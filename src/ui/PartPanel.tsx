import type { ReactNode } from 'react';
import type { Parts, PartNode } from '../viewer/parts';
import type { SceneView, ViewMode } from '../viewer/scene';

const MODES: { id: ViewMode; label: string }[] = [
  { id: 'solid', label: 'Solid' }, { id: 'edges', label: 'Edges' }, { id: 'wire', label: 'Wireframe' },
];
const mm = (v: { x: number; y: number; z: number }) => `${v.x.toFixed(1)} × ${v.y.toFixed(1)} × ${v.z.toFixed(1)} mm`;
const leafCount = (n: PartNode): number => n.children.length ? n.children.reduce((s, c) => s + leafCount(c), 0) : 1;
const num = (n: number) => Math.round(n).toLocaleString('en-US');

function Prop({ k, children }: { k: string; children: ReactNode }) {
  return <div className="prop"><dt>{k}</dt><dd>{children}</dd></div>;
}

// File facts, plus the selected part's facts and look controls (R10, R16).
export function PartPanel({ view, parts, selected, format, size, onChange }: {
  view: SceneView; parts: Parts; selected: PartNode | null; format: string; size: string; onChange: () => void;
}) {
  const all = parts.root.meshes;
  if (!selected) {
    return (
      <dl className="props">
        <Prop k="Format">{format}</Prop>
        <Prop k="Size">{size}</Prop>
        <Prop k="Parts">{num(parts.leaves.length)}</Prop>
        <Prop k="Triangles">{num(view.triangles(all))}</Prop>
        <Prop k="Bounds"><span className="mono">{mm(view.size(all))}</span></Prop>
        <p className="props-hint">Select a part to change its color, transparency or view.</p>
      </dl>
    );
  }
  const meshes = selected.meshes, look = view.partLook(meshes);
  const path = [] as string[];
  for (let p = selected.parent; p && p.parent; p = p.parent) path.unshift(p.name);
  return (
    <div className="part-panel">
      <div className="part-title">
        <strong title={selected.name}>{selected.name}</strong>
        {path.length > 0 && <span className="part-path" title={path.join(' / ')}>{path.join(' / ')}</span>}
      </div>
      <dl className="props">
        <Prop k="Type">{selected.children.length ? `Assembly · ${leafCount(selected)} parts` : 'Part'}</Prop>
        <Prop k="Triangles">{num(view.triangles(meshes))}</Prop>
        <Prop k="Bounds"><span className="mono">{mm(view.size(meshes))}</span></Prop>
      </dl>
      <div className="controls">
        <label className="ctl"><span>Color</span>
          <input type="color" value={look.color} onChange={e => { view.setPartColor(meshes, e.target.value); onChange(); }} />
        </label>
        <label className="ctl"><span>Transparency</span>
          <input type="range" min={0} max={90} step={5} value={Math.round((1 - look.opacity) * 100)}
            onChange={e => { view.setPartOpacity(meshes, 1 - Number(e.target.value) / 100); onChange(); }} />
          <span className="val">{Math.round((1 - look.opacity) * 100)}%</span>
        </label>
        <div className="ctl"><span>View</span>
          <div className="segmented" role="group" aria-label="View mode">
            {MODES.map(m => <button key={m.label} aria-pressed={look.mode === m.id} onClick={() => { view.setPartMode(meshes, m.id); onChange(); }}>{m.label}</button>)}
          </div>
        </div>
        <button className="btn small" onClick={() => { view.resetPart(meshes); onChange(); }}>Reset to file</button>
      </div>
    </div>
  );
}
