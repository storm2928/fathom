import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  selected: string;
  onSelect: (id: string) => void;
  'aria-label': string;
  className?: string;
}

/**
 * ARIA tabs with a roving tabindex. Left/Right/Home/End move the selection
 * and selection follows focus. Panels are the caller's: give each
 * `id="panel-{id}"` and `aria-labelledby="tab-{id}"`.
 */
export function Tabs({ items, selected, onSelect, className, ...rest }: TabsProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, to: number) => {
    const count = items.length;
    const index = ((to % count) + count) % count;
    if (index === from) return;
    onSelect(items[index].id);
    buttons.current[index]?.focus();
  };

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        move(index, index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        move(index, index - 1);
        break;
      case 'Home':
        event.preventDefault();
        move(index, 0);
        break;
      case 'End':
        event.preventDefault();
        move(index, items.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className={className ? `tabs ${className}` : 'tabs'} role="tablist" aria-label={rest['aria-label']}>
      {items.map((item, index) => {
        const isSelected = item.id === selected;
        return (
          <button
            key={item.id}
            ref={(el) => {
              buttons.current[index] = el;
            }}
            type="button"
            className="tab"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={isSelected}
            aria-controls={`panel-${item.id}`}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => handleKey(event, index)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
