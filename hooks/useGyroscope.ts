import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

const degToRad = Math.PI / 180;

// Three.js helper vectors/quaternions for device orientation
const zee = new THREE.Vector3(0, 0, 1);
const euler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90 deg X rotation

export const useGyroscope = () => {
  const [isGyroSupported, setIsGyroSupported] = useState<boolean>(false);
  const [isGyroEnabled, setIsGyroEnabled] = useState<boolean>(true);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [hasReceivedData, setHasReceivedData] = useState<boolean>(false);

  // Camera Quaternion ref used directly by R3F frame loop
  const cameraQuaternionRef = useRef<THREE.Quaternion>(new THREE.Quaternion());

  // Calibration quaternion
  const calibrationQuatRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const rawDeviceQuatRef = useRef<THREE.Quaternion>(new THREE.Quaternion());

  // Mouse / Touch drag look offset
  const dragPitchRef = useRef<number>(0);
  const dragYawRef = useRef<number>(0);

  // Pointer drag state
  const isDraggingRef = useRef<boolean>(false);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 1. Detect Support & iOS Permissions
  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    setIsGyroSupported(supported);

    // If DeviceOrientationEvent exists and doesn't require permission request (Android / older iOS), mark permission granted
    if (supported && typeof (DeviceOrientationEvent as any).requestPermission !== 'function') {
      setHasPermission(true);
    }
  }, []);

  // 2. iOS Request Permission function
  const requestGyroPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      return false;
    }

    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          setHasPermission(true);
          return true;
        } else {
          setHasPermission(false);
          return false;
        }
      } catch (err) {
        console.warn("Failed to request DeviceOrientation permission:", err);
        setHasPermission(false);
        return false;
      }
    } else {
      setHasPermission(true);
      return true;
    }
  }, []);

  // 3. Calibrate Gyroscope (set current device direction as forward view)
  const calibrateGyro = useCallback(() => {
    // Save inverse of current raw device quaternion as calibration baseline
    calibrationQuatRef.current.copy(rawDeviceQuatRef.current).invert();
    // Also reset manual drag pitch & yaw
    dragPitchRef.current = 0;
    dragYawRef.current = 0;
  }, []);

  // 4. DeviceOrientation Event Listener
  useEffect(() => {
    if (!isGyroSupported || !isGyroEnabled || !hasPermission) return;

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha === null || event.beta === null || event.gamma === null) return;

      if (!hasReceivedData) {
        setHasReceivedData(true);
      }

      const alpha = event.alpha ? event.alpha : 0; // 0..360
      const beta = event.beta ? event.beta : 0;   // -180..180
      const gamma = event.gamma ? event.gamma : 0; // -90..90

      const screenOrient = window.orientation || window.screen?.orientation?.angle || 0;

      // Compute raw device quaternion
      euler.set(beta * degToRad, alpha * degToRad, -gamma * degToRad, 'YXZ');
      const currentQuat = new THREE.Quaternion();
      currentQuat.setFromEuler(euler);
      currentQuat.multiply(q1);
      currentQuat.multiply(q0.setFromAxisAngle(zee, -Number(screenOrient) * degToRad));

      rawDeviceQuatRef.current.copy(currentQuat);

      // Apply calibration baseline
      const calibratedDeviceQuat = calibrationQuatRef.current.clone().multiply(currentQuat);

      // Apply drag look pitch/yaw
      const dragQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(dragPitchRef.current, dragYawRef.current, 0, 'YXZ')
      );

      // Combine calibrated device orientation + manual drag offset
      const finalQuat = dragQuat.multiply(calibratedDeviceQuat);
      cameraQuaternionRef.current.copy(finalQuat);
    };

    window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
    };
  }, [isGyroSupported, isGyroEnabled, hasPermission, hasReceivedData]);

  // 5. Fallback & Additive Pointer Drag (Mouse / Touch Look)
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      // Ignore clicks on UI elements like buttons or inputs
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input'))) {
        return;
      }

      isDraggingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - lastPointerRef.current.x;
      const deltaY = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      const SENSITIVITY = 0.003;
      dragYawRef.current -= deltaX * SENSITIVITY;
      dragPitchRef.current -= deltaY * SENSITIVITY;

      // Clamp pitch to avoid flipping upside down (-85 deg to +85 deg)
      const maxPitch = Math.PI / 2 - 0.05;
      dragPitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, dragPitchRef.current));

      // If gyro is disabled or no gyro data received yet, update camera quaternion purely from drag
      if (!isGyroEnabled || !hasReceivedData) {
        const dragQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(dragPitchRef.current, dragYawRef.current, 0, 'YXZ')
        );
        cameraQuaternionRef.current.copy(dragQuat);
      }
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isGyroEnabled, hasReceivedData]);

  return {
    isGyroSupported,
    isGyroEnabled,
    setIsGyroEnabled,
    hasPermission,
    hasReceivedData,
    cameraQuaternionRef,
    requestGyroPermission,
    calibrateGyro
  };
};

export default useGyroscope;
