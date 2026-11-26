import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { matchParts, visibility, type PartNode, type Parts } from '../viewer/parts';
import { Icon } from './icons';

const AUTO_EXPAND_LIMIT = 200; // small models open fully; big ones show only the first level

export function ModelTree({ parts, selected, onSelect, onToggle, onIsolate }: {
  parts: Parts; selected: PartNode | null;
  onSelect: (n: PartNode) => void; onToggle: (n: PartNode) => void; onIsolate: (n: PartNode) => void;
}) {
  const [open, setOpen] = useState<Set<number>>(() => new Set(parts.all
    .filter(n => n.children.length && (parts.all.length <= AUTO_EXPAND_LIMIT || n.depth <= 0)).map(n => n.id)));
  const [query, setQuery] = useState('');
  const matches = useMemo(() => matchParts(parts, query), [parts, query]);

  // Open the groups above a part picked in the 3D view, then bring its row into view.
  useEffect(() => {
    if (!selected) return;
    setOpen(s => { const n = new Set(s); for (let p = selected.parent; p; p = p.parent) n.add(p.id); return n; });
    requestAnimationFrame(() => document.querySelector(`[data-part="${selected.id}"]`)?.scrollIntoView({ block: 'nearest' }));
  }, [selected]);

  const flip = (id: number) => setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const rows = (nodes: PartNode[]): ReactNode[] => nodes.flatMap(n => {
    if (matches && !matches.has(n.id)) return [];
    const group = n.children.length > 0, isOpen = !!matches || open.has(n.id), vis = visibility(n);
    return [
      <div key={n.id} data-part={n.id} className={`row ${selected === n ? 'sel' : ''} ${vis === 'off' ? 'dim' : ''}`}
        style={{ '--d': n.depth } as CSSProperties} role="treeitem" aria-selected={selected === n} aria-expanded={group ? isOpen : undefined} tabIndex={0}
        title="Click to select · Double-click to isolate"
        onClick={() => onSelect(n)} onDoubleClick={() => onIsolate(n)}
        onKeyDown={e => {
          if (e.key === 'Enter') onSelect(n);
          if (e.key === ' ') { e.preventDefault(); onToggle(n); }
          if (group && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) flip(n.id);
        }}>
        <span className={`tw ${group ? (isOpen ? 'open' : '') : 'none'}`} onClick={e => { e.stopPropagation(); flip(n.id); }}><Icon name="chev" /></span>
        <button className={`eye ${vis === 'mixed' ? 'mixed' : ''}`} aria-label={`${vis === 'off' ? 'Show' : 'Hide'} ${n.name}`} title={vis === 'off' ? 'Show' : 'Hide'}
          onClick={e => { e.stopPropagation(); onToggle(n); }} onDoubleClick={e => e.stopPropagation()}>
          <Icon name={vis === 'off' ? 'eyeOff' : 'eye'} />
        </button>
        <span className="ico"><Icon name={group ? 'parts' : 'part'} /></span>
        <span className="name">{n.name}</span>
        {group && <span className="cnt">{n.meshes.length}</span>}
      </div>,
      ...(group && isOpen ? rows(n.children) : []),
    ];
  });
  const list = rows(parts.root.children);

  return (
    <>
      <div className="search"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter parts…" aria-label="Filter parts" /></div>
      <div className="tree" role="tree" aria-label="Parts">{list.length ? list : <div className="tree-empty">No matching parts.</div>}</div>
    </>
  );
}
