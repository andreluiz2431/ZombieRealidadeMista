/**
 * GPS Utility Functions
 * Converts real-world latitude/longitude coordinates to local 3D world coordinates (meters).
 */

import { GPSCoords, PlayerWorldPos } from '../types';

// Earth radius in meters
const EARTH_RADIUS = 6378137;

/**
 * Converts latitude & longitude difference relative to a reference origin into (x, z) 3D meters.
 * x: East (+) / West (-) in meters
 * z: South (+) / North (-) in meters (matching standard Three.js coordinates where -Z is North/forward)
 */
export const gpsToWorldCoords = (
  originLat: number,
  originLng: number,
  targetLat: number,
  targetLng: number
): PlayerWorldPos => {
  const dLat = ((targetLat - originLat) * Math.PI) / 180;
  const dLng = ((targetLng - originLng) * Math.PI) / 180;

  const originLatRad = (originLat * Math.PI) / 180;

  // X offset = Easting (Longitude difference scaled by cos(lat))
  const x = dLng * EARTH_RADIUS * Math.cos(originLatRad);

  // Z offset = Northing (Latitude difference inverted: North is -Z in Three.js)
  const z = -dLat * EARTH_RADIUS;

  return { x, y: 0, z };
};

/**
 * Calculates distance in meters between two lat/lng points using Haversine formula
 */
export const haversineDistanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = EARTH_RADIUS;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
