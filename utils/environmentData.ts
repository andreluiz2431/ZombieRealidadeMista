/**
 * Shared environment obstacles & collision detection system.
 * Prevents player from walking through buildings, houses, and tree trunks.
 */

export interface BoundingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CylinderObstacle {
  x: number;
  z: number;
  radius: number;
}

// Generate the exact same deterministic building boxes as Environment3D
export const getBuildingObstacles = (): BoundingBox[] => {
  const list: BoundingBox[] = [];

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
          pseudoRandom(); // h
          const d = 8 + pseudoRandom() * 6;
          pseudoRandom(); // color
          pseudoRandom(); // windowColor

          list.push({
            minX: x - w / 2,
            maxX: x + w / 2,
            minZ: z - d / 2,
            maxZ: z + d / 2,
          });
        }
      }
    }
  });

  // Add Suburban Houses & Safe Shelters
  const houses = [
    { x: -22, z: 22, w: 7, d: 7 },
    { x: 22, z: -22, w: 7, d: 7 },
    { x: -35, z: -22, w: 7, d: 7 },
    { x: 35, z: 22, w: 7, d: 7 },
    { x: 12, z: -14, w: 6, d: 6 },
    { x: -22, z: 20, w: 8, d: 7 },
    { x: 28, z: 32, w: 7, d: 8 },
  ];

  houses.forEach((h) => {
    list.push({
      minX: h.x - h.w / 2,
      maxX: h.x + h.w / 2,
      minZ: h.z - h.d / 2,
      maxZ: h.z + h.d / 2,
    });
  });

  return list;
};

// Generate tree trunk obstacle circles
export const getTreeObstacles = (): CylinderObstacle[] => {
  const list: CylinderObstacle[] = [];
  let seed = 1234;
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < 45; i++) {
    const angle = pseudoRandom() * Math.PI * 2;
    const dist = 8 + pseudoRandom() * 65;
    const x = Math.sin(angle) * dist;
    const z = Math.cos(angle) * dist;

    if (Math.abs(x) > 7 && Math.abs(z) > 7) {
      list.push({ x, z, radius: 0.7 });
    }
  }
  return list;
};

const BUILDINGS = getBuildingObstacles();
const TREES = getTreeObstacles();

export const isPositionColliding = (x: number, z: number, playerRadius = 0.5): boolean => {
  // Check building/house boxes
  for (let i = 0; i < BUILDINGS.length; i++) {
    const b = BUILDINGS[i];
    if (
      x + playerRadius > b.minX &&
      x - playerRadius < b.maxX &&
      z + playerRadius > b.minZ &&
      z - playerRadius < b.maxZ
    ) {
      return true;
    }
  }

  // Check tree trunks
  for (let i = 0; i < TREES.length; i++) {
    const t = TREES[i];
    const dx = x - t.x;
    const dz = z - t.z;
    const minDist = playerRadius + t.radius;
    if (dx * dx + dz * dz < minDist * minDist) {
      return true;
    }
  }

  return false;
};

/**
 * Resolves movement with wall sliding so the player slides smoothly along surfaces without passing through.
 */
export const resolvePlayerCollision = (
  currX: number,
  currZ: number,
  targetX: number,
  targetZ: number,
  playerRadius = 0.5
): { x: number; z: number } => {
  // If target position has no collision, move directly
  if (!isPositionColliding(targetX, targetZ, playerRadius)) {
    return { x: targetX, z: targetZ };
  }

  // Try sliding along X wall (move X only)
  if (!isPositionColliding(targetX, currZ, playerRadius)) {
    return { x: targetX, z: currZ };
  }

  // Try sliding along Z wall (move Z only)
  if (!isPositionColliding(currX, targetZ, playerRadius)) {
    return { x: currX, z: targetZ };
  }

  // Fully blocked
  return { x: currX, z: currZ };
};
