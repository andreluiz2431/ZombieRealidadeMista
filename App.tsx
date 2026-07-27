/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { GameStatus, PlayerWorldPos, ZombieData, HouseData, RemotePlayer, GPSCoords, DamageTextData } from './types';
import { useMediaPipe } from './hooks/useMediaPipe';
import { useFullscreen } from './hooks/useFullscreen';
import { useGyroscope } from './hooks/useGyroscope';
import { useAccelerometerMovement } from './hooks/useAccelerometerMovement';
import GameScene from './components/GameScene';
import WebcamPreview from './components/WebcamPreview';
import { RadarHUD } from './components/RadarHUD';
import { VirtualJoystick } from './components/VirtualJoystick';
import { gpsToWorldCoords } from './utils/gps';
import { multiplayerEngine } from './utils/multiplayer';
import { soundEngine } from './utils/soundEngine';
import { resolvePlayerCollision, isPositionColliding } from './utils/environmentData';
import * as THREE from 'three';
import {
  ShieldCheck,
  Zap,
  MapPin,
  Users,
  Compass,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Navigation,
  Crosshair,
  Skull,
  Maximize,
  Minimize,
  Smartphone,
  Eye,
  EyeOff,
  RefreshCw,
  Glasses,
  Camera,
  SwitchCamera,
  Footprints,
  Activity,
  BookOpen,
  Info,
  LogOut,
  FlipHorizontal,
  ZoomIn,
  Gamepad2,
  Move,
  Trophy,
  Award,
  TrendingUp,
  Star
} from 'lucide-react';

// Default Safe House Shelters around origin
const DEFAULT_HOUSES: HouseData[] = [
  {
    id: 'house-alpha',
    name: 'Casa Segura Alfa',
    x: 12,
    z: -14,
    width: 6,
    depth: 6,
    height: 4,
    radius: 7,
    color: '#0f766e'
  },
  {
    id: 'house-bravo',
    name: 'Abrigo Bravo',
    x: -22,
    z: 20,
    width: 8,
    depth: 7,
    height: 4.5,
    radius: 8.5,
    color: '#0369a1'
  },
  {
    id: 'house-gamma',
    name: 'Bunker Charlie',
    x: 28,
    z: 32,
    width: 7,
    depth: 8,
    height: 5,
    radius: 9,
    color: '#15803d'
  }
];

export const MAX_PLAYER_HEALTH = 300;

