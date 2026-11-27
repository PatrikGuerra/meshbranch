import type { ReactNode } from 'react';
import type { Projection, View } from '../viewer/scene';
import { Icon, type IconName } from './icons';

export type Display = 'solid' | 'edges' | 'wire';

const VIEWS: { v: View; icon: IconName; name: string; key: string }[] = [
  { v: 'fit', icon: 'fit', name: 'Fit to view', key: 'F' },
  { v: 'iso', icon: 'viewIso', name: 'Isometric', key: '0' },
  { v: 'top', icon: 'viewTop', name: 'Top', key: '7' },
  { v: 'front', icon: 'viewFront', name: 'Front', key: '1' },
  { v: 'right', icon: 'viewRight', name: 'Right', key: '3' },
];
const DISPLAYS: { d: Display; icon: IconName; name: string; key?: string }[] = [
  { d: 'solid', icon: 'solid', name: 'Solid' },
  { d: 'edges', icon: 'edges', name: 'Solid with edges', key: 'E' },
  { d: 'wire', icon: 'wire', name: 'Wireframe', key: 'W' },
];

function Btn({ icon, name, keyHint, pressed, disabled, onClick, children, className = '' }: {
  icon: IconName; name: string; keyHint?: string; pressed?: boolean; disabled?: boolean; onClick: () => void; children?: ReactNode; className?: string;
}) {
  return (
    <button className={`ib ${className}`} aria-label={name} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <Icon name={icon} />{children}
      <span className="tip" role="tooltip">{name}{keyHint && <kbd>{keyHint}</kbd>}</span>
    </button>
  );
}

// Viewer toolbar (mock/toolbar.html, version A): projection, camera, display, scene and tools groups.
export function ViewToolbar({ disabled, measuring, display, grid, projection, onView, onMeasure, onDisplay, onGrid, onProjection }: {
  disabled: boolean; measuring: boolean; display: Display; grid: boolean; projection: Projection;
  onView: (v: View) => void; onMeasure: () => void; onDisplay: (d: Display) => void; onGrid: () => void; onProjection: (p: Projection) => void;
}) {
  return (
    <div className="tools" role="toolbar" aria-label="View">
      <div className="group" role="radiogroup" aria-label="Projection">
        <Btn icon="persp" name="Perspective" keyHint="5" pressed={projection === 'persp'} onClick={() => onProjection('persp')} />
        <Btn icon="ortho" name="Orthographic" keyHint="5" pressed={projection === 'ortho'} onClick={() => onProjection('ortho')} />
      </div>
      <div className="group" role="group" aria-label="Camera">
        {VIEWS.map(x => <Btn key={x.v} icon={x.icon} name={x.name} keyHint={x.key} onClick={() => onView(x.v)} />)}
      </div>
      <div className="group" role="radiogroup" aria-label="Display">
        {DISPLAYS.map(x => <Btn key={x.d} icon={x.icon} name={x.name} keyHint={x.key} pressed={display === x.d} onClick={() => onDisplay(x.d)} />)}
      </div>
      <div className="group" role="group" aria-label="Scene">
        <Btn icon="grid" name="Grid" keyHint="G" pressed={grid} onClick={onGrid} />
      </div>
      <div className="group" role="group" aria-label="Tools">
        <Btn icon="ruler" name="Measure distances" keyHint="M" pressed={measuring} disabled={disabled} onClick={onMeasure} className="wide primary"><span>Measure</span></Btn>
      </div>
    </div>
  );
}
