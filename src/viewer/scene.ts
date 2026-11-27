import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ViewportGizmo, type GizmoOptions } from 'three-viewport-gizmo';

// Z-up for everything, like CAD tools. The view cube reads this global to orient its clicks and drags;
// without it, a click on a face rolls the camera around a Y-up axis and the next orbit jumps.
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

export type View = 'fit' | 'iso' | 'top' | 'front' | 'right';
export type ViewMode = 'solid' | 'edges' | 'wire';
export type ModelStats = { triangles: number; size: THREE.Vector3 };
type Mat = THREE.MeshStandardMaterial | THREE.MeshPhongMaterial;
type Base = { color: THREE.Color; opacity: number; transparent: boolean; vertexColors: boolean };

const EDGE_LIMIT = 1_000_000; // above this many triangles, edges start off (they cost time and memory)
const HIGHLIGHT = new THREE.Color(0x0f766e).multiplyScalar(0.55);
const BLACK = new THREE.Color(0x000000);
const DIRS: Record<Exclude<View, 'fit'>, [number, number, number]> = {
  iso: [1, -1, 0.8], top: [0, -0.001, 1], front: [0, -1, 0], right: [1, 0, 0],
};
const mats = (m: THREE.Mesh) => [m.material].flat() as Mat[];

// View cube. The library names faces for a Y-up world; this scene is Z-up, so the labels follow the real axes.
function cubeOptions(el: HTMLElement, dark: boolean): GizmoOptions {
  const face = dark ? '#1c212b' : '#ffffff', label = dark ? '#c9ced6' : '#374151', accent = dark ? '#2dd4bf' : '#0f766e';
  const f = (text: string) => ({ label: text, color: face, labelColor: label, hover: { color: accent, labelColor: dark ? '#062824' : '#ffffff' } });
  return {
    type: 'cube', id: 'viewcube', container: el, placement: 'top-right', size: 96, offset: { top: 12, right: 12 },
    animated: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    font: { family: 'Inter, "Segoe UI", system-ui, sans-serif', weight: 700 },
    background: { color: dark ? '#2e3442' : '#aab2bd', hover: { color: accent } },
    edges: { color: dark ? '#2e3442' : '#aab2bd', hover: { color: accent } },
    corners: { color: dark ? '#2e3442' : '#aab2bd', hover: { color: accent } },
    x: f('RIGHT'), nx: f('LEFT'), y: f('BACK'), ny: f('FRONT'), z: f('TOP'), nz: f('BOTTOM'),
  };
}

