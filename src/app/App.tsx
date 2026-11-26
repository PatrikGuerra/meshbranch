import { useCallback, useState } from 'react';
import { Home } from '../ui/Home';
import { RepoView } from '../ui/RepoView';
import { useHashRoute } from './useHashRoute';

export function App() {
  const [route, navigate] = useHashRoute();
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  const toggleTheme = useCallback(() => setDark(d => {
    const t = d ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    localStorage.setItem('meshbranch-theme', t);
    return !d;
  }), []);
  const home = useCallback(() => navigate({ kind: 'home' }), [navigate]);

  if (route.kind === 'home') return <Home onOpen={r => navigate({ kind: 'repo', ...r })} onToggleTheme={toggleTheme} />;
  return <RepoView key={`${route.owner}/${route.repo}`} route={route} navigate={navigate} dark={dark} onToggleTheme={toggleTheme} onHome={home} />;
}
