import { describe, expect, it } from 'vitest';
import { buildHash, parseHash, parseRepoInput } from './route';

describe('parseRepoInput', () => {
  it.each([
    ['kovacsv/Online3DViewer', 'kovacsv', 'Online3DViewer'],
    ['https://github.com/kovacsv/Online3DViewer', 'kovacsv', 'Online3DViewer'],
    ['github.com/a-b/c.d_e.git', 'a-b', 'c.d_e'],
    ['https://github.com/o/r/tree/main/cad/x.step', 'o', 'r'],
    ['  o/r  ', 'o', 'r'],
  ])('reads %s', (input, owner, repo) => {
    expect(parseRepoInput(input)).toEqual({ owner, repo });
  });

  it.each(['', 'just-a-name', 'https://gitlab.com/o/r/x', '-bad/r', 'o/..', 'o r/x'])('rejects %s', input => {
    expect(parseRepoInput(input)).toBeNull();
  });
});

describe('hash routes', () => {
  it('round-trips repo, branch with slashes and path', () => {
    const route = { kind: 'repo', owner: 'o', repo: 'r', ref: 'feature/fan-inside', path: 'cad/case assembly.step' } as const;
    const hash = buildHash(route);
    expect(hash).toBe('#/o/r?ref=feature/fan-inside&path=cad/case+assembly.step');
    expect(parseHash(hash)).toEqual(route);
  });

  it('falls back to home for unknown or invalid hashes', () => {
    expect(parseHash('')).toEqual({ kind: 'home' });
    expect(parseHash('#/')).toEqual({ kind: 'home' });
    expect(parseHash('#/-x/y')).toEqual({ kind: 'home' });
  });
});
