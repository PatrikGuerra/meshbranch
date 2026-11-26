import * as THREE from 'three';

export type PartNode = {
  id: number;
  name: string;
  children: PartNode[];
  meshes: THREE.Mesh[]; // every mesh under this node
  parent: PartNode | null;
  depth: number;
};
export type Parts = { root: PartNode; all: PartNode[]; leaves: PartNode[]; byMesh: Map<THREE.Mesh, PartNode> };

type Draft = { name: string; children: Draft[]; meshes: THREE.Mesh[] };

// Turns the loaded scene into the part tree shown in the UI.
// A group with a single child is merged into it (CAD exports wrap each body in its own group).
export function buildParts(root: THREE.Object3D): Parts {
  const visit = (obj: THREE.Object3D): Draft | null => {
    if (obj instanceof THREE.Mesh) return { name: obj.name, children: [], meshes: [obj] };
    const kids = obj.children.map(visit).filter((d): d is Draft => d !== null);
    if (!kids.length) return null;
    if (kids.length === 1) return { ...kids[0], name: obj.name || kids[0].name };
    return { name: obj.name, children: kids, meshes: kids.flatMap(k => k.meshes) };
  };
  const top = obj2draft(root, visit);

  const all: PartNode[] = [], leaves: PartNode[] = [];
  const byMesh = new Map<THREE.Mesh, PartNode>();
  let bodies = 0, groups = 0;
  const finish = (d: Draft, parent: PartNode | null, depth: number): PartNode => {
    const n: PartNode = { id: all.length, name: d.name, children: [], meshes: d.meshes, parent, depth };
    all.push(n);
    n.children = d.children.map(c => finish(c, n, depth + 1));
    if (!n.name) n.name = n.children.length ? `Group ${++groups}` : `Body ${++bodies}`;
    if (!n.children.length) { leaves.push(n); n.meshes.forEach(m => byMesh.set(m, n)); }
    return n;
  };
  return { root: finish(top, null, -1), all, leaves, byMesh };
}

// The root keeps its children even when there is only one, so the tree always lists the file's parts.
function obj2draft(root: THREE.Object3D, visit: (o: THREE.Object3D) => Draft | null): Draft {
  const kids = root instanceof THREE.Mesh ? [visit(root)!] : root.children.map(visit).filter((d): d is Draft => d !== null);
  return { name: root.name, children: kids, meshes: kids.flatMap(k => k.meshes) };
}

export const visibility = (n: PartNode): 'on' | 'off' | 'mixed' => {
  const v = n.meshes.filter(m => m.visible).length;
  return v === n.meshes.length ? 'on' : v ? 'mixed' : 'off';
};

// Ids of the parts whose name matches, the groups above them and, for a matching group, everything inside it.
// null = no search.
export function matchParts(parts: Parts, query: string): Set<number> | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const keep = new Set<number>();
  for (const n of parts.all) {
    if (!n.parent || !n.name.toLowerCase().includes(q)) continue;
    for (let p: PartNode | null = n; p && p.parent; p = p.parent) keep.add(p.id);
    const stack = [...n.children];
    while (stack.length) { const c = stack.pop()!; keep.add(c.id); stack.push(...c.children); }
  }
  return keep;
}
