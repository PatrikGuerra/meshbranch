import * as THREE from 'three';
import { classifyEdge, classifyFace } from './classify';
import type { Edge, Face, Vertex } from './types';

export type MeshTopology = {
  faceOfTri: Int32Array; // triangle -> index into faces (-1: none)
  faces: Face[];
  edges: Edge[];
  vertices: Vertex[]; // corners plus snap points (midpoints of lines, centers of circles)
};
export type Topology = Map<THREE.Mesh, MeshTopology>;

// Face id per triangle. STEP gives B-rep face ranges; meshes without them get null (corner snap only).
export type FaceSource = (mesh: THREE.Mesh, triCount: number, corners: Uint32Array, pos: Float32Array) => Int32Array | null;

export const brepFaces: FaceSource = (mesh, triCount) => {
  const r = mesh.userData.brepFaces as Int32Array | undefined;
  if (!r) return null;
  const out = new Int32Array(triCount).fill(-1);
  for (let f = 0; f < r.length / 2; f++) for (let t = r[2 * f]; t <= r[2 * f + 1] && t < triCount; t++) out[t] = f;
  return out;
};

// shortcut: runs on the page thread when Measure is first turned on; move to a worker if big models stall.
export function buildTopology(meshes: readonly THREE.Mesh[], diagonal: number, faceSources: FaceSource[] = [brepFaces]): Topology {
  const out: Topology = new Map();
  for (const mesh of meshes) {
    const t = meshTopology(mesh, diagonal, faceSources);
    if (t) out.set(mesh, t);
  }
  return out;
}

