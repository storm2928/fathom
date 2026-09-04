import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  as?: 'section' | 'article' | 'div' | 'li';
  /** 24px icon shown in the header row. */
  icon?: ReactNode;
  /** Header title; rendered as `h2.card__title` (or `h3` via `headingLevel`). */
  title?: ReactNode;
  headingLevel?: 2 | 3;
  /** Id for the title so the card can be `aria-labelledby` it. */
  titleId?: string;
  /** Colour of the header icon. */
  tone?: 'accent' | 'caution' | 'alert';
  /** Nested tile: `--bg-2`, no shadow. */
  soft?: boolean;
  /** Accent border — only for the "nothing leaves your device" banner. */
  accent?: boolean;
  /** Skip the `.prose` wrapper when the body lays itself out. */
  plain?: boolean;
}

export function Card({
  as = 'section',
  icon,
  title,
  headingLevel = 2,
  titleId,
  tone = 'accent',
  soft = false,
  accent = false,
  plain = false,
  className,
  children,
  ...rest
}: CardProps) {
  const Tag = as;
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const classes = ['card', soft ? 'card--soft' : '', accent ? 'card--accent' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const labelled = titleId && title ? { 'aria-labelledby': titleId } : {};

  return (
    <Tag {...labelled} {...rest} className={classes}>
      {(icon || title) && (
        <div className="card__head">
          {icon && <span className={`card__icon card__icon--${tone}`}>{icon}</span>}
          {title && (
            <Heading className="card__title" id={titleId}>
              {title}
            </Heading>
          )}
        </div>
      )}
      <div className={plain ? 'card__body' : 'card__body prose'}>{children}</div>
    </Tag>
  );
}
