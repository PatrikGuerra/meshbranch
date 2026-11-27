import * as THREE from 'three';
import type { SceneView } from '../viewer/scene';
import type { Topology } from './topology';
import type { Edge, Entity } from './types';

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

// Pixel distance from (mx, my) to the segment a-b; t is where along it.
function segDist(mx: number, my: number, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.min(1, Math.max(0, ((mx - a.x) * dx + (my - a.y) * dy) / l2)) : 0;
  return { d: Math.hypot(a.x + t * dx - mx, a.y + t * dy - my), t };
}

// Snap with priority: vertex, then midpoint or center, then edge, then the face under the cursor (docs/MEASURE.md 5.1).
// Candidates come from every mesh the cursor ray crosses; hidden ones are dropped by the occlusion check.
export function pickTopology(view: SceneView, topo: Topology, e: { clientX: number; clientY: number }, snap: boolean, scale = 1): Entity | null {
  const hits = view.raycastAt(e);
  const hit = hits[0];
  if (!hit) return null;
  const hitTopo = topo.get(hit.object);
  if (!hitTopo) return pickCorner(view, e, scale);
  const r = view.canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  const tol = view.modelDiagonal() * 1e-3, cam = view.cam;
  const toScreen = (p: THREE.Vector3) => { const v = p.clone().project(cam); return { x: (v.x + 1) / 2 * r.width, y: (1 - v.y) / 2 * r.height, z: v.z }; };
  if (snap) {
    const meshes = [...new Set(hits.map(h => h.object))].map(m => topo.get(m)).filter((t): t is NonNullable<typeof t> => !!t);
    for (const pass of ['Vertex', 'point'] as const) {
      let best: Entity | null = null, bestD = (pass === 'Vertex' ? SNAP_PX.vertex : SNAP_PX.point) * scale;
      for (const t of meshes) for (const v of t.vertices) {
        if ((pass === 'Vertex') !== (v.label === 'Vertex')) continue;
        const s = toScreen(v.p);
        if (s.z > 1) continue;
        const d = Math.hypot(s.x - mx, s.y - my);
        if (d <= bestD && view.isVisiblePoint(v.p, tol)) { bestD = d; best = v; }
      }
      if (best) return best;
    }
    let bestEdge: Edge | null = null, bestD = SNAP_PX.edge * scale;
    for (const t of meshes) for (const edge of t.edges) {
      const pts = edge.closed ? [...edge.points, edge.points[0]] : edge.points;
      let prev = toScreen(pts[0]);
      for (let i = 1; i < pts.length; i++) {
        const cur = toScreen(pts[i]);
        if (prev.z <= 1 && cur.z <= 1) {
          const { d, t: u } = segDist(mx, my, prev, cur);
          if (d <= bestD) {
            const w = pts[i - 1].clone().lerp(pts[i], u);
            if (view.isVisiblePoint(w, tol)) { bestD = d; bestEdge = edge; }
          }
        }
        prev = cur;
      }
    }
    if (bestEdge) return bestEdge;
  }
  const f = hit.faceIndex != null ? hitTopo.faceOfTri[hit.faceIndex] : -1;
  return f >= 0 ? hitTopo.faces[f] : null;
}

