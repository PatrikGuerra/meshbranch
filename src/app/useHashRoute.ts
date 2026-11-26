import { useCallback, useEffect, useState } from 'react';
import { buildHash, parseHash, type Route } from './route';

// Links in another form (#ref=<GitHub link>, ?ref=&path=) are rewritten to #/owner/repo/... once read.
function readRoute(): Route {
  const route = parseHash(location.hash);
  if (route.kind === 'repo' && !/^#\/[^?]*$/.test(location.hash)) history.replaceState(null, '', buildHash(route));
  return route;
}

export function useHashRoute(): [Route, (route: Route, isFile?: boolean) => void] {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((next: Route, isFile = false) => { location.hash = buildHash(next, isFile); }, []);
  return [route, navigate];
}
