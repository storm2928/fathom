import { useSyncExternalStore } from 'react';

/**
 * Hand-rolled hash routing. No dependency: four routes and a hash is all the
 * app needs, and the URL then says where you are.
 */
export type Route = 'dive' | 'research' | 'how' | 'safety' | 'harness';

/** The input harness is a development surface; visitors never see it. */
const DEV_TOOLS = import.meta.env.DEV;

export function routeFromHash(hash: string): Route {
  switch (hash) {
    case '':
    case '#':
    case '#/':
      return 'dive';
    case '#/research':
      return 'research';
    case '#/how':
      return 'how';
    case '#/safety':
      return 'safety';
    case '#/harness':
      return DEV_TOOLS ? 'harness' : 'dive';
    default:
      return 'dive';
  }
}

export function hashForRoute(route: Route): string {
  return route === 'dive' ? '#/' : `#/${route}`;
}

export function navigate(route: Route): void {
  location.hash = hashForRoute(route);
}

function readRoute(): Route {
  return routeFromHash(location.hash);
}

/** Unknown hashes normalise to the dive route — outside render, never during it. */
function normaliseHash(): void {
  const hash = location.hash;
  if (hash !== '' && hash !== '#' && hash !== '#/' && routeFromHash(hash) === 'dive') {
    history.replaceState(null, '', '#/');
  }
}

function subscribe(onChange: () => void): () => void {
  const handle = () => {
    normaliseHash();
    onChange();
  };
  normaliseHash();
  window.addEventListener('hashchange', handle);
  return () => window.removeEventListener('hashchange', handle);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, readRoute, readRoute);
}
