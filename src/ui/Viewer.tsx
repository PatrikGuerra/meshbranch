import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SceneView } from '../viewer/scene';

export function Viewer({ dark, onView, children }: { dark: boolean; onView: (v: SceneView | null) => void; children?: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const view = useRef<SceneView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try { view.current = new SceneView(el.current!); } catch { setFailed(true); return; }
    onView(view.current);
    return () => { onView(null); view.current?.dispose(); view.current = null; };
  }, [onView]);
  useEffect(() => { view.current?.setTheme(dark); }, [dark]);

  return (
    <div ref={el} className="viewport">
      {failed ? <div className="overlay"><div className="card"><h2>WebGL is not available</h2><p>This browser or device cannot show 3D. Try another browser, or turn on hardware acceleration.</p></div></div> : children}
      <div className="hint">Drag to orbit · Right-drag to pan · Scroll to zoom · F to fit</div>
    </div>
  );
}
