import type { HTMLAttributes, ReactNode } from 'react';

export type ChipTone = 'muted' | 'accent' | 'zone-1' | 'zone-2' | 'zone-3' | 'hud';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
  /** Zone dot colour; combines with any tone (e.g. `tone="hud" zone={2}`). */
  zone?: 1 | 2 | 3;
  /** Show the leading dot even without a zone. */
  dot?: boolean;
  /** 16px leading icon. */
  icon?: ReactNode;
}

/** A small, never-interactive label. */
export function Chip({ tone = 'muted', zone, dot, icon, className, children, ...rest }: ChipProps) {
  const showDot = dot ?? (zone !== undefined || tone.startsWith('zone-'));
  const classes = ['chip', `chip--${tone}`, zone !== undefined ? `chip--zone-${zone}` : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <span {...rest} className={classes}>
      {showDot && <span className="chip__dot" aria-hidden="true" />}
      {icon && <span className="chip__icon">{icon}</span>}
      <span className="chip__label">{children}</span>
    </span>
  );
}
