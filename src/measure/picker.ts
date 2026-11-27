import * as THREE from 'three';
import type { SceneView } from '../viewer/scene';
import type { Entity } from './types';

export const SNAP_PX = { vertex: 10, point: 8, edge: 6 };

// Corners of the triangle under the pointer: the nearest within SNAP_PX.vertex becomes a vertex.
// This is the fallback snap for meshes without topology.
export function pickCorner(view: SceneView, e: { clientX: number; clientY: number }, scale = 1): Entity | null {
  const hit = view.raycastAt(e)[0];
  if (!hit || hit.faceIndex == null) return null;
  const mesh = hit.object, g = mesh.geometry, pos = g.attributes.position, idx = g.index;
  const r = view.canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  let best: THREE.Vector3 | null = null, bestD = SNAP_PX.vertex * scale;
  for (let k = 0; k < 3; k++) {
    const i = idx ? idx.getX(hit.faceIndex * 3 + k) : hit.faceIndex * 3 + k;
    const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const s = view.toScreen(p), d = Math.hypot(s.x - mx, s.y - my);
    if (d <= bestD) { bestD = d; best = p; }
  }
  return best && { kind: 'vertex', p: best, label: 'Vertex', mesh };
}
