import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type View = 'fit' | 'iso' | 'top' | 'front' | 'right';
export type ModelStats = { parts: number; triangles: number; size: THREE.Vector3 };

const EDGE_LIMIT = 1_000_000; // above this many triangles, edges start off (they cost time and memory)
const DIRS: Record<Exclude<View, 'fit'>, [number, number, number]> = {
  iso: [1, -1, 0.8], top: [0, -0.001, 1], front: [0, -1, 0], right: [1, 0, 0],
};

export class SceneView {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1e6);
  private controls: OrbitControls;
  private grid: THREE.GridHelper | null = null;
  private edgeMat = new THREE.LineBasicMaterial({ transparent: true });
  private model: THREE.Object3D | null = null;
  private box = new THREE.Box3();
  private dirty = true;
  private raf = 0;
  private resizeObserver: ResizeObserver;
  edges = true; wire = false; gridOn = true; dark = false;

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
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(el);
    this.resize();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      // Render only when something changed, so an idle viewer costs nothing.
      if (this.controls.update() || this.dirty) { this.renderer.render(this.scene, this.camera); this.dirty = false; }
    };
    loop();
  }

  private resize() {
    const r = this.el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  setTheme(dark: boolean) {
    this.dark = dark;
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
    if (obj) {
      this.scene.add(obj);
      this.box.setFromObject(obj);
      this.edges = this.stats().triangles <= EDGE_LIMIT;
    }
    this.applyModes();
    this.makeGrid();
    this.fit('iso');
  }

  applyModes() {
    this.model?.traverse(o => {
      if (o instanceof THREE.Mesh) {
        for (const m of [o.material].flat()) (m as THREE.MeshStandardMaterial).wireframe = this.wire;
        if (this.edges && !this.wire && !o.userData.edges) {
          const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), this.edgeMat);
          e.raycast = () => {};
          o.userData.edges = e; o.add(e);
        }
        if (o.userData.edges) (o.userData.edges as THREE.LineSegments).visible = this.edges && !this.wire;
      }
    });
    if (this.grid) this.grid.visible = this.gridOn && !!this.model;
    this.dirty = true;
  }

  fit(view: View) {
    if (!this.model || this.box.isEmpty()) return;
    const c = this.box.getCenter(new THREE.Vector3());
    const r = Math.max(this.box.getSize(new THREE.Vector3()).length() / 2, 1e-3);
    const dir = view === 'fit'
      ? this.camera.position.clone().sub(this.controls.target).normalize()
      : new THREE.Vector3(...DIRS[view]).normalize();
    const dist = (r / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.05;
    this.camera.position.copy(c).addScaledVector(dir, dist);
    this.camera.near = dist / 1000; this.camera.far = dist * 100;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(c);
    this.controls.update();
    this.dirty = true;
  }

  stats(): ModelStats {
    let parts = 0, triangles = 0;
    this.model?.traverse(o => {
      if (o instanceof THREE.Mesh) {
        parts++;
        const g = o.geometry as THREE.BufferGeometry;
        triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
      }
    });
    return { parts, triangles, size: this.box.getSize(new THREE.Vector3()) };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
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
