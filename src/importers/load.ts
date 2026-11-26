import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import type { OcctNode } from 'occt-import-js';
import type { Format } from './formats';
import type { StepMesh, StepReply } from './step.worker';

const DEFAULT_COLOR = 0xc9ced6;
const material = (color: THREE.ColorRepresentation = DEFAULT_COLOR, vertexColors = false) =>
  new THREE.MeshStandardMaterial({ color: vertexColors ? 0xffffff : color, vertexColors, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide });

// One long-lived worker keeps the 7 MB OpenCascade WASM loaded between files.
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (r: Extract<StepReply, { ok: true }>) => void; reject: (e: Error) => void }>();
function stepWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./step.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<StepReply>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve(e.data); else p.reject(new Error(e.data.error));
  };
  worker.onerror = e => {
    pending.forEach(p => p.reject(new Error(e.message || 'The STEP reader stopped unexpectedly.')));
    pending.clear(); worker?.terminate(); worker = null;
  };
  return worker;
}

async function readStep(buffer: ArrayBuffer): Promise<THREE.Object3D> {
  const id = ++seq;
  const { root, meshes } = await new Promise<Extract<StepReply, { ok: true }>>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    stepWorker().postMessage({ id, buffer }, [buffer]);
  });
  const mats = new Map<string, THREE.Material>();
  const toMesh = (m: StepMesh) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
    g.setIndex(new THREE.BufferAttribute(m.index, 1));
    if (m.normal) g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3)); else g.computeVertexNormals();
    const c = m.color ? new THREE.Color(...m.color) : new THREE.Color(DEFAULT_COLOR);
    const key = c.getHexString();
    if (!mats.has(key)) mats.set(key, material(c));
    const mesh = new THREE.Mesh(g, mats.get(key)!);
    mesh.name = m.name;
    return mesh;
  };
  const build = (n: OcctNode): THREE.Object3D => {
    const group = new THREE.Group();
    group.name = n.name;
    n.meshes.forEach(i => group.add(toMesh(meshes[i])));
    n.children.forEach(c => group.add(build(c)));
    return group;
  };
  return build(root);
}

export type LoadContext = {
  name: string;
  fetchText: (relativePath: string) => Promise<string | null>; // sibling files such as .mtl
  resourceUrl: string; // base URL for textures referenced by a .mtl
};

export async function loadModel(format: Format, buffer: ArrayBuffer, ctx: LoadContext): Promise<THREE.Object3D> {
  if (format === 'step') {
    const obj = await readStep(buffer);
    obj.name ||= ctx.name;
    return obj;
  }
  if (format === 'stl') {
    const geo = new STLLoader().parse(buffer);
    const mesh = new THREE.Mesh(geo, material(DEFAULT_COLOR, geo.hasAttribute('color')));
    mesh.name = ctx.name;
    const group = new THREE.Group();
    group.name = ctx.name;
    group.add(mesh);
    return group;
  }
  const text = new TextDecoder().decode(buffer);
  const loader = new OBJLoader();
  const mtlName = text.match(/^mtllib\s+(.+?)\s*$/m)?.[1];
  const mtlText = mtlName ? await ctx.fetchText(mtlName) : null;
  if (mtlText) {
    const mats = new MTLLoader().setResourcePath(ctx.resourceUrl).parse(mtlText, '');
    mats.preload();
    loader.setMaterials(mats);
  }
  const obj = loader.parse(text);
  if (!mtlText) obj.traverse(o => { if (o instanceof THREE.Mesh) o.material = material(); });
  obj.name = ctx.name;
  obj.rotation.x = Math.PI / 2; // OBJ is Y-up; the viewer is Z-up like CAD tools
  return obj;
}
