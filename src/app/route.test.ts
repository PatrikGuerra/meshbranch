import { describe, expect, it } from 'vitest';
import { buildHash, parseHash, parseRepoInput, splitRefPath } from './route';

describe('parseRepoInput', () => {
  it.each([
    ['kovacsv/Online3DViewer', 'kovacsv', 'Online3DViewer', undefined],
    ['https://github.com/kovacsv/Online3DViewer', 'kovacsv', 'Online3DViewer', undefined],
    ['github.com/a-b/c.d_e.git', 'a-b', 'c.d_e', undefined],
    ['  o/r  ', 'o', 'r', undefined],
    ['https://github.com/o/r/tree/feature/fan-inside', 'o', 'r', 'feature/fan-inside'],
    ['https://github.com/o/r/tree/feature/fan-inside/cad/', 'o', 'r', 'feature/fan-inside/cad'],
    ['https://github.com/o/r/blob/main/cad/my%20case.step?raw=true', 'o', 'r', 'main/cad/my case.step'],
    ['https://github.com/o/r/pulls', 'o', 'r', undefined],
    ['https://patrikguerra.github.io/meshbranch/#/o/r/blob/dev/x.stl', 'o', 'r', 'dev/x.stl'],
  ])('reads %s', (input, owner, repo, rest) => {
    expect(parseRepoInput(input)).toEqual({ owner, repo, rest });
  });

  it.each(['', 'just-a-name', 'https://gitlab.com/o/r/x', '-bad/r', 'o/..', 'o r/x'])('rejects %s', input => {
    expect(parseRepoInput(input)).toBeNull();
  });
});

describe('hash routes', () => {
  it('mirrors GitHub blob URLs and round-trips', () => {
    const route = { kind: 'repo', owner: 'o', repo: 'r', rest: 'feature/fan-inside/cad/case assembly.step' } as const;
    const hash = buildHash(route, true);
    expect(hash).toBe('#/o/r/blob/feature/fan-inside/cad/case%20assembly.step');
    expect(parseHash(hash)).toEqual(route);
  });

  it('uses tree for branches and folders', () => {
    expect(buildHash({ kind: 'repo', owner: 'o', repo: 'r', rest: 'dev' })).toBe('#/o/r/tree/dev');
    expect(buildHash({ kind: 'repo', owner: 'o', repo: 'r' })).toBe('#/o/r');
    expect(parseHash('#/o/r/tree/dev/')).toEqual({ kind: 'repo', owner: 'o', repo: 'r', rest: 'dev' });
  });

  it('still reads the old ?ref=&path= links', () => {
    expect(parseHash('#/o/r?ref=feature/x&path=cad/a.step')).toEqual({ kind: 'repo', owner: 'o', repo: 'r', rest: 'feature/x/cad/a.step' });
  });

  it('falls back to home for unknown or invalid hashes', () => {
    expect(parseHash('')).toEqual({ kind: 'home' });
    expect(parseHash('#/')).toEqual({ kind: 'home' });
    expect(parseHash('#/-x/y')).toEqual({ kind: 'home' });
  });
});

describe('splitRefPath', () => {
  const branches = new Set(['main', 'feature', 'feature/fan-inside', 'feature/fan-inside-v2']);
  it.each([
    ['main/cad/a.step', 'main', 'cad/a.step'],
    ['feature/fan-inside/cad/a.step', 'feature/fan-inside', 'cad/a.step'],
    ['feature/fan-inside-v2', 'feature/fan-inside-v2', ''],
    ['feature/other/a.stl', 'feature', 'other/a.stl'],
    ['main', 'main', ''],
    ['529e5ad6892ce3b25015b7cca7f0481b8335a76c/x/a.stl', '529e5ad6892ce3b25015b7cca7f0481b8335a76c', 'x/a.stl'],
    ['v1.0/a.stl', 'v1.0', 'a.stl'],
  ])('%s -> %s + %s', (rest, ref, path) => expect(splitRefPath(rest, branches)).toEqual({ ref, path }));
});
