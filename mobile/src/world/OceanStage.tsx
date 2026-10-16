import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DiveScene, createDiveRenderer } from '@fathom/game/scene/diveScene';

/**
 * The ocean is always there. One renderer and one DiveScene for the life of
 * the app; every screen is drawn over it. Building the renderer once is also
 * what keeps a second dive from losing its WebGL context.
 *
 * The canvas is created by the effect, not rendered by React: each build gets
 * a canvas of its own. Two Pixi applications initialising on one canvas at the
 * same time freeze the page — which is exactly what StrictMode's mount, unmount,
 * remount does in development.
 */

const OceanContext = createContext<DiveScene | null>(null);

export function useOcean(): DiveScene | null {
  return useContext(OceanContext);
}

export function OceanStage({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [scene, setScene] = useState<DiveScene | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    host.appendChild(canvas);

    let disposed = false;
    let built: DiveScene | null = null;
    void createDiveRenderer(canvas).then((renderer) => {
      setFailed(false);
      // A build that finishes after its effect was cleaned up is thrown away.
      if (disposed) {
        renderer.destroy();
        return;
      }
      // The app's dives begin aboard the boat (the website's begin in the water).
      built = new DiveScene(renderer, canvas, { boat: true });
      built.start();
      setScene(built);
    }).catch(() => {
      // Neither WebGL nor a 2D canvas would start: say so rather than leave a
      // dark screen whose Begin button never wakes.
      if (!disposed) setFailed(true);
    });
    return () => {
      disposed = true;
      built?.destroy();
      canvas.remove();
      setScene(null);
    };
  }, []);

  return (
    <OceanContext.Provider value={scene}>
      <div ref={hostRef} style={{ position: 'fixed', inset: 0, touchAction: 'none' }} />
      {failed && (
        <p className="ocean-failed" role="alert">
          The ocean could not be drawn on this device. Close Fathom and open it again.
        </p>
      )}
      {children}
    </OceanContext.Provider>
  );
}
