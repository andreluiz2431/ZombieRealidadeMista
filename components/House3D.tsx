/**
 * 3D House / Safe Zone Component
 * Renders safe house structures with glowing green protection barriers.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { HouseData, COLORS } from '../types';
import { ShieldCheck } from 'lucide-react';

interface House3DProps {
  house: HouseData;
  isPlayerInside: boolean;
}

export const House3D: React.FC<House3DProps> = ({ house, isPlayerInside }) => {
  const barrierRef = useRef<THREE.Mesh>(null);

  useFrame((_state, delta) => {
    if (barrierRef.current) {
      barrierRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group position={[house.x, 0, house.z]}>
      {/* Safe House Label Overhead */}
      <Html position={[0, house.height + 2, 0]} center distanceFactor={18}>
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold tracking-wider uppercase transition-all ${
            isPlayerInside
              ? 'bg-emerald-600/90 text-white border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.8)] animate-pulse'
              : 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{house.name}</span>
        </div>
      </Html>

      {/* Main Building Body */}
      <mesh position={[0, house.height / 2, 0]}>
        <boxGeometry args={[house.width, house.height, house.depth]} />
        <meshStandardMaterial color={house.color} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Roof */}
      <mesh position={[0, house.height + 1, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[house.width * 0.75, 2, 4]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>

      {/* Front Door */}
      <mesh position={[0, 1.25, house.depth / 2 + 0.02]}>
        <boxGeometry args={[1.5, 2.5, 0.1]} />
        <meshStandardMaterial color="#78350f" roughness={0.6} />
      </mesh>

      {/* Windows with Warm Light */}
      <mesh position={[-house.width / 4, 2, house.depth / 2 + 0.02]}>
        <boxGeometry args={[1, 1, 0.05]} />
        <meshBasicMaterial color="#fef08a" />
      </mesh>
      <mesh position={[house.width / 4, 2, house.depth / 2 + 0.02]}>
        <boxGeometry args={[1, 1, 0.05]} />
        <meshBasicMaterial color="#fef08a" />
      </mesh>

      {/* Safe Dome Barrier */}
      <mesh ref={barrierRef} position={[0, house.height / 2, 0]}>
        <cylinderGeometry args={[house.radius, house.radius, house.height + 2, 32, 1, true]} />
        <meshStandardMaterial
          color={COLORS.safeZone}
          emissive={COLORS.safeZone}
          emissiveIntensity={isPlayerInside ? 2.5 : 1.2}
          transparent
          opacity={isPlayerInside ? 0.35 : 0.2}
          side={THREE.DoubleSide}
          roughness={0.1}
        />
      </mesh>

      {/* Glowing Ring on Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[house.radius - 0.2, house.radius, 64]} />
        <meshBasicMaterial color={COLORS.safeZone} side={THREE.DoubleSide} transparent opacity={0.8} />
      </mesh>

      {/* Safe Zone Point Light */}
      <pointLight color="#22c55e" intensity={isPlayerInside ? 4 : 2} distance={house.radius + 2} position={[0, 2, 0]} />
    </group>
  );
};
