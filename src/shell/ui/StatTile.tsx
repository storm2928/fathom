import type { HTMLAttributes, ReactNode } from 'react';
import { useLanguage } from '../i18n';

export interface StatTileProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  /** A measured value. `null`/`undefined`/empty shows the dash, never a blank. */
  value?: ReactNode;
  /** Unit or hint, inline after the value. */
  unit?: ReactNode;
}

/** One measured quantity: label, mono value, optional unit. Group tiles in `.stat-grid`. */
export function StatTile({ label, value, unit, className, ...rest }: StatTileProps) {
  const { t } = useLanguage();
  const empty = value === null || value === undefined || value === '';
  return (
    <div {...rest} className={className ? `stat ${className}` : 'stat'}>
      <span className="stat__label t-label">{label}</span>
      <span className="stat__row">
        <span className={empty ? 'stat__value t-num-lg stat__value--empty' : 'stat__value t-num-lg'}>
          {empty ? t.common.dash : value}
        </span>
        {unit && <span className="stat__unit t-small">{unit}</span>}
      </span>
    </div>
  );
}
