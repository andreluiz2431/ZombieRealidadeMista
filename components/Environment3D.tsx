/**
 * Post-Apocalyptic 3D Environment
 * Renders desolate terrain grid, ruins, street barricades, sky atmosphere, and fog.
 */

import React from 'react';
import { Grid, Stars } from '@react-three/drei';

export const Environment3D: React.FC = () => {
  return (
    <>
      {/* Dark Post-Apocalyptic Atmosphere */}
      <color attach="background" args={['#08080c']} />
      <fog attach="fog" args={['#08080c', 5, 45]} />

      {/* Lighting setup */}
      <ambientLight intensity={0.25} color="#64748b" />
      <directionalLight position={[10, 20, -10]} intensity={0.6} color="#38bdf8" castShadow />
      <directionalLight position={[-10, 15, 10]} intensity={0.4} color="#ef4444" />

      {/* Stars & Blood/Toxic Moon Horizon */}
      <Stars radius={60} depth={50} count={1500} factor={4} saturation={0.5} fade speed={0.5} />

      {/* Floor / Ruined Road Grid */}
      <Grid
        position={[0, -0.01, 0]}
        args={[200, 200]}
        cellThickness={0.1}
        cellColor="#1e293b"
        sectionSize={10}
        sectionThickness={1.5}
        sectionColor="#0284c7"
        fadeDistance={50}
        infiniteGrid
      />

      {/* Dark Asphalt Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Scattered Ruined Barricades / Concrete Blocks around origin */}
      {[-15, 18, -30, 25, -45, 40].map((xOffset, i) => {
        const zOffset = (i % 2 === 0 ? 1 : -1) * (15 + i * 8);
        return (
          <group key={i} position={[xOffset, 0.5, zOffset]} rotation={[0, (i * Math.PI) / 3, 0]}>
            {/* Concrete Barrier */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[3, 1, 0.8]} />
              <meshStandardMaterial color="#334155" roughness={0.9} />
            </mesh>

            {/* Warning Stripe */}
            <mesh position={[0, 0.3, 0.41]}>
              <planeGeometry args={[2.8, 0.2]} />
              <meshBasicMaterial color="#eab308" />
            </mesh>
          </group>
        );
      })}
    </>
  );
};
