import type { DetailsHTMLAttributes, ReactNode } from 'react';
import { useLanguage } from '../i18n';
import { IconChevron } from './icons';

export interface ExpandableProps extends DetailsHTMLAttributes<HTMLDetailsElement> {
  /** Summary label while closed (default: `common.more`). */
  more?: ReactNode;
  /** Summary label while open (default: `common.less`). */
  less?: ReactNode;
}

/**
 * Native disclosure. Used only for the "why" beneath a required statement,
 * never for the statement itself.
 */
export function Expandable({ more, less, className, children, ...rest }: ExpandableProps) {
  const { t } = useLanguage();
  return (
    <details {...rest} className={className ? `expandable ${className}` : 'expandable'}>
      <summary className="expandable__summary">
        <IconChevron size={16} className="expandable__chevron" />
        <span className="expandable__more">{more ?? t.common.more}</span>
        <span className="expandable__less">{less ?? t.common.less}</span>
      </summary>
      <div className="expandable__body prose">{children}</div>
    </details>
  );
}
