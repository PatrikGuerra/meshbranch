import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Route } from '../app/route';
import { download, getDefaultBranch, getTree, onRateLimit, rawUrl, resolveCommit, type RateLimit, type Tree } from '../github/client';
import { FORMAT_LABEL, formatOf, isLfsPointer } from '../importers/formats';
import { loadModel } from '../importers/load';
import type { ModelStats, SceneView, View } from '../viewer/scene';
import { FileTree, TypeBadge } from './FileTree';
import { Icon } from './icons';
import { Viewer } from './Viewer';

type RepoRoute = Extract<Route, { kind: 'repo' }>;
type RepoState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; ref: string; sha: string; tree: Tree };
type FileState =
  | { status: 'none' } | { status: 'loading'; step: string; progress?: number } | { status: 'error'; message: string }
  | { status: 'big'; size: number } | { status: 'lfs' } | { status: 'ready'; stats: ModelStats };

const BIG_FILE = 50 * 1024 * 1024; // ask before opening files larger than this
const EMPTY_LIST_LIMIT = 100;
const mb = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
const time = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function joinPath(dir: string, rel: string): string {
  const out: string[] = [];
  for (const p of (dir + rel).split('/')) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
  return out.join('/');
}

export function RepoView({ route, navigate, dark, onToggleTheme, onHome }: {
  route: RepoRoute; navigate: (r: Route) => void; dark: boolean; onToggleTheme: () => void; onHome: () => void;
}) {
  const { owner, repo, ref, path } = route;
  const [state, setState] = useState<RepoState>({ status: 'loading' });
  const [file, setFile] = useState<FileState>({ status: 'none' });
  const [view, setView] = useState<SceneView | null>(null);
  const [rate, setRate] = useState<RateLimit | null>(null);
  const [allowBig, setAllowBig] = useState<Set<string>>(new Set());
  const [modes, setModes] = useState({ edges: true, wire: false, grid: true });
  const [toast, setToast] = useState('');
  const onView = useCallback((v: SceneView | null) => setView(v), []);

  useEffect(() => onRateLimit(setRate), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); }, [toast]);

  // Repository: 1 call for the default branch (only without ?ref), 1 for the commit SHA, 0-1 for the tree (cached by SHA).
  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    (async () => {
      const r = ref ?? await getDefaultBranch(owner, repo);
      const sha = await resolveCommit(owner, repo, r);
      const tree = await getTree(owner, repo, sha);
      if (live) setState({ status: 'ready', ref: r, sha, tree });
    })().catch((e: Error) => { if (live) setState({ status: 'error', message: e.message }); });
    return () => { live = false; };
  }, [owner, repo, ref]);

  // Open the file in ?path. Files come from raw.githubusercontent.com, pinned to the commit SHA.
  useEffect(() => {
    if (state.status !== 'ready' || !view) return;
    if (!path) { view.setModel(null); setFile({ status: 'none' }); return; }
    const entry = state.tree.entries.find(e => e.path === path && e.type === 'blob');
    const format = formatOf(path);
    if (!entry || !format) { view.setModel(null); setFile({ status: 'error', message: entry ? 'This file type cannot be previewed.' : 'This file is not on this branch.' }); return; }
    if ((entry.size ?? 0) > BIG_FILE && !allowBig.has(path)) { view.setModel(null); setFile({ status: 'big', size: entry.size! }); return; }

    const ac = new AbortController();
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    const name = path.slice(dir.length);
    (async () => {
      let shown = -1;
      setFile({ status: 'loading', step: `Downloading ${name}`, progress: 0 });
      const buf = await download(rawUrl(owner, repo, state.sha, path), entry.size ?? 0, p => {
        const pct = Math.floor(p * 100);
        if (pct !== shown) { shown = pct; setFile({ status: 'loading', step: `Downloading ${name}`, progress: p }); }
      }, ac.signal);
      if (isLfsPointer(buf)) { view.setModel(null); setFile({ status: 'lfs' }); return; }
      setFile({ status: 'loading', step: format === 'step' ? 'Reading STEP with OpenCascade…' : `Reading ${FORMAT_LABEL[format]}…` });
      const obj = await loadModel(format, buf, {
        name,
        resourceUrl: rawUrl(owner, repo, state.sha, dir),
        fetchText: async rel => {
          const p = joinPath(dir, rel);
          if (!state.tree.entries.some(e => e.path === p)) return null;
          const r = await fetch(rawUrl(owner, repo, state.sha, p), { signal: ac.signal });
          return r.ok ? r.text() : null;
        },
      });
      // shortcut: a STEP read still running in the worker is not stopped, only ignored; add worker cancel if big files make this hurt.
      if (ac.signal.aborted) return;
      view.setModel(obj);
      setModes(m => ({ ...m, edges: view.edges }));
      setFile({ status: 'ready', stats: view.stats() });
    })().catch((e: Error) => {
      if (ac.signal.aborted) return;
      view.setModel(null);
      setFile({ status: 'error', message: e.message || 'This file could not be opened.' });
    });
    return () => ac.abort();
  }, [state, view, path, owner, repo, allowBig]);

  useEffect(() => {
    if (!view) return;
    Object.assign(view, { edges: modes.edges, wire: modes.wire, gridOn: modes.grid });
    view.applyModes();
  }, [view, modes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input, textarea')) return;
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) view?.fit('fit');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [view]);

  const open = (p: string) => navigate({ ...route, path: p });
  const models = useMemo(() => state.status === 'ready'
    ? state.tree.entries.filter(e => e.type === 'blob' && formatOf(e.path)).map(e => e.path).sort() : [], [state]);
  const copyLink = () => navigator.clipboard.writeText(location.href).then(() => setToast('Link copied'), () => setToast(location.href));
  const fmt = path ? formatOf(path) : null;
  const ready = state.status === 'ready' ? state : null;
  const ghUrl = ready && path ? `https://github.com/${owner}/${repo}/blob/${ready.sha}/${path}` : `https://github.com/${owner}/${repo}`;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand brand-link" onClick={onHome} title="Home"><Icon name="logo" />MeshBranch</button>
        <nav className="crumbs" aria-label="Repository">
          <Icon name="repo" /><span>{owner}</span><span>/</span><strong>{repo}</strong>
        </nav>
        {ready && <span className="ref" title={`Commit ${ready.sha}`}><Icon name="branch" /><span className="mono">{ready.ref}</span><span className="sha mono">{ready.sha.slice(0, 7)}</span></span>}
        <div className="spacer" />
        <button className="icon-btn" onClick={onToggleTheme} title="Toggle theme" aria-label="Toggle theme"><Icon name="moon" /></button>
        <button className="btn" onClick={copyLink}><Icon name="link" />Copy link</button>
      </header>

      {ready?.tree.truncated && <div className="banner"><Icon name="warn" /><span className="grow">This repository is very large. GitHub returned only part of its file list, so some files are missing.</span></div>}

      <main className="layout">
        <aside className="sidebar left" aria-label="Repository files">
          {ready ? <FileTree key={ready.sha} entries={ready.tree.entries} selected={path} onOpen={open} />
            : <div className="tree-empty">{state.status === 'loading' ? 'Loading files…' : ''}</div>}
        </aside>

        <section className="stage">
          <div className="stage-head">
            <div className="path">
              {path ? <>
                <TypeBadge format={fmt} name={path} />
                {path.split('/').slice(0, -1).map((s, i) => <span key={i} className="seg">{s} /</span>)}
                <strong>{path.split('/').pop()}</strong>
                <a className="btn ghost small" href={ghUrl} target="_blank" rel="noopener">View on GitHub</a>
              </> : <span className="seg">No file selected</span>}
            </div>
            <div className="toolbar" role="toolbar" aria-label="View">
              {(['fit', 'iso', 'top', 'front', 'right'] as View[]).map(v => <button key={v} className="tb" onClick={() => view?.fit(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
              <span className="sep" />
              <button className="tb" aria-pressed={modes.edges} onClick={() => setModes(m => ({ ...m, edges: !m.edges }))}>Edges</button>
              <button className="tb" aria-pressed={modes.wire} onClick={() => setModes(m => ({ ...m, wire: !m.wire }))}>Wireframe</button>
              <button className="tb" aria-pressed={modes.grid} onClick={() => setModes(m => ({ ...m, grid: !m.grid }))}>Grid</button>
            </div>
          </div>
          <Viewer dark={dark} onView={onView}>
            {state.status === 'loading' && <div className="overlay"><div className="loader"><span className="spin" />Loading {owner}/{repo}…</div></div>}
            {state.status === 'error' && <div className="overlay"><div className="card"><h2>Could not open {owner}/{repo}</h2><p>{state.message}</p><button className="btn primary" onClick={onHome}>Back to home</button></div></div>}
            {ready && file.status === 'none' && (
              <div className="overlay"><div className="card list-card">
                <header><h2>{models.length ? 'Select a 3D file' : 'No 3D files here'}</h2>
                  <p>{models.length ? <>{models.length.toLocaleString('en-US')} models on <span className="mono">{ready.ref}</span>. Pick one here or in the file tree.</> : <>This branch has no STEP, STL or OBJ files.</>}</p></header>
                {models.length > 0 && <div className="card-list">
                  {models.slice(0, EMPTY_LIST_LIMIT).map(p => <button key={p} className="row" onClick={() => open(p)}><TypeBadge format={formatOf(p)} name={p} /><span className="name mono">{p}</span></button>)}
                  {models.length > EMPTY_LIST_LIMIT && <div className="tree-empty">and {(models.length - EMPTY_LIST_LIMIT).toLocaleString('en-US')} more in the file tree</div>}
                </div>}
              </div></div>
            )}
            {file.status === 'loading' && <div className="overlay dim"><div className="loader"><span className="spin" />{file.step}{file.progress !== undefined && <span className="pct">{Math.round(file.progress * 100)}%</span>}</div></div>}
            {file.status === 'error' && <div className="overlay"><div className="card"><h2>Could not open this file</h2><p>{file.message}</p></div></div>}
            {file.status === 'lfs' && <div className="overlay"><div className="card"><h2>Stored with Git LFS</h2><p>This file lives in Git Large File Storage. MeshBranch cannot open LFS files yet.</p><a className="btn" href={ghUrl} target="_blank" rel="noopener">Open on GitHub</a></div></div>}
            {file.status === 'big' && path && <div className="overlay"><div className="card"><h2>Large file: {mb(file.size)}</h2><p>Opening it may use a lot of memory and take a while.</p><button className="btn primary" onClick={() => setAllowBig(s => new Set(s).add(path))}>Open anyway</button></div></div>}
          </Viewer>
        </section>
      </main>

      <footer className="statusbar">
        <span title="GitHub allows 60 API requests per hour per IP without sign-in. File downloads do not count.">
          <span className={`dotc ${rate && rate.remaining < 10 ? 'low' : ''}`} />api.github.com · {rate ? `${rate.remaining} / ${rate.limit} requests left · resets ${time(rate.reset)}` : 'no API requests this visit (answered from cache)'}
        </span>
        {file.status === 'ready' && <span className="r">{file.stats.parts.toLocaleString('en-US')} {file.stats.parts === 1 ? 'part' : 'parts'} · {Math.round(file.stats.triangles).toLocaleString('en-US')} triangles · {file.stats.size.x.toFixed(1)} × {file.stats.size.y.toFixed(1)} × {file.stats.size.z.toFixed(1)} mm</span>}
      </footer>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
