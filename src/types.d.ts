declare module 'occt-import-js' {
  type OcctMesh = {
    name?: string;
    color?: [number, number, number];
    attributes: { position: { array: ArrayLike<number> }; normal?: { array: ArrayLike<number> } };
    index: { array: ArrayLike<number> };
    brep_faces?: { first: number; last: number }[];
  };
  export type OcctNode = { name: string; meshes: number[]; children: OcctNode[] };
  type OcctResult = { success: boolean; root: OcctNode; meshes: OcctMesh[] };
  type Occt = { ReadStepFile(content: Uint8Array, params: object | null): OcctResult };
  export default function occtimportjs(overrides?: { locateFile?: (path: string) => string }): Promise<Occt>;
}
