/**
 * Radar / Minimap HUD Component
 * Renders tactical radar displaying player, safe house buildings, zombies, and remote survivors.
 */

import React from 'react';
import { PlayerWorldPos, ZombieData, HouseData, RemotePlayer } from '../types';
import { Shield, Compass } from 'lucide-react';

interface RadarHUDProps {
  playerPos: PlayerWorldPos;
  zombies: ZombieData[];
  houses: HouseData[];
  remotePlayers: RemotePlayer[];
  heading?: number;
}

export const RadarHUD: React.FC<RadarHUDProps> = ({ playerPos, zombies, houses, remotePlayers }) => {
  const RADAR_RADIUS = 70; // Radar display radius in pixels
  const RADAR_RANGE = 40;  // Real world meters represented in radar radius

  return (
    <div className="relative w-36 h-36 rounded-full bg-slate-950/90 border-2 border-emerald-500/50 backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.3)] overflow-hidden flex items-center justify-center pointer-events-none">
      {/* Radar Grid Lines */}
      <div className="absolute inset-2 rounded-full border border-emerald-500/20" />
      <div className="absolute inset-8 rounded-full border border-emerald-500/20" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-[1px] bg-emerald-500/20" />
        <div className="h-full w-[1px] bg-emerald-500/20" />
      </div>

      {/* Radar Sweeper Line Animation */}
      <div className="absolute w-full h-full rounded-full animate-spin [animation-duration:4s] border-t-2 border-emerald-400/40 opacity-40" />

      {/* Center Player Marker */}
      <div className="absolute w-3 h-3 bg-cyan-400 rounded-full border-2 border-white shadow-[0_0_10px_#38bdf8] z-20 flex items-center justify-center">
        <div className="w-1 h-1 bg-white rounded-full" />
      </div>

      {/* Safe Houses on Radar */}
      {houses.map((house) => {
        const dx = house.x - playerPos.x;
        const dz = house.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > RADAR_RANGE) return null;

        const radarX = (dx / RADAR_RANGE) * (RADAR_RADIUS - 10);
        const radarY = (dz / RADAR_RANGE) * (RADAR_RADIUS - 10);

        return (
          <div
            key={house.id}
            className="absolute z-10 p-0.5 bg-emerald-500 text-black rounded shadow-[0_0_8px_#22c55e]"
            style={{
              transform: `translate(${radarX}px, ${radarY}px)`
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
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > RADAR_RANGE) return null;

        const radarX = (dx / RADAR_RANGE) * (RADAR_RADIUS - 10);
        const radarY = (dz / RADAR_RANGE) * (RADAR_RADIUS - 10);

        return (
          <div
            key={p.id}
            className="absolute z-10 w-2.5 h-2.5 bg-blue-400 rounded-full border border-white shadow-[0_0_6px_#3b82f6]"
            style={{
              transform: `translate(${radarX}px, ${radarY}px)`
            }}
          />
        );
      })}

      {/* Zombies on Radar */}
      {zombies.map((z) => {
        if (z.state === 'dead') return null;

        const dx = z.x - playerPos.x;
        const dz = z.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > RADAR_RANGE) return null;

        const radarX = (dx / RADAR_RANGE) * (RADAR_RADIUS - 10);
        const radarY = (dz / RADAR_RANGE) * (RADAR_RADIUS - 10);

        return (
          <div
            key={z.id}
            className="absolute z-10 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_6px_#ef4444] animate-ping"
            style={{
              transform: `translate(${radarX}px, ${radarY}px)`
            }}
          />
        );
      })}

      {/* Compass North Label */}
      <div className="absolute top-1 text-[9px] font-bold text-emerald-400 tracking-tighter flex items-center gap-0.5">
        <Compass className="w-2.5 h-2.5 text-emerald-400" /> N
      </div>
    </div>
  );
};
