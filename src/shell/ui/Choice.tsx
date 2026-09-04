import type { FieldsetHTMLAttributes, ReactNode } from 'react';
import { IconCheck } from './icons';

/**
 * A radio option drawn as a card. The native input is visually hidden and
 * the card takes the checked, hover and focus states through `:has()`.
 */
export interface ChoiceProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Choice({
  name,
  value,
  checked,
  onChange,
  icon,
  title,
  description,
  disabled = false,
  className,
}: ChoiceProps) {
  return (
    <label className={className ? `choice ${className}` : 'choice'}>
      <input
        className="visually-hidden"
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
      />
      <span className="choice__icon">{icon}</span>
      <span className="choice__text">
        <span className="choice__title">{title}</span>
        {description && <span className="choice__desc">{description}</span>}
      </span>
      <span className="choice__check" aria-hidden="true">
        <IconCheck size={16} />
      </span>
    </label>
  );
}

export interface ChoiceGroupProps extends FieldsetHTMLAttributes<HTMLFieldSetElement> {
  legend: ReactNode;
  /** Optional control beside the legend (spans the full row). */
  extra?: ReactNode;
}

export function ChoiceGroup({ legend, extra, className, children, ...rest }: ChoiceGroupProps) {
  return (
    <fieldset {...rest} className={className ? `choice-group ${className}` : 'choice-group'}>
      <legend className="t-label">{legend}</legend>
      {extra && <div className="choice-group__extra">{extra}</div>}
      {children}
    </fieldset>
  );
}
