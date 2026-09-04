import type { HTMLAttributes, LiHTMLAttributes, ReactNode } from 'react';

export interface TimelineProps extends HTMLAttributes<HTMLOListElement> {
  children?: ReactNode;
}

/** An ordered list drawn as a vertical hairline with one accent node per step. */
export function Timeline({ className, children, ...rest }: TimelineProps) {
  return (
    <ol {...rest} className={className ? `timeline ${className}` : 'timeline'}>
      {children}
    </ol>
  );
}

export interface TimelineStepProps extends Omit<LiHTMLAttributes<HTMLLIElement>, 'title'> {
  /** Mono numeral, e.g. "01". Decorative; the list order carries the meaning. */
  num: ReactNode;
  title: ReactNode;
  /** Id for the title so the step can be `aria-labelledby` it. */
  titleId?: string;
  /** Heading level for the title (default h2). */
  headingLevel?: 2 | 3;
  children?: ReactNode;
}

export function TimelineStep({
  num,
  title,
  titleId,
  headingLevel = 2,
  className,
  children,
  ...rest
}: TimelineStepProps) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const labelled = titleId ? { 'aria-labelledby': titleId } : {};
  return (
    <li {...labelled} {...rest} className={className ? `timeline__step ${className}` : 'timeline__step'}>
      <span className="timeline__node" aria-hidden="true" />
      <div className="timeline__body">
        <div className="timeline__head">
          <span className="timeline__num" aria-hidden="true">
            {num}
          </span>
          <Heading className="timeline__title" id={titleId}>
            {title}
          </Heading>
        </div>
        {children}
      </div>
    </li>
  );
}
