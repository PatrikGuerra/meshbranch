import { useCallback, useEffect, useState } from 'react';
import { buildHash, parseHash, type Route } from './route';

export function useHashRoute(): [Route, (route: Route, isFile?: boolean) => void] {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((next: Route, isFile = false) => { location.hash = buildHash(next, isFile); }, []);
  return [route, navigate];
}
