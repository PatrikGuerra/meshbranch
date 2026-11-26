import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildParts, visibility } from './parts';

const mesh = (name = '') => { const m = new THREE.Mesh(new THREE.BoxGeometry()); m.name = name; return m; };
const group = (name: string, ...kids: THREE.Object3D[]) => { const g = new THREE.Group(); g.name = name; g.add(...kids); return g; };

describe('buildParts', () => {
  it('keeps assemblies and merges single-child wrappers', () => {
    const lid = mesh();
    const root = group('case.step', group('Case', group('Base', mesh('Floor'), mesh('Wall')), group('Lid', lid)), group('Fan', mesh('')));
    const p = buildParts(root);
    expect(p.root.children.map(c => c.name)).toEqual(['Case', 'Fan']);
    expect(p.root.children[0].children.map(c => c.name)).toEqual(['Base', 'Lid']);
    expect(p.byMesh.get(lid)?.name).toBe('Lid'); // the wrapper group gave the unnamed mesh its name
    expect(p.leaves.map(l => l.name)).toEqual(['Floor', 'Wall', 'Lid', 'Fan']);
    expect(p.root.meshes).toHaveLength(4);
    expect(p.root.children[0].depth).toBe(0);
  });

  it('lists a single-body file as one part', () => {
    const p = buildParts(group('part.stl', mesh('part.stl')));
    expect(p.root.children.map(c => c.name)).toEqual(['part.stl']);
  });

  it('names unnamed parts and ignores empty groups', () => {
    const p = buildParts(group('', mesh(), mesh(), group('empty')));
    expect(p.root.children.map(c => c.name)).toEqual(['Body 1', 'Body 2']);
  });

  it('reports visibility of groups', () => {
    const a = mesh('a'), b = mesh('b');
    const p = buildParts(group('r', a, b));
    expect(visibility(p.root)).toBe('on');
    a.visible = false;
    expect(visibility(p.root)).toBe('mixed');
    b.visible = false;
    expect(visibility(p.root)).toBe('off');
  });
});
