import { useEffect, useState } from 'react';

/** Routage minimal par l'ancre (#/…) : fonctionne hors ligne et sur GitHub Pages sans configuration. */
export function useRoute(): string[] {
  const read = () => (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path: string) {
  location.hash = '#/' + path.replace(/^\//, '');
}

export const href = (path: string) => '#/' + path.replace(/^\//, '');
