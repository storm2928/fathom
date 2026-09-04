import type { HTMLAttributes, ReactNode } from 'react';
import { IconCaution, IconInfo } from './icons';

export type NoticeTone = 'info' | 'caution' | 'alert';

export interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: NoticeTone;
  /** 20px icon; defaults by tone. */
  icon?: ReactNode;
  title?: ReactNode;
  /** Trailing control, e.g. a ghost Dismiss button. */
  action?: ReactNode;
}

/** A quiet inline message. Alerts announce themselves; the others do not. */
export function Notice({ tone = 'info', icon, title, action, className, children, ...rest }: NoticeProps) {
  const defaultIcon = tone === 'info' ? <IconInfo size={20} /> : <IconCaution size={20} />;
  return (
    <div
      {...rest}
      className={['notice', `notice--${tone}`, className ?? ''].filter(Boolean).join(' ')}
      role={tone === 'alert' ? 'alert' : rest.role}
    >
      <span className="notice__icon">{icon ?? defaultIcon}</span>
      <div className="notice__body prose">
        {title && <p className="notice__title">{title}</p>}
        {typeof children === 'string' ? <p>{children}</p> : children}
      </div>
      {action && <div className="notice__action">{action}</div>}
    </div>
  );
}
