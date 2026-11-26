import occtimportjs from 'occt-import-js';
import wasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url';
import type { OcctNode } from 'occt-import-js';

export type StepMesh = { name: string; color: [number, number, number] | null; position: Float32Array; normal: Float32Array | null; index: Uint32Array };
export type StepReply = { id: number; ok: true; root: OcctNode; meshes: StepMesh[] } | { id: number; ok: false; error: string };

const ctx = self as unknown as { postMessage(msg: StepReply, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent) => void) | null };
let occt: ReturnType<typeof occtimportjs> | undefined;

ctx.onmessage = async (e: MessageEvent<{ id: number; buffer: ArrayBuffer }>) => {
  const { id, buffer } = e.data;
  try {
    occt ??= occtimportjs({ locateFile: () => wasmUrl });
    const res = (await occt).ReadStepFile(new Uint8Array(buffer), null); // output in millimeters
    if (!res.success) throw new Error('This STEP file could not be read.');
    const meshes: StepMesh[] = res.meshes.map(m => ({
      name: m.name ?? '',
      color: m.color ?? null,
      position: Float32Array.from(m.attributes.position.array),
      normal: m.attributes.normal ? Float32Array.from(m.attributes.normal.array) : null,
      index: Uint32Array.from(m.index.array),
    }));
    const transfer = meshes.flatMap(m => [m.position.buffer, m.index.buffer, ...(m.normal ? [m.normal.buffer] : [])]);
    ctx.postMessage({ id, ok: true, root: res.root, meshes }, transfer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ id, ok: false, error: /memory|OOM|abort/i.test(msg) ? 'Not enough memory to read this STEP file.' : msg });
  }
};
