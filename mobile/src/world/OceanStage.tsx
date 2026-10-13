import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DiveScene, createDiveRenderer } from '@fathom/game/scene/diveScene';

/**
 * The ocean is always there. One canvas, one renderer and one DiveScene for
 * the life of the app; every screen is drawn over it. Building the renderer
 * once is also what keeps a second dive from losing its WebGL context.
 */

const OceanContext = createContext<DiveScene | null>(null);

export function useOcean(): DiveScene | null {
  return useContext(OceanContext);
}

export function OceanStage({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scene, setScene] = useState<DiveScene | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let built: DiveScene | null = null;
    void createDiveRenderer(canvas).then((renderer) => {
      // StrictMode mounts effects twice in development; the first build is
      // thrown away rather than leaked.
      if (disposed) {
        renderer.destroy();
        return;
      }
      built = new DiveScene(renderer, canvas);
      built.start();
      setScene(built);
    });
    return () => {
      disposed = true;
      built?.destroy();
      setScene(null);
    };
  }, []);

  return (
    <OceanContext.Provider value={scene}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />
      {children}
    </OceanContext.Provider>
  );
}
