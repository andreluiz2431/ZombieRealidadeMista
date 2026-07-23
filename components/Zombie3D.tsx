/**
 * 3D Zombie Component
 * Renders textured zombies with walking/running animation, eyes, health bar, and hit effects.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ZombieData, COLORS } from '../types';

interface Zombie3DProps {
  zombie: ZombieData;
}

export const Zombie3D: React.FC<Zombie3DProps> = ({ zombie }) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;

    // Position & Rotation update
    groupRef.current.position.set(zombie.x, zombie.y, zombie.z);
    groupRef.current.rotation.y = zombie.rotation;

    // Walking / Running procedural limbs animation
    if (zombie.state === 'chasing' || zombie.state === 'attacking') {
      const time = state.clock.getElapsedTime() * (zombie.type === 'runner' ? 12 : 6);
      const swing = Math.sin(time) * 0.4;

      if (leftArmRef.current) leftArmRef.current.rotation.x = -Math.PI / 3 + swing;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -Math.PI / 3 - swing;
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
    } else if (zombie.state === 'idle') {
      // Gentle idle sway breathing
      const time = state.clock.getElapsedTime() * 1.5;
      const sway = Math.sin(time) * 0.05;

      if (leftArmRef.current) leftArmRef.current.rotation.x = sway;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -sway;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
    }
  });

  const isHit = zombie.state === 'hit';
  const isDead = zombie.state === 'dead';

  if (isDead) return null;

  // Scale according to zombie type
  const scale = zombie.type === 'brute' ? 1.4 : zombie.type === 'runner' ? 0.9 : 1.1;
  const bodyColor = isHit ? '#ff2222' : zombie.type === 'brute' ? '#3f4739' : '#2d3728';

  return (
    <group ref={groupRef} scale={[scale, scale, scale]}>
      {/* Overhead Health Bar */}
      <Html position={[0, 2.2, 0]} center distanceFactor={10}>
        <div className="w-16 bg-black/80 p-0.5 rounded border border-red-900 shadow">
          <div
            className="h-1.5 bg-red-600 rounded transition-all duration-150"
            style={{ width: `${Math.max(0, (zombie.health / zombie.maxHealth) * 100)}%` }}
          />
        </div>
      </Html>

      {/* Head */}
      <mesh position={[0, 1.6, 0]}>
        <boxGeometry args={[0.3, 0.35, 0.3]} />
        <meshStandardMaterial color={bodyColor} roughness={0.8} />
      </mesh>

      {/* Glowing Red Eyes */}
      <mesh position={[-0.08, 1.68, 0.16]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color={COLORS.zombieEye} />
      </mesh>
      <mesh position={[0.08, 1.68, 0.16]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color={COLORS.zombieEye} />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.45, 0.7, 0.25]} />
        <meshStandardMaterial color={isHit ? '#ef4444' : '#1e293b'} roughness={0.9} />
      </mesh>

      {/* Left Arm */}
      <group ref={leftArmRef} position={[-0.28, 1.2, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <boxGeometry args={[0.12, 0.6, 0.12]} />
          <meshStandardMaterial color={bodyColor} roughness={0.8} />
        </mesh>
      </group>

      {/* Right Arm */}
      <group ref={rightArmRef} position={[0.28, 1.2, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <boxGeometry args={[0.12, 0.6, 0.12]} />
          <meshStandardMaterial color={bodyColor} roughness={0.8} />
        </mesh>
      </group>

      {/* Left Leg */}
      <group ref={leftLegRef} position={[-0.12, 0.6, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <boxGeometry args={[0.14, 0.6, 0.14]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>
      </group>

      {/* Right Leg */}
      <group ref={rightLegRef} position={[0.12, 0.6, 0]}>
        <mesh position={[0, -0.3, 0]}>
          <boxGeometry args={[0.14, 0.6, 0.14]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>
      </group>

      {/* Red Eye Glow Point Light */}
      <pointLight color="#ff0000" intensity={0.8} distance={1.5} position={[0, 1.68, 0.2]} />
    </group>
  );
};
