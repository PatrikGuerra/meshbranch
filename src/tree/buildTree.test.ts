import { describe, expect, it } from 'vitest';
import type { TreeEntry } from '../github/client';
import type { Format } from '../importers/formats';
import { allDirs, buildTree, countFiles } from './buildTree';

const blob = (path: string, size = 10): TreeEntry => ({ path, type: 'blob', sha: path, size });
const entries: TreeEntry[] = [
  { path: 'cad', type: 'tree', sha: 't1' }, blob('cad/case.step'), blob('cad/notes.md'),
  blob('export/stl/base.stl'), blob('export/obj/fan.obj'), blob('README.md'), blob('src/case.py'),
];
const all = new Set<Format>(['step', 'stl', 'obj']);

describe('buildTree', () => {
  it('keeps only 3D files and the folders that hold them', () => {
    const t = buildTree(entries, { only3d: true, formats: all, query: '' });
    expect(allDirs(t).sort()).toEqual(['cad', 'export', 'export/obj', 'export/stl']);
    expect(countFiles(t)).toBe(3);
    expect(t.files).toEqual([]);
  });

  it('shows other files when only3d is off', () => {
    expect(countFiles(buildTree(entries, { only3d: false, formats: all, query: '' }))).toBe(6);
  });

  it('filters by format and by text', () => {
    expect(countFiles(buildTree(entries, { only3d: true, formats: new Set(['stl']), query: '' }))).toBe(1);
    const t = buildTree(entries, { only3d: true, formats: all, query: 'FAN' });
    expect(allDirs(t)).toEqual(['export', 'export/obj']);
  });
});
