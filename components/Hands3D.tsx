/**
 * 3D Hands and Weapons Component
 * Right Hand: Tactical Baton / Spiked Baseball Bat (Melee Weapon)
 * Left Hand: Combat Fist / Armored Glove (Punch Attack)
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HandType, COLORS } from '../types';

interface Hands3DProps {
  type: HandType;
  positionRef: React.MutableRefObject<THREE.Vector3 | null>;
  velocityRef: React.MutableRefObject<THREE.Vector3 | null>;
  isAttacking?: boolean;
}

export const Hands3D: React.FC<Hands3DProps> = ({ type, positionRef, velocityRef }) => {
  const meshRef = useRef<THREE.Group>(null);

  const targetRotation = useRef(new THREE.Euler());

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    const targetPos = positionRef.current;
    const velocity = velocityRef.current;

    if (targetPos) {
      meshRef.current.visible = true;

      // Smoothly interpolate position
      meshRef.current.position.lerp(targetPos, 0.6);

      // Default stance for hands
      const isRight = type === 'right';
      const restingX = isRight ? -Math.PI / 4 : -Math.PI / 5;
      const restingY = isRight ? -0.2 : 0.2;
      const restingZ = isRight ? -0.1 : 0.1;

      let swayX = 0;
      let swayY = 0;
      let swayZ = 0;

      if (velocity) {
        swayX = velocity.y * 0.04;
        swayZ = -velocity.x * 0.04;
        swayY = velocity.z * 0.03;
      }

      targetRotation.current.set(restingX + swayX, restingY + swayY, restingZ + swayZ);

      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotation.current.x, 0.25);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotation.current.y, 0.25);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRotation.current.z, 0.25);
    } else {
      meshRef.current.visible = false;
    }
  });

  return (
    <group ref={meshRef}>
      {type === 'right' ? (
        /* RIGHT HAND: TACTICAL BATON / BAT */
        <group>
          {/* Hand Grip Glove */}
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[0.08, 0.12, 0.08]} />
            <meshStandardMaterial color="#222" roughness={0.7} metalness={0.2} />
          </mesh>

          {/* Knuckle Guards */}
          <mesh position={[0, -0.01, 0.04]}>
            <boxGeometry args={[0.085, 0.03, 0.02]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.3} metalness={0.9} />
          </mesh>

          {/* Baton Handle */}
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.02, 0.022, 0.25, 16]} />
            <meshStandardMaterial color="#111" roughness={0.5} metalness={0.8} />
          </mesh>

          {/* Leather Grip Wrap Rings */}
          <mesh position={[0, 0.02, 0]}>
            <torusGeometry args={[0.023, 0.003, 8, 20]} />
            <meshStandardMaterial color="#d97706" />
          </mesh>

          {/* Baton Main Shaft */}
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.032, 0.022, 0.7, 16]} />
            <meshStandardMaterial color="#475569" roughness={0.2} metalness={0.9} />
          </mesh>

          {/* Reinforced Spikes / Impact Ribs */}
          {[-0.1, 0, 0.1, 0.2].map((yOffset, idx) => (
            <mesh key={idx} position={[0, 0.45 + yOffset, 0]}>
              <cylinderGeometry args={[0.038, 0.038, 0.03, 16]} />
              <meshStandardMaterial color="#fbbf24" roughness={0.1} metalness={1} emissive="#f59e0b" emissiveIntensity={0.6} />
            </mesh>
          ))}

          {/* Glowing Top Tip */}
          <mesh position={[0, 0.86, 0]}>
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>

          {/* Light emission for weapon strike feedback */}
          <pointLight color="#f59e0b" intensity={2} distance={2.5} position={[0, 0.5, 0]} />
        </group>
      ) : (
        /* LEFT HAND: COMBAT FIST (EMPTY HAND / SOCO) */
        <group>
          {/* Armored Forearm Sleeve */}
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.05, 0.055, 0.2, 16]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.5} />
          </mesh>

          {/* Combat Glove Palm/Fist */}
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.09, 0.12, 0.09]} />
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>

          {/* Heavy Reinforced Knuckle Plate */}
          <mesh position={[0, 0.06, 0.045]}>
            <boxGeometry args={[0.095, 0.04, 0.025]} />
            <meshStandardMaterial color="#0284c7" roughness={0.2} metalness={0.8} />
          </mesh>

          {/* Cyan Energy Stripes */}
          <mesh position={[0, 0.02, 0.048]}>
            <planeGeometry args={[0.08, 0.02]} />
            <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
          </mesh>

          {/* Fist Light Aura */}
          <pointLight color="#38bdf8" intensity={1.5} distance={1.8} position={[0, 0.05, 0.05]} />
        </group>
      )}
    </group>
  );
};
