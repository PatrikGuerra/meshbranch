import * as THREE from 'three';
import type { Entity } from './types';

export type Pair = { d: number; a: THREE.Vector3; b: THREE.Vector3 };
type Seg = [THREE.Vector3, THREE.Vector3];

// Closest points between segments p1-q1 and p2-q2 (Ericson, Real-Time Collision Detection 5.1.9).
export function segSeg(p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3): Pair {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s = 0, t = 0;
  if (a <= 1e-18 && e <= 1e-18) { /* both points */ }
  else if (a <= 1e-18) t = THREE.MathUtils.clamp(f / e, 0, 1);
  else {
    const c = d1.dot(r);
    if (e <= 1e-18) s = THREE.MathUtils.clamp(-c / a, 0, 1);
    else {
      const b = d1.dot(d2), den = a * e - b * b;
      s = den > 1e-18 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1); }
    }
  }
  const A = p1.clone().addScaledVector(d1, s), B = p2.clone().addScaledVector(d2, t);
  return { d: A.distanceTo(B), a: A, b: B };
}

const tmp = new THREE.Vector3();
function pointTri(p: THREE.Vector3, t: THREE.Triangle): Pair {
  const q = t.closestPointToPoint(p, new THREE.Vector3());
  return { d: p.distanceTo(q), a: p.clone(), b: q };
}

// Everything the distance code needs from one entity, in world space.
type Shape = { points: THREE.Vector3[]; segs: Seg[]; tris: THREE.Triangle[]; center: THREE.Vector3; spheres: { c: THREE.Vector3; r: number }[] };

export function shapeOf(e: Entity): Shape {
  if (e.kind === 'vertex') return { points: [e.p], segs: [], tris: [], center: e.p, spheres: [] };
  if (e.kind === 'edge') {
    const pts = e.points, segs: Seg[] = [];
    for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]);
    if (e.closed) segs.push([pts[pts.length - 1], pts[0]]);
    return { points: pts, segs, tris: [], center: edgeCenter(e), spheres: [] };
  }
  const tris: THREE.Triangle[] = [], seen = new Map<string, THREE.Vector3>(), spheres: Shape['spheres'] = [];
  for (let i = 0; i < e.tris.length; i += 9) {
    const t = new THREE.Triangle(new THREE.Vector3().fromArray(e.tris, i), new THREE.Vector3().fromArray(e.tris, i + 3), new THREE.Vector3().fromArray(e.tris, i + 6));
    tris.push(t);
    const c = t.a.clone().add(t.b).add(t.c).divideScalar(3);
    spheres.push({ c, r: Math.max(c.distanceTo(t.a), c.distanceTo(t.b), c.distanceTo(t.c)) });
    for (const p of [t.a, t.b, t.c]) seen.set(`${p.x},${p.y},${p.z}`, p);
  }
  return { points: [...seen.values()], segs: [], tris, center: e.centroid, spheres };
}

export function edgeCenter(e: Extract<Entity, { kind: 'edge' }>): THREE.Vector3 {
  if (e.shape.type === 'circle') return e.shape.center;
  const pts = e.points, half = e.length / 2;
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = pts[i].distanceTo(pts[i - 1]);
    if (run + l >= half) return pts[i - 1].clone().lerp(pts[i], l ? (half - run) / l : 0);
    run += l;
  }
  return pts[0];
}

const better = (x: Pair, y: Pair) => (y.d < x.d ? y : x);

function segTri(s: Seg, t: THREE.Triangle): Pair {
  let best = pointTri(s[0], t);
  best = better(best, pointTri(s[1], t));
  for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as Seg[]) best = better(best, segSeg(s[0], s[1], u, v));
  // The segment may pass through the triangle.
  const ray = new THREE.Ray(s[0], tmp.copy(s[1]).sub(s[0]).normalize()), len = s[0].distanceTo(s[1]);
  const hit = ray.intersectTriangle(t.a, t.b, t.c, false, new THREE.Vector3());
  if (hit && hit.distanceTo(s[0]) <= len) best = { d: 0, a: hit, b: hit.clone() };
  return best;
}

