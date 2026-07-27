/**
 * Post-Apocalyptic 3D Environment
 * Renders a rich city layout with asphalt roads, skyscrapers, houses, trees, street lamps, and atmosphere.
 */

import React, { useMemo } from 'react';
import { Grid, Stars } from '@react-three/drei';
import * as THREE from 'three';

export const Environment3D: React.FC = () => {
  // Generate deterministic building data
  const buildings = useMemo(() => {
    const list: Array<{
      x: number;
      z: number;
      w: number;
      h: number;
      d: number;
      color: string;
      windowColor: string;
    }> = [];

    const buildingColors = ['#1e293b', '#334155', '#1e1b4b', '#2e1065', '#0f172a', '#3f3f46'];
    const windowColors = ['#fef08a', '#38bdf8', '#fb923c', '#4ade80', '#f43f5e'];

    // Place buildings in 4 quadrants around central crossroads (leaving roads clear)
    const offsets = [
      { startX: 12, endX: 70, startZ: 12, endZ: 70 },
      { startX: -70, endX: -12, startZ: 12, endZ: 70 },
      { startX: 12, endX: 70, startZ: -70, endZ: -12 },
      { startX: -70, endX: -12, startZ: -70, endZ: -12 },
    ];

    let seed = 42;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    offsets.forEach((quad) => {
      for (let x = quad.startX; x < quad.endX; x += 16) {
        for (let z = quad.startZ; z < quad.endZ; z += 16) {
          if (pseudoRandom() > 0.2) {
            const w = 8 + pseudoRandom() * 6;
            const h = 8 + pseudoRandom() * 18; // Height up to 26m
            const d = 8 + pseudoRandom() * 6;
            const color = buildingColors[Math.floor(pseudoRandom() * buildingColors.length)];
            const windowColor = windowColors[Math.floor(pseudoRandom() * windowColors.length)];

            list.push({ x, z, w, h, d, color, windowColor });
          }
        }
      }
    });

    return list;
  }, []);

  // Generate deterministic trees
  const trees = useMemo(() => {
    const list: Array<{ x: number; z: number; scale: number; type: 'pine' | 'oak' }> = [];
    let seed = 1234;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // Along sidewalks and park areas
    for (let i = 0; i < 45; i++) {
      const angle = pseudoRandom() * Math.PI * 2;
      const dist = 8 + pseudoRandom() * 65;
      const x = Math.sin(angle) * dist;
      const z = Math.cos(angle) * dist;

      // Keep main roads near axis (x in [-6, 6] or z in [-6, 6]) clear
      if (Math.abs(x) > 7 && Math.abs(z) > 7) {
        list.push({
          x,
          z,
          scale: 0.8 + pseudoRandom() * 0.6,
          type: pseudoRandom() > 0.5 ? 'pine' : 'oak',
        });
      }
    }
    return list;
  }, []);

  // Street Lamp positions along main avenues
  const streetLamps = useMemo(() => {
    const list: Array<{ x: number; z: number }> = [];
    for (let pos = -60; pos <= 60; pos += 20) {
      if (Math.abs(pos) > 5) {
        list.push({ x: 7, z: pos });
        list.push({ x: -7, z: pos });
        list.push({ x: pos, z: 7 });
        list.push({ x: pos, z: -7 });
      }
    }
    return list;
  }, []);

  return (
    <>
      {/* Post-Apocalyptic Twilight Atmosphere */}
      <color attach="background" args={['#090d16']} />
      <fog attach="fog" args={['#0f172a', 10, 65]} />

      {/* Ambient & Directional Lighting */}
      <ambientLight intensity={0.5} color="#94a3b8" />
      
      {/* Cyan Moonlight */}
      <directionalLight position={[20, 35, -20]} intensity={0.8} color="#38bdf8" castShadow />
      
      {/* Red/Orange Horizon Rim Light */}
      <directionalLight position={[-25, 10, 25]} intensity={0.5} color="#f97316" />

      {/* Stars in Sky */}
      <Stars radius={80} depth={50} count={2000} factor={4} saturation={0.6} fade speed={0.5} />

      {/* Main Ground (Asphalt & Grass Terrain) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <planeGeometry args={[250, 250]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Main Crossroads Roads (North-South & East-West) */}
      {/* N-S Avenue */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[12, 200]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>
      {/* E-W Avenue */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[200, 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>

      {/* Yellow Road Divider Lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[0.25, 200]} />
        <meshBasicMaterial color="#eab308" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 0.25]} />
        <meshBasicMaterial color="#eab308" />
      </mesh>

      {/* Grid Overlay for Tactical HUD Feel */}
      <Grid
        position={[0, 0.01, 0]}
        args={[200, 200]}
        cellThickness={0.1}
        cellColor="#1e293b"
        sectionSize={10}
        sectionThickness={1.2}
        sectionColor="#0284c7"
        fadeDistance={60}
        infiniteGrid
      />

      {/* City Buildings & Skyscrapers */}
      {buildings.map((b, i) => (
        <group key={`bld-${i}`} position={[b.x, 0, b.z]}>
          {/* Main Building Frame */}
          <mesh position={[0, b.h / 2, 0]}>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.color} roughness={0.6} metalness={0.3} />
          </mesh>

          {/* Roof Accent Box */}
          <mesh position={[0, b.h + 0.5, 0]}>
            <boxGeometry args={[b.w * 0.6, 1, b.d * 0.6]} />
            <meshStandardMaterial color="#0f172a" roughness={0.5} />
          </mesh>

          {/* Glowing Windows Grid */}
          <mesh position={[0, b.h / 2, b.d / 2 + 0.05]}>
            <planeGeometry args={[b.w * 0.7, b.h * 0.7]} />
            <meshBasicMaterial color={b.windowColor} transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, b.h / 2, -b.d / 2 - 0.05]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[b.w * 0.7, b.h * 0.7]} />
            <meshBasicMaterial color={b.windowColor} transparent opacity={0.85} />
          </mesh>
        </group>
      ))}

      {/* Suburban Houses & Shelters */}
      {[
        { x: -22, z: 22, color: '#334155' },
        { x: 22, z: -22, color: '#1e293b' },
        { x: -35, z: -22, color: '#475569' },
        { x: 35, z: 22, color: '#1e1b4b' },
      ].map((h, i) => (
        <group key={`house-${i}`} position={[h.x, 0, h.z]}>
          {/* House body */}
          <mesh position={[0, 2.5, 0]}>
            <boxGeometry args={[7, 5, 7]} />
            <meshStandardMaterial color={h.color} roughness={0.7} />
          </mesh>
          {/* Sloped Roof */}
          <mesh position={[0, 6, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[5.5, 2.5, 4]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.5} />
          </mesh>
          {/* Glowing Window */}
          <mesh position={[0, 2.5, 3.55]}>
            <planeGeometry args={[2, 1.5]} />
            <meshBasicMaterial color="#fef08a" />
          </mesh>
        </group>
      ))}

      {/* Trees & Foliage */}
      {trees.map((t, i) => (
        <group key={`tree-${i}`} position={[t.x, 0, t.z]} scale={[t.scale, t.scale, t.scale]}>
          {/* Trunk */}
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.25, 0.4, 3, 8]} />
            <meshStandardMaterial color="#451a03" roughness={0.9} />
          </mesh>
          {/* Foliage */}
          {t.type === 'pine' ? (
            <>
              <mesh position={[0, 3.8, 0]}>
                <coneGeometry args={[1.6, 3, 8]} />
                <meshStandardMaterial color="#14532d" roughness={0.8} />
              </mesh>
              <mesh position={[0, 5.2, 0]}>
                <coneGeometry args={[1.2, 2.2, 8]} />
                <meshStandardMaterial color="#166534" roughness={0.8} />
              </mesh>
            </>
          ) : (
            <mesh position={[0, 3.8, 0]}>
              <sphereGeometry args={[1.8, 8, 8]} />
              <meshStandardMaterial color="#15803d" roughness={0.8} />
            </mesh>
          )}
        </group>
      ))}

      {/* Street Lamps along Avenues */}
      {streetLamps.map((lamp, i) => (
        <group key={`lamp-${i}`} position={[lamp.x, 0, lamp.z]}>
          {/* Lamp Pole */}
          <mesh position={[0, 2.5, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 5, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Lamp Head */}
          <mesh position={[0, 5, 0]}>
            <boxGeometry args={[0.4, 0.2, 0.4]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
          {/* Point Light Pool */}
          <pointLight color="#fef08a" intensity={2} distance={8} position={[0, 4.8, 0]} />
        </group>
      ))}

      {/* Burning Barrels / Fire Props */}
      {[
        { x: -5, z: -10 },
        { x: 6, z: 12 },
        { x: -14, z: 6 },
      ].map((barrel, i) => (
        <group key={`barrel-${i}`} position={[barrel.x, 0, barrel.z]}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.4, 0.4, 1.2, 12]} />
            <meshStandardMaterial color="#1f2937" roughness={0.8} />
          </mesh>
          {/* Fire Glow */}
          <mesh position={[0, 1.25, 0]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshBasicMaterial color="#f97316" />
          </mesh>
          <pointLight color="#f97316" intensity={3} distance={6} position={[0, 1.3, 0]} />
        </group>
      ))}
    </>
  );
};
