/**
 * Main 3D Game Scene
 * First-person perspective rendered with Three.js / React Three Fiber.
 * Handles player movement, hand strike collision detection, zombies, and safe zones.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { GameStatus, PlayerWorldPos, ZombieData, HouseData, RemotePlayer, HandPositions } from '../types';
import { Environment3D } from './Environment3D';
import { House3D } from './House3D';
import { Zombie3D } from './Zombie3D';
import { RemotePlayer3D } from './RemotePlayer3D';
import { Hands3D } from './Hands3D';
import { soundEngine } from '../utils/soundEngine';

interface GameSceneProps {
  gameStatus: GameStatus;
  playerPos: PlayerWorldPos;
  handPositionsRef: React.MutableRefObject<any>;
  cameraQuaternionRef?: React.MutableRefObject<THREE.Quaternion>;
  isStereoVR?: boolean;
  zombies: ZombieData[];
  houses: HouseData[];
  remotePlayers: RemotePlayer[];
  isPlayerInSafeZone: boolean;
  onZombieHit: (zombieId: string, damage: number, handType: 'left' | 'right') => void;
  onPlayerDamaged: (damage: number) => void;
}

export const GameScene: React.FC<GameSceneProps> = ({
  gameStatus,
  playerPos,
  handPositionsRef,
  cameraQuaternionRef,
  isStereoVR = false,
  zombies,
  houses,
  remotePlayers,
  isPlayerInSafeZone,
  onZombieHit,
  onPlayerDamaged
}) => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const stereoCamera = useMemo(() => new THREE.StereoCamera(), []);
  const shakeIntensity = useRef<number>(0);
  const lastAttackTime = useRef<{ left: number; right: number }>({ left: 0, right: 0 });

  // Helper vectors for collision checks
  const vecHand = useMemo(() => new THREE.Vector3(), []);
  const vecZombie = useMemo(() => new THREE.Vector3(), []);

  // Hand position refs for visual rendering
  const leftHandPosRef = useRef<THREE.Vector3 | null>(null);
  const rightHandPosRef = useRef<THREE.Vector3 | null>(null);
  const leftHandVelRef = useRef<THREE.Vector3 | null>(null);
  const rightHandVelRef = useRef<THREE.Vector3 | null>(null);

  useFrame((state, delta) => {
    // 1. Camera First Person Follow Player & Gyroscope/Drag Orientation
    if (cameraRef.current) {
      const shake = shakeIntensity.current;
      const shakeX = (Math.random() - 0.5) * shake;
      const shakeY = (Math.random() - 0.5) * shake;

      cameraRef.current.position.set(
        playerPos.x + shakeX,
        playerPos.y + 1.6 + shakeY, // Eye height
        playerPos.z
      );

      // Apply gyro & drag look orientation
      if (cameraQuaternionRef?.current) {
        const combinedQuat = cameraQuaternionRef.current.clone();
        if (shake > 0) {
          const shakeQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(shakeY * 0.1, shakeX * 0.1, 0)
          );
          combinedQuat.multiply(shakeQuat);
        }
        cameraRef.current.quaternion.copy(combinedQuat);
      }

      // Decay camera shake
      if (shakeIntensity.current > 0) {
        shakeIntensity.current = THREE.MathUtils.lerp(shakeIntensity.current, 0, 10 * delta);
      }
    }

    if (gameStatus !== GameStatus.PLAYING) return;

    // 2. Update Hands
    const hands = handPositionsRef.current as HandPositions;
    const camQuat = cameraQuaternionRef?.current || new THREE.Quaternion();

    if (hands) {
      // Map screen-relative hand coordinates to first-person local view rotated by camera orientation
      if (hands.left) {
        const localLeft = new THREE.Vector3(
          hands.left.x * 0.8 - 0.3,
          hands.left.y * 0.6,
          hands.left.z * 0.8 - 0.6
        );
        localLeft.applyQuaternion(camQuat);
        localLeft.add(new THREE.Vector3(playerPos.x, playerPos.y + 1.2, playerPos.z));

        leftHandPosRef.current = localLeft;
        leftHandVelRef.current = hands.leftVelocity;
      } else {
        leftHandPosRef.current = null;
      }

      if (hands.right) {
        const localRight = new THREE.Vector3(
          hands.right.x * 0.8 + 0.3,
          hands.right.y * 0.6,
          hands.right.z * 0.8 - 0.6
        );
        localRight.applyQuaternion(camQuat);
        localRight.add(new THREE.Vector3(playerPos.x, playerPos.y + 1.2, playerPos.z));

        rightHandPosRef.current = localRight;
        rightHandVelRef.current = hands.rightVelocity;
      } else {
        rightHandPosRef.current = null;
      }
    }

    // 3. Combat Collision Detection (Player attacking Zombies)
    const now = performance.now();

    zombies.forEach((zombie) => {
      if (zombie.state === 'dead') return;

      vecZombie.set(zombie.x, zombie.y + 1.2, zombie.z);

      // RIGHT HAND: BATON ATTACK
      if (rightHandPosRef.current) {
        const distRight = rightHandPosRef.current.distanceTo(vecZombie);
        const speedRight = hands?.rightVelocity ? hands.rightVelocity.length() : 0;

        if (distRight < 2.2 && (speedRight > 1.2 || rightHandPosRef.current.z < playerPos.z - 0.5)) {
          if (now - lastAttackTime.current.right > 280) {
            lastAttackTime.current.right = now;
            shakeIntensity.current = 0.3;
            soundEngine.playBatSwing();
            soundEngine.playZombieHit();
            onZombieHit(zombie.id, 45, 'right'); // Baton deals heavy 45 damage
          }
        }
      }

      // LEFT HAND: FIST PUNCH ATTACK
      if (leftHandPosRef.current) {
        const distLeft = leftHandPosRef.current.distanceTo(vecZombie);
        const speedLeft = hands?.leftVelocity ? hands.leftVelocity.length() : 0;

        if (distLeft < 1.7 && (speedLeft > 1.2 || leftHandPosRef.current.z < playerPos.z - 0.5)) {
          if (now - lastAttackTime.current.left > 250) {
            lastAttackTime.current.left = now;
            shakeIntensity.current = 0.2;
            soundEngine.playFistPunch();
            soundEngine.playZombieHit();
            onZombieHit(zombie.id, 25, 'left'); // Fist deals 25 damage
          }
        }
      }

      // 4. Zombie Attacking Player (if NOT in Safe Zone)
      if (!isPlayerInSafeZone && zombie.state === 'attacking') {
        const distPlayer = vecZombie.distanceTo(
          new THREE.Vector3(playerPos.x, playerPos.y + 1.2, playerPos.z)
        );
        if (distPlayer < 1.6) {
          // Controlled damage rate: ~15 HP/sec for walkers (approx 20 hits total against 300 HP)
          onPlayerDamaged(zombie.damage * delta * 1.5);
        }
      }
    });

    // 5. Google Cardboard / VR Stereoscopic Dual Eye Render Pipeline
    if (isStereoVR && cameraRef.current) {
      const gl = state.gl;
      const scene = state.scene;
      const camera = cameraRef.current;
      const width = gl.domElement.clientWidth;
      const height = gl.domElement.clientHeight;

      stereoCamera.aspect = (width / 2) / height;
      stereoCamera.update(camera);

      gl.clear();

      // Left Eye Render
      gl.setViewport(0, 0, width / 2, height);
      gl.setScissor(0, 0, width / 2, height);
      gl.setScissorTest(true);
      gl.render(scene, stereoCamera.cameraL);

      // Right Eye Render
      gl.setViewport(width / 2, 0, width / 2, height);
      gl.setScissor(width / 2, 0, width / 2, height);
      gl.setScissorTest(true);
      gl.render(scene, stereoCamera.cameraR);

      gl.setScissorTest(false);
    }
  }, isStereoVR ? 1 : 0);

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault fov={65} near={0.1} far={200} />

      {/* Post Apocalyptic Environment */}
      <Environment3D />

      {/* Safe House Buildings */}
      {houses.map((house) => (
        <House3D key={house.id} house={house} isPlayerInside={isPlayerInSafeZone} />
      ))}

      {/* Active Zombies */}
      {zombies.map((zombie) => (
        <Zombie3D key={zombie.id} zombie={zombie} />
      ))}

      {/* Remote Multiplayer Players */}
      {remotePlayers.map((player) => (
        <RemotePlayer3D key={player.id} player={player} />
      ))}

      {/* Player Weapons / Hands */}
      <Hands3D type="left" positionRef={leftHandPosRef} velocityRef={leftHandVelRef} />
      <Hands3D type="right" positionRef={rightHandPosRef} velocityRef={rightHandVelRef} />
    </>
  );
};

export default GameScene;
