import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { measure } from './measure';
import type { Vertex } from './types';

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