export function meshTopology(mesh: THREE.Mesh, diagonal: number, faceSources: FaceSource[] = [brepFaces]): MeshTopology | null {
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry, attr = g.attributes.position, idx = g.index;
  const triCount = (idx ? idx.count : attr.count) / 3;
  const pos = new Float32Array(attr.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < attr.count; i++) { v.fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld); pos.set([v.x, v.y, v.z], i * 3); }

  // Weld equal positions so neighbouring triangles share corner ids.
  const q = diagonal * 1e-6 || 1e-9, ids = new Map<string, number>(), weldPos: number[] = [];
  const weldOf = new Uint32Array(attr.count);
  for (let i = 0; i < attr.count; i++) {
    const key = `${Math.round(pos[3 * i] / q)},${Math.round(pos[3 * i + 1] / q)},${Math.round(pos[3 * i + 2] / q)}`;
    let id = ids.get(key);
    if (id === undefined) { id = weldPos.length / 3; ids.set(key, id); weldPos.push(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]); }
    weldOf[i] = id;
  }
  const corners = new Uint32Array(triCount * 3);
  for (let k = 0; k < triCount * 3; k++) corners[k] = weldOf[idx ? idx.getX(k) : k];
  const P = (id: number) => new THREE.Vector3(weldPos[3 * id], weldPos[3 * id + 1], weldPos[3 * id + 2]);

  let faceOfTri: Int32Array | null = null;
  for (const src of faceSources) if ((faceOfTri = src(mesh, triCount, corners, pos))) break;
  if (!faceOfTri) return null;

  // Faces.
  const triList = new Map<number, number[]>();
  for (let t = 0; t < triCount; t++) if (faceOfTri[t] >= 0) { const l = triList.get(faceOfTri[t]); if (l) l.push(t); else triList.set(faceOfTri[t], [t]); }
  const faces: Face[] = [], remap = new Map<number, number>();
  const tol = diagonal * 1e-4;
  for (const [fid, list] of triList) {
    const tris = new Float32Array(list.length * 9);
    let area = 0; const centroid = new THREE.Vector3();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    list.forEach((t, k) => {
      for (let j = 0; j < 3; j++) tris.set(P(corners[3 * t + j]).toArray(), k * 9 + j * 3);
      a.fromArray(tris, k * 9); b.fromArray(tris, k * 9 + 3); c.fromArray(tris, k * 9 + 6);
      const ar = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
      area += ar; centroid.addScaledVector(a.clone().add(b).add(c).divideScalar(3), ar);
    });
    remap.set(fid, faces.length);
    faces.push({ kind: 'face', id: faces.length, tris, area, centroid: area ? centroid.divideScalar(area) : a.clone(), shape: classifyFace(tris, tol), mesh });
  }
  const faceIdx = new Int32Array(triCount);
  for (let t = 0; t < triCount; t++) faceIdx[t] = faceOfTri[t] >= 0 ? remap.get(faceOfTri[t])! : -1;

  // Feature segments: triangle sides between two different faces, or on an open border.
  const sides = new Map<number, { lo: number; hi: number; f: number[] }>();
  const W = weldPos.length / 3;
  for (let t = 0; t < triCount; t++) for (let j = 0; j < 3; j++) {
    const x = corners[3 * t + j], y = corners[3 * t + (j + 1) % 3];
    if (x === y) continue;
    const lo = Math.min(x, y), hi = Math.max(x, y), key = lo * W + hi;
    const s = sides.get(key);
    if (s) s.f.push(faceIdx[t]); else sides.set(key, { lo, hi, f: [faceIdx[t]] });
  }
  type Seg = { a: number; b: number; key: string };
  const segs: Seg[] = [];
  for (const s of sides.values()) {
    const distinct = [...new Set(s.f)].sort((x, y) => x - y);
    if (s.f.length === 1 || distinct.length > 1) segs.push({ a: s.lo, b: s.hi, key: distinct.join('|') });
  }
  const adj = new Map<number, number[]>();
  segs.forEach((s, i) => { for (const p of [s.a, s.b]) { const l = adj.get(p); if (l) l.push(i); else adj.set(p, [i]); } });
  const isNode = (p: number) => { const l = adj.get(p)!; return l.length !== 2 || segs[l[0]].key !== segs[l[1]].key; };

  // Chain segments into edges; an edge stops where 3+ faces meet.
  const used = new Uint8Array(segs.length), chains: { pts: number[]; closed: boolean }[] = [];
  const walk = (start: number, first: number) => {
    const pts = [start]; let seg = first, p = start;
    for (;;) {
      used[seg] = 1;
      p = segs[seg].a === p ? segs[seg].b : segs[seg].a;
      if (p === start) return { pts, closed: true };
      pts.push(p);
      if (isNode(p)) return { pts, closed: false };
      const next = adj.get(p)!.find(i => !used[i]);
      if (next === undefined) return { pts, closed: false };
      seg = next;
    }
  };
  for (const [p, list] of adj) if (isNode(p)) for (const s of list) if (!used[s]) chains.push(walk(p, s));
  for (let s = 0; s < segs.length; s++) if (!used[s]) chains.push(walk(segs[s].a, s));

  const edges: Edge[] = [], vertices: Vertex[] = [], nodes = new Set<number>();
  for (const ch of chains) {
    const points = ch.pts.map(P);
    let length = 0;
    for (let i = 1; i < points.length; i++) length += points[i].distanceTo(points[i - 1]);
    if (ch.closed) length += points[points.length - 1].distanceTo(points[0]);
    const shape = classifyEdge(points, ch.closed, tol);
    edges.push({ kind: 'edge', id: edges.length, points, closed: ch.closed, length, shape, mesh });
    if (!ch.closed) { nodes.add(ch.pts[0]); nodes.add(ch.pts[ch.pts.length - 1]); }
    if (shape.type === 'line') vertices.push({ kind: 'vertex', p: points[0].clone().add(points[points.length - 1]).multiplyScalar(0.5), label: 'Midpoint', mesh });
    if (shape.type === 'circle') vertices.push({ kind: 'vertex', p: shape.center.clone(), label: 'Center', mesh });
  }
  for (const n of nodes) vertices.unshift({ kind: 'vertex', p: P(n), label: 'Vertex', mesh });
  // Two circle edges of the same hole share a center: keep one.
  const seen: THREE.Vector3[] = [];
  const unique = vertices.filter(x => x.label !== 'Center' || (!seen.some(s => s.distanceTo(x.p) < tol) && !!seen.push(x.p)));
  return { faceOfTri: faceIdx, faces, edges, vertices: unique };
}
