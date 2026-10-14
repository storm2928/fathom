import { useId } from 'react';
import type { CreatureId } from './catalogue';
import { CREATURE_ART } from './creatureArt';

/**
 * A creature in the journal: its silhouette in the zone's colour with its
 * lights glowing, or — not yet found — a dim outline with no lights.
 */
export function CreatureIcon({
  id,
  found,
  colour,
  size = 72,
}: {
  id: CreatureId;
  found: boolean;
  colour: string;
  size?: number;
}) {
  const art = CREATURE_ART[id];
  const glow = useId();
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="creature-icon">
      <defs>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      {art.body.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={found ? colour : 'none'}
          fillOpacity={found ? 0.28 : 0}
          stroke={found ? colour : 'rgba(234, 243, 247, 0.22)'}
          strokeWidth={found ? 1.4 : 1.2}
          strokeDasharray={found ? undefined : '3 3'}
          strokeLinejoin="round"
        />
      ))}
      {found &&
        art.lights.map(([cx, cy, r], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r * 2.4} fill={colour} opacity={0.55} filter={`url(#${glow})`} />
            <circle cx={cx} cy={cy} r={r} fill="#eafffb" />
          </g>
        ))}
    </svg>
  );
}
