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

function single(e: Entity): Row[] {
  if (e.kind === 'vertex') return [
    { label: 'X', value: mm(e.p.x) }, { label: 'Y', value: mm(e.p.y) }, { label: 'Z', value: mm(e.p.z) },
  ];
  return [];
}
