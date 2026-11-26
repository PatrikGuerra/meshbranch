import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { TreeEntry } from '../github/client';
import { FORMAT_BADGE, FORMATS, FORMAT_LABEL, type Format } from '../importers/formats';
import { allDirs, buildTree, countFiles, type DirNode } from '../tree/buildTree';
import { Icon } from './icons';

const AUTO_EXPAND_LIMIT = 300; // small repos open fully; big ones start collapsed

export function TypeBadge({ format, name }: { format: Format | null; name: string }) {
  if (format) return <span className={`ft ft-${format}`}>{FORMAT_BADGE[format]}</span>;
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1, name.lastIndexOf('.') + 4).toUpperCase() : '—';
  return <span className="ft ft-other">{ext}</span>;
}

export function FileTree({ entries, selected, reveal, onOpen, onCollapse }: { entries: TreeEntry[]; selected?: string; reveal?: string; onOpen: (path: string) => void; onCollapse: () => void }) {
  const [only3d, setOnly3d] = useState(true);
  const [formats, setFormats] = useState<Set<Format>>(() => new Set(FORMATS));
  const [query, setQuery] = useState('');
  const tree = useMemo(() => buildTree(entries, { only3d, formats, query }), [entries, only3d, formats, query]);
  const models = useMemo(() => countFiles(buildTree(entries, { only3d: true, formats: new Set(FORMATS), query: '' })), [entries]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const t = buildTree(entries, { only3d: true, formats: new Set(FORMATS), query: '' });
    return new Set(countFiles(t) <= AUTO_EXPAND_LIMIT ? allDirs(t) : []);
  });
  const toggleDir = (p: string) => setExpanded(s => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  // Open the folders on the way to the file or folder in the URL, then bring its row into view.
  useEffect(() => {
    if (!reveal) return;
    const segs = reveal.split('/');
    setExpanded(s => { const n = new Set(s); segs.forEach((_, i) => n.add(segs.slice(0, i + 1).join('/'))); return n; });
    requestAnimationFrame(() => document.querySelector(`.tree [data-path="${CSS.escape(reveal)}"]`)?.scrollIntoView({ block: 'nearest' }));
  }, [reveal]);
  const toggleFormat = (f: Format) => setFormats(s => { const n = new Set(s); if (n.has(f)) n.delete(f); else n.add(f); return n; });
  const searching = query.trim() !== '';

  const rows = (dir: DirNode, depth: number): ReactNode[] => [
    ...[...dir.dirs.values()].sort((a, b) => a.name.localeCompare(b.name)).flatMap(d => {
      const open = searching || expanded.has(d.path);
      return [
        <div key={`d:${d.path}`} data-path={d.path} className={`row ${d.path === reveal ? 'sel' : ''}`} style={{ '--d': depth } as CSSProperties} role="treeitem" aria-expanded={open} tabIndex={0}
          onClick={() => toggleDir(d.path)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDir(d.path); } }}>
          <span className={`tw ${open ? 'open' : ''}`}><Icon name="chev" /></span><span className="ico"><Icon name="folder" /></span><span className="name">{d.name}</span>
        </div>,
        ...(open ? rows(d, depth + 1) : []),
      ];
    }),
    ...dir.files.sort((a, b) => a.name.localeCompare(b.name)).map(f => (
      <div key={`f:${f.path}`} data-path={f.path} className={`row ${f.format ? '' : 'muted'} ${f.path === selected ? 'sel' : ''}`} style={{ '--d': depth } as CSSProperties}
        role="treeitem" aria-selected={f.path === selected} tabIndex={f.format ? 0 : -1} title={f.format ? f.path : 'No 3D preview for this file type'}
        onClick={() => f.format && onOpen(f.path)} onKeyDown={e => { if (f.format && e.key === 'Enter') onOpen(f.path); }}>
        <span className="tw none" /><TypeBadge format={f.format} name={f.name} /><span className="name">{f.name}</span>
      </div>
    )),
  ];
  const list = rows(tree, 0);

  return (
    <>
      <div className="panel-head"><span>Files</span>
        <span className="actions">
          <label className="switch"><input type="checkbox" checked={only3d} onChange={e => setOnly3d(e.target.checked)} />3D only</label>
          <button className="icon-btn small" onClick={onCollapse} title="Hide files" aria-label="Hide files"><Icon name="panel" /></button>
        </span>
      </div>
      <div className="search"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter files…" aria-label="Filter files" /></div>
      <div className="chips">
        {FORMATS.map(f => <button key={f} className="chip" aria-pressed={formats.has(f)} onClick={() => toggleFormat(f)}>{FORMAT_LABEL[f]}</button>)}
      </div>
      <div className="tree" role="tree">{list.length ? list : <div className="tree-empty">No matching files.</div>}</div>
      <div className="left-foot">{entries.filter(e => e.type === 'blob').length.toLocaleString('en-US')} files · {models.toLocaleString('en-US')} models</div>
    </>
  );
}
