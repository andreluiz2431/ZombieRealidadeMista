/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';

export enum GameStatus {
  LOADING = 'LOADING',
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export type HandType = 'left' | 'right';

export interface GPSCoords {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy: number;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export interface PlayerWorldPos {
  x: number; // Easting offset in meters
  y: number; // Height
  z: number; // Northing offset in meters
}

export interface ZombieData {
  id: string;
  x: number;
  y: number;
  z: number;
  health: number;
  maxHealth: number;
  speed: number;
  type: 'walker' | 'runner' | 'brute';
  state: 'chasing' | 'attacking' | 'hit' | 'dead';
  rotation: number;
  hitTime?: number;
  damage: number;
}

export interface HouseData {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  radius: number; // Safe zone radius around house center
  color: string;
}

export interface RemotePlayer {
  id: string;
  name: string;
  x: number;
  z: number;
  health: number;
  kills: number;
  lastActive: number;
  lat?: number;
  lng?: number;
  color: string;
}

export interface HandPositions {
  left: THREE.Vector3 | null;
  right: THREE.Vector3 | null;
  leftVelocity: THREE.Vector3;
  rightVelocity: THREE.Vector3;
}

export const COLORS = {
  left: '#38bdf8',  // Cyan/Punch Fist
  right: '#f59e0b', // Amber/Baton
  safeZone: '#22c55e', // Green Safe Zone
  zombie: '#ef4444',   // Red Zombie
  zombieEye: '#ff0000'
};
