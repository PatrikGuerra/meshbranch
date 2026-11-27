import type { FaceSource } from './topology';

const SHARP = Math.cos((20 * Math.PI) / 180); // a crease sharper than 20° splits two faces
const FLAT = Math.cos((0.5 * Math.PI) / 180); // triangles this close count as one plane

// Faces for meshes without B-rep data (STL, OBJ): docs/MEASURE.md section 2.
// 1. Smooth regions: neighbours across a crease of at most 20° stay together.
// 2. Inside a curved region, a flat patch becomes its own face when it is real (3+ triangles or 10% of
//    the region's area), not just one facet strip of a cylinder or fillet.
export const estimatedFaces: FaceSource = (_mesh, triCount, corners, W) => {
  const nx = new Float64Array(triCount), ny = new Float64Array(triCount), nz = new Float64Array(triCount), area = new Float64Array(triCount);
  for (let t = 0; t < triCount; t++) {
    const a = corners[3 * t] * 3, b = corners[3 * t + 1] * 3, c = corners[3 * t + 2] * 3;
    const ux = W[b] - W[a], uy = W[b + 1] - W[a + 1], uz = W[b + 2] - W[a + 2];
    const vx = W[c] - W[a], vy = W[c + 1] - W[a + 1], vz = W[c + 2] - W[a + 2];
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx, l = Math.hypot(x, y, z);
    area[t] = l / 2;
    if (l > 0) { nx[t] = x / l; ny[t] = y / l; nz[t] = z / l; }
  }
  const dot = (s: number, t: number) => nx[s] * nx[t] + ny[s] * ny[t] + nz[s] * nz[t];

  // Triangles that share a side.
  const side = new Map<number, number>(), nbr: number[][] = Array.from({ length: triCount }, () => []);
  let maxId = 0;
  for (let k = 0; k < corners.length; k++) if (corners[k] > maxId) maxId = corners[k];
  const N = maxId + 1;
  for (let t = 0; t < triCount; t++) for (let j = 0; j < 3; j++) {
    const x = corners[3 * t + j], y = corners[3 * t + (j + 1) % 3], key = Math.min(x, y) * N + Math.max(x, y);
    const o = side.get(key);
    if (o === undefined) side.set(key, t); else { nbr[t].push(o); nbr[o].push(t); }
  }

  const grow = (seed: number, label: Int32Array, id: number, ok: (from: number, to: number) => boolean) => {
    const stack = [seed], members = [seed];
    label[seed] = id;
    while (stack.length) {
      const t = stack.pop()!;
      for (const o of nbr[t]) if (label[o] === -1 && ok(t, o)) { label[o] = id; stack.push(o); members.push(o); }
    }
    return members;
  };

  const out = new Int32Array(triCount).fill(-1);
  const smooth = new Int32Array(triCount).fill(-1);
  let next = 0;
  for (let s = 0; s < triCount; s++) {
    if (smooth[s] !== -1) continue;
    const region = grow(s, smooth, s, (a, b) => dot(a, b) >= SHARP);
    if (region.every(t => dot(t, s) >= FLAT)) { for (const t of region) out[t] = next; next++; continue; }
    // Curved region: keep real flat patches, the rest stays one face per connected curved part.
    const regionArea = region.reduce((sum, t) => sum + area[t], 0), flat = new Int32Array(triCount).fill(-1);
    const inRegion = new Set(region);
    for (const t of region) {
      if (flat[t] !== -1) continue;
      const patch = grow(t, flat, t, (_a, b) => inRegion.has(b) && dot(b, t) >= FLAT);
      const patchArea = patch.reduce((sum, x) => sum + area[x], 0);
      if (patch.length >= 3 || patchArea >= regionArea * 0.1) { for (const x of patch) out[x] = next; next++; }
    }
    const rest = new Int32Array(triCount).fill(-1);
    for (const t of region) {
      if (out[t] !== -1 || rest[t] !== -1) continue;
      for (const x of grow(t, rest, t, (_a, b) => inRegion.has(b) && out[b] === -1)) out[x] = next;
      next++;
    }
  }
  return out;
};
