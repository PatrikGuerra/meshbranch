import type { TreeEntry } from '../github/client';
import { formatOf, type Format } from '../importers/formats';

export type FileNode = { name: string; path: string; size: number; format: Format | null };
export type DirNode = { name: string; path: string; dirs: Map<string, DirNode>; files: FileNode[] };
export type TreeFilter = { only3d: boolean; formats: Set<Format>; query: string };

// Folders appear only when they hold a file that passes the filter.
export function buildTree(entries: TreeEntry[], filter: TreeFilter): DirNode {
  const root: DirNode = { name: '', path: '', dirs: new Map(), files: [] };
  const q = filter.query.trim().toLowerCase();
  for (const e of entries) {
    if (e.type !== 'blob') continue;
    const format = formatOf(e.path);
    if (filter.only3d && !format) continue;
    if (format && !filter.formats.has(format)) continue;
    if (q && !e.path.toLowerCase().includes(q)) continue;
    const parts = e.path.split('/');
    let dir = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const path = parts.slice(0, i + 1).join('/');
      let next = dir.dirs.get(parts[i]);
      if (!next) { next = { name: parts[i], path, dirs: new Map(), files: [] }; dir.dirs.set(parts[i], next); }
      dir = next;
    }
    dir.files.push({ name: parts.at(-1)!, path: e.path, size: e.size ?? 0, format });
  }
  return root;
}

export function allDirs(dir: DirNode, out: string[] = []): string[] {
  for (const d of dir.dirs.values()) { out.push(d.path); allDirs(d, out); }
  return out;
}

export function countFiles(dir: DirNode): number {
  let n = dir.files.length;
  for (const d of dir.dirs.values()) n += countFiles(d);
  return n;
}