function triTri(x: THREE.Triangle, y: THREE.Triangle): Pair {
  let best: Pair = { d: Infinity, a: x.a, b: y.a };
  for (const p of [x.a, x.b, x.c]) best = better(best, pointTri(p, y));
  for (const p of [y.a, y.b, y.c]) { const r = pointTri(p, x); best = better(best, { d: r.d, a: r.b, b: r.a }); }
  for (const [p, q] of [[x.a, x.b], [x.b, x.c], [x.c, x.a]] as Seg[])
    for (const [u, v] of [[y.a, y.b], [y.b, y.c], [y.c, y.a]] as Seg[]) best = better(best, segSeg(p, q, u, v));
  return best;
}

// Smallest distance between two entities, with the two closest points.
export function minPair(A: Shape, B: Shape): Pair {
  const flip = (p: Pair): Pair => ({ d: p.d, a: p.b, b: p.a });
  // Order: points < segments < triangles, so each case is written once.
  const rank = (s: Shape) => s.tris.length ? 2 : s.segs.length ? 1 : 0;
  if (rank(A) > rank(B)) return flip(minPair(B, A));
  let best: Pair = { d: Infinity, a: A.center, b: B.center };
  if (rank(A) === 0) {
    const p = A.points[0];
    if (rank(B) === 0) return { d: p.distanceTo(B.points[0]), a: p, b: B.points[0] };
    if (rank(B) === 1) { for (const s of B.segs) best = better(best, segSeg(p, p, s[0], s[1])); return best; }
    for (const t of B.tris) best = better(best, pointTri(p, t));
    return best;
  }
  if (rank(A) === 1) {
    if (rank(B) === 1) { for (const s of A.segs) for (const u of B.segs) best = better(best, segSeg(s[0], s[1], u[0], u[1])); return best; }
    B.tris.forEach((t, i) => {
      const sp = B.spheres[i];
      for (const s of A.segs) {
        if (segSeg(s[0], s[1], sp.c, sp.c).d - sp.r >= best.d) continue;
        best = better(best, segTri(s, t));
      }
    });
    return best;
  }
  // Two faces: skip triangle pairs whose bounding spheres are already farther than the best so far.
  for (let i = 0; i < A.tris.length; i++) {
    const sa = A.spheres[i];
    for (let j = 0; j < B.tris.length; j++) {
      const sb = B.spheres[j];
      if (sa.c.distanceTo(sb.c) - sa.r - sb.r >= best.d) continue;
      best = better(best, triTri(A.tris[i], B.tris[j]));
      if (best.d === 0) return best;
    }
  }
  return best;
}

// Largest distance between two entities. It is always reached at mesh corners.
export function maxPair(A: Shape, B: Shape): Pair {
  let best: Pair = { d: -1, a: A.center, b: B.center };
  for (const p of A.points) for (const q of B.points) {
    const d = p.distanceToSquared(q);
    if (d > best.d) best = { d, a: p, b: q };
  }
  return { ...best, d: Math.sqrt(Math.max(0, best.d)) };
}

// Direction used for angles: line direction, plane normal, cylinder axis.
export function direction(e: Entity): { dir: THREE.Vector3; kind: 'line' | 'plane' } | null {
  if (e.kind === 'edge' && e.shape.type === 'line') return { dir: e.shape.dir, kind: 'line' };
  if (e.kind === 'face' && e.shape.type === 'plane') return { dir: e.shape.normal, kind: 'plane' };
  if (e.kind === 'face' && e.shape.type === 'cylinder') return { dir: e.shape.axis, kind: 'line' };
  return null;
}

// Angle between two directions, 0..90 degrees. A line against a plane uses 90 minus the normal angle.
export function angleBetween(a: NonNullable<ReturnType<typeof direction>>, b: NonNullable<ReturnType<typeof direction>>): number {
  const raw = THREE.MathUtils.radToDeg(Math.acos(Math.min(1, Math.abs(a.dir.dot(b.dir)))));
  return a.kind === b.kind ? raw : 90 - raw;
}

// Axis of a cylinder face or a circle edge, as a point and a direction.
export function axisOf(e: Entity): { p: THREE.Vector3; dir: THREE.Vector3 } | null {
  if (e.kind === 'face' && e.shape.type === 'cylinder') return { p: e.shape.point, dir: e.shape.axis };
  if (e.kind === 'edge' && e.shape.type === 'circle') return { p: e.shape.center, dir: e.shape.normal };
  return null;
}

