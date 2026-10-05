import type { HTMLAttributes } from 'react';

export interface RuleProps extends HTMLAttributes<HTMLHRElement> {
  /** `--line-2` instead of `--line-1`. */
  strong?: boolean;
}

/** A hairline. Structure on the content pages comes from these, not from borders around boxes. */
export function Rule({ strong = false, className, ...rest }: RuleProps) {
  const classes = ['rule', strong ? 'rule--strong' : '', className ?? ''].filter(Boolean).join(' ');
  return <hr {...rest} className={classes} />;
}
