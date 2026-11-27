import * as THREE from 'three';
import type { Entity, Row } from './types';

export const mm = (v: number) => `${v.toFixed(v >= 1000 ? 1 : 2)} mm`;

export function distanceRow(label: string, a: THREE.Vector3, b: THREE.Vector3, approx = false): Row {
  const d = b.clone().sub(a);
  return { label, value: mm(d.length()), approx, from: a.clone(), to: b.clone(), delta: [d.x, d.y, d.z] };
}

// Rows for the current selection. M1: one or two points.
export function measure(a: Entity | null, b: Entity | null): Row[] {
  if (!a) return [];
  if (!b) return single(a);
  if (a.kind === 'vertex' && b.kind === 'vertex') return [distanceRow('Distance', a.p, b.p)];
  return [];
}

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
