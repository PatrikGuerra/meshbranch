import { useEffect, useRef, useState } from 'react';
import type { MeasureState } from '../measure/tool';
import type { Entity } from '../measure/types';
import { Icon } from './icons';

const POS_KEY = 'meshbranch-measure-pos';
type Pos = { right: number; bottom: number };
const fmt = (n: number) => (Math.abs(n) < 5e-7 ? 0 : n).toFixed(2);

function readPos(): Pos {
  try { const p = JSON.parse(localStorage.getItem(POS_KEY) ?? ''); if (typeof p.right === 'number') return p; } catch { /* first use */ }
  return { right: 12, bottom: 34 };
}

function Pick({ tag, e, part }: { tag: 'A' | 'B'; e: Entity | null; part?: string }) {
  return (
    <div className={`m-pick ${e ? '' : 'empty'}`}>
      <span className={`m-dot m-${tag.toLowerCase()}`}>{tag}</span>
      {e ? <><span>{describe(e)}</span>{part && <span className="m-part" title={part}>· {part}</span>}</> : <span>{tag === 'A' ? 'Click a vertex, edge or face' : 'Click a second item, or Shift+click to swap it'}</span>}
    </div>
  );
}

export function describe(e: Entity): string {
  if (e.kind === 'vertex') return e.label;
  if (e.kind === 'edge') return `Edge (${e.shape.type === 'line' ? 'line' : e.shape.type === 'circle' ? (e.closed ? 'circle' : 'arc') : 'curve'})`;
  return `Face (${e.shape.type})`;
}

// Floating panel in the bottom-right corner of the viewer. Drag it by its title; the spot is kept.
export function MeasurePanel({ state, partName, onFocus, onClear, onClose }: {
  state: MeasureState; partName: (e: Entity) => string | undefined;
  onFocus: (i: number | null) => void; onClear: () => void; onClose: () => void;
}) {
  const [pos, setPos] = useState<Pos>(readPos);
  const [small, setSmall] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (copied === null) return; const t = setTimeout(() => setCopied(null), 1200); return () => clearTimeout(t); }, [copied]);

  const drag = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const start = { x: e.clientX, y: e.clientY, ...pos };
    const parent = box.current!.parentElement!.getBoundingClientRect(), me = box.current!.getBoundingClientRect();
    const move = (ev: PointerEvent) => setPos({
      right: Math.min(Math.max(0, start.right - (ev.clientX - start.x)), parent.width - me.width),
      bottom: Math.min(Math.max(0, start.bottom - (ev.clientY - start.y)), parent.height - me.height),
    });
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up);
      setPos(p => { try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* keep for this visit */ } return p; });
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  };

  const { a, b, rows } = state;
  const copy = (i: number, v: string) => navigator.clipboard?.writeText(v.replace(/\s*mm²?$/, '')).then(() => setCopied(i), () => {});
  const shown = small ? rows.slice(0, 1) : rows;
  return (
    <div ref={box} className="measure" style={{ right: pos.right, bottom: pos.bottom }} role="region" aria-label="Measure">
      <div className="m-head" onPointerDown={drag} title="Drag to move">
        <span>Measure</span>
        <span className="m-actions">
          {(a || b) && <button className="link-btn" onClick={onClear}>Clear</button>}
          <button className="icon-btn small" onClick={() => setSmall(s => !s)} aria-label={small ? 'Expand' : 'Collapse'} title={small ? 'Expand' : 'Collapse'}>
            <span className={`tw ${small ? '' : 'open'}`}><Icon name="chev" /></span>
          </button>
          <button className="icon-btn small" onClick={onClose} aria-label="Close measure" title="Close (M)"><Icon name="x" /></button>
        </span>
      </div>
      {!small && <div className="m-picks"><Pick tag="A" e={a} part={a ? partName(a) : undefined} /><Pick tag="B" e={b} part={b ? partName(b) : undefined} /></div>}
      {shown.length > 0 && (
        <table className="m-rows"><tbody>
          {shown.map((r, i) => (
            <tr key={r.label} onMouseEnter={() => onFocus(r.from ? i : null)} onMouseLeave={() => onFocus(null)}>
              <th>{r.label}</th>
              <td><button className="m-val" onClick={() => copy(i, r.value)} title={r.approx ? 'Approximate: measured on the triangle mesh. Click to copy.' : 'Click to copy'}>
                {copied === i ? 'Copied' : `${r.approx ? '≈ ' : ''}${r.value}`}</button></td>
              {!small && <td className="m-delta">{r.delta && `ΔX ${fmt(r.delta[0])}  ΔY ${fmt(r.delta[1])}  ΔZ ${fmt(r.delta[2])}`}</td>}
            </tr>
          ))}
        </tbody></table>
      )}
      {!small && <div className="m-hint">Alt: no snap · Esc: clear</div>}
    </div>
  );
}
