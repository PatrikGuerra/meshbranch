import { useEffect } from 'react';
import type { ChangedFile } from '../github/client';
import { formatOf } from '../importers/formats';
import { TypeBadge } from './FileTree';

export function CompareDialog({ owner, repo, current, branch, files, onOpen, onSwitch, onClose }: {
  owner: string; repo: string; current: string; branch: string; files: ChangedFile[];
  onOpen: (path: string) => void; onSwitch: () => void; onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  const enc = (s: string) => s.split('/').map(encodeURIComponent).join('/');
  return (
    <div className="modal" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Compare branches">
        <header>
          <h3><span className="mono">{current}</span> ← <span className="mono">{branch}</span></h3>
          <p>3D files created or changed on <span className="mono">{branch}</span> since it split from <span className="mono">{current}</span>.</p>
        </header>
        <div className="dialog-body">
          <table>
            <thead><tr><th>File</th><th>Change</th><th /></tr></thead>
            <tbody>
              {files.map(f => (
                <tr key={f.path}>
                  <td><span className="file-cell"><TypeBadge format={formatOf(f.path)} name={f.path} /><span className="mono">{f.path}</span></span></td>
                  <td className={f.status === 'added' ? 'st-new' : 'st-mod'}>{f.status === 'added' ? 'new' : f.status}</td>
                  <td><button className="btn small" onClick={() => onOpen(f.path)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer>
          <a className="btn ghost" href={`https://github.com/${owner}/${repo}/compare/${enc(current)}...${enc(branch)}`} target="_blank" rel="noopener">Full diff on GitHub</a>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={onSwitch}>Switch to {branch}</button>
        </footer>
      </div>
    </div>
  );
}
