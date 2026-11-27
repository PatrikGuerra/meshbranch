const API = 'https://api.github.com';
const CACHE_PREFIX = 'mb:api:';

export type RateLimit = { remaining: number; limit: number; reset: Date };
export type TreeEntry = { path: string; type: 'blob' | 'tree' | 'commit'; sha: string; size?: number };
export type Tree = { entries: TreeEntry[]; truncated: boolean };

export class GitHubError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

let rate: RateLimit | null = null;
const listeners = new Set<(r: RateLimit) => void>();
export function onRateLimit(fn: (r: RateLimit) => void): () => void {
  listeners.add(fn);
  if (rate) fn(rate);
  return () => { listeners.delete(fn); };
}

type Cached = { etag?: string; body: string; at?: number };
function readCache(url: string): Cached | null {
  try { const s = localStorage.getItem(CACHE_PREFIX + url); return s ? JSON.parse(s) as Cached : null; } catch { return null; }
}
function writeCache(url: string, c: Cached) {
  try { localStorage.setItem(CACHE_PREFIX + url, JSON.stringify(c)); } catch { /* storage full: run without cache */ }
}

const time = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Without a token, even a 304 uses one request (checked 2026-11-26), so the cache answers first:
// immutable URLs (pinned to a commit SHA) never refetch; others refetch after maxAgeMs.
// Two callers asking for the same URL at the same time share one request.
const inflight = new Map<string, Promise<string>>();
function api(path: string, opts: { accept?: string; immutable?: boolean; maxAgeMs?: number; noCache?: boolean } = {}): Promise<string> {
  const key = `${opts.accept ?? ''} ${path}`;
  let p = inflight.get(key);
  if (!p) { p = request(path, opts).finally(() => inflight.delete(key)); inflight.set(key, p); }
  return p;
}

async function request(path: string, opts: { accept?: string; immutable?: boolean; maxAgeMs?: number; noCache?: boolean }): Promise<string> {
  const url = API + path;
  const cached = opts.noCache ? null : readCache(url);
  if (cached && (opts.immutable || (opts.maxAgeMs && Date.now() - (cached.at ?? 0) < opts.maxAgeMs))) return cached.body;
  const headers: Record<string, string> = { Accept: opts.accept ?? 'application/vnd.github+json' };
  if (cached?.etag) headers['If-None-Match'] = cached.etag;
  let res: Response;
  try { res = await fetch(url, { headers }); } catch { throw new GitHubError('Could not reach GitHub. Check your connection and try again.', 0); }

  const remaining = res.headers.get('x-ratelimit-remaining');
  if (remaining !== null) {
    rate = { remaining: Number(remaining), limit: Number(res.headers.get('x-ratelimit-limit') ?? 60), reset: new Date(Number(res.headers.get('x-ratelimit-reset') ?? 0) * 1000) };
    listeners.forEach(fn => fn(rate!));
  }
  if (res.status === 304 && cached) { writeCache(url, { ...cached, at: Date.now() }); return cached.body; }
  if (res.ok) {
    const body = await res.text();
    if (!opts.noCache) writeCache(url, { etag: res.headers.get('etag') ?? undefined, body, at: Date.now() });
    return body;
  }
  if ((res.status === 403 || res.status === 429) && remaining === '0') {
    throw new GitHubError(`GitHub's limit of ${rate?.limit ?? 60} requests per hour was reached. It resets at ${time(rate!.reset)}.`, res.status);
  }
  if (res.status === 404 || res.status === 422) throw new GitHubError('Not found. The repository may be private, or the name or branch may be wrong.', 404);
  if (res.status === 409) throw new GitHubError('This repository is empty.', 409);
  throw new GitHubError(`GitHub returned an error (${res.status}). Try again in a moment.`, res.status);
}

const DAY = 24 * 60 * 60 * 1000;
const REF_MAX_AGE = 2 * 60 * 1000; // a new push shows up after at most 2 minutes
const seg = (s: string) => s.split('/').map(encodeURIComponent).join('/');
const repoPath = (owner: string, repo: string) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

export async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  return (JSON.parse(await api(repoPath(owner, repo), { maxAgeMs: DAY })) as { default_branch: string }).default_branch;
}

export async function resolveCommit(owner: string, repo: string, ref: string): Promise<string> {
  if (/^[0-9a-f]{40}$/i.test(ref)) return ref.toLowerCase();
  return (await api(`${repoPath(owner, repo)}/commits/${seg(ref)}`, { accept: 'application/vnd.github.sha', maxAgeMs: REF_MAX_AGE })).trim();
}

// 1 request per 100 branches, kept for 2 minutes. Only needed when a URL has a ref that could hold a slash.
export async function listBranches(owner: string, repo: string, maxPages = 5): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let page = 1; page <= maxPages; page++) {
    const list = JSON.parse(await api(`${repoPath(owner, repo)}/branches?per_page=100&page=${page}`, { maxAgeMs: REF_MAX_AGE })) as { name: string; commit: { sha: string } }[];
    list.forEach(b => out.set(b.name, b.commit.sha));
    if (list.length < 100) break;
  }
  return out;
}

export async function getTree(owner: string, repo: string, commitSha: string): Promise<Tree> {
  const t = JSON.parse(await api(`${repoPath(owner, repo)}/git/trees/${commitSha}?recursive=1`, { immutable: true })) as { tree: TreeEntry[]; truncated: boolean };
  return { entries: t.tree, truncated: t.truncated };
}

// raw.githubusercontent.com does not count against the API rate limit.
export const rawUrl = (owner: string, repo: string, sha: string, path: string) =>
  `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${sha}/${seg(path)}`;

export async function download(url: string, total: number, onProgress: (ratio: number) => void, signal: AbortSignal): Promise<ArrayBuffer> {
  let res: Response;
  try { res = await fetch(url, { signal }); } catch (e) {
    if (signal.aborted) throw e;
    throw new GitHubError('Could not download the file from GitHub.', 0);
  }
  if (!res.ok) throw new GitHubError(res.status === 404 ? 'File not found on GitHub.' : `Download failed (${res.status}).`, res.status);
  if (!res.body || !total) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length; onProgress(Math.min(got / total, 1));
  }
  const out = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out.buffer;
}
