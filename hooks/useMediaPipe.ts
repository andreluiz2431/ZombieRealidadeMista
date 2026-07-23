/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

// Mapping 2D normalized coordinates to 3D game world.
const mapHandToWorld = (x: number, y: number): THREE.Vector3 => {
  const GAME_X_RANGE = 5; 
  const GAME_Y_RANGE = 3.5;
  const Y_OFFSET = 0.8;

  // MediaPipe often returns mirrored X if facingMode is 'user'.
  // We might need to invert X depending on the final behavior.
  // For now, assuming standard mirroring where 0 is left-screen (user's right hand physically if mirrored).
  const worldX = (0.5 - x) * GAME_X_RANGE; 
  const worldY = (1.0 - y) * GAME_Y_RANGE - (GAME_Y_RANGE / 2) + Y_OFFSET;

  const worldZ = -Math.max(0, worldY * 0.2);

  return new THREE.Vector3(worldX, Math.max(0.1, worldY), worldZ);
};

export const useMediaPipe = (videoRef: React.RefObject<HTMLVideoElement | null>) => {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const handPositionsRef = useRef<{
    left: THREE.Vector3 | null;
    right: THREE.Vector3 | null;
    lastLeft: THREE.Vector3 | null;
    lastRight: THREE.Vector3 | null;
    leftVelocity: THREE.Vector3;
    rightVelocity: THREE.Vector3;
    lastTimestamp: number;
  }>({
    left: null,
    right: null,
    lastLeft: null,
    lastRight: null,
    leftVelocity: new THREE.Vector3(0,0,0),
    rightVelocity: new THREE.Vector3(0,0,0),
    lastTimestamp: 0
  });

  // To expose raw results for UI preview
  const lastResultsRef = useRef<HandLandmarkerResult | null>(null);

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const currentStreamRef = useRef<MediaStream | null>(null);

  // 1. Initialize MediaPipe Model ONCE on mount
  useEffect(() => {
    let isActive = true;

    const setupMediaPipeModel = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );

        if (!isActive) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        if (!isActive) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setIsModelLoaded(true);
      } catch (err: any) {
        console.error("Error initializing MediaPipe model:", err);
        setError(`Failed to load hand tracking model: ${err.message}`);
      }
    };

    setupMediaPipeModel();

    return () => {
      isActive = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  // 2. Camera Switch Handler
  const switchCamera = async (targetMode?: 'user' | 'environment') => {
    setIsCameraReady(false);

    // If we have enumerated multiple video devices
    if (videoDevices.length > 1) {
      const currentIndex = videoDevices.findIndex(d => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      const nextDevice = videoDevices[nextIndex];

      setSelectedDeviceId(nextDevice.deviceId);

      const label = nextDevice.label.toLowerCase();
      if (label.includes('back') || label.includes('rear') || label.includes('traseira') || label.includes('environment')) {
        setFacingMode('environment');
      } else if (label.includes('front') || label.includes('user') || label.includes('frontal') || label.includes('selfie')) {
        setFacingMode('user');
      } else {
        setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
      }
    } else {
      // Direct toggle facingMode
      const nextMode = targetMode || (facingMode === 'user' ? 'environment' : 'user');
      setSelectedDeviceId(null);
      setFacingMode(nextMode);
    }
  };

  // 3. Start Camera Stream whenever model is loaded or camera selection changes
  useEffect(() => {
    if (!isModelLoaded) return;

    let isActive = true;

    const stopCurrentCamera = () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = 0;
      }
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach((track) => track.stop());
        currentStreamRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    };

    const startCameraStream = async () => {
      stopCurrentCamera();
      setIsCameraReady(false);

      let stream: MediaStream | null = null;

      // Try multiple constraint combinations in order of precision
      const constraintAttempts: MediaStreamConstraints[] = [];

      if (selectedDeviceId) {
        constraintAttempts.push({
          video: { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
        });
      }

      constraintAttempts.push(
        {
          video: { facingMode: { exact: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } }
        },
        {
          video: { facingMode: facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
        },
        {
          video: { width: { ideal: 640 }, height: { ideal: 480 } }
        },
        {
          video: true
        }
      );

      for (const constraints of constraintAttempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream && stream.getVideoTracks().length > 0) {
            break;
          }
        } catch (e) {
          console.warn("Camera constraint attempt failed, trying fallback...", constraints, e);
        }
      }

      if (!stream || !isActive) {
        if (stream) stream.getTracks().forEach(t => t.stop());
        setError("Não foi possível acessar a câmera selecionada.");
        return;
      }

      currentStreamRef.current = stream;

      // Enumerate available devices for smart switching
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const vDevices = allDevices.filter(d => d.kind === 'videoinput');
        setVideoDevices(vDevices);

        // Update active deviceId if not set
        const activeTrack = stream.getVideoTracks()[0];
        const activeSettings = activeTrack.getSettings();
        if (activeSettings.deviceId && !selectedDeviceId) {
          setSelectedDeviceId(activeSettings.deviceId);
        }
      } catch (e) {
        console.warn("Could not enumerate camera devices:", e);
      }

      if (videoRef.current && isActive) {
        const video = videoRef.current;
        video.srcObject = stream;

        try {
          await video.play();
        } catch (playErr) {
          console.warn("Video play error (retry on loadeddata):", playErr);
        }

        video.onloadeddata = () => {
          if (isActive) {
            setIsCameraReady(true);
            predictWebcam();
          }
        };

        // Fallback if onloadeddata already fired or doesn't trigger
        if (video.readyState >= 2 && isActive) {
          setIsCameraReady(true);
          predictWebcam();
        }
      }
    };

    const predictWebcam = () => {
      if (!videoRef.current || !landmarkerRef.current || !isActive) return;

      const video = videoRef.current;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        let startTimeMs = performance.now();
        try {
          const results = landmarkerRef.current.detectForVideo(video, startTimeMs);
          lastResultsRef.current = results;
          processResults(results);
        } catch (e) {
          // Detection warning frame skip
        }
      }

      requestRef.current = requestAnimationFrame(predictWebcam);
    };

    const processResults = (results: HandLandmarkerResult) => {
      const now = performance.now();
      const deltaTime = (now - handPositionsRef.current.lastTimestamp) / 1000;
      handPositionsRef.current.lastTimestamp = now;

      let newLeft: THREE.Vector3 | null = null;
      let newRight: THREE.Vector3 | null = null;

      if (results.landmarks) {
        for (let i = 0; i < results.landmarks.length; i++) {
          const landmarks = results.landmarks[i];
          const classification = results.handedness[i][0];
          const isRight = classification.categoryName === 'Right';

          const tip = landmarks[8];
          const worldPos = mapHandToWorld(tip.x, tip.y);

          if (isRight) {
            newRight = worldPos;
          } else {
            newLeft = worldPos;
          }
        }
      }

      const s = handPositionsRef.current;
      const LERP = 0.6;

      if (newLeft) {
        if (s.left) {
          newLeft.lerpVectors(s.left, newLeft, LERP);
          if (deltaTime > 0.001) {
            s.leftVelocity.subVectors(newLeft, s.left).divideScalar(deltaTime);
          }
        }
        s.lastLeft = s.left ? s.left.clone() : newLeft.clone();
        s.left = newLeft;
      } else {
        s.left = null;
      }

      if (newRight) {
        if (s.right) {
          newRight.lerpVectors(s.right, newRight, LERP);
          if (deltaTime > 0.001) {
            s.rightVelocity.subVectors(newRight, s.right).divideScalar(deltaTime);
          }
        }
        s.lastRight = s.right ? s.right.clone() : newRight.clone();
        s.right = newRight;
      } else {
        s.right = null;
      }
    };

    startCameraStream();

    return () => {
      isActive = false;
      stopCurrentCamera();
    };
  }, [isModelLoaded, videoRef, facingMode, selectedDeviceId]);

  return {
    isCameraReady,
    isModelLoaded,
    handPositionsRef,
    lastResultsRef,
    error,
    facingMode,
    videoDevices,
    switchCamera
  };
};
