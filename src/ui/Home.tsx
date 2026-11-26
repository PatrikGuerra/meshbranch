import { useState, type FormEvent } from 'react';
import { parseRepoInput, type RepoTarget } from '../app/route';
import { Icon } from './icons';

// Public repositories with STEP, STL or OBJ files, used as one-click examples.
const EXAMPLES = ['kovacsv/Online3DViewer', 'prusa3d/Original-Prusa-i3'];

export function Home({ onOpen, onToggleTheme }: { onOpen: (r: RepoTarget) => void; onToggleTheme: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const open = (input: string) => {
    const r = parseRepoInput(input);
    if (r) onOpen(r); else setError('Enter a repository as owner/repo, or paste a GitHub link to a repo, branch, folder or file.');
  };
  const submit = (e: FormEvent) => { e.preventDefault(); open(value); };

  return (
    <div className="home">
      <div className="home-top">
        <div className="brand plain"><Icon name="logo" />MeshBranch</div>
        <button className="icon-btn" onClick={onToggleTheme} title="Toggle theme" aria-label="Toggle theme"><Icon name="moon" /></button>
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
          {EXAMPLES.map(r => <button key={r} className="ex" onClick={() => open(r)}>{r}</button>)}
        </div>
        <div className="features">
          <div className="feature"><Icon name="parts" /><h3>CAD and print files</h3><p>STEP assemblies, STL prints and OBJ meshes, with edges, wireframe and standard views.</p></div>
          <div className="feature"><Icon name="branch" /><h3>Any branch or commit</h3><p>Every view has a link that points to the exact commit and file. Share it in a PR or an issue.</p></div>
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
