import { useEffect, useState, type FormEvent } from 'react';
import { parseRepoInput, type RepoTarget } from '../app/route';
import { Icon } from './icons';

// One-click examples: links straight to a STEP assembly and to a repo with many branches.
const EXAMPLES = [
  { label: 'STEP assembly', repo: 'kovacsv/Online3DViewer', link: 'https://github.com/kovacsv/Online3DViewer/blob/master/website/assets/models/as1_pe_203.stp' },
  { label: '9 branches', repo: 'prusa3d/Original-Prusa-i3', link: 'https://github.com/prusa3d/Original-Prusa-i3/tree/MK3S/Printed-Parts/STEP' },
];

export function Home({ onOpen, dark, onToggleTheme }: { onOpen: (r: RepoTarget) => void; dark: boolean; onToggleTheme: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { document.title = 'MeshBranch · 3D viewer for GitHub repositories'; }, []);
  const open = (input: string) => {
    const r = parseRepoInput(input);
    if (r) onOpen(r); else setError('Enter a repository as owner/repo, or paste a GitHub link to a repo, branch, folder or file.');
  };
  const submit = (e: FormEvent) => { e.preventDefault(); open(value); };

  return (
    <div className="home">
      <div className="home-top">
        <div className="brand plain"><Icon name="logo" />MeshBranch</div>
        <button className="icon-btn" onClick={onToggleTheme} title={dark ? 'Light theme' : 'Dark theme'} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}><Icon name={dark ? 'sun' : 'moon'} /></button>
      </div>
      <main className="home-main">
        <h1>Browse the 3D models in any GitHub repository</h1>
        <p className="lead">Open STEP, STL and OBJ files in your browser, straight from a public repository. Nothing to install, no sign-in.</p>
        <form className="home-form" onSubmit={submit} autoComplete="off">
          <input autoFocus value={value} onChange={e => { setValue(e.target.value); setError(''); }} placeholder="owner/repo, or a GitHub link to a repo, branch, folder or file" aria-label="Repository" spellCheck={false} />
          <button className="btn primary" type="submit">Open</button>
        </form>
        <div className="home-err" role="alert">{error}</div>
        <div className="examples">
          <span>Try:</span>
          {EXAMPLES.map(x => <button key={x.repo} className="ex" onClick={() => open(x.link)} title={x.link}><span className="ex-tag">{x.label}</span>{x.repo}</button>)}
        </div>
        <div className="features">
          <div className="feature"><Icon name="parts" /><h3>Parts you can toggle</h3><p>See the assembly tree of a STEP file. Hide, isolate, recolor or make any part see-through.</p></div>
          <div className="feature"><Icon name="branch" /><h3>Branch aware</h3><p>Switch branches and get told when one has newer 3D files than yours. Every view has its own link.</p></div>
          <div className="feature"><Icon name="lock" /><h3>No sign-in, no upload</h3><p>Runs in your browser. Files come straight from GitHub and never leave your machine.</p></div>
        </div>
      </main>
      <footer className="home-foot">
        <span>Free and open source · <a href="https://github.com/PatrikGuerra/meshbranch" target="_blank" rel="noopener">MIT</a></span>
        <span>Public repositories · 60 GitHub API requests per hour</span>
      </footer>
    </div>
  );
}
