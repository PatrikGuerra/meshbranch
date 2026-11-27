import type * as THREE from 'three';

// What the user can pick. All coordinates are world coordinates, in mm.
export type Vertex = { kind: 'vertex'; p: THREE.Vector3; label: 'Vertex' | 'Midpoint' | 'Center'; mesh: THREE.Mesh };
export type EdgeShape =
  | { type: 'line'; dir: THREE.Vector3 }
  | { type: 'circle'; center: THREE.Vector3; normal: THREE.Vector3; radius: number }
  | { type: 'curve' };
export type Edge = { kind: 'edge'; id: number; points: THREE.Vector3[]; closed: boolean; length: number; shape: EdgeShape; mesh: THREE.Mesh };
export type FaceShape =
  | { type: 'plane'; normal: THREE.Vector3 }
  | { type: 'cylinder'; axis: THREE.Vector3; point: THREE.Vector3; radius: number }
  | { type: 'other' };
// tris: 9 numbers per triangle (three corners).
export type Face = { kind: 'face'; id: number; tris: Float32Array; area: number; centroid: THREE.Vector3; shape: FaceShape; mesh: THREE.Mesh };
export type Entity = Vertex | Edge | Face;

export type Row = {
  label: string;
  value: string;
  approx?: boolean;
  from?: THREE.Vector3; // drawn as a dashed line when both ends are set
  to?: THREE.Vector3;
  delta?: [number, number, number];
};
