import type { AnchorHTMLAttributes, ButtonHTMLAttributes, KeyboardEvent, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon, 18px. */
  icon?: ReactNode;
  /** Icon without a visible label — requires `aria-label`. */
  iconOnly?: boolean;
  /** Renders an `<a>` that looks like a button (route links). */
  href?: string;
  /**
   * HUD placement. Adds `.btn--hud` and guards the Space key so that holding
   * the spacebar to exhale can never activate the button; Enter still does.
   */
  hud?: boolean;
}

function guardSpace(event: KeyboardEvent<HTMLElement>) {
  if (event.key === ' ') event.preventDefault();
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconOnly = false,
  href,
  hud = false,
  className,
  children,
  disabled,
  onKeyDown,
  onKeyUp,
  ...rest
}: ButtonProps) {
  const isHud = hud || (className?.includes('btn--hud') ?? false);
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    iconOnly ? 'btn--icon' : '',
    isHud && !className?.includes('btn--hud') ? 'btn--hud' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {icon && <span className="btn__icon">{icon}</span>}
      {children !== undefined && (
        <span className={iconOnly ? 'visually-hidden' : 'btn__label'}>{children}</span>
      )}
    </>
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isHud) guardSpace(event);
    onKeyDown?.(event);
  };
  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isHud) guardSpace(event);
    onKeyUp?.(event);
  };

  if (href !== undefined) {
    const anchorProps = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>;
    if (disabled) {
      return (
        <a {...anchorProps} className={`${classes} btn--disabled`} aria-disabled="true" role="link">
          {content}
        </a>
      );
    }
    return (
      <a {...anchorProps} className={classes} href={href}>
        {content}
      </a>
    );
  }

  return (
    <button
      {...rest}
      type="button"
      className={classes}
      disabled={disabled}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      {content}
    </button>
  );
}
