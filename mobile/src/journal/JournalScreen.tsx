import { useMemo, useState } from 'react';
import { useLanguage } from '@fathom/shell/i18n';
import { fill } from '@fathom/shell/strings';
import { formatDecimal } from '@fathom/shell/format';
import { useAppStrings } from '../strings';
import { clock, wholeMetres } from '../screens/resultsFormat';
import { CATALOGUE } from './catalogue';
import type { CreatureId } from './catalogue';
import { CreatureIcon } from './CreatureIcon';
import { useCreatureWords } from './creatureStrings';
import { loadJournal } from './journalStore';
import type { Journal } from './journalStore';
import { ZONE_CSS } from './zoneColours';
import './journal.css';

type Tab = 0 | 1 | 2 | 'log';

/**
 * The field journal: a page per zone with what you have found glowing and the
 * rest as dim outlines, and a logbook of past dives. No totals, no ranks — the
 * journal shows what you have seen, not a score.
 */
export function JournalScreen({ onBack }: { onBack: () => void }) {
  const { t, language } = useLanguage();
  const a = useAppStrings();
  const words = useCreatureWords();
  const journal: Journal = useMemo(() => loadJournal(), []);
  const [tab, setTab] = useState<Tab>(0);
  const [open, setOpen] = useState<CreatureId | null>(null);

  const dateFormat = new Intl.DateTimeFormat(language === 'fr' ? 'fr-CA' : 'en-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const date = (iso: string) => dateFormat.format(new Date(iso));

  const tabs: { key: Tab; label: string }[] = [
    { key: 0, label: a.zones[0] },
    { key: 1, label: a.zones[1] },
    { key: 2, label: a.zones[2] },
    { key: 'log', label: a.logbook },
  ];

  const opened = open ? CATALOGUE.find((e) => e.id === open)! : null;
  const openedRecord = open ? journal.found[open] : undefined;

  return (
    <div className="journal fade-in">
      <header className="journal__head">
        <button type="button" className="game-btn icon-btn" aria-label={a.back} onClick={onBack}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="journal__title">{a.fieldJournal}</h1>
      </header>

      <nav className="journal__tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={String(item.key)}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className="journal__tab"
            style={typeof item.key === 'number' ? { ['--zc' as string]: ZONE_CSS[item.key] } : undefined}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="journal__page">
        {tab === 'log' ? (
          journal.log.length === 0 ? (
            <p className="journal__empty">{a.logEmpty}</p>
          ) : (
            <ul className="logbook">
              {journal.log.map((entry, i) => (
                <li key={`${entry.date}-${i}`} className="logbook__row">
                  <div className="logbook__when">
                    <span>{date(entry.date)}</span>
                    <span className="logbook__plan">
                      {entry.plan === 'full' ? a.dive : a.quick} · {clock(entry.durationMs)}
                      {entry.ending === 'stopped' ? ` · ${a.logLeftEarly}` : ''}
                    </span>
                  </div>
                  <div className="logbook__numbers">
                    <span className="logbook__depth">{wholeMetres(entry.depth)} m</span>
                    {entry.calibrated && entry.ending !== 'signal-lost' && (
                      <span className="logbook__rates">
                        {formatDecimal(entry.baselineRR, language, t)} → {formatDecimal(entry.finalRR, language, t)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          <ul className="journal__grid" style={{ ['--zc' as string]: ZONE_CSS[tab] }}>
            {CATALOGUE.filter((e) => e.zone === tab).map((entry) => {
              const found = Boolean(journal.found[entry.id]);
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="journal__entry"
                    disabled={!found}
                    aria-label={found ? words[entry.id].name : a.notFoundYet}
                    onClick={() => setOpen(entry.id)}
                  >
                    <CreatureIcon id={entry.id} found={found} colour={ZONE_CSS[tab]} size={84} />
                    <span className="journal__name">{found ? words[entry.id].name : '???'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {opened && openedRecord && (
        <div className="safe journal__detail fade-in" onClick={() => setOpen(null)}>
          <div
            className="sheet"
            role="dialog"
            aria-labelledby="creature-title"
            style={{ ['--zc' as string]: ZONE_CSS[opened.zone] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="journal__detail-art">
              <CreatureIcon id={opened.id} found colour={ZONE_CSS[opened.zone]} size={180} />
            </div>
            <h1 id="creature-title">{words[opened.id].name}</h1>
            <p className="journal__zone-line">{a.zones[opened.zone]}</p>
            <p>{words[opened.id].fact}</p>
            <p className="journal__first">
              {fill(a.firstFound, { depth: openedRecord.depth, date: date(openedRecord.date) })}
            </p>
            <div className="sheet__actions">
              <button type="button" className="game-btn" onClick={() => setOpen(null)}>
                {a.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
