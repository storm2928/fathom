import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export type RingMode = 'sweep' | 'static' | 'segments';

export interface ProgressRingProps {
  /** Outer size in px. */
  size?: number;
  /** Stroke width in px. */
  stroke?: number;
  /** 0–1, static mode. */
  progress?: number;
  /** Sweep length in wall ms, sweep mode. */
  durationMs?: number;
  mode?: RingMode;
  segments?: number;
  activeSegment?: number;
  /** Centred label, at most two lines. */
  label?: ReactNode;
  /** Caption under the ring. */
  caption?: ReactNode;
  /** Changing this restarts the sweep. */
  seq?: number;
  tone?: 'hud' | 'page';
  /** Disc glow (the exhale step). */
  glow?: boolean;
  className?: string;
}

const VIEW = 120;
const R = 54;
const CIRCUMFERENCE = 2 * Math.PI * R; // 339.29
const GAP_DEGREES = 6;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function polar(angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [VIEW / 2 + R * Math.cos(a), VIEW / 2 + R * Math.sin(a)];
}

function arcPath(startDeg: number, endDeg: number): string {
  const [sx, sy] = polar(startDeg);
  const [ex, ey] = polar(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

/**
 * SVG ring for the HUD prompt and the surface screen. Sweep mode animates
 * `stroke-dashoffset` over `durationMs` and restarts when `seq` changes,
 * cross-fading the previous sweep out so nothing flickers. Under reduced
 * motion a sweep becomes segments.
 */
export function ProgressRing({
  size = 120,
  stroke = 6,
  progress = 0,
  durationMs = 0,
  mode = 'sweep',
  segments = 4,
  activeSegment = -1,
  label,
  caption,
  seq = 0,
  tone = 'hud',
  glow = false,
  className,
}: ProgressRingProps) {
  const reduced = usePrefersReducedMotion();
  const effectiveMode: RingMode = mode === 'sweep' && reduced ? 'segments' : mode;

  // Keep the last two seq values so the outgoing sweep can fade while the new
  // one starts at zero. Adjusted during render, so there is no extra frame.
  const [pair, setPair] = useState<{ prev: number | null; cur: number }>({ prev: null, cur: seq });
  if (seq !== pair.cur) setPair({ prev: pair.cur, cur: seq });

  const strokeUnits = stroke * (VIEW / size);
  const style = {
    '--ring-size': `${size}px`,
    '--ring-stroke': `${strokeUnits}`,
    '--ring-ms': `${Math.max(0, durationMs)}ms`,
  } as CSSProperties;
  const classes = ['ring', `ring--${tone}`, `ring--${effectiveMode}`, glow ? 'ring--glow' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  const segmentSpan = 360 / Math.max(1, segments);

  return (
    <>
      <div className={classes} style={style}>
        <svg viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true" focusable="false">
          <circle className="ring__disc" cx={VIEW / 2} cy={VIEW / 2} r={R + 2} />
          {effectiveMode !== 'segments' && (
            <circle className="ring__track" cx={VIEW / 2} cy={VIEW / 2} r={R} />
          )}
          {effectiveMode === 'sweep' &&
            // One array with keys equal to the seq values: the outgoing circle
            // keeps its element (and its running animation) while it fades.
            [
              ...(pair.prev !== null
                ? [
                    <circle
                      key={String(pair.prev)}
                      className="ring__progress ring__progress--sweep ring__progress--fading"
                      cx={VIEW / 2}
                      cy={VIEW / 2}
                      r={R}
                      strokeDasharray={CIRCUMFERENCE}
                    />,
                  ]
                : []),
              <circle
                key={String(pair.cur)}
                className="ring__progress ring__progress--sweep"
                cx={VIEW / 2}
                cy={VIEW / 2}
                r={R}
                strokeDasharray={CIRCUMFERENCE}
              />,
            ]}
          {effectiveMode === 'static' && (
            <circle
              className="ring__progress ring__progress--static"
              cx={VIEW / 2}
              cy={VIEW / 2}
              r={R}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)))}
            />
          )}
          {effectiveMode === 'segments' &&
            Array.from({ length: Math.max(1, segments) }, (_, i) => (
              <path
                key={i}
                className={i === activeSegment ? 'ring__segment ring__segment--active' : 'ring__segment'}
                d={arcPath(i * segmentSpan + GAP_DEGREES / 2, (i + 1) * segmentSpan - GAP_DEGREES / 2)}
              />
            ))}
        </svg>
        {label !== undefined && <div className="ring__label">{label}</div>}
      </div>
      {caption !== undefined && caption !== null && <p className="ring__caption">{caption}</p>}
    </>
  );
}
