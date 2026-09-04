import type { HTMLAttributes, ReactNode } from 'react';

export interface MeterProps extends Omit<HTMLAttributes<HTMLDivElement>, 'aria-label'> {
  /** 0–100. */
  value: number;
  'aria-label': string;
  /** Visually hidden text for screen readers (e.g. "64%"). */
  text?: ReactNode;
}

/** The light meter: a horizontal bar that fills as the dive light charges. */
export function Meter({ value, text, className, ...rest }: MeterProps) {
  const clamped = Math.round(Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)));
  return (
    <div
      {...rest}
      className={className ? `meter ${className}` : 'meter'}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      data-full={clamped >= 90 ? '1' : undefined}
    >
      <div className="meter__track">
        <div className="meter__fill" style={{ width: `${clamped}%` }} />
      </div>
      {text !== undefined && <span className="visually-hidden">{text}</span>}
    </div>
  );
}
