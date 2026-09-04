import type { HTMLAttributes, ReactNode } from 'react';
import { useLanguage } from '../i18n';
import { Overline } from './Overline';

export interface KeyValueItem {
  key: ReactNode;
  /** A measured value. `null`/`undefined`/empty shows the dash, never a blank. */
  value?: ReactNode;
  /** Small note under the value. */
  hint?: ReactNode;
  /** Mono tabular figures (default) or plain text for words. */
  mono?: boolean;
}

export interface KeyValueProps extends HTMLAttributes<HTMLDListElement> {
  items: KeyValueItem[];
}

/** A compact key/value readout: overline keys, mono values, hairlines between rows. */
export function KeyValue({ items, className, ...rest }: KeyValueProps) {
  const { t } = useLanguage();
  return (
    <dl {...rest} className={className ? `kv ${className}` : 'kv'}>
      {items.map((item, index) => {
        const empty = item.value === null || item.value === undefined || item.value === '';
        const mono = item.mono ?? true;
        const valClass = [
          'kv__val',
          empty ? 'kv__val--empty' : '',
          !mono && !empty ? 'kv__val--text' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <div className="kv__row" key={index}>
            <Overline as="dt">{item.key}</Overline>
            <dd className={valClass}>
              {empty || mono ? (
                <span className="t-num">{empty ? t.common.dash : item.value}</span>
              ) : (
                item.value
              )}
              {item.hint !== undefined && item.hint !== null && (
                <span className="kv__hint t-small">{item.hint}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
