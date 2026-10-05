import type { FieldsetHTMLAttributes, ReactNode } from 'react';

/**
 * A radio group drawn as one segmented control: the options share a single
 * bordered track and the checked one is filled, with an accent bar along its
 * foot. The native input is visually hidden; the option takes the checked,
 * hover and focus states through `:has()`. No check icon: the fill and the
 * bar are the state.
 */
export interface SegmentedOptionProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  /** 20px icon, only where it carries meaning (the microphone, the keyboard). */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function SegmentedOption({
  name,
  value,
  checked,
  onChange,
  icon,
  title,
  description,
  disabled = false,
  className,
}: SegmentedOptionProps) {
  return (
    <label className={className ? `seg__opt ${className}` : 'seg__opt'}>
      <input
        className="visually-hidden"
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
      />
      {icon && <span className="seg__icon">{icon}</span>}
      <span className="seg__text">
        <span className="seg__title">{title}</span>
        {description && <span className="seg__desc">{description}</span>}
      </span>
      <span className="seg__bar" aria-hidden="true" />
    </label>
  );
}

export interface SegmentedProps extends FieldsetHTMLAttributes<HTMLFieldSetElement> {
  legend: ReactNode;
  size?: 'md' | 'sm';
  /** Optional control under the track (the development speed button). */
  extra?: ReactNode;
}

export function Segmented({ legend, size = 'md', extra, className, children, ...rest }: SegmentedProps) {
  const classes = ['seg', `seg--${size}`, className ?? ''].filter(Boolean).join(' ');
  return (
    <fieldset {...rest} className={classes}>
      <legend className="overline seg__legend">{legend}</legend>
      <div className="seg__track">{children}</div>
      {extra && <div className="seg__extra">{extra}</div>}
    </fieldset>
  );
}
