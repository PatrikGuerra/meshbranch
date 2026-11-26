export type RepoRef = { owner: string; repo: string };
export type Route = { kind: 'home' } | ({ kind: 'repo'; ref?: string; path?: string } & RepoRef);

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const valid = (owner: string, repo: string) => OWNER.test(owner) && REPO.test(repo) && repo !== '.' && repo !== '..';

// Accepts owner/repo, github.com/owner/repo and full GitHub URLs (extra path parts are ignored).
export function parseRepoInput(input: string): RepoRef | null {
  const m = input.trim().match(/^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([^/\s]+)\/([^/\s?#]+?)(?:\.git)?(?:[/?#].*)?$/i);
  return m && valid(m[1], m[2]) ? { owner: m[1], repo: m[2] } : null;
}

// Hash routes: #/ (home) and #/owner/repo?ref=<branch or sha>&path=<file>
export function parseHash(hash: string): Route {
  const m = hash.match(/^#\/([^/?]+)\/([^/?]+)(?:\?(.*))?$/);
  if (!m || !valid(m[1], m[2])) return { kind: 'home' };
  const q = new URLSearchParams(m[3] ?? '');
  return { kind: 'repo', owner: m[1], repo: m[2], ref: q.get('ref') || undefined, path: q.get('path') || undefined };
}

export function buildHash(route: Route): string {
  if (route.kind === 'home') return '#/';
  const q = new URLSearchParams();
  if (route.ref) q.set('ref', route.ref);
  if (route.path) q.set('path', route.path);
  const s = q.toString().replace(/%2F/g, '/'); // keep slashes readable in shared links
  return `#/${route.owner}/${route.repo}${s ? `?${s}` : ''}`;
}
