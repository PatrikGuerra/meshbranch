import * as THREE from 'three';
import { angleBetween, axisOf, direction, maxPair, minPair, shapeOf } from './distance';
import type { Entity, Row } from './types';

export const mm = (v: number) => `${v.toFixed(v >= 1000 ? 1 : 2)} mm`;

export function distanceRow(label: string, a: THREE.Vector3, b: THREE.Vector3, approx = false): Row {
  const d = b.clone().sub(a);
  return { label, value: mm(d.length()), approx, from: a.clone(), to: b.clone(), delta: [d.x, d.y, d.z] };
}

// Rows for the current selection: one item, or the distances, angle and perpendicular between two.
export function measure(a: Entity | null, b: Entity | null): Row[] {
  if (!a) return [];
  if (!b) return single(a);
  if (a.kind === 'vertex' && b.kind === 'vertex') return [distanceRow('Distance', a.p, b.p)];
  return pair(a, b);
}

const exact = (e: Entity) => e.kind === 'vertex' || (e.kind === 'edge' && e.shape.type === 'line') || (e.kind === 'face' && e.shape.type === 'plane');
const deg = (v: number) => `${v.toFixed(2)}°`;
const PARALLEL = 0.01; // degrees

function pair(a: Entity, b: Entity): Row[] {
  const A = shapeOf(a), B = shapeOf(b), sure = exact(a) && exact(b);
  const lo = minPair(A, B), hi = maxPair(A, B);
  const rows: Row[] = [
    distanceRow('Minimum', lo.a, lo.b, !sure),
    distanceRow('Maximum', hi.a, hi.b, !sure),
    distanceRow('Center', A.center, B.center, !centerExact(a, b)),
  ];
  // Perpendicular distance to a plane, from a point or from a parallel line or plane.
  const plane = [a, b].find(e => e.kind === 'face' && e.shape.type === 'plane') as Extract<Entity, { kind: 'face' }> | undefined;
  const other = plane === a ? b : a, da = direction(a), db = direction(b);
  if (plane && plane.shape.type === 'plane') {
    const n = plane.shape.normal, angle = da && db ? angleBetween(da, db) : null;
    const flat = other.kind === 'vertex' || (angle !== null && angle < PARALLEL);
    if (flat) {
      const p = other.kind === 'vertex' ? other.p : shapeOf(other).center;
      const d = p.clone().sub(plane.centroid).dot(n);
      rows.push({ label: 'Perpendicular', value: mm(Math.abs(d)), from: p.clone(), to: p.clone().addScaledVector(n, -d) });
    }
  }
  // Two parallel axes (holes, pins, lines): their distance.
  const xa = axisOf(a) ?? (a.kind === 'edge' && a.shape.type === 'line' ? { p: a.points[0], dir: a.shape.dir } : null);
  const xb = axisOf(b) ?? (b.kind === 'edge' && b.shape.type === 'line' ? { p: b.points[0], dir: b.shape.dir } : null);
  if (xa && xb && (axisOf(a) || axisOf(b)) && THREE.MathUtils.radToDeg(Math.acos(Math.min(1, Math.abs(xa.dir.dot(xb.dir))))) < PARALLEL) {
    const w = xb.p.clone().sub(xa.p), off = w.clone().addScaledVector(xa.dir, -w.dot(xa.dir));
    rows.push({ label: 'Axis distance', value: mm(off.length()), from: xb.p.clone().sub(off), to: xb.p.clone() });
  }
  if (da && db) rows.push({ label: 'Angle', value: deg(angleBetween(da, db)) });
  return rows;
}

// Circle centers and plane centroids are exact; centroids of curved faces are not.
const centerExact = (a: Entity, b: Entity) => [a, b].every(e => e.kind !== 'face' || e.shape.type === 'plane') && [a, b].every(e => e.kind !== 'edge' || e.shape.type !== 'curve');

const vec = (v: THREE.Vector3, digits = 2) => [v.x, v.y, v.z].map(n => (Math.abs(n) < 5e-7 ? 0 : n).toFixed(digits)).join(', ');

// True length of an arc: radius times the swept angle (the polyline is a little shorter).
export function arcLength(points: THREE.Vector3[], center: THREE.Vector3, normal: THREE.Vector3, radius: number): number {
  const u = points[0].clone().sub(center).normalize(), v = normal.clone().cross(u);
  let total = 0, prev = 0;
  for (let i = 1; i < points.length; i++) {
    const d = points[i].clone().sub(center), a = Math.atan2(d.dot(v), d.dot(u));
    let step = a - prev;
    if (step > Math.PI) step -= 2 * Math.PI;
    if (step < -Math.PI) step += 2 * Math.PI;
    total += step; prev = a;
  }
  return Math.abs(total) * radius;
}

function single(e: Entity): Row[] {
  if (e.kind === 'vertex') return [
    { label: 'X', value: mm(e.p.x) }, { label: 'Y', value: mm(e.p.y) }, { label: 'Z', value: mm(e.p.z) },
  ];
  if (e.kind === 'edge') {
    const s = e.shape;
    if (s.type === 'line') return [{ label: 'Length', value: mm(e.length), from: e.points[0], to: e.points[e.points.length - 1] }];
    if (s.type === 'circle') {
      const len = e.closed ? 2 * Math.PI * s.radius : arcLength(e.points, s.center, s.normal, s.radius);
      return [
        { label: 'Radius', value: mm(s.radius), from: s.center, to: e.points[0] },
        { label: 'Diameter', value: mm(2 * s.radius) },
        { label: 'Length', value: mm(len) },
        { label: 'Center', value: vec(s.center) },
      ];
    }
    return [{ label: 'Length', value: mm(e.length), approx: true }];
  }
  const s = e.shape;
  const rows: Row[] = [{ label: 'Area', value: `${e.area.toFixed(2)} mm²`, approx: s.type !== 'plane' }];
  if (s.type === 'plane') rows.push({ label: 'Normal', value: vec(s.normal, 3) });
  if (s.type === 'cylinder') rows.push({ label: 'Radius', value: mm(s.radius) }, { label: 'Diameter', value: mm(2 * s.radius) }, { label: 'Axis', value: vec(s.axis, 3) });
  return rows;
}
