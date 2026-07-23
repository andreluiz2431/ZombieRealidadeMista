/**
 * Radar / Minimap HUD Component
 * Renders tactical rotating radar displaying player, safe house buildings, zombies, and remote survivors.
 * Rotates dynamically based on player's camera orientation (gyroscope).
 */

import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { PlayerWorldPos, ZombieData, HouseData, RemotePlayer } from '../types';
import { Shield } from 'lucide-react';

interface RadarHUDProps {
  playerPos: PlayerWorldPos;
  zombies: ZombieData[];
  houses: HouseData[];
  remotePlayers: RemotePlayer[];
  cameraQuaternionRef?: React.RefObject<THREE.Quaternion>;
}

export const RadarHUD: React.FC<RadarHUDProps> = ({
  playerPos,
  zombies,
  houses,
  remotePlayers,
  cameraQuaternionRef
}) => {
  const RADAR_RADIUS = 70; // Radar display radius in pixels
  const RADAR_RANGE = 40;  // Real world meters represented in radar radius

  // Forward unit vector in XZ plane (default facing North: x=0, z=-1)
  const [forwardVec, setForwardVec] = useState({ x: 0, z: -1 });

  // Update forward vector on animation frame from camera quaternion
  useEffect(() => {
    let animId: number;
    const tempQuat = new THREE.Quaternion();
    const tempVec = new THREE.Vector3();

    const updateHeading = () => {
      if (cameraQuaternionRef && cameraQuaternionRef.current) {
        tempQuat.copy(cameraQuaternionRef.current);
        tempVec.set(0, 0, -1).applyQuaternion(tempQuat);

        // Project onto XZ ground plane
        const len = Math.sqrt(tempVec.x * tempVec.x + tempVec.z * tempVec.z);
        if (len > 0.0001) {
          setForwardVec({ x: tempVec.x / len, z: tempVec.z / len });
        }
      }
      animId = requestAnimationFrame(updateHeading);
    };

    animId = requestAnimationFrame(updateHeading);
    return () => cancelAnimationFrame(animId);
  }, [cameraQuaternionRef]);

  const fx = forwardVec.x;
  const fz = forwardVec.z;

  // Transform world offset (dx, dz) to radar screen relative pixels
  // Screen X: Right = +X
  // Screen Y: Up = -Y
  const getRadarCoords = (dx: number, dz: number, maxRange: number = RADAR_RANGE) => {
    const screenX = -dx * fz + dz * fx;
    const screenY = -(dx * fx + dz * fz);

    const dist = Math.sqrt(screenX * screenX + screenY * screenY);
    if (dist < 0.0001) return { x: 0, y: 0, dist: 0 };

    const angle = Math.atan2(screenY, screenX);
    const clampedDist = Math.min(dist, maxRange);
    const pxRadius = (clampedDist / maxRange) * (RADAR_RADIUS - 12);

    return {
      x: Math.cos(angle) * pxRadius,
      y: Math.sin(angle) * pxRadius,
      dist,
      isEdge: dist > maxRange
    };
  };

  // Cardinal direction angles on radar ring
  const getCardinalPos = (worldDx: number, worldDz: number) => {
    const screenX = -worldDx * fz + worldDz * fx;
    const screenY = -(worldDx * fx + worldDz * fz);
    const angle = Math.atan2(screenY, screenX);
    const borderRadius = RADAR_RADIUS - 10;
    return {
      x: Math.cos(angle) * borderRadius,
      y: Math.sin(angle) * borderRadius
    };
  };

  const posNorth = getCardinalPos(0, -1);
  const posEast = getCardinalPos(1, 0);
  const posSouth = getCardinalPos(0, 1);
  const posWest = getCardinalPos(-1, 0);

  // Count active zombies nearby
  const activeZombies = zombies.filter((z) => z.state !== 'dead');

  return (
    <div className="relative w-36 h-36 rounded-full bg-slate-950/90 border-2 border-emerald-500/50 backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.3)] overflow-hidden flex items-center justify-center pointer-events-none">
      {/* Radar Grid Rings */}
      <div className="absolute inset-2 rounded-full border border-emerald-500/20" />
      <div className="absolute inset-8 rounded-full border border-emerald-500/20" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-[1px] bg-emerald-500/20" />
        <div className="h-full w-[1px] bg-emerald-500/20" />
      </div>

      {/* Radar Sweeper Rotation Effect */}
      <div className="absolute w-full h-full rounded-full animate-spin [animation-duration:3s] border-t-2 border-emerald-400/40 opacity-40" />

      {/* Dynamic Cardinal Compass Indicators (N, L, S, O) */}
      <div
        className="absolute text-[10px] font-black text-cyan-400 drop-shadow-[0_0_4px_#38bdf8] z-20"
        style={{ transform: `translate(${posNorth.x}px, ${posNorth.y}px)` }}
      >
        N
      </div>
      <div
        className="absolute text-[8px] font-bold text-slate-400 z-10"
        style={{ transform: `translate(${posEast.x}px, ${posEast.y}px)` }}
      >
        L
      </div>
      <div
        className="absolute text-[8px] font-bold text-slate-400 z-10"
        style={{ transform: `translate(${posSouth.x}px, ${posSouth.y}px)` }}
      >
        S
      </div>
      <div
        className="absolute text-[8px] font-bold text-slate-400 z-10"
        style={{ transform: `translate(${posWest.x}px, ${posWest.y}px)` }}
      >
        O
      </div>

      {/* Center Player Pointer (Facing Forward/Up) */}
      <div className="absolute w-3 h-3 bg-cyan-400 rounded-full border-2 border-white shadow-[0_0_10px_#38bdf8] z-30 flex items-center justify-center">
        {/* Forward direction arrow pointing UP */}
        <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px] border-b-cyan-300 -mt-2" />
      </div>

      {/* Safe Houses on Radar */}
      {houses.map((house) => {
        const dx = house.x - playerPos.x;
        const dz = house.z - playerPos.z;
        const coords = getRadarCoords(dx, dz);

        if (coords.dist > RADAR_RANGE * 1.5) return null;

        return (
          <div
            key={house.id}
            className="absolute z-10 p-0.5 bg-emerald-500 text-black rounded shadow-[0_0_8px_#22c55e]"
            style={{
              transform: `translate(${coords.x}px, ${coords.y}px)`
            }}
          >
            <Shield className="w-2.5 h-2.5 text-black" />
          </div>
        );
      })}

      {/* Remote Players on Radar */}
      {remotePlayers.map((p) => {
        const dx = p.x - playerPos.x;
        const dz = p.z - playerPos.z;
        const coords = getRadarCoords(dx, dz);

        if (coords.dist > RADAR_RANGE * 1.5) return null;

        return (
          <div
            key={p.id}
            className="absolute z-10 w-2.5 h-2.5 bg-blue-400 rounded-full border border-white shadow-[0_0_6px_#3b82f6]"
            style={{
              transform: `translate(${coords.x}px, ${coords.y}px)`
            }}
          />
        );
      })}

      {/* ZOMBIES ON RADAR - RED DOTS WITH THREAT INDICATORS */}
      {activeZombies.map((z) => {
        const dx = z.x - playerPos.x;
        const dz = z.z - playerPos.z;
        const coords = getRadarCoords(dx, dz);

        // Render dot or edge warning
        return (
          <div
            key={z.id}
            className={`absolute z-20 flex items-center justify-center transition-all ${
              coords.isEdge ? 'opacity-80 scale-90' : 'opacity-100'
            }`}
            style={{
              transform: `translate(${coords.x}px, ${coords.y}px)`
            }}
          >
            {/* Red Blip Dot */}
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full border border-red-200 shadow-[0_0_8px_#ef4444] animate-pulse" />
            {/* Outer pulsing threat ring for close zombies */}
            {coords.dist < 15 && (
              <div className="absolute w-4 h-4 rounded-full border border-red-500/80 animate-ping" />
            )}
          </div>
        );
      })}

      {/* Threat count label if zombies detected */}
      {activeZombies.length > 0 && (
        <div className="absolute bottom-1 bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-mono text-red-400 border border-red-500/30 z-30">
          {activeZombies.length} {activeZombies.length === 1 ? 'ZUMBI' : 'INIMIGOS'}
        </div>
      )}
    </div>
  );
};

