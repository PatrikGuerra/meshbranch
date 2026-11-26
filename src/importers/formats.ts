export type Format = 'step' | 'stl' | 'obj';
export const FORMATS: Format[] = ['step', 'stl', 'obj'];
export const FORMAT_LABEL: Record<Format, string> = { step: 'STEP', stl: 'STL', obj: 'OBJ' };
export const FORMAT_BADGE: Record<Format, string> = { step: 'STP', stl: 'STL', obj: 'OBJ' };

export function formatOf(path: string): Format | null {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  return ext === 'step' || ext === 'stp' ? 'step' : ext === 'stl' || ext === 'obj' ? ext : null;
}

export function isLfsPointer(buffer: ArrayBuffer): boolean {
  return buffer.byteLength < 1024 && new TextDecoder().decode(buffer.slice(0, 32)).startsWith('version https://git-lfs');
}
