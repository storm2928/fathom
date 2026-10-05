import type { HTMLAttributes, ReactNode } from 'react';

export type OverlineTag = 'h2' | 'h3' | 'p' | 'span' | 'dt';

export interface OverlineProps extends HTMLAttributes<HTMLElement> {
  /** Element to render; headings keep their semantics, the style is the same. */
  as?: OverlineTag;
  children?: ReactNode;
}

/**
 * A small tracked uppercase label above a block of content. It is how sections
 * announce themselves on the content pages: type and a hairline, not a box.
 */
export function Overline({ as = 'span', className, children, ...rest }: OverlineProps) {
  const Tag = as;
  return (
    <Tag {...rest} className={className ? `overline ${className}` : 'overline'}>
      {children}
    </Tag>
  );
}
