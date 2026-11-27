import type * as THREE from 'three';
import type { SceneView } from '../viewer/scene';
import { measure } from './measure';
import { COLORS, disposeGroup, drawEntity, drawRows, setOverlayScale } from './overlay';
import { pickTopology } from './picker';
import { buildTopology, type Topology } from './topology';
import type { Entity, Row } from './types';

export type MeasureState = { a: Entity | null; b: Entity | null; hover: Entity | null; rows: Row[] };
export type Picker = (view: SceneView, e: MouseEvent, opts: { snap: boolean; scale: number }) => Entity | null;

const same = (x: Entity | null, y: Entity | null) => !!x && !!y && (x === y ||
  (x.kind === 'vertex' && y.kind === 'vertex' && x.p.distanceToSquared(y.p) < 1e-12));

// Measure mode: hover highlights, two picks (A, B), rows and dashed lines in the scene.
export class MeasureTool {
  state: MeasureState = { a: null, b: null, hover: null, rows: [] };
  focus: number | null = null;
  dark = false;
  private layer: THREE.Object3D | null = null;
  private hoverLayer: THREE.Object3D | null = null;
  readonly topo: Topology;
  picker: Picker = (v, e, o) => pickTopology(v, this.topo, e, o.snap, o.scale);

  constructor(private view: SceneView, private onChange: (s: MeasureState) => void) {
    setOverlayScale(view.modelDiagonal());
    this.topo = buildTopology(view.modelMeshes(), view.modelDiagonal());
    view.setTool(this);
  }

  private scale(e: MouseEvent) { return (e as PointerEvent).pointerType === 'touch' ? 2 : 1; }

  hover(e: MouseEvent | null) {
    const h = e ? this.picker(this.view, e, { snap: !e.altKey, scale: this.scale(e) }) : null;
    if (same(h, this.state.hover) || (!h && !this.state.hover)) return;
    this.state = { ...this.state, hover: h };
    if (this.hoverLayer) disposeGroup(this.hoverLayer);
    this.hoverLayer = null;
    if (h && !same(h, this.state.a) && !same(h, this.state.b)) {
      this.hoverLayer = drawEntity(h, this.state.a && !this.state.b ? COLORS.b : COLORS.a, true);
      this.view.overlay.add(this.hoverLayer);
    }
    this.view.touch();
    this.onChange(this.state);
  }

  click(e: MouseEvent) {
    const p = this.picker(this.view, e, { snap: !e.altKey, scale: this.scale(e) });
    let { a, b } = this.state;
    if (!p) { a = b = null; }
    else if (same(p, a)) { a = b; b = null; }
    else if (same(p, b)) b = null;
    else if (e.shiftKey && a) b = p;
    else if (!a) a = p;
    else if (!b) b = p;
    else { a = p; b = null; }
    this.set(a, b);
  }

  set(a: Entity | null, b: Entity | null) {
    this.state = { ...this.state, a, b, rows: measure(a, b) };
    this.focus = null;
    this.redraw();
  }
  clear() { this.set(null, null); }
  setFocus(i: number | null) { this.focus = i; this.redraw(); }

  redraw() {
    if (this.layer) disposeGroup(this.layer);
    if (this.hoverLayer) { disposeGroup(this.hoverLayer); this.hoverLayer = null; }
    const g = this.layer = drawRows(this.state.rows, this.focus, this.view.modelDiagonal() * 0.006, this.dark ? 0xe7e9ee : 0x111827);
    if (this.state.a) g.add(drawEntity(this.state.a, COLORS.a, false, 'A'));
    if (this.state.b) g.add(drawEntity(this.state.b, COLORS.b, false, 'B'));
    this.view.overlay.add(g);
    this.view.touch();
    this.onChange(this.state);
  }

  dispose() {
    if (this.layer) disposeGroup(this.layer);
    if (this.hoverLayer) disposeGroup(this.hoverLayer);
    this.view.setTool(null);
    this.view.touch();
  }
}
