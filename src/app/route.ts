export type RepoRef = { owner: string; repo: string };
// rest is "<ref>/<path>" exactly as in a GitHub URL. The ref may contain slashes, so it is split later
// against the repository's branch list (see splitRefPath).
export type RepoTarget = RepoRef & { rest?: string };
export type Route = { kind: 'home' } | ({ kind: 'repo' } & RepoTarget);

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const valid = (owner: string, repo: string) => OWNER.test(owner) && REPO.test(repo) && repo !== '.' && repo !== '..';
const clean = (rest: string | undefined) => rest?.split('/').filter(Boolean).join('/') || undefined;
const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

// Accepts owner/repo, GitHub URLs (…/tree|blob|raw/<branch>/<path>), raw.githubusercontent.com URLs and MeshBranch links.
export function parseRepoInput(input: string): RepoTarget | null {
  const s = input.trim();
  const hash = s.indexOf('#/');
  if (hash >= 0) { const r = parseHash(s.slice(hash)); return r.kind === 'repo' ? { owner: r.owner, repo: r.repo, rest: r.rest } : null; }
  const refPath = (p: string | undefined) => clean(p?.split('/').map(decode).join('/').replace(/^refs\/heads\//, ''));
  const raw = s.match(/^(?:https?:\/\/)?raw\.githubusercontent\.com\/([^/\s]+)\/([^/\s]+)\/([^?#\s]+)/i);
  if (raw) return valid(raw[1], raw[2]) ? { owner: raw[1], repo: raw[2], rest: refPath(raw[3]) } : null;
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([^/\s]+)\/([^/\s?#]+?)(?:\.git)?(?:\/(?:tree|blob|raw)\/([^?#\s]+)|\/[^\s]*)?(?:[?#].*)?$/i);
  if (!m || !valid(m[1], m[2])) return null;
  return { owner: m[1], repo: m[2], rest: refPath(m[3]) };
}

// Hash routes mirror GitHub URLs: #/owner/repo, #/owner/repo/tree/<ref>/<dir>, #/owner/repo/blob/<ref>/<file>.
// Also read: #ref=<any GitHub link> (like 3dviewer.net's #model=) and the older #/owner/repo?ref=<ref>&path=<file>.
export function parseHash(hash: string): Route {
  const link = hash.match(/^#(?:ref|model|url)=(.+)$/i);
  if (link) { const r = parseRepoInput(decode(link[1])); return r ? { kind: 'repo', ...r } : { kind: 'home' }; }
  const m = hash.match(/^#\/([^/?]+)\/([^/?]+)(?:\/(?:tree|blob)\/([^?]*))?\/?(?:\?(.*))?$/);
  if (!m || !valid(m[1], m[2])) return { kind: 'home' };
  let rest = m[3] ? m[3].split('/').map(decode).join('/') : undefined;
  if (!rest && m[4]) {
    const q = new URLSearchParams(m[4]);
    const ref = q.get('ref');
    if (ref) rest = [ref, q.get('path') ?? ''].join('/');
  }
  return { kind: 'repo', owner: m[1], repo: m[2], rest: clean(rest) };
}

export function buildHash(route: Route, isFile = false): string {
  if (route.kind === 'home') return '#/';
  const base = `#/${route.owner}/${route.repo}`;
  if (!route.rest) return base;
  return `${base}/${isFile ? 'blob' : 'tree'}/${route.rest.split('/').map(encodeURIComponent).join('/')}`;
}

// Picks the longest branch name that prefixes the segments, as GitHub does.
// Without a match the first segment is the ref (a SHA, a tag, or a branch the list did not include).
export function splitRefPath(rest: string, branches: ReadonlySet<string>): { ref: string; path: string } {
  const segs = rest.split('/').filter(Boolean);
  for (let i = segs.length; i > 1; i--) {
    const ref = segs.slice(0, i).join('/');
    if (branches.has(ref)) return { ref, path: segs.slice(i).join('/') };
  }
  return { ref: segs[0], path: segs.slice(1).join('/') };
}