export class SceneView {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1e6);
  private controls: OrbitControls;
  private grid: THREE.GridHelper | null = null;
  private edgeMat = new THREE.LineBasicMaterial({ transparent: true });
  private model: THREE.Object3D | null = null;
  private meshes: THREE.Mesh[] = [];
  private box = new THREE.Box3();
  private highlighted = new Set<THREE.Mesh>();
  private ray = new THREE.Raycaster();
  private dirty = true;
  private raf = 0;
  private resizeObserver: ResizeObserver;
  private gizmo: ViewportGizmo;
  edges = true; wire = false; gridOn = true; dark = false;
  // Called on a click (not a drag) in the viewport with the visible mesh under the pointer.
  onPick: ((mesh: THREE.Mesh | null, double: boolean) => void) | null = null;

  constructor(private el: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // throws without WebGL
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.prepend(this.renderer.domElement);
    this.camera.up.set(0, 0, 1); // Z-up, like CAD tools
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a90a0, 1.7);
    hemi.position.set(0, 0, 1);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1, -1.4, 2);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-1.2, 1, 0.6);
    this.scene.add(hemi, key, fill);
    this.gizmo = new ViewportGizmo(this.camera, this.renderer, cubeOptions(el, false));
    // Looking straight down Z with Z as "up" has no unique roll, so the library picks one 90° off from the
    // toolbar's Top view. Tilt that click a hair toward -Y, like DIRS.top, so FRONT sits at the bottom.
    // shortcut: patches a private method of three-viewport-gizmo 2.2.0; re-check if the version changes.
    const gz = this.gizmo as unknown as { _setOrientation(p: THREE.Vector3): void };
    const setOrientation = gz._setOrientation.bind(this.gizmo);
    gz._setOrientation = p => setOrientation(Math.hypot(p.x, p.y) < 1e-6 ? new THREE.Vector3(0, -0.001 * Math.abs(p.z), p.z) : p);
    this.gizmo.attachControls(this.controls);
    this.gizmo.addEventListener('change', () => { this.dirty = true; });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(el);
    this.resize();

    const canvas = this.renderer.domElement;
    const down = { x: 0, y: 0 };
    canvas.addEventListener('pointerdown', e => { down.x = e.clientX; down.y = e.clientY; });
    canvas.addEventListener('pointerup', e => {
      if (e.button === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) this.onPick?.(this.pick(e), false);
    });
    canvas.addEventListener('dblclick', e => this.onPick?.(this.pick(e), true));

    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      // Render only when something changed, so an idle viewer costs nothing.
      if (this.controls.update() || this.dirty) {
        this.renderer.render(this.scene, this.camera);
        this.gizmo.cameraUpdate().render(); // keep the cube turned like the camera, even after fit()
        this.dirty = false;
      }
    };
    loop();
  }

  private resize() {
    const r = this.el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
    this.gizmo?.update();
    this.dirty = true;
  }

  setTheme(dark: boolean) {
    this.dark = dark;
    this.gizmo.set(cubeOptions(this.el, dark));
    this.edgeMat.color.set(dark ? 0x05070a : 0x1d2330);
    this.edgeMat.opacity = dark ? 0.6 : 0.35;
    this.makeGrid();
  }

  private makeGrid() {
    if (this.grid) { this.scene.remove(this.grid); this.grid.dispose(); }
    const size = this.model ? this.box.getSize(new THREE.Vector3()) : new THREE.Vector3(100, 100, 0);
    const span = Math.max(size.x, size.y, 1) * 3;
    const step = 10 ** Math.floor(Math.log10(span / 4)); // round cell size: 1, 10, 100 mm...
    const cells = Math.max(4, Math.ceil(span / step / 2) * 2);
    this.grid = new THREE.GridHelper(cells * step, cells, this.dark ? 0x3a4150 : 0xc5cad4, this.dark ? 0x222731 : 0xe2e6ec);
    this.grid.rotation.x = Math.PI / 2;
    if (this.model) { const c = this.box.getCenter(new THREE.Vector3()); this.grid.position.set(c.x, c.y, this.box.min.z - size.z * 0.001); }
    this.grid.visible = this.gridOn && !!this.model;
    this.scene.add(this.grid);
    this.dirty = true;
  }

  setModel(obj: THREE.Object3D | null) {
    if (this.model) { this.scene.remove(this.model); disposeTree(this.model); }
    this.model = obj;
    this.meshes = [];
    this.highlighted.clear();
    if (obj) {
      // Each mesh gets its own material, so one part can change color or opacity alone.
      const shared = new Set<THREE.Material>();
      obj.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        mats(o).forEach(m => shared.add(m));
        o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
        o.userData.base = mats(o).map(m => ({ color: m.color.clone(), opacity: m.opacity, transparent: m.transparent, vertexColors: m.vertexColors }) satisfies Base);
        this.meshes.push(o);
      });
      shared.forEach(m => m.dispose());
      this.scene.add(obj);
      this.box.setFromObject(obj);
      this.edges = this.triangles(this.meshes) <= EDGE_LIMIT;
    }
    this.applyModes();
    this.makeGrid();
    this.fit('iso');
  }

  applyModes() {
    const global: ViewMode = this.globalMode();
    for (const o of this.meshes) {
      const mode: ViewMode = o.userData.mode ?? global;
      mats(o).forEach(m => { m.wireframe = mode === 'wire'; });
      if (mode === 'edges' && !o.userData.edges) {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), this.edgeMat);
        e.raycast = () => {};
        o.userData.edges = e; o.add(e);
      }
      if (o.userData.edges) (o.userData.edges as THREE.LineSegments).visible = mode === 'edges';
    }
    if (this.grid) this.grid.visible = this.gridOn && !!this.model;
    this.dirty = true;
  }

  // ----- Per-part changes (the file itself never changes) -----
  setPartColor(meshes: THREE.Mesh[], color: string) {
    for (const o of meshes) mats(o).forEach(m => { m.color.set(color); if (m.vertexColors) { m.vertexColors = false; m.needsUpdate = true; } });
    this.dirty = true;
  }
  setPartOpacity(meshes: THREE.Mesh[], opacity: number) {
    for (const o of meshes) mats(o).forEach(m => {
      const t = opacity < 1;
      if (m.transparent !== t) m.needsUpdate = true;
      m.opacity = opacity; m.transparent = t; m.depthWrite = !t;
    });
    this.dirty = true;
  }
  setPartMode(meshes: THREE.Mesh[], mode: ViewMode | null) {
    for (const o of meshes) o.userData.mode = mode ?? undefined;
    this.applyModes();
  }
  // The toolbar's Edges/Wireframe apply to the whole model, so they drop the per-part choices.
  clearPartModes() {
    for (const o of this.meshes) o.userData.mode = undefined;
    this.applyModes();
  }
  private globalMode(): ViewMode { return this.wire ? 'wire' : this.edges ? 'edges' : 'solid'; }
  resetPart(meshes: THREE.Mesh[]) {
    for (const o of meshes) {
      const base = o.userData.base as Base[];
      mats(o).forEach((m, i) => {
        if (m.vertexColors !== base[i].vertexColors || m.transparent !== base[i].transparent) m.needsUpdate = true;
        m.color.copy(base[i].color); m.opacity = base[i].opacity; m.transparent = base[i].transparent;
        m.depthWrite = !base[i].transparent; m.vertexColors = base[i].vertexColors;
      });
      o.userData.mode = undefined;
    }
    this.applyModes();
  }
  // Current look of the first mesh, to fill the part controls. The mode is the one on screen.
  partLook(meshes: THREE.Mesh[]): { color: string; opacity: number; mode: ViewMode } {
    const m = meshes[0] ? mats(meshes[0])[0] : null;
    return { color: m ? `#${m.color.getHexString()}` : '#c9ced6', opacity: m?.opacity ?? 1, mode: meshes[0]?.userData.mode ?? this.globalMode() };
  }
  setHighlight(meshes: THREE.Mesh[]) {
    this.highlighted = new Set(meshes);
    for (const o of this.meshes) mats(o).forEach(m => m.emissive.copy(this.highlighted.has(o) ? HIGHLIGHT : BLACK));
    this.dirty = true;
  }
  touch() { this.dirty = true; }

  private pick(e: MouseEvent): THREE.Mesh | null {
    if (!this.model) return null;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const shown = (o: THREE.Object3D | null): boolean => !o || (o.visible && shown(o.parent));
    const hit = this.ray.intersectObjects(this.meshes.filter(m => shown(m)), false)[0];
    return (hit?.object as THREE.Mesh) ?? null;
  }

  fit(view: View, meshes?: THREE.Mesh[]) {
    if (!this.model || this.box.isEmpty()) return;
    const box = meshes?.length ? meshes.reduce((b, m) => b.expandByObject(m), new THREE.Box3()) : this.box;
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1e-3);
    const dir = view === 'fit'
      ? this.camera.position.clone().sub(this.controls.target).normalize()
      : new THREE.Vector3(...DIRS[view]).normalize();
    const dist = (r / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.05;
    this.camera.position.copy(c).addScaledVector(dir, dist);
    this.camera.near = dist / 1000; this.camera.far = dist * 100;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(c);
    this.gizmo.target.copy(c);
    this.controls.update();
    this.dirty = true;
  }

  triangles(meshes: THREE.Mesh[]): number {
    return meshes.reduce((t, o) => t + (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3, 0);
  }
  size(meshes: THREE.Mesh[]): THREE.Vector3 {
    return meshes.reduce((b, m) => b.expandByObject(m), new THREE.Box3()).getSize(new THREE.Vector3());
  }
  stats(): ModelStats {
    return { triangles: this.triangles(this.meshes), size: this.box.getSize(new THREE.Vector3()) };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.gizmo.detachControls();
    this.gizmo.dispose();
    this.controls.dispose();
    if (this.model) disposeTree(this.model);
    this.edgeMat.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function disposeTree(obj: THREE.Object3D) {
  obj.traverse(o => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      o.geometry.dispose();
      if (!(o instanceof THREE.LineSegments && o.parent instanceof THREE.Mesh)) for (const m of [o.material].flat()) m.dispose();
    }
  });
}
