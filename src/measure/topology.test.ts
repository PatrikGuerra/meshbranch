import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { meshTopology } from './topology';

// One B-rep face per geometry group, like occt-import-js gives for STEP files.
function withFaces(g: THREE.BufferGeometry): THREE.Mesh {
  const m = new THREE.Mesh(g);
  m.userData.brepFaces = Int32Array.from(g.groups.flatMap(gr => [gr.start / 3, (gr.start + gr.count) / 3 - 1]));
  return m;
}

describe('meshTopology', () => {
  it('finds the faces, edges and corners of a box', () => {
    const t = meshTopology(withFaces(new THREE.BoxGeometry(10, 20, 30)), 40)!;
    expect(t.faces).toHaveLength(6);
    expect(t.faces.every(f => f.shape.type === 'plane')).toBe(true);
    expect(t.edges).toHaveLength(12);
    expect(t.edges.every(e => e.shape.type === 'line' && !e.closed)).toBe(true);
    expect(t.edges.map(e => Math.round(e.length)).sort((a, b) => a - b)).toEqual([10, 10, 10, 10, 20, 20, 20, 20, 30, 30, 30, 30]);
    expect(t.vertices.filter(v => v.label === 'Vertex')).toHaveLength(8);
    expect(t.vertices.filter(v => v.label === 'Midpoint')).toHaveLength(12);
    const top = t.faces.find(f => f.centroid.y > 9)!;
    expect(top.area).toBeCloseTo(300, 6);
  });

  it('finds a cylinder, its two circles and their centers', () => {
    const t = meshTopology(withFaces(new THREE.CylinderGeometry(3, 3, 10, 48)), 12)!;
    const kinds = t.faces.map(f => f.shape.type).sort();
    expect(kinds).toEqual(['cylinder', 'plane', 'plane']);
    const cyl = t.faces.find(f => f.shape.type === 'cylinder')!.shape as { radius: number; axis: THREE.Vector3 };
    expect(cyl.radius).toBeCloseTo(3, 3);
    expect(Math.abs(cyl.axis.y)).toBeCloseTo(1, 6);
    const circles = t.edges.filter(e => e.shape.type === 'circle');
    expect(circles).toHaveLength(2);
    expect(circles.every(e => e.closed && Math.abs((e.shape as { radius: number }).radius - 3) < 1e-3)).toBe(true);
    expect(t.vertices.filter(v => v.label === 'Center').map(v => Math.round(v.p.y)).sort()).toEqual([-5, 5]);
  });

  it('returns null without face data', () => {
    expect(meshTopology(new THREE.Mesh(new THREE.BoxGeometry()), 2)).toBeNull();
  });
});
