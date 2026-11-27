import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { arcLength, measure } from './measure';
import { meshTopology } from './topology';
import type { Vertex } from './types';

function withFaces(g: THREE.BufferGeometry): THREE.Mesh {
  const m = new THREE.Mesh(g);
  m.userData.brepFaces = Int32Array.from(g.groups.flatMap(gr => [gr.start / 3, (gr.start + gr.count) / 3 - 1]));
  return m;
}

const mesh = new THREE.Mesh();
const v = (x: number, y: number, z: number): Vertex => ({ kind: 'vertex', p: new THREE.Vector3(x, y, z), label: 'Vertex', mesh });

describe('measure points', () => {
  it('gives the distance and its parts between two vertices', () => {
    const [r] = measure(v(0, 0, 0), v(3, 4, 12));
    expect(r.value).toBe('13.00 mm');
    expect(r.delta).toEqual([3, 4, 12]);
  });
  it('gives the coordinates of one vertex', () => {
    expect(measure(v(1, 2, 3), null).map(r => r.value)).toEqual(['1.00 mm', '2.00 mm', '3.00 mm']);
  });
  it('is empty without a selection', () => {
    expect(measure(null, null)).toEqual([]);
  });
});

describe('measure one item', () => {
  const t = meshTopology(withFaces(new THREE.CylinderGeometry(3, 3, 10, 48)), 12)!;
  const box = meshTopology(withFaces(new THREE.BoxGeometry(10, 20, 30)), 40)!;
  const row = (rows: { label: string; value: string }[], l: string) => rows.find(r => r.label === l)?.value;

  it('gives radius, diameter and exact length of a circle', () => {
    const rows = measure(t.edges.find(e => e.shape.type === 'circle')!, null);
    expect(row(rows, 'Radius')).toBe('3.00 mm');
    expect(row(rows, 'Diameter')).toBe('6.00 mm');
    expect(row(rows, 'Length')).toBe(`${(6 * Math.PI).toFixed(2)} mm`);
  });
  it('gives the length of a straight edge and the area of a flat face', () => {
    expect(row(measure(box.edges.find(e => Math.round(e.length) === 30)!, null), 'Length')).toBe('30.00 mm');
    const top = box.faces.find(f => f.centroid.y > 9)!;
    expect(row(measure(top, null), 'Area')).toBe('300.00 mm²');
    expect(row(measure(top, null), 'Normal')).toBe('0.000, 1.000, 0.000');
  });
  it('gives the radius of a cylinder face', () => {
    expect(row(measure(t.faces.find(f => f.shape.type === 'cylinder')!, null), 'Diameter')).toBe('6.00 mm');
  });
  it('measures a quarter arc as r times the angle', () => {
    const c = new THREE.Vector3(), n = new THREE.Vector3(0, 0, 1);
    const pts = Array.from({ length: 7 }, (_, i) => new THREE.Vector3(Math.cos(i * Math.PI / 12) * 2, Math.sin(i * Math.PI / 12) * 2, 0));
    expect(arcLength(pts, c, n, 2)).toBeCloseTo(Math.PI, 9);
  });
});

describe('measure two items', () => {
  const at = (g: THREE.BufferGeometry, x: number) => { const m = withFaces(g); m.position.x = x; return meshTopology(m, 60)!; };
  // Two 10 mm cubes with a 12.4 mm gap between the facing sides.
  const left = at(new THREE.BoxGeometry(10, 10, 10), 0), right = at(new THREE.BoxGeometry(10, 10, 10), 22.4);
  const faceAtX = (t: ReturnType<typeof at>, x: number) => t.faces.find(f => Math.abs(f.centroid.x - x) < 1e-6)!;
  const row = (rows: { label: string; value: string }[], l: string) => rows.find(r => r.label === l)?.value;

  it('gives minimum, maximum, center, perpendicular and angle between parallel faces', () => {
    const rows = measure(faceAtX(left, 5), faceAtX(right, 17.4));
    expect(row(rows, 'Minimum')).toBe('12.40 mm');
    expect(row(rows, 'Center')).toBe('12.40 mm');
    expect(row(rows, 'Perpendicular')).toBe('12.40 mm');
    expect(row(rows, 'Angle')).toBe('0.00°');
    expect(row(rows, 'Maximum')).toBe(`${Math.hypot(12.4, 10, 10).toFixed(2)} mm`);
    expect(rows.every(r => !r.approx)).toBe(true);
  });

  it('gives the distance from a vertex to a face', () => {
    const v = left.vertices.find(x => x.label === 'Vertex' && x.p.x < 0)!;
    const rows = measure(v, faceAtX(right, 17.4));
    expect(row(rows, 'Minimum')).toBe('22.40 mm');
    expect(row(rows, 'Perpendicular')).toBe('22.40 mm');
  });

  it('gives 90 degrees between a face and a crossing edge, and the gap between edges', () => {
    const edge = right.edges.find(e => e.shape.type === 'line' && Math.abs((e.shape as { dir: THREE.Vector3 }).dir.x) > 0.99)!;
    expect(row(measure(faceAtX(left, 5), edge), 'Angle')).toBe('90.00°');
    expect(row(measure(faceAtX(left, 5), edge), 'Minimum')).toBe('12.40 mm');
  });

  it('gives the distance between two parallel hole axes', () => {
    const a = at(new THREE.CylinderGeometry(3, 3, 10, 48), 0), b = at(new THREE.CylinderGeometry(2, 2, 10, 48), 15);
    const cyl = (t: ReturnType<typeof at>) => t.faces.find(f => f.shape.type === 'cylinder')!;
    const rows = measure(cyl(a), cyl(b));
    expect(row(rows, 'Axis distance')).toBe('15.00 mm');
    expect(row(rows, 'Minimum')).toBe('10.00 mm');
  });
});