export const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOADING);
  const [health, setHealth] = useState(MAX_PLAYER_HEALTH);
  const [kills, setKills] = useState(0);
  const [wave, setWave] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // GPS State
  const [originGps, setOriginGps] = useState<{ lat: number; lng: number } | null>(null);
  const [currentGps, setCurrentGps] = useState<GPSCoords | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [useVirtualGps, setUseVirtualGps] = useState(false);

  // Player World Position (playerPos is smoothly lerped towards targetPlayerPosRef)
  const playerPosRef = useRef<PlayerWorldPos>({ x: 0, y: 0, z: 0 });
  const targetPlayerPosRef = useRef<PlayerWorldPos>({ x: 0, y: 0, z: 0 });
  const [playerPos, setPlayerPos] = useState<PlayerWorldPos>({ x: 0, y: 0, z: 0 });

  // Joystick Mode State (Left thumbstick on-screen)
  const [useJoystick, setUseJoystick] = useState<boolean>(false);
  const joystickVectorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Safe Zone Status
  const [isPlayerInSafeZone, setIsPlayerInSafeZone] = useState(false);
  const [currentSafeHouse, setCurrentSafeHouse] = useState<HouseData | null>(null);

  // Zombies & World Objects
  const [zombies, setZombies] = useState<ZombieData[]>([]);
  const [houses] = useState<HouseData[]>(DEFAULT_HOUSES);

  // Score, Player Level & Damage Boost System
  const [score, setScore] = useState<number>(0);
  const [damageTexts, setDamageTexts] = useState<DamageTextData[]>([]);
  const [levelUpNotice, setLevelUpNotice] = useState<{ visible: boolean; level: number }>({ visible: false, level: 1 });

  // Player Level: Each 200 points = +1 Level. Level 1 starts at 0 points.
  const playerLevel = Math.floor(score / 200) + 1;
  const damageMultiplier = 1 + (playerLevel - 1) * 0.08;
  const damageBonusPercent = Math.round((playerLevel - 1) * 8);
  const xpInCurrentLevel = score % 200;

  // Level up detection and banner audio effect
  const prevLevelRef = useRef<number>(1);
  useEffect(() => {
    if (gameStatus === GameStatus.PLAYING && playerLevel > prevLevelRef.current) {
      soundEngine.playLevelUp();
      setLevelUpNotice({ visible: true, level: playerLevel });
      const timer = setTimeout(() => {
        setLevelUpNotice({ visible: false, level: playerLevel });
      }, 3500);
      prevLevelRef.current = playerLevel;
      return () => clearTimeout(timer);
    }
    if (gameStatus === GameStatus.IDLE) {
      prevLevelRef.current = 1;
    }
  }, [playerLevel, gameStatus]);

  // Multiplayer State
  const [roomId, setRoomId] = useState('apocalypse-sp');
  const [playerName, setPlayerName] = useState(() => `Sobrevivente_${Math.floor(1000 + Math.random() * 9000)}`);
  const [remotePlayers, setRemotePlayers] = useState<RemotePlayer[]>([]);

  // VR Stereoscopic (Google Cardboard) Mode State
  const [isStereoVR, setIsStereoVR] = useState<boolean>(false);

  // Toggle Joystick Mode helper (disables Cardboard when Joystick is active)
  const toggleJoystickMode = (active: boolean) => {
    setUseJoystick(active);
    if (active) {
      setIsStereoVR(false); // VR Cardboard requires hands-free, so disable when joystick is active
    }
  };

  // Video Ref & MediaPipe Hook
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraPreviewVisible, setIsCameraPreviewVisible] = useState<boolean>(true);
  const {
    isCameraReady,
    handPositionsRef,
    lastResultsRef,
    error: cameraError,
    facingMode,
    videoDevices,
    selectedDeviceId,
    isCameraMirrored,
    setIsCameraMirrored,
    switchCamera,
    selectUltraWideCamera
  } = useMediaPipe(videoRef);

  // Exit Room / Return to Menu
  const exitRoom = () => {
    setGameStatus(GameStatus.IDLE);
    setHealth(MAX_PLAYER_HEALTH);
    setKills(0);
    setWave(1);
    setScore(0);
    setDamageTexts([]);
    setLevelUpNotice({ visible: false, level: 1 });
    prevLevelRef.current = 1;
    resetStepCount();
    setIsAutoWalking(false);
    playerPosRef.current = { x: 0, y: 0, z: 0 };
    targetPlayerPosRef.current = { x: 0, y: 0, z: 0 };
    setPlayerPos({ x: 0, y: 0, z: 0 });
  };

  // Fullscreen & Gyroscope Hooks
  const { isFullscreen, isSupported: isFullscreenSupported, toggleFullscreen, requestFullscreen } = useFullscreen();
  const {
    isGyroSupported,
    isGyroEnabled,
    setIsGyroEnabled,
    hasPermission: hasGyroPermission,
    cameraQuaternionRef,
    requestGyroPermission,
    calibrateGyro
  } = useGyroscope();

  // Movement Mode State ('accelerometer' or 'gps')
  const [movementMode, setMovementMode] = useState<'accelerometer' | 'gps'>('accelerometer');

  // Accelerometer step movement handler (moves target position; lerped smoothly below)
  const handleAccelerometerStep = useCallback(({ dx, dz }: { dx: number; dz: number }) => {
    if (useJoystick) return; // Joystick takes over movement when enabled
    const proposedX = targetPlayerPosRef.current.x + dx;
    const proposedZ = targetPlayerPosRef.current.z + dz;
    const safeTarget = resolvePlayerCollision(
      targetPlayerPosRef.current.x,
      targetPlayerPosRef.current.z,
      proposedX,
      proposedZ,
      0.5
    );
    targetPlayerPosRef.current.x = safeTarget.x;
    targetPlayerPosRef.current.z = safeTarget.z;
    soundEngine.playFootstep();
  }, [useJoystick]);

  const {
    stepCount,
    setStepCount,
    resetStepCount,
    isMotionSupported,
    hasMotionPermission,
    requestMotionPermission,
    triggerForwardStep,
    isAutoWalking,
    setIsAutoWalking
  } = useAccelerometerMovement({
    enabled: movementMode === 'accelerometer' && !useJoystick,
    gameStatus,
    cameraQuaternionRef,
    onStep: handleAccelerometerStep
  });

  // -------------------------------------------------------------
  // Smooth Player Movement Animation Loop (Lerping playerPosRef -> targetPlayerPosRef & Joystick)
  // -------------------------------------------------------------
  useEffect(() => {
    if (gameStatus !== GameStatus.PLAYING) return;

    let animId: number;
    let lastTime = performance.now();

    const updateMovementLoop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Handle Virtual Joystick Locomotion (if active & thumbstick displaced)
      if (useJoystick && (joystickVectorRef.current.x !== 0 || joystickVectorRef.current.y !== 0)) {
        const jx = joystickVectorRef.current.x; // > 0 right, < 0 left
        const jy = joystickVectorRef.current.y; // < 0 up (forward), > 0 down (backward)

        const JOYSTICK_SPEED = 2.2; // Smooth, natural walking speed (2.2 m/s)

        // Determine orientation from camera orientation or default world
        let fX = 0, fZ = -1;
        let rX = 1, rZ = 0;

        if (cameraQuaternionRef.current) {
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuaternionRef.current);
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraQuaternionRef.current);

          const fLen = Math.hypot(forward.x, forward.z);
          const rLen = Math.hypot(right.x, right.z);

          if (fLen > 0.001) {
            fX = forward.x / fLen;
            fZ = forward.z / fLen;
          }
          if (rLen > 0.001) {
            rX = right.x / rLen;
            rZ = right.z / rLen;
          }
        }

        // Pushing UP (jy < 0) moves FORWARD into camera view direction
        const forwardFactor = -jy;
        const sideFactor = jx;

        const moveDX = (rX * sideFactor + fX * forwardFactor) * JOYSTICK_SPEED * dt;
        const moveDZ = (rZ * sideFactor + fZ * forwardFactor) * JOYSTICK_SPEED * dt;

        const proposedX = targetPlayerPosRef.current.x + moveDX;
        const proposedZ = targetPlayerPosRef.current.z + moveDZ;

        const safeTarget = resolvePlayerCollision(
          targetPlayerPosRef.current.x,
          targetPlayerPosRef.current.z,
          proposedX,
          proposedZ,
          0.5
        );

        targetPlayerPosRef.current.x = safeTarget.x;
        targetPlayerPosRef.current.z = safeTarget.z;
      }

      // Smoothly lerp playerPosRef towards targetPlayerPosRef with collision safety
      const curr = playerPosRef.current;
      const target = targetPlayerPosRef.current;

      const dx = target.x - curr.x;
      const dz = target.z - curr.z;
      const dist = Math.hypot(dx, dz);

      let nextX = curr.x;
      let nextZ = curr.z;

      if (dist > 0.0001) {
        const lerpFactor = Math.min(1, dt * 10);
        nextX += dx * lerpFactor;
        nextZ += dz * lerpFactor;
      } else {
        nextX = target.x;
        nextZ = target.z;
      }

      const safeNext = resolvePlayerCollision(curr.x, curr.z, nextX, nextZ, 0.5);
      curr.x = safeNext.x;
      curr.z = safeNext.z;

      setPlayerPos({ x: curr.x, y: curr.y, z: curr.z });

      animId = requestAnimationFrame(updateMovementLoop);
    };

    animId = requestAnimationFrame(updateMovementLoop);
    return () => cancelAnimationFrame(animId);
  }, [gameStatus, useJoystick, cameraQuaternionRef]);

  // -------------------------------------------------------------
  // 1. GPS Tracking System
  // -------------------------------------------------------------
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS não suportado neste navegador. Ativando modo virtual.");
      setUseVirtualGps(true);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: GPSCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp
        };

        setCurrentGps(coords);

        // Calibrate origin if first reading
        setOriginGps((prev) => {
          if (!prev) {
            return { lat: coords.latitude, lng: coords.longitude };
          }
          return prev;
        });

        // Update player world position if origin exists, not in manual override, and in GPS mode
        if (originGps && !useVirtualGps && movementMode === 'gps' && !useJoystick) {
          const wPos = gpsToWorldCoords(originGps.lat, originGps.lng, coords.latitude, coords.longitude);
          targetPlayerPosRef.current = wPos;
        }
      },
      (err) => {
        console.warn("Erro no GPS:", err);
        setGpsError("GPS indisponível ou permissão negada. Use os controles virtuais/teclado.");
        setUseVirtualGps(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [originGps, useVirtualGps, movementMode, useJoystick]);

  // Keyboard movement for testing play
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStatus !== GameStatus.PLAYING) return;
      const STEP = 1.2;

      let dx = 0, dz = 0;
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') dz -= STEP;
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') dz += STEP;
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') dx -= STEP;
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') dx += STEP;

      if (dx !== 0 || dz !== 0) {
        const proposedX = targetPlayerPosRef.current.x + dx;
        const proposedZ = targetPlayerPosRef.current.z + dz;
        const safeTarget = resolvePlayerCollision(
          targetPlayerPosRef.current.x,
          targetPlayerPosRef.current.z,
          proposedX,
          proposedZ,
          0.5
        );
        targetPlayerPosRef.current.x = safeTarget.x;
        targetPlayerPosRef.current.z = safeTarget.z;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStatus]);

  // -------------------------------------------------------------
  // 2. Safe House Checking & Health Regeneration
  // -------------------------------------------------------------
  useEffect(() => {
    let inSafe = false;
    let foundHouse: HouseData | null = null;

    for (const house of houses) {
      const dx = playerPos.x - house.x;
      const dz = playerPos.z - house.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= house.radius) {
        inSafe = true;
        foundHouse = house;
        break;
      }
    }

    if (inSafe !== isPlayerInSafeZone) {
      setIsPlayerInSafeZone(inSafe);
      setCurrentSafeHouse(foundHouse);
      if (inSafe) {
        soundEngine.playSafeZoneChime();
      }
    }
  }, [playerPos, houses, isPlayerInSafeZone]);

  // Safe zone ref sync for zombie AI loop
  const isPlayerInSafeZoneRef = useRef(isPlayerInSafeZone);
  useEffect(() => {
    isPlayerInSafeZoneRef.current = isPlayerInSafeZone;
  }, [isPlayerInSafeZone]);

  // Health Regeneration System (Rapid inside Safe House, slow passive outside)
  useEffect(() => {
    if (gameStatus !== GameStatus.PLAYING) return;

    const interval = setInterval(() => {
      setHealth((h) => {
        if (h >= MAX_PLAYER_HEALTH) return h;
        const regenAmount = isPlayerInSafeZone ? 15 : 2; // +15 HP/s in shelter, +2 HP/s passive
        return Math.min(MAX_PLAYER_HEALTH, h + regenAmount);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlayerInSafeZone, gameStatus]);

  // -------------------------------------------------------------
  // 3. Zombie Wave & AI System (Proximity Chasing & Random Wandering)
  // -------------------------------------------------------------
  const spawnZombieWave = useCallback((waveNum: number) => {
    const newZombies: ZombieData[] = [];
    const count = 3 + waveNum;
    const pPos = playerPosRef.current;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Spawn at active wave distance (10 to 16 meters)
      const dist = 10 + Math.random() * 6;
      const x = pPos.x + Math.sin(angle) * dist;
      const z = pPos.z + Math.cos(angle) * dist;

      const rand = Math.random();
      const type: 'walker' | 'runner' | 'brute' = rand > 0.8 ? 'runner' : rand > 0.92 ? 'brute' : 'walker';
      const maxHealth = type === 'brute' ? 200 : type === 'runner' ? 60 : 100;
      const speed = type === 'runner' ? 2.6 : type === 'brute' ? 1.2 : 1.6;
      const initialRotation = Math.atan2(pPos.x - x, pPos.z - z);

      newZombies.push({
        id: `zombie-${waveNum}-${i}-${Date.now()}`,
        x,
        y: 0,
        z,
        health: maxHealth,
        maxHealth,
        speed,
        type,
        state: 'chasing', // Spawn actively chasing the player as in standard wave survival
        rotation: initialRotation,
        damage: type === 'brute' ? 20 : 10,
        wanderAngle: initialRotation,
        wanderTimer: 1 + Math.random() * 3
      });
    }

    setZombies(newZombies);
  }, []);

  // Zombie Movement & AI Frame Loop
  useEffect(() => {
    if (gameStatus !== GameStatus.PLAYING) return;

    const interval = setInterval(() => {
      setZombies((prevZombies) => {
        let aliveCount = 0;
        const currentP = playerPosRef.current;
        const inSafeZone = isPlayerInSafeZoneRef.current;

        const updated = prevZombies.map((z) => {
          if (z.state === 'dead') return z;
          aliveCount++;

          const dx = currentP.x - z.x;
          const dz = currentP.z - z.z;
          const distToPlayer = Math.hypot(dx, dz);
          const angleToPlayer = Math.atan2(dx, dz);

          let state: 'idle' | 'chasing' | 'attacking' | 'hit' | 'dead' = z.state;
          let wanderAngle = z.wanderAngle ?? Math.random() * Math.PI * 2;
          let wanderTimer = (z.wanderTimer ?? 2) - 0.15; // interval is 150ms

          // Detection & Pursuit Triggers (Halved):
          // 1. Idle zombies spot player within 7.5 meters (or 10.5 meters if facing player)
          // 2. Chasing zombies continue tracking player up to 16.25 meters away
          const angleDiff = Math.abs(z.rotation - angleToPlayer);
          const isFacingPlayer = angleDiff < 1.5 || angleDiff > (Math.PI * 2 - 1.5);
          const isTriggered = distToPlayer <= 7.5 || (distToPlayer <= 10.5 && isFacingPlayer) || z.state === 'hit';

          if (state === 'idle') {
            if (isTriggered && !inSafeZone) {
              state = 'chasing'; // Zombie spots player!
            }
          } else if (state === 'chasing' || state === 'attacking' || state === 'hit') {
            if (inSafeZone) {
              if (distToPlayer > 6.0) {
                state = 'idle';
                wanderAngle = angleToPlayer + Math.PI; // Return to wandering away from shelter
              } else {
                state = 'chasing';
              }
            } else if (distToPlayer <= 2.2) {
              state = 'attacking';
            } else if (distToPlayer > 16.25) {
              // Player escaped (over 16.25 meters away)
              state = 'idle';
            } else {
              state = 'chasing';
            }
          }

          let newX = z.x;
          let newZ = z.z;
          let newRotation = z.rotation;

          if (state === 'chasing' || state === 'attacking') {
            const moveSpeed = z.speed * 0.15;
            // Hold outside safe house perimeter
            if (!inSafeZone || distToPlayer >= 8) {
              newX = z.x + Math.sin(angleToPlayer) * moveSpeed;
              newZ = z.z + Math.cos(angleToPlayer) * moveSpeed;
            }
            newRotation = angleToPlayer;
          } else if (state === 'idle') {
            // WANDERING MODE: Walk slowly in wanderAngle direction
            if (wanderTimer <= 0) {
              wanderAngle = wanderAngle + (Math.random() - 0.5) * 1.5;
              wanderTimer = 2 + Math.random() * 3;
            }

            const wanderSpeed = z.speed * 0.05; // Slow shuffling wander speed
            const proposedX = z.x + Math.sin(wanderAngle) * wanderSpeed;
            const proposedZ = z.z + Math.cos(wanderAngle) * wanderSpeed;

            // Turn around if proposed wander position hits a building or map edge
            if (isPositionColliding(proposedX, proposedZ, 0.6) || Math.hypot(proposedX, proposedZ) > 85) {
              wanderAngle += Math.PI;
              newX = z.x;
              newZ = z.z;
            } else {
              newX = proposedX;
              newZ = proposedZ;
            }

            newRotation = wanderAngle;
          }

          return {
            ...z,
            x: newX,
            z: newZ,
            rotation: newRotation,
            state,
            wanderAngle,
            wanderTimer
          };
        });

        // Trigger next wave if all zombies cleared
        if (aliveCount === 0) {
          setTimeout(() => {
            setWave((w) => {
              const nextW = w + 1;
              spawnZombieWave(nextW);
              return nextW;
            });
          }, 1500);
        }

        return updated;
      });

      // Occasional ambient zombie growl
      if (Math.random() < 0.05) {
        soundEngine.playZombieGroan();
      }
    }, 150);

    return () => clearInterval(interval);
  }, [gameStatus, spawnZombieWave]);

  // -------------------------------------------------------------
  // 4. Combat Handlers (Level Damage Scaling & Score Calculation)
  // -------------------------------------------------------------
  const handleZombieHit = useCallback((
    zombieId: string,
    baseDamage: number,
    handType: 'left' | 'right',
    zombiePos: { x: number; y: number; z: number }
  ) => {
    setScore((currentScore) => {
      const currentLevel = Math.floor(currentScore / 200) + 1;
      const mult = 1 + (currentLevel - 1) * 0.08;
      const actualDamage = Math.round(baseDamage * mult);

      let addedScore = 15; // Hit score bonus

      setZombies((prev) =>
        prev.map((z) => {
          if (z.id !== zombieId || z.state === 'dead') return z;

          const newHealth = z.health - actualDamage;
          const isKill = newHealth <= 0;

          if (isKill) {
            setKills((k) => k + 1);
            const killBonus = z.type === 'brute' ? 250 : z.type === 'runner' ? 150 : 100;
            addedScore += killBonus;
          }

          // Spawn 3D floating damage text
          const newPopup: DamageTextData = {
            id: `dmg-${Date.now()}-${Math.random()}`,
            x: zombiePos.x + (Math.random() - 0.5) * 0.3,
            y: zombiePos.y + 0.2,
            z: zombiePos.z + (Math.random() - 0.5) * 0.3,
            damage: actualDamage,
            createdAt: Date.now(),
            isKill,
            handType
          };
          setDamageTexts((dt) => [...dt.slice(-12), newPopup]);

          if (isKill) {
            return { ...z, health: 0, state: 'dead' };
          }

          return { ...z, health: newHealth, state: 'hit' };
        })
      );

      return currentScore + addedScore;
    });
  }, []);

  const handlePlayerDamaged = useCallback((damage: number) => {
    setHealth((h) => {
      const nextH = Math.max(0, h - damage);
      if (nextH <= 0) {
        setGameStatus(GameStatus.GAME_OVER);
      }
      return nextH;
    });
  }, []);

  // -------------------------------------------------------------
  // 5. Multiplayer Engine Sync
  // -------------------------------------------------------------
  useEffect(() => {
    multiplayerEngine.joinRoom(roomId, {
      id: `player-${Math.random().toString(36).substr(2, 6)}`,
      name: playerName,
      x: playerPos.x,
      z: playerPos.z,
      health,
      kills,
      weapon: 'Bastão / Soco',
      color: '#38bdf8'
    });

    const unsubscribe = multiplayerEngine.subscribe((players) => {
      setRemotePlayers(players);
    });

    return () => {
      unsubscribe();
      multiplayerEngine.cleanup();
    };
  }, [roomId, playerName]);

  useEffect(() => {
    multiplayerEngine.updateLocalState(
      { x: playerPos.x, z: playerPos.z },
      health,
      kills,
      currentGps ? { lat: currentGps.latitude, lng: currentGps.longitude } : undefined
    );
  }, [playerPos, health, kills, currentGps]);

  // -------------------------------------------------------------
  // 6. Game Flow Controls
  // -------------------------------------------------------------
  const startGame = async () => {
    if (!isCameraReady) return;

    // Request iOS Gyroscope & Motion permissions if applicable
    await requestGyroPermission();
    await requestMotionPermission();

    // Auto request fullscreen if available and not yet active
    if (!isFullscreen && isFullscreenSupported) {
      await requestFullscreen();
    }

    // Calibrate baseline gyro orientation
    calibrateGyro();

    setHealth(MAX_PLAYER_HEALTH);
    setKills(0);
    setWave(1);
    setScore(0);
    setDamageTexts([]);
    setLevelUpNotice({ visible: false, level: 1 });
    prevLevelRef.current = 1;
    setGameStatus(GameStatus.PLAYING);

    spawnZombieWave(1);
  };

  const calibrateGpsOrigin = () => {
    if (currentGps) {
      setOriginGps({ lat: currentGps.latitude, lng: currentGps.longitude });
      setPlayerPos({ x: 0, y: 0, z: 0 });
    }
  };

  useEffect(() => {
    if (gameStatus === GameStatus.LOADING && isCameraReady) {
      setGameStatus(GameStatus.IDLE);
    }
  }, [isCameraReady, gameStatus]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">
      {/* Hidden processing video element */}
      <video
        ref={videoRef}
        className="absolute opacity-0 pointer-events-none"
        playsInline
        muted
        autoPlay
        style={{ width: '640px', height: '480px' }}
      />

      {/* 3D R3F Canvas */}
      <Canvas shadows dpr={[1, 2]}>
        {gameStatus !== GameStatus.LOADING && (
          <GameScene
            gameStatus={gameStatus}
            playerPos={playerPos}
            handPositionsRef={handPositionsRef}
            cameraQuaternionRef={cameraQuaternionRef}
            isStereoVR={isStereoVR}
            zombies={zombies}
            houses={houses}
            remotePlayers={remotePlayers}
            isPlayerInSafeZone={isPlayerInSafeZone}
            onZombieHit={handleZombieHit}
            onPlayerDamaged={handlePlayerDamaged}
            damageTexts={damageTexts}
          />
        )}
      </Canvas>

      {/* Webcam Feed for Tracking Preview */}
      <WebcamPreview
        videoRef={videoRef}
        resultsRef={lastResultsRef}
        isCameraReady={isCameraReady}
        facingMode={facingMode}
        onSwitchCamera={switchCamera}
        isCameraMirrored={isCameraMirrored}
        onToggleMirror={() => setIsCameraMirrored(!isCameraMirrored)}
        videoDevices={videoDevices}
        selectedDeviceId={selectedDeviceId}
        onSelectUltraWide={selectUltraWideCamera}
        isCameraPreviewVisible={isCameraPreviewVisible}
        onToggleCameraPreviewVisible={setIsCameraPreviewVisible}
      />

      {/* VR Cardboard Center Divider & Dual Eye Reticles */}
      {gameStatus === GameStatus.PLAYING && isStereoVR && (
        <div className="absolute inset-0 pointer-events-none z-10 flex">
          {/* Middle Dividing Line for VR Headset lenses */}
          <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-slate-900/90 border-r border-slate-800/80 shadow-2xl" />

          {/* Left Eye Aim Reticle */}
          <div className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-red-500/80 flex items-center justify-center opacity-80">
            <div className="w-1 h-1 bg-red-500 rounded-full" />
          </div>

          {/* Right Eye Aim Reticle */}
          <div className="absolute left-3/4 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-red-500/80 flex items-center justify-center opacity-80">
            <div className="w-1 h-1 bg-red-500 rounded-full" />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* HUD OVERLAY (TOP & SIDE PANELS) */}
      {/* ------------------------------------------------------------- */}
      {gameStatus === GameStatus.PLAYING && (
        <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between z-20">
          {/* Virtual Joystick (Left Thumbstick for movement) */}
          {useJoystick && (
            <div className="absolute bottom-6 left-6 z-30 pointer-events-auto">
              <VirtualJoystick
                onMove={(vec) => {
                  joystickVectorRef.current = vec;
                }}
              />
            </div>
          )}
          {/* Top Header */}
          <div className="flex justify-between items-start w-full">
            {/* Health & Status */}
            <div className="flex flex-col gap-2 max-w-xs">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 backdrop-blur-md shadow-lg">
                <div className="flex justify-between items-center text-xs text-slate-300 font-bold mb-1">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-red-500" /> VITALIDADE DO SOBREVIVENTE
                  </span>
                  <span className="font-mono text-emerald-400">{Math.round(health)} / {MAX_PLAYER_HEALTH} HP</span>
                </div>
                <div className="h-3.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                  <div
                    className={`h-full transition-all duration-300 ${
                      health > MAX_PLAYER_HEALTH * 0.5 ? 'bg-emerald-500' : health > MAX_PLAYER_HEALTH * 0.2 ? 'bg-amber-500' : 'bg-red-600 animate-pulse'
                    }`}
                    style={{ width: `${(health / MAX_PLAYER_HEALTH) * 100}%` }}
                  />
                </div>

                {/* Safe Zone Banner */}
                {isPlayerInSafeZone && (
                  <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/90 border border-emerald-500/50 rounded-lg text-emerald-300 text-xs font-bold animate-pulse">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>ÁREA DE SEGURANÇA ATIVA: REGULANDO ENERGIA</span>
                  </div>
                )}
              </div>

              {/* Weapons Available Display */}
              <div className="bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 backdrop-blur-md flex justify-between text-xs font-mono">
                <div className="text-amber-400 flex items-center gap-1">
                  <Crosshair className="w-3.5 h-3.5" /> Dir: Bastão
                </div>
                <div className="text-cyan-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> Esq: Soco
                </div>
              </div>
            </div>

            {/* Kills, Score, Level & Wave Stats Header */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="bg-slate-950/95 px-5 py-2.5 rounded-2xl border border-amber-500/40 backdrop-blur-md text-center shadow-[0_0_20px_rgba(245,158,11,0.2)] flex flex-col gap-1.5">
                {/* Top Row: Score, Level Badge & Kills */}
                <div className="flex items-center gap-3 justify-center">
                  {/* Score Counter */}
                  <div className="flex items-center gap-1.5 text-yellow-400 font-extrabold text-sm sm:text-base font-mono">
                    <Trophy className="w-4 h-4 text-yellow-400 animate-pulse shrink-0" />
                    <span>{score.toLocaleString()} PTS</span>
                  </div>

                  {/* Level & Damage Badge */}
                  <div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black px-2.5 py-0.5 rounded-lg text-xs flex items-center gap-1.5 shadow-md">
                    <Award className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                    <span>NÍVEL {playerLevel}</span>
                    <span className="text-[10px] bg-black/25 px-1.5 py-0.5 rounded font-bold text-slate-950">
                      +{damageBonusPercent}% DANO
                    </span>
                  </div>

                  {/* Kills Badge */}
                  <div className="flex items-center gap-1 text-red-400 font-black text-xs sm:text-sm font-mono">
                    <Skull className="w-4 h-4 text-red-500 shrink-0" />
                    <span>{kills} KILLS</span>
                  </div>
                </div>

                {/* Bottom Row: XP Progress Bar & Wave Counter */}
                <div className="w-full flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                  <span className="whitespace-nowrap text-amber-300 font-bold">XP: {xpInCurrentLevel}/200</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-300"
                      style={{ width: `${(xpInCurrentLevel / 200) * 100}%` }}
                    />
                  </div>
                  <span className="text-slate-300 font-bold">ONDA #{wave}</span>
                </div>
              </div>
            </div>

            {/* Radar, GPS & View/Display Controls */}
            <div className="flex flex-col items-end gap-2">
              {/* Quick Gyro, Fullscreen, Exit Room & VR Cardboard controls bar */}
              <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 backdrop-blur-md shadow-lg">
                <button
                  onClick={exitRoom}
                  className="px-2.5 py-1.5 bg-red-950/90 hover:bg-red-900 text-red-200 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border border-red-500/50 active:scale-95 transition-all shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                  title="Sair da sala e voltar ao Menu Inicial"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                  <span>Sair da Sala</span>
                </button>

                <button
                  onClick={() => setIsStereoVR(!isStereoVR)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border active:scale-95 transition-all ${
                    isStereoVR
                      ? 'bg-purple-900/90 text-purple-200 border-purple-500/60'
                      : 'bg-slate-900 hover:bg-slate-800 text-purple-300 border-purple-500/30'
                  }`}
                  title={isStereoVR ? 'Desativar VR Cardboard' : 'Ativar VR Cardboard'}
                >
                  <Glasses className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden sm:inline">{isStereoVR ? 'VR Cardboard ON' : 'Modo VR'}</span>
                </button>

                <button
                  onClick={calibrateGyro}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border border-cyan-500/30 active:scale-95 transition-all"
                  title="Calibrar Visão Central do Giroscópio"
                >
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Calibrar Giroscópio</span>
                </button>

                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 rounded-lg text-xs font-mono font-bold flex items-center gap-1 border border-emerald-500/30 active:scale-95 transition-all"
                  title={isFullscreen ? 'Sair da Tela Cheia' : 'Entrar em Tela Cheia'}
                >
                  {isFullscreen ? (
                    <Minimize className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Maximize className="w-4 h-4 text-emerald-400" />
                  )}
                </button>
              </div>

              <RadarHUD
                playerPos={playerPos}
                zombies={zombies}
                houses={houses}
                remotePlayers={remotePlayers}
                cameraQuaternionRef={cameraQuaternionRef}
              />

              {/* Movement Mode Status Box */}
              {movementMode === 'accelerometer' ? (
                <div className="bg-slate-950/90 px-3 py-2 rounded-xl border border-amber-500/50 text-[11px] text-amber-300 font-mono flex flex-col gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Footprints className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                      <span>Passos: <strong className="text-white">{stepCount}</strong></span>
                    </div>

                    {!hasMotionPermission && (
                      <button
                        onClick={requestMotionPermission}
                        className="pointer-events-auto px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-[10px] animate-bounce"
                      >
                        Ativar Sensores
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pointer-events-auto">
                    <button
                      type="button"
                      onClick={() => triggerForwardStep(0.9)}
                      className="flex-1 py-1 px-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-lg text-[11px] active:scale-95 transition-all shadow-md flex items-center justify-center gap-1"
                      title="Dar 1 passo para a frente"
                    >
                      <Footprints className="w-3.5 h-3.5" />
                      <span>Dar Passo (+1m)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAutoWalking(!isAutoWalking)}
                      className={`px-2.5 py-1 font-bold rounded-lg text-[10px] transition-all flex items-center gap-1 ${
                        isAutoWalking
                          ? 'bg-amber-400 text-black shadow-[0_0_8px_#f59e0b] animate-pulse'
                          : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                      }`}
                      title="Ativar/desativar caminhada contínua automática"
                    >
                      <Activity className="w-3 h-3" />
                      <span>{isAutoWalking ? 'Caminhando...' : 'Auto-Caminhar'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] text-slate-300 font-mono flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  <span>
                    GPS: {playerPos.x.toFixed(1)}m, {playerPos.z.toFixed(1)}m
                  </span>
                  <button
                    onClick={calibrateGpsOrigin}
                    className="pointer-events-auto ml-1 text-slate-400 hover:text-white underline"
                    title="Recalibrar Origem GPS"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Virtual Controls for Testing / Indoor play */}
          <div className="flex justify-between items-end w-full">
            {/* Multiplayer Room Status */}
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-blue-500/30 backdrop-blur-md text-xs text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span>Sala: <strong className="text-white">{roomId}</strong></span>
              <span className="bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded-full font-bold text-[10px]">
                {remotePlayers.length + 1} Jogadores
              </span>
            </div>

            {/* Manual Movement D-Pad Controls (for Indoor / Desktop Play) */}
            <div className="pointer-events-auto bg-slate-950/80 p-2 rounded-2xl border border-slate-800 backdrop-blur-md flex flex-col items-center gap-1">
              <div className="text-[10px] font-mono text-slate-400 mb-0.5 flex items-center gap-1">
                <Navigation className="w-3 h-3" /> Deslocar no Mapa
              </div>
              <button
                onClick={() => setPlayerPos((p) => ({ ...p, z: p.z - 2.5 }))}
                className="w-9 h-8 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs active:scale-95 transition-all"
              >
                ▲
              </button>
              <div className="flex gap-1">
                <button
                  onClick={() => setPlayerPos((p) => ({ ...p, x: p.x - 2.5 }))}
                  className="w-9 h-8 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs active:scale-95 transition-all"
                >
                  ◄
                </button>
                <button
                  onClick={() => setPlayerPos((p) => ({ ...p, z: p.z + 2.5 }))}
                  className="w-9 h-8 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs active:scale-95 transition-all"
                >
                  ▼
                </button>
                <button
                  onClick={() => setPlayerPos((p) => ({ ...p, x: p.x + 2.5 }))}
                  className="w-9 h-8 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs active:scale-95 transition-all"
                >
                  ►
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Level Up Center Screen Floating Notification */}
      {gameStatus === GameStatus.PLAYING && levelUpNotice.visible && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-bounce">
          <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 px-6 py-3 rounded-2xl border-2 border-yellow-100 shadow-[0_0_40px_rgba(245,158,11,0.9)] flex flex-col items-center justify-center font-black">
            <div className="flex items-center gap-2 text-lg sm:text-xl tracking-wider uppercase">
              <Trophy className="w-6 h-6 text-slate-950 shrink-0" />
              <span>NÍVEL SUBIU! NÍVEL {levelUpNotice.level}</span>
              <Sparkles className="w-6 h-6 text-slate-950 shrink-0" />
            </div>
            <div className="text-xs font-mono font-extrabold text-slate-900 mt-0.5">
              ⚡ BÔNUS DE DANO AUMENTADO PARA +{(levelUpNotice.level - 1) * 8}% DE DANO TOTAL!
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MENUS (START, LOADING, GAME OVER) */}
      {/* ------------------------------------------------------------- */}
      {gameStatus !== GameStatus.PLAYING && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-40 overflow-y-auto p-3 sm:p-6 bg-black/40 backdrop-blur-sm">
          {gameStatus === GameStatus.LOADING && (
          <div className="bg-slate-950/90 p-8 rounded-3xl flex flex-col items-center border border-blue-500/40 backdrop-blur-xl shadow-2xl max-w-sm text-center my-auto">
            <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-blue-500 mb-4"></div>
            <h2 className="text-xl text-white font-bold mb-1">Inicializando Rastreador de Mãos</h2>
            <p className="text-xs text-blue-300 mb-2">{!isCameraReady ? 'Conectando à câmera...' : 'Carregando cenário 3D...'}</p>
            {cameraError && <p className="text-red-400 text-xs mt-2 bg-red-950/80 p-2 rounded border border-red-800">{cameraError}</p>}
          </div>
        )}

        {gameStatus === GameStatus.IDLE && (
          <div className="bg-slate-950/95 p-4 sm:p-6 md:p-8 rounded-3xl border-2 border-red-500/40 backdrop-blur-2xl max-w-md w-full my-auto shadow-2xl text-center text-white max-h-[92vh] overflow-y-auto scrollbar-thin">
            <div className="mb-3 sm:mb-4 flex justify-center">
              <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 animate-pulse" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter mb-1 text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-red-600">
              ZOMBIELAND <span className="text-white">GPS</span>
            </h1>
            <p className="text-xs text-slate-400 mb-4 sm:mb-6 font-mono">APOCALIPSE EM PRIMEIRA PESSOA</p>

            {/* Instruction cards */}
            <div className="space-y-2 text-xs text-slate-300 text-left bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
                <span><strong>Escolha de Câmera:</strong> Traseira para ver o ambiente à frente ou frontal para modo selfie.</span>
              </div>
              <div className="flex items-center gap-2">
                <Footprints className="w-4 h-4 text-amber-400 shrink-0" />
                <span><strong>Deslocamento (Acelerômetro ou GPS):</strong> Escolha se prefere caminhar com o celular dando passos/inclinando (Acelerômetro) ou se locomovendo fisicamente (GPS Real).</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
                <span><strong>Giroscópio & Visão 360°:</strong> Mova o celular em volta para olhar em todas as direções no mundo 3D.</span>
              </div>
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-red-400 shrink-0" />
                <span><strong>Ataque por Câmera:</strong> Posicione sua mão em frente à câmera para disparar ataques com o bastão de luz.</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span><strong>Casas de Segurança:</strong> Entre nas áreas verdes indicadas no radar para curar e recuperar vida.</span>
              </div>
            </div>

            {/* Display & Gyro & VR & Camera Settings Panel */}
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 mb-4 flex flex-col gap-2.5 text-left text-xs">
              {/* Camera Selection & Ultra-Wide Option */}
              <div className="flex flex-col gap-1.5 border-b border-slate-800/80 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                    <Camera className="w-4 h-4 text-cyan-400" />
                    <span>Câmera do Jogo:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={selectUltraWideCamera}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border active:scale-95 bg-purple-900/80 hover:bg-purple-800 border-purple-500/50 text-purple-200"
                      title="Ativar lente Ultra-Wide (Ampla 0.5x) para capturar melhor os movimentos das mãos"
                    >
                      <ZoomIn className="w-3.5 h-3.5 text-purple-300" />
                      <span>Ultra Wide 0.5x</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => switchCamera()}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 bg-slate-800 border-slate-700 text-cyan-300 hover:bg-slate-700"
                      title="Alternar entre Câmera Frontal e Traseira"
                    >
                      <SwitchCamera className="w-3.5 h-3.5" />
                      <span>{facingMode === 'user' ? 'Frontal' : 'Traseira'}</span>
                    </button>
                  </div>
                </div>

                {/* Mirror / Invert Hand Toggle */}
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/50">
                  <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                    <FlipHorizontal className="w-4 h-4 text-amber-400" />
                    <span>Espelhar Orientação das Mãos:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCameraMirrored(!isCameraMirrored)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border active:scale-95 ${
                      isCameraMirrored
                        ? 'bg-cyan-950 border-cyan-500/60 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                    title="Inverte horizontalmente a posição das mãos para combinar com a visualização intuitiva"
                  >
                    <FlipHorizontal className="w-3 h-3" />
                    <span>{isCameraMirrored ? 'Espelhado (Invertido)' : 'Direto'}</span>
                  </button>
                </div>

                {/* Pop-up de Câmera na Tela Toggle */}
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/50">
                  <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span>Pop-up da Câmera na Tela:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCameraPreviewVisible(!isCameraPreviewVisible)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${
                      isCameraPreviewVisible
                        ? 'bg-cyan-950 border-cyan-500/60 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                    title="Exibir ou ocultar a janela pop-up de pré-visualização da câmera na tela"
                  >
                    {isCameraPreviewVisible ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Exibir (Visível)</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-red-400" />
                        <span>Ocultar (Oculto)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Virtual Joystick Option */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                    <Gamepad2 className="w-4 h-4 text-cyan-400" />
                    <span>Joystick Virtual (Mão Esquerda):</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    Movimenta o personagem na tela pelo polegar esquerdo. Desativa Acelerômetro, GPS e VR Cardboard.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleJoystickMode(!useJoystick)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 shrink-0 ${
                    useJoystick
                      ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                  title="Ativar direcional analógico na tela"
                >
                  <Gamepad2 className="w-3.5 h-3.5" />
                  <span>{useJoystick ? 'Ativado (ON)' : 'Desativado'}</span>
                </button>
              </div>

              {/* Google Cardboard VR Option */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                  <Glasses className="w-4 h-4 text-purple-400" />
                  <span>Google Cardboard (Óculos VR):</span>
                </div>
                {useJoystick ? (
                  <span className="text-[10px] text-purple-300/70 font-mono bg-purple-950/60 px-2 py-1 rounded border border-purple-800/50">
                    Indisponível no modo Joystick
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsStereoVR(!isStereoVR)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${
                      isStereoVR
                        ? 'bg-purple-900/90 border-purple-400 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {isStereoVR ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-purple-300" />
                        <span>VR Ativado (Dual)</span>
                      </>
                    ) : (
                      <>
                        <Glasses className="w-3.5 h-3.5" />
                        <span>Desativado (Normal)</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Fullscreen Option */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                  <Maximize className="w-4 h-4 text-emerald-400" />
                  <span>Modo Tela Cheia:</span>
                </div>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 ${
                    isFullscreen
                      ? 'bg-blue-600/40 border-blue-400 text-blue-200'
                      : 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700'
                  }`}
                >
                  {isFullscreen ? (
                    <>
                      <Minimize className="w-3.5 h-3.5" />
                      <span>Ativada</span>
                    </>
                  ) : (
                    <>
                      <Maximize className="w-3.5 h-3.5" />
                      <span>Ativar Tela Cheia</span>
                    </>
                  )}
                </button>
              </div>

              {/* Gyroscope Option */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span>Sensor Giroscópio:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsGyroEnabled(!isGyroEnabled)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold uppercase transition-all ${
                      isGyroEnabled
                        ? 'bg-emerald-950 border border-emerald-500/60 text-emerald-300'
                        : 'bg-slate-800 border border-slate-700 text-slate-400'
                    }`}
                  >
                    {isGyroEnabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await requestGyroPermission();
                      calibrateGyro();
                    }}
                    className="p-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg border border-slate-700 active:scale-95 transition-all"
                    title="Calibrar posição atual como centro"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Player Movement Mode Option (Acelerômetro vs GPS) */}
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-800/80">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                    <Footprints className="w-4 h-4 text-amber-400" />
                    <span>Modo de Deslocamento:</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setMovementMode('accelerometer')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                        movementMode === 'accelerometer'
                          ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Activity className="w-3 h-3" />
                      <span>Acelerômetro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMovementMode('gps')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                        movementMode === 'gps'
                          ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                      <span>GPS Real</span>
                    </button>
                  </div>
                </div>
                <div className="text-[10px] font-mono">
                  {movementMode === 'accelerometer' ? (
                    <span className="text-amber-300/90">
                      👟 <strong>Acelerômetro Ativo:</strong> Incline ou dê passos físicos com o celular para caminhar para frente.
                    </span>
                  ) : (
                    <span className="text-emerald-300/90">
                      📍 <strong>GPS Real Ativo:</strong> Seu personagem no jogo acompanha seu movimento físico no GPS.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Guia do Jogo & Instruções de Sobrevivência */}
            <div className="bg-slate-900/90 p-3.5 sm:p-4 rounded-xl border border-amber-500/30 text-left mb-4 shadow-lg">
              <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-slate-800">
                <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider">
                  Guia de Sobrevivência AR (Como Jogar)
                </h3>
              </div>

              <div className="space-y-3 text-[11px] text-slate-300">
                {/* 1. Deslocamento */}
                <div className="flex items-start gap-2">
                  <Footprints className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block">1. Como se Deslocar (Movimentação):</strong>
                    <p className="text-slate-400 leading-relaxed mt-0.5">
                      • <strong>Acelerômetro:</strong> Dê passos físicos com o celular na mão, incline levemente o aparelho para a frente ou toque nos botões <strong>"Dar Passo (+1m)"</strong> / <strong>"Auto-Caminhar"</strong>.<br />
                      • <strong>GPS Real:</strong> Caminhe livremente ao ar livre; sua posição GPS real move seu sobrevivente no mapa 3D.<br />
                      • <em>No Computador:</em> Use as teclas <strong>WASD</strong> ou as setas direcionais do teclado.
                    </p>
                  </div>
                </div>

                {/* 2. Olhar em Volta */}
                <div className="flex items-start gap-2">
                  <Compass className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block">2. Como Virar e Olhar em Volta (360°):</strong>
                    <p className="text-slate-400 leading-relaxed mt-0.5">
                      Gire o smartphone em qualquer direção (360°). O <strong>Giroscópio</strong> do celular rotaciona a câmera do jogo em tempo real. Compatível com óculos <strong>Google Cardboard VR</strong> para imersão 3D.
                    </p>
                  </div>
                </div>

                {/* 3. Como Atacar */}
                <div className="flex items-start gap-2">
                  <Crosshair className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block">3. Como Atacar com a Câmera:</strong>
                    <p className="text-slate-400 leading-relaxed mt-0.5">
                      Posicione a mão em frente à câmera frontal ou traseira. O rastreador detecta seus gestos e projeta o <strong>Bastão / Sabre de Luz</strong>. Movimente ou golpeie em direção aos zumbis para destruí-los!
                    </p>
                  </div>
                </div>

                {/* 4. Radar HUD e Safe Houses */}
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block">4. Radar HUD, Indicadores & Casas de Segurança:</strong>
                    <p className="text-slate-400 leading-relaxed mt-0.5">
                      • <strong>Radar HUD:</strong> Bússola 360° no topo com indicação do Norte e distâncias.<br />
                      • <strong>Inimigos (Pontos Vermelhos):</strong> Zumbis entram em estado de ataque ao se aproximar a menos de <strong>4 metros</strong> ou ao te avistar.<br />
                      • <strong>Abrigos (Pontos Verdes):</strong> Entre na área da Casa de Segurança para regenerar sua vida e se proteger!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Player name & Room input */}
            <div className="flex gap-2 mb-6 text-left">
              <div className="flex-1">
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Nome do Sobrevivente</label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="w-1/3">
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1">Sala MP</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={startGame}
              disabled={!isCameraReady}
              className="w-full py-3.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-lg rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>INICIAR SOBREVIVÊNCIA</span>
            </button>
          </div>
        )}

        {gameStatus === GameStatus.GAME_OVER && (
          <div className="bg-slate-950/95 p-8 rounded-3xl border-2 border-red-600 backdrop-blur-2xl max-w-sm w-full text-center text-white shadow-[0_0_50px_rgba(220,38,38,0.5)]">
            <Skull className="w-16 h-16 text-red-500 mx-auto mb-3 animate-pulse" />
            <h2 className="text-3xl font-black text-red-500 tracking-wider mb-1">VOCÊ FOI INFECTADO</h2>
            <p className="text-xs text-slate-400 mb-6 font-mono">SUA JORNADA NO APOCALIPSE TERMINOU</p>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2 mb-6 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Score Conquistado:</span>
                <span className="text-yellow-400 font-bold">{score.toLocaleString()} PTS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Nível Alcançado:</span>
                <span className="text-amber-400 font-bold">NÍVEL {playerLevel} (+{damageBonusPercent}% DANO)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Zombies Mortos:</span>
                <span className="text-red-400 font-bold">{kills}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Onda Alcançada:</span>
                <span className="text-red-400 font-bold">#{wave}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={startGame}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-wider active:scale-95"
              >
                <RotateCcw className="w-5 h-5" />
                <span>TENTAR NOVAMENTE</span>
              </button>

              <button
                onClick={exitRoom}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-xs active:scale-95"
              >
                <LogOut className="w-4 h-4 text-slate-400" />
                <span>VOLTAR AO MENU INICIAL</span>
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default App;
