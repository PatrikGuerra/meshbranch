import type { ChangedFile, Comparison } from '../github/client';
import { formatOf } from '../importers/formats';

export const MAX_COMPARES = 10; // branches checked automatically per visit
export const MIN_REMAINING = 10; // below this many API requests left, stop checking branches

// 3D files created or changed on another branch since it split from the current one (PLAN.md 6.3).
export function newer3d(c: Comparison): ChangedFile[] {
  return c.ahead > 0 ? c.files.filter(f => formatOf(f.path)) : [];
}

// Branches to compare automatically: the default branch first, then the list order. Branches on the
// current commit cannot hold anything newer, so they are skipped.
export function pickCandidates(branches: ReadonlyMap<string, string>, current: { ref: string; sha: string }, defaultBranch?: string, limit = MAX_COMPARES): string[] {
  const names = [...branches.keys()].filter(b => b !== current.ref && branches.get(b) !== current.sha);
  if (defaultBranch && names.includes(defaultBranch)) names.unshift(...names.splice(names.indexOf(defaultBranch), 1));
  return names.slice(0, limit);
}

// The branch with the most newer 3D files (ties: name order), for the banner.
export function bestBranch(newer: ReadonlyMap<string, ChangedFile[]>): { branch: string; files: ChangedFile[] } | null {
  let best: { branch: string; files: ChangedFile[] } | null = null;
  for (const [branch, files] of [...newer].sort(([a], [b]) => a.localeCompare(b))) {
    if (files.length && (!best || files.length > best.files.length)) best = { branch, files };
  }
  return best;
}

// path -> branches that hold a newer version of it, for the dots in the file tree.
export function newerIndex(newer: ReadonlyMap<string, ChangedFile[]>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [branch, files] of newer) for (const f of files) out.set(f.path, [...(out.get(f.path) ?? []), branch]);
  return out;
}
