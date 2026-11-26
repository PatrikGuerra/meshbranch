import { describe, expect, it } from 'vitest';
import type { ChangedFile } from '../github/client';
import { bestBranch, newer3d, newerIndex, pickCandidates } from './newer';

const f = (path: string, status: ChangedFile['status'] = 'modified'): ChangedFile => ({ path, status });

describe('newer3d', () => {
  it('keeps only 3D files of a branch that is ahead', () => {
    expect(newer3d({ ahead: 2, truncated: false, files: [f('cad/a.step'), f('README.md'), f('b.stl', 'added')] }))
      .toEqual([f('cad/a.step'), f('b.stl', 'added')]);
  });
  it('is empty when the branch has no commits of its own', () => {
    expect(newer3d({ ahead: 0, truncated: false, files: [f('a.step')] })).toEqual([]);
  });
});

describe('pickCandidates', () => {
  const branches = new Map([['a', '1'], ['main', '2'], ['same', '9'], ['cur', '9'], ['z', '3']]);
  it('puts the default branch first and skips the current commit', () => {
    expect(pickCandidates(branches, { ref: 'cur', sha: '9' }, 'main')).toEqual(['main', 'a', 'z']);
  });
  it('respects the limit', () => {
    expect(pickCandidates(branches, { ref: 'cur', sha: '9' }, undefined, 2)).toEqual(['a', 'main']);
  });
});

describe('bestBranch and newerIndex', () => {
  const newer = new Map([['b', [f('x.stl')]], ['a', [f('x.stl'), f('y.obj')]], ['c', []]]);
  it('picks the branch with the most newer files', () => {
    expect(bestBranch(newer)?.branch).toBe('a');
    expect(bestBranch(new Map([['c', []]]))).toBeNull();
  });
  it('maps each file to its branches', () => {
    expect(newerIndex(newer).get('x.stl')).toEqual(['b', 'a']);
  });
});
