import { useEffect, useRef, useState } from 'react';
import type { ChangedFile } from '../github/client';
import { Icon } from './icons';

export type CheckState = { status: 'pending' } | { status: 'done'; files: ChangedFile[] } | { status: 'skipped' } | { status: 'error'; message: string };

export function BranchMenu({ current, sha, defaultBranch, branches, checks, onSwitch, onCheck, onRefresh }: {
  current: string; sha: string; defaultBranch?: string;
  branches: ReadonlyMap<string, string> | null; checks: ReadonlyMap<string, CheckState>;
  onSwitch: (b: string) => void; onCheck: (b: string) => void; onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('pointerdown', onDown); addEventListener('keydown', onKey);
    return () => { removeEventListener('pointerdown', onDown); removeEventListener('keydown', onKey); };
  }, [open]);

  const newerCount = (b: string) => { const c = checks.get(b); return c?.status === 'done' ? c.files.length : 0; };
  const anyNewer = [...checks.keys()].some(b => newerCount(b) > 0);
  const names = branches ? [...branches.keys()] : [];
  const q = query.trim().toLowerCase();
  // Current first, then the default branch, then branches with newer files, then the rest by name.
  const rank = (b: string) => b === current ? 0 : b === defaultBranch ? 1 : newerCount(b) ? 2 : 3;
  const list = names.filter(b => !q || b.toLowerCase().includes(q))
    .sort((a, b) => rank(a) - rank(b) || newerCount(b) - newerCount(a) || a.localeCompare(b));

  return (
    <div className="branch-wrap" ref={box}>
      <button className="btn ref" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)} title={`Commit ${sha}`}>
        <Icon name="branch" /><span className="mono">{current}</span><span className="sha mono">{sha.slice(0, 7)}</span>
        {anyNewer && <span className="dot" title="Another branch has newer 3D files" />}
        <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 12, height: 12 }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">Switch branch {branches && <span className="pill">{branches.size} branches</span>}</div>
          {names.length > 8 && <div className="search menu-search"><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a branch…" aria-label="Find a branch" /></div>}
          <div className="menu-list">
            {!branches && <div className="tree-empty">Loading branches…</div>}
            {list.map(b => {
              const c = checks.get(b), n = newerCount(b), cur = b === current;
              return (
                <div key={b} className={`menu-item ${cur ? 'cur' : ''}`}>
                  <button className="menu-main" role="menuitem" onClick={() => { setOpen(false); if (!cur) onSwitch(b); }}>
                    <span className="check">{cur && <svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg>}</span>
                    <span className="grow"><span className="mono">{b}</span>{b === defaultBranch && <span className="tag">default</span>}</span>
                    {n > 0 && <span className="badge" title="3D files changed on this branch since it split from yours">{n} newer</span>}
                    {c?.status === 'pending' && <span className="meta">checking…</span>}
                    {c?.status === 'error' && <span className="meta" title={c.message}>not compared</span>}
                  </button>
                  {!cur && (!c || c.status === 'skipped') && branches?.get(b) !== sha &&
                    <button className="link-btn" onClick={() => onCheck(b)} title="Compare with your branch (1 GitHub request)">Check</button>}
                </div>
              );
            })}
            {branches && !list.length && <div className="tree-empty">No matching branches.</div>}
          </div>
          <div className="menu-foot">
            <span>“Newer” = 3D files changed on that branch since it split from <span className="mono">{current}</span>.</span>
            <button className="link-btn" onClick={onRefresh} title="Reload the branch list (1 GitHub request)">Refresh</button>
          </div>
        </div>
      )}
    </div>
  );
}
