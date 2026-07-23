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
  const [isAutoWalking, setIsAutoWalking] = useState<boolean>(false);
  const [tiltAngle, setTiltAngle] = useState<number>(0);

  const lastStepTimestampRef = useRef<number>(0);
  const baselineMagRef = useRef<number>(9.81);
  const isWalkingPressedRef = useRef<boolean>(false);

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
    setLastStepTime(performance.now());

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
    const supported = typeof window !== 'undefined' && ('DeviceMotionEvent' in window || 'DeviceOrientationEvent' in window);
    setIsMotionSupported(supported);

    if (supported && typeof (DeviceMotionEvent as any).requestPermission !== 'function') {
      setHasMotionPermission(true);
    }
  }, []);

  const requestMotionPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    let granted = true;

    // DeviceMotionEvent permission (iOS 13+)
    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        if (response !== 'granted') granted = false;
      } catch (err) {
        console.warn('DeviceMotion permission error:', err);
        granted = false;
      }
    }

    // DeviceOrientationEvent permission (iOS 13+)
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response !== 'granted') granted = false;
      } catch (err) {
        console.warn('DeviceOrientation permission error:', err);
      }
    }

    setHasMotionPermission(granted);
    return granted;
  }, []);

  // Motion event listener for step detection & magnitude impulse
  useEffect(() => {
    if (!enabled || gameStatus !== 'PLAYING') return;

    const STEP_COOLDOWN_MS = 320; // Min time between physical steps
    const IMPULSE_THRESHOLD = 1.15; // m/s^2 deviation from moving baseline

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      const now = performance.now();

      let ax = 0, ay = 0, az = 0;
      let isGravityIncluded = false;

      if (event.acceleration && event.acceleration.x !== null && event.acceleration.x !== undefined) {
        ax = event.acceleration.x || 0;
        ay = event.acceleration.y || 0;
        az = event.acceleration.z || 0;
      } else if (event.accelerationIncludingGravity && event.accelerationIncludingGravity.x !== null) {
        ax = event.accelerationIncludingGravity.x || 0;
        ay = event.accelerationIncludingGravity.y || 0;
        az = event.accelerationIncludingGravity.z || 0;
        isGravityIncluded = true;
      } else {
        return;
      }

      const currentMag = Math.sqrt(ax * ax + ay * ay + az * az);

      // Update baseline magnitude with exponential smoothing (alpha = 0.05)
      const alpha = 0.05;
      if (isGravityIncluded) {
        baselineMagRef.current = baselineMagRef.current * (1 - alpha) + currentMag * alpha;
      } else {
        baselineMagRef.current = baselineMagRef.current * (1 - alpha) + 0;
      }

      const impulse = Math.abs(currentMag - baselineMagRef.current);

      if (impulse > IMPULSE_THRESHOLD && (now - lastStepTimestampRef.current > STEP_COOLDOWN_MS)) {
        lastStepTimestampRef.current = now;
        triggerForwardStep(0.85); // Walk forward 0.85m
      }
    };

    // Device Orientation tilt forward detector
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta !== null && event.beta !== undefined) {
        setTiltAngle(event.beta);
      }
    };

    window.addEventListener('devicemotion', handleDeviceMotion, true);
    window.addEventListener('deviceorientation', handleDeviceOrientation, true);

    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion, true);
      window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
    };
  }, [enabled, gameStatus, triggerForwardStep]);

  // Tilt forward walking timer (if phone is pitched forward < 15deg when held)
  useEffect(() => {
    if (!enabled || gameStatus !== 'PLAYING') return;

    // Check if phone is tilted forward significantly (e.g. beta < 15 or beta > 140 depending on hold)
    const isTiltedForward = (tiltAngle > 120 || tiltAngle < 15) && tiltAngle !== 0;

    if (!isTiltedForward && !isAutoWalking && !isWalkingPressedRef.current) return;

    const interval = setInterval(() => {
      const now = performance.now();
      if (now - lastStepTimestampRef.current > 380) {
        lastStepTimestampRef.current = now;
        triggerForwardStep(0.75);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [enabled, gameStatus, tiltAngle, isAutoWalking, triggerForwardStep]);

  return {
    stepCount,
    lastStepTime,
    isMotionSupported,
    hasMotionPermission,
    requestMotionPermission,
    triggerForwardStep,
    isAutoWalking,
    setIsAutoWalking
  };
};

