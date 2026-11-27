import * as THREE from 'three';
import type { EdgeShape, FaceShape } from './types';

// Eigen decomposition of a symmetric 3x3 matrix (Jacobi). Returns eigenvalues ascending with their vectors.
export function eigen3(m: number[][]): { values: number[]; vectors: THREE.Vector3[] } {
  const a = m.map(r => [...r]), v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) off += a[p][q] ** 2;
    if (off < 1e-30) break;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) {
      if (Math.abs(a[p][q]) < 1e-300) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = v[k][p], y = v[k][q]; v[k][p] = c * x - s * y; v[k][q] = s * x + c * y; }
    }
  }
  return [0, 1, 2].map(i => ({ val: a[i][i], vec: new THREE.Vector3(v[0][i], v[1][i], v[2][i]).normalize() }))
    .sort((x, y) => x.val - y.val)
    .reduce((o, e) => { o.values.push(e.val); o.vectors.push(e.vec); return o; }, { values: [] as number[], vectors: [] as THREE.Vector3[] });
}

function covariance(points: THREE.Vector3[], center: THREE.Vector3): number[][] {
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of points) {
    const d = [p.x - center.x, p.y - center.y, p.z - center.z];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += d[i] * d[j];
  }
  return m;
}
const mean = (pts: THREE.Vector3[]) => pts.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(pts.length);

// Least-squares circle through points that lie on the plane (origin, u, v). Returns center in 3D and radius.
function circle2d(points: THREE.Vector3[], origin: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3): { center: THREE.Vector3; radius: number; err: number } | null {
  // Kasa fit: x² + y² + D x + E y + F = 0.
  let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, sxz = 0, syz = 0, sz = 0;
  const xy = points.map(p => { const d = p.clone().sub(origin); return [d.dot(u), d.dot(v)]; });
  for (const [x, y] of xy) { const z = x * x + y * y; sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y; sxz += x * z; syz += y * z; sz += z; }
  const n = xy.length;
  const A = new THREE.Matrix3().set(sxx, sxy, sx, sxy, syy, sy, sx, sy, n);
  if (Math.abs(A.determinant()) < 1e-18) return null;
  const sol = new THREE.Vector3(-sxz, -syz, -sz).applyMatrix3(A.invert());
  const cx = -sol.x / 2, cy = -sol.y / 2, r2 = cx * cx + cy * cy - sol.z;
  if (!(r2 > 0)) return null;
  const radius = Math.sqrt(r2);
  const err = Math.max(...xy.map(([x, y]) => Math.abs(Math.hypot(x - cx, y - cy) - radius)));
  return { center: origin.clone().addScaledVector(u, cx).addScaledVector(v, cy), radius, err };
}

// Straight line, circle (or arc) or other curve. tol: length tolerance in mm.
export function classifyEdge(points: THREE.Vector3[], closed: boolean, tol: number): EdgeShape {
  if (points.length < 2) return { type: 'curve' };
  const a = points[0], b = points[points.length - 1];
  if (!closed && a.distanceTo(b) > tol) {
    const dir = b.clone().sub(a).normalize();
    const off = (p: THREE.Vector3) => p.clone().sub(a).cross(dir).length();
    if (points.every(p => off(p) <= tol)) return { type: 'line', dir };
  }
  if (points.length < 5) return { type: 'curve' };
  const c = mean(points), { vectors } = eigen3(covariance(points, c));
  const normal = vectors[0];
  if (points.some(p => Math.abs(p.clone().sub(c).dot(normal)) > tol)) return { type: 'curve' };
  const fit = circle2d(points, c, vectors[2], vectors[1]);
  if (!fit || fit.err > Math.max(tol, fit.radius * 1e-3)) return { type: 'curve' };
  return { type: 'circle', center: fit.center, normal, radius: fit.radius };
}

// tris: 9 numbers per triangle. Plane, cylinder or other.
export function classifyFace(tris: Float32Array, tol: number): FaceShape {
  const normals: THREE.Vector3[] = [], weights: number[] = [], pts: THREE.Vector3[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < tris.length; i += 9) {
    a.fromArray(tris, i); b.fromArray(tris, i + 3); c.fromArray(tris, i + 6);
    const n = b.clone().sub(a).cross(c.clone().sub(a)), area = n.length();
    if (area < 1e-12) continue;
    normals.push(n.divideScalar(area)); weights.push(area);
    pts.push(a.clone(), b.clone(), c.clone());
  }
  if (!normals.length) return { type: 'other' };
  const n0 = normals[0];
  if (normals.every(n => n.dot(n0) > 1 - 1e-6)) {
    const avg = normals.reduce((s, n, i) => s.addScaledVector(n, weights[i]), new THREE.Vector3()).normalize();
    return { type: 'plane', normal: avg };
  }
  // A cylinder's facet normals all lie in the plane across its axis.
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  normals.forEach((n, k) => { const d = [n.x, n.y, n.z]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += weights[k] * d[i] * d[j]; });
  const { vectors } = eigen3(m), axis = vectors[0];
  if (normals.some(n => Math.abs(n.dot(axis)) > 0.01)) return { type: 'other' };
  const u = vectors[2], v = vectors[1], origin = mean(pts);
  const fit = circle2d(pts, origin, u, v);
  if (!fit || fit.err > Math.max(tol, fit.radius * 2e-3)) return { type: 'other' };
  return { type: 'cylinder', axis, point: fit.center, radius: fit.radius };
}
