// 3D files kept in IndexedDB by Git blob SHA. Equal content has an equal SHA, so a file opened once is never
// downloaded again, on any branch or commit. Oldest files go first once the cache passes LIMIT bytes.
const DB = 'meshbranch', BLOBS = 'blobs', META = 'meta';
export const LIMIT = 500 * 1024 * 1024;
type Meta = { size: number; at: number };

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(BLOBS); req.result.createObjectStore(META); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}
const done = (t: IDBTransaction) => new Promise<void>((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = t.onabort = () => reject(t.error); });
const value = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

// Any failure (private mode, quota, old browser) just means "not cached".
export async function getBlob(sha: string): Promise<ArrayBuffer | null> {
  try {
    const t = (await db()).transaction([BLOBS, META], 'readwrite');
    const buf = await value(t.objectStore(BLOBS).get(sha) as IDBRequest<ArrayBuffer | undefined>);
    if (buf) t.objectStore(META).put({ size: buf.byteLength, at: Date.now() } satisfies Meta, sha);
    await done(t);
    return buf ?? null;
  } catch { return null; }
}

export async function putBlob(sha: string, buf: ArrayBuffer): Promise<void> {
  try {
    const d = await db();
    const t = d.transaction([BLOBS, META], 'readwrite');
    t.objectStore(BLOBS).put(buf, sha); // copied now, so the caller may transfer buf afterwards
    t.objectStore(META).put({ size: buf.byteLength, at: Date.now() } satisfies Meta, sha);
    await done(t);
    await evict(d);
  } catch { /* storage full or blocked: run without cache */ }
}

async function evict(d: IDBDatabase) {
  const t = d.transaction([BLOBS, META], 'readwrite');
  const meta = t.objectStore(META);
  const [keys, metas] = await Promise.all([value(meta.getAllKeys()), value(meta.getAll() as IDBRequest<Meta[]>)]);
  for (const sha of pickEvictions(keys.map((k, i) => ({ sha: String(k), ...metas[i] })), LIMIT)) {
    t.objectStore(BLOBS).delete(sha); meta.delete(sha);
  }
  await done(t);
}

// Oldest-used first, until the total fits the limit.
export function pickEvictions(items: { sha: string; size: number; at: number }[], limit: number): string[] {
  let total = items.reduce((s, i) => s + i.size, 0);
  const out: string[] = [];
  for (const i of [...items].sort((a, b) => a.at - b.at)) {
    if (total <= limit) break;
    out.push(i.sha); total -= i.size;
  }
  return out;
}
