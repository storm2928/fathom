import { useLanguage } from '../i18n';
import { fill } from '../strings';

export interface DepthScaleProps {
  /** How many metre labels to draw (one per major tick). */
  labels?: number;
  className?: string;
}

/** Pixels between minor ticks; a major tick and a label every sixth. */
const MINOR_PX = 16;
const MAJOR_PX = MINOR_PX * 6;
/** The ruler starts a little below the top of its box so the first tick is not clipped. */
const ORIGIN_PX = 6;
/** Metres per major tick. */
const METRES_PER_MAJOR = 5;

/**
 * The ocean motif on the content pages: a slim ruler in the outer margin,
 * hairline ticks and a few low-contrast metre labels. Decorative only, drawn
 * in CSS, hidden from assistive technology and from any viewport narrower
 * than the gutter it sits in.
 */
export function DepthScale({ labels = 12, className }: DepthScaleProps) {
  const { t } = useLanguage();
  const count = Math.max(0, Math.floor(labels));
  return (
    <div className={className ? `depth-scale ${className}` : 'depth-scale'} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="depth-scale__label"
          style={{ top: `${ORIGIN_PX + i * MAJOR_PX}px` }}
        >
          {fill(t.common.metres, { n: i * METRES_PER_MAJOR })}
        </span>
      ))}
    </div>
  );
}
