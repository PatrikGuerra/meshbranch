import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { Entity, Row } from './types';

export const COLORS = { a: 0x0d9488, b: 0xea580c };
const ON_TOP = { depthTest: false, depthWrite: false, transparent: true };

let ringTex: THREE.Texture | null = null;
function ring(): THREE.Texture {
  if (ringTex) return ringTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.lineWidth = 9; g.strokeStyle = '#fff'; g.beginPath(); g.arc(32, 32, 24, 0, Math.PI * 2); g.stroke();
  return (ringTex = new THREE.CanvasTexture(c));
}

// A screen-sized ring (hover) or dot (picked) at a point.
function marker(p: THREE.Vector3, color: number, filled: boolean): THREE.Object3D {
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([p.x, p.y, p.z], 3));
  const m = new THREE.PointsMaterial({ color, size: filled ? 11 : 18, sizeAttenuation: false, map: filled ? null : ring(), alphaTest: filled ? 0 : 0.4, ...ON_TOP });
  const pts = new THREE.Points(g, m);
  pts.renderOrder = 10;
  return pts;
}

export function label(text: string, p: THREE.Vector3, cls = 'm-label'): CSS2DObject {
  const div = document.createElement('div');
  div.className = cls; div.textContent = text;
  const o = new CSS2DObject(div);
  o.position.copy(p);
  return o;
}

// Draws one entity in a color. hover = lighter look.
export function drawEntity(e: Entity, color: number, hover: boolean, tag?: string): THREE.Object3D {
  const group = new THREE.Group();
  if (e.kind === 'vertex') {
    group.add(marker(e.p, color, !hover));
    if (tag) group.add(label(tag, e.p, 'm-tag'));
  } else if (e.kind === 'edge') {
    const g = new THREE.BufferGeometry().setFromPoints(e.closed ? [...e.points, e.points[0]] : e.points);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, linewidth: 3, opacity: hover ? 0.75 : 1, ...ON_TOP }));
    line.renderOrder = 9;
    group.add(line);
    // A thin tube reads as a thick line on every GPU (WebGL ignores linewidth > 1).
    group.add(tube(e.points, e.closed, color, hover));
    if (tag) group.add(label(tag, e.points[Math.floor(e.points.length / 2)], 'm-tag'));
  } else {
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(e.tris, 3));
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: hover ? 0.3 : 0.5, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = 8;
    group.add(mesh);
    if (tag) group.add(label(tag, e.centroid, 'm-tag'));
  }
  return group;
}

let tubeRadius = 0.2;
export function setOverlayScale(diagonal: number) { tubeRadius = diagonal * 0.0015; }
function tube(points: THREE.Vector3[], closed: boolean, color: number, hover: boolean): THREE.Object3D {
  if (points.length < 2) return new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal', 0);
  const g = new THREE.TubeGeometry(curve, Math.min(points.length * 2, 400), tubeRadius, 6, closed);
  const m = new THREE.MeshBasicMaterial({ color, opacity: hover ? 0.7 : 1, ...ON_TOP });
  const t = new THREE.Mesh(g, m);
  t.renderOrder = 9;
  return t;
}

// Dashed lines with their value, for rows that have two ends.
export function drawRows(rows: Row[], focus: number | null, dash: number, ink: number): THREE.Object3D {
  const group = new THREE.Group();
  rows.forEach((r, i) => {
    if (!r.from || !r.to || r.from.distanceTo(r.to) < 1e-9) return;
    const g = new THREE.BufferGeometry().setFromPoints([r.from, r.to]);
    const on = focus === null || focus === i;
    const line = new THREE.Line(g, new THREE.LineDashedMaterial({ color: on ? ink : 0x9aa1ad, dashSize: dash, gapSize: dash * 0.6, ...ON_TOP }));
    line.computeLineDistances();
    line.renderOrder = 11;
    group.add(line);
    group.add(marker(r.from, ink, true), marker(r.to, ink, true));
    // One value label at a time (the first row, or the row under the mouse) so labels never overlap.
    if (focus === i || (focus === null && i === rows.findIndex(x => x.from && x.to))) group.add(label(`${r.approx ? '≈ ' : ''}${r.value}`, r.from.clone().add(r.to).multiplyScalar(0.5)));
  });
  return group;
}

export function disposeGroup(g: THREE.Object3D) {
  g.traverse(o => {
    if (o instanceof CSS2DObject) o.element.remove();
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    [m.material].flat().forEach(x => (x as THREE.Material | undefined)?.dispose());
  });
  g.removeFromParent();
}
