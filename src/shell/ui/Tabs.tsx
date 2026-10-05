import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: ReactNode;
}

export type TabsOrientation = 'horizontal' | 'vertical';

export interface TabsProps {
  items: TabItem[];
  selected: string;
  onSelect: (id: string) => void;
  'aria-label': string;
  /** Vertical lists stack as a column (the research category list at desktop widths). */
  orientation?: TabsOrientation;
  className?: string;
}

/**
 * ARIA tabs with a roving tabindex, drawn as plain text links. Left, Right,
 * Home and End move the selection (Up and Down too when vertical) and
 * selection follows focus. Panels are the caller's: give each
 * `id="panel-{id}"` and `aria-labelledby="tab-{id}"`.
 */
export function Tabs({
  items,
  selected,
  onSelect,
  orientation = 'horizontal',
  className,
  ...rest
}: TabsProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const vertical = orientation === 'vertical';

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
      case 'ArrowDown':
        if (!vertical) break;
        event.preventDefault();
        move(index, index + 1);
        break;
      case 'ArrowUp':
        if (!vertical) break;
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

  const classes = ['tabs', vertical ? 'tabs--vertical' : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      role="tablist"
      aria-label={rest['aria-label']}
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
    >
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
