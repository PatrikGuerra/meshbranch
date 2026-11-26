import { describe, expect, it } from 'vitest';
import { formatOf, isLfsPointer } from './formats';

describe('formatOf', () => {
  it.each([
    ['cad/case.STEP', 'step'], ['a.stp', 'step'], ['x/y/part.Stl', 'stl'], ['fan.obj', 'obj'],
    ['README.md', null], ['stl', null], ['.stl', null], ['dir.stl/readme', null],
  ])('%s -> %s', (path, format) => expect(formatOf(path)).toBe(format));
});

describe('isLfsPointer', () => {
  const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
  it('detects a Git LFS pointer', () => {
    expect(isLfsPointer(enc('version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 123\n'))).toBe(true);
  });
  it('ignores real files', () => {
    expect(isLfsPointer(enc('solid part\nendsolid part\n'))).toBe(false);
  });
});
