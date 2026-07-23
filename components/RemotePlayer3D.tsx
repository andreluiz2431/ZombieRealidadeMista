/**
 * 3D Remote Survivor Component for Multiplayer
 * Displays fellow online survivors in the post-apocalyptic world.
 */

import React from 'react';
import { Html } from '@react-three/drei';
import { RemotePlayer } from '../types';
import { User } from 'lucide-react';

interface RemotePlayer3DProps {
  player: RemotePlayer;
}

export const RemotePlayer3D: React.FC<RemotePlayer3DProps> = ({ player }) => {
  return (
    <group position={[player.x, 0, player.z]}>
      {/* Name tag and health bar overhead */}
      <Html position={[0, 2.3, 0]} center distanceFactor={15}>
        <div className="flex flex-col items-center bg-black/80 px-2 py-1 rounded border border-blue-500/50 shadow text-xs">
          <div className="flex items-center gap-1 font-bold text-blue-300">
            <User className="w-3 h-3 text-blue-400" />
            <span>{player.name}</span>
          </div>
          <div className="w-12 h-1 bg-gray-700 rounded mt-0.5 overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${player.health}%` }} />
          </div>
        </div>
      </Html>

      {/* Survivor Body Avatar */}
      <mesh position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.3, 1.2, 8, 16]} />
        <meshStandardMaterial color={player.color || '#3b82f6'} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Visor / Helmet Glow */}
      <mesh position={[0, 1.4, 0.2]}>
        <boxGeometry args={[0.25, 0.1, 0.1]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>

      {/* Light Beacon */}
      <pointLight color="#3b82f6" intensity={1.5} distance={3} position={[0, 1.5, 0]} />
    </group>
  );
};
