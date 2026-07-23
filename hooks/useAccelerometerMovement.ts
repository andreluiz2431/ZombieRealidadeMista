import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

interface UseAccelerometerMovementProps {
  enabled: boolean;
  gameStatus: string;
  cameraQuaternionRef: React.RefObject<THREE.Quaternion>;
  onStep: (stepVector: { dx: number; dz: number }) => void;
}

export const useAccelerometerMovement = ({
  enabled,
  gameStatus,
  cameraQuaternionRef,
  onStep
}: UseAccelerometerMovementProps) => {
  const [stepCount, setStepCount] = useState<number>(0);
  const [lastStepTime, setLastStepTime] = useState<number>(0);
  const [hasMotionPermission, setHasMotionPermission] = useState<boolean>(false);
  const [isMotionSupported, setIsMotionSupported] = useState<boolean>(false);

  const lastStepTimestampRef = useRef<number>(0);
  const lastAccelRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

  // Manual step trigger function (e.g. from button tap or auto-walk loop)
  const triggerForwardStep = useCallback((stepDistance: number = 0.85) => {
    if (!cameraQuaternionRef.current) return;

    // Get forward direction from camera quaternion
    const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuaternionRef.current);

    // Normalize in XZ plane
    const xzLen = Math.sqrt(forwardVec.x * forwardVec.x + forwardVec.z * forwardVec.z);
    if (xzLen < 0.0001) return;

    const dx = (forwardVec.x / xzLen) * stepDistance;
    const dz = (forwardVec.z / xzLen) * stepDistance;

    onStep({ dx, dz });
    setStepCount((c) => c + 1);

    // Haptic feedback if available on mobile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(25);
      } catch (e) {
        // ignore
      }
    }
  }, [cameraQuaternionRef, onStep]);

  // Check support & iOS permission
  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
    setIsMotionSupported(supported);

    if (supported && typeof (DeviceMotionEvent as any).requestPermission !== 'function') {
      setHasMotionPermission(true);
    }
  }, []);

  const requestMotionPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      return false;
    }

    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        if (response === 'granted') {
          setHasMotionPermission(true);
          return true;
        } else {
          setHasMotionPermission(false);
          return false;
        }
      } catch (err) {
        console.warn('DeviceMotion permission request error:', err);
        return false;
      }
    } else {
      setHasMotionPermission(true);
      return true;
    }
  }, []);

  // Motion event listener for step detection
  useEffect(() => {
    if (!enabled || gameStatus !== 'PLAYING' || !isMotionSupported) return;

    const STEP_COOLDOWN_MS = 380; // Min time between physical step detections
    const ACCEL_THRESHOLD = 2.2;  // m/s^2 delta threshold for step peak

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      const now = performance.now();
      if (now - lastStepTimestampRef.current < STEP_COOLDOWN_MS) return;

      let ax = 0, ay = 0, az = 0;

      if (event.acceleration && (event.acceleration.x !== null)) {
        ax = event.acceleration.x || 0;
        ay = event.acceleration.y || 0;
        az = event.acceleration.z || 0;
      } else if (event.accelerationIncludingGravity && (event.accelerationIncludingGravity.x !== null)) {
        ax = event.accelerationIncludingGravity.x || 0;
        ay = event.accelerationIncludingGravity.y || 0;
        az = event.accelerationIncludingGravity.z || 0;
      } else {
        return;
      }

      // Compute acceleration magnitude delta compared to previous frame
      const deltaX = ax - lastAccelRef.current.x;
      const deltaY = ay - lastAccelRef.current.y;
      const deltaZ = az - lastAccelRef.current.z;
      const deltaAccel = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

      lastAccelRef.current = { x: ax, y: ay, z: az };

      if (deltaAccel > ACCEL_THRESHOLD) {
        lastStepTimestampRef.current = now;
        setLastStepTime(now);
        triggerForwardStep(0.9); // Step forward 0.9 meters
      }
    };

    window.addEventListener('devicemotion', handleDeviceMotion);
    return () => window.removeEventListener('devicemotion', handleDeviceMotion);
  }, [enabled, gameStatus, isMotionSupported, triggerForwardStep]);

  return {
    stepCount,
    lastStepTime,
    isMotionSupported,
    hasMotionPermission,
    requestMotionPermission,
    triggerForwardStep
  };
};
