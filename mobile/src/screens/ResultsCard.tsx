import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Rich, useLanguage } from '@fathom/shell/i18n';
import { CrisisRail } from '@fathom/shell/CrisisRail';
import { fill } from '@fathom/shell/strings';
import { formatDecimal } from '@fathom/shell/format';
import type { SessionResult } from '@fathom/game/session/sessionMachine';
import type { InputCode } from '@fathom/game/surface/diveLog';
import type { Strings } from '@fathom/shell/strings';
import { verdictFor } from '@fathom/game/surface/verdict';
import type { DiveStats } from '../dive/diveController';
import { useAppStrings } from '../strings';
import { clock, exhaleSeconds, wholeMetres } from './resultsFormat';
import { useCountUp } from './useCountUp';
import { shareDiveLog } from '../native/shareDiveLog';
import { CrisisLine } from './CrisisLine';
import { CreatureIcon } from '../journal/CreatureIcon';
import { entryFor } from '../journal/catalogue';
import type { CreatureId } from '../journal/catalogue';
import { useCreatureWords } from '../journal/creatureStrings';
import { ZONE_CSS } from '../journal/zoneColours';
import { DEVICE } from '../app/device';
import '../journal/journal.css';
import './results.css';

/** What actually drove the dive, in the words the results card uses. */
const INPUT_LABEL: Record<InputCode, (t: Strings) => string> = {
  microphone: (t) => t.setup.inputMicrophone,
  keyboard: (t) => t.setup.inputKeyboard,
  touch: (t) => t.setup.inputTouch,
  scripted: (t) => t.setup.inputScripted,
};

/**
 * What the dive measured, then the door. Same claims, same wording as the
 * website's surface screen; one exit, back to the title.
 */
export function ResultsCard({
  result,
  input,
  stats,
  newlyFound,
  plan,
  onDone,
}: {
  result: SessionResult;
  /** 'full' or 'quick', for the exported log */
  plan: string;
  /** What actually drove the dive — not what was chosen. */
  input: InputCode;
  stats: DiveStats;
  /** ids found for the first time on this dive */
  newlyFound: string[];
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const a = useAppStrings();
  const s = t.surface;
  // The hold input is a touch on a phone, Space or the mouse on a desk.
  const inputLabel = input === 'touch' && DEVICE === 'desktop' ? a.useTouch : INPUT_LABEL[input](t);

  const done = (
    <div className="sheet__actions">
      <button type="button" className="game-btn game-btn--primary" onClick={onDone}>
        {a.done}
      </button>
    </div>
  );

  // Left before the baseline was read: there is no "before", so no figures and
  // no verdict — an invented comparison is worse than none.
  if (!result.calibrated && result.ending === 'stopped') {
    return (
      <div className="safe fade-in">
        <div className="sheet">
          <h1>{a.leftEarly}</h1>
          <p>{a.leftBeforeBaseline}</p>
          <p style={{ color: 'var(--hud-text)' }}>{s.exit}</p>
          <CrisisRail />
          {done}
        </div>
      </div>
    );
  }

  if (result.ending === 'signal-lost') {
    return (
      <div className="safe fade-in">
        <div className="sheet">
          <h1>{s.lostTitle}</h1>
          <p>{s.lostBody}</p>
          {/* The website's fix names the spacebar; a phone has none. */}
          <p>{input === 'touch' ? a.lostFixTouch : a.lostFixMic}</p>
          <CrisisRail />
          {done}
        </div>
      </div>
    );
  }

  return (
    <StatShowcase
      result={result}
      stats={stats}
      newlyFound={newlyFound}
      inputLabel={inputLabel}
      onShare={() => void shareDiveLog(result, plan, input).catch(() => {})}
      onDone={onDone}
    />
  );
}

/** Zone colours: the screen takes the hue of the deepest water you reached. */
const ZONE_COLOUR = ['var(--zone-1)', 'var(--zone-2)', 'var(--zone-3)'];

/**
 * The end of a dive as a stat screen: how deep, how your breathing changed,
 * and four numbers from the dive. The full measurement wording sits one tap
 * away behind the info button; a one-line caveat and the crisis numbers never
 * leave the screen.
 */
function StatShowcase({
  result,
  stats,
  newlyFound,
  inputLabel,
  onShare,
  onDone,
}: {
  result: SessionResult;
  stats: DiveStats;
  newlyFound: string[];
  inputLabel: string;
  onShare: () => void;
  onDone: () => void;
}) {
  const words = useCreatureWords();
  const { t, language } = useLanguage();
  const a = useAppStrings();
  const s = t.surface;
  const [aboutOpen, setAboutOpen] = useState(false);

  const metres = wholeMetres(stats.depth);
  const shownMetres = Math.round(useCountUp(metres, 1400, 200));
  const verdict = verdictFor(result.deltaRR);
  const delta = formatDecimal(Math.abs(result.deltaRR), language, t);
  const chip =
    verdict === 'slowed'
      ? fill(s.deltaSlower, { delta, unit: s.unit })
      : verdict === 'sped'
        ? fill(s.deltaFaster, { delta, unit: s.unit })
        : s.deltaNone;
  const sentence =
    verdict === 'slowed'
      ? fill(s.slowed, { delta })
      : verdict === 'sped'
        ? fill(s.sped, { delta })
        : s.unchanged;

  const tiles = [
    { value: clock(result.durationMs), label: a.inWater },
    { value: String(result.scoredBreaths), label: a.breaths },
    { value: exhaleSeconds(stats.longestExhaleMs, language), label: a.longestExhale },
    { value: clock(result.downshiftMs), label: s.downshift, hint: s.downshiftHint },
  ];

  return (
    <div
      className="stats"
      style={{ '--zc': ZONE_COLOUR[Math.min(2, stats.zone)] } as CSSProperties}
      role="dialog"
      aria-labelledby="stats-title"
    >
      <div className="stats__scroll">
        <h1 id="stats-title" className="stats__title">
          {result.ending === 'stopped' ? a.leftEarly : a.diveComplete}
        </h1>

        <section className="stats__hero" aria-label={t.dive.depth}>
          <svg className="stats__line" viewBox="0 0 12 160" aria-hidden="true">
            <line x1="6" y1="4" x2="6" y2="156" className="stats__line-track" />
            <line x1="6" y1="4" x2="6" y2="156" className="stats__line-fill" />
            <circle cx="6" cy="156" r="5" className="stats__line-dot" />
          </svg>
          <div>
            <div className="stats__depth">
              <span className="stats__depth-num">{shownMetres}</span>
              <span className="stats__depth-unit">{a.metresUnit}</span>
            </div>
            <div className="stats__zone">{fill(a.deepestZone, { zone: a.zones[stats.zone] })}</div>
          </div>
        </section>

        <section className="stats__breathing" aria-label={a.breathing}>
          <div className="stats__label-row">
            <h2 className="stats__label">{a.breathing}</h2>
            <span className="stats__unit">{s.unit}</span>
          </div>
          <div className="stats__rates">
            <div className="stats__rate stats__rate--before">
              <span className="stats__rate-num">{formatDecimal(result.baselineRR, language, t)}</span>
              <span className="stats__rate-label">{s.before}</span>
            </div>
            <svg className="stats__arrow" viewBox="0 0 64 12" aria-hidden="true">
              <line x1="0" y1="6" x2="56" y2="6" />
              <path d="M54 1 L62 6 L54 11" />
            </svg>
            <div className="stats__rate">
              <span className="stats__rate-num">{formatDecimal(result.finalRR, language, t)}</span>
              <span className="stats__rate-label">{s.after}</span>
            </div>
          </div>
          <div className={`stats__chip stats__chip--${verdict}`}>{chip}</div>
        </section>

        <ul className="stats__tiles">
          {tiles.map((tile) => (
            <li key={tile.label} className="stats__tile">
              <span className="stats__tile-value">{tile.value}</span>
              <span className="stats__tile-label">{tile.label}</span>
              {tile.hint && <span className="stats__tile-hint">{tile.hint}</span>}
            </li>
          ))}
        </ul>

        {stats.found.length > 0 && (
          <section className="found-row" aria-label={a.foundThisDive}>
            <span className="found-row__label">{a.foundThisDive}</span>
            <ul className="found-row__list">
              {stats.found.map((id) => {
                const zone = entryFor(id as CreatureId).zone;
                return (
                  <li
                    key={id}
                    className="found-row__item"
                    style={{ ['--zc' as string]: ZONE_CSS[zone] }}
                    aria-label={words[id as CreatureId].name}
                  >
                    <CreatureIcon id={id as CreatureId} found colour={ZONE_CSS[zone]} size={46} />
                    {newlyFound.includes(id) && <span className="found-row__new">{a.newFind}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="stats__caveat">
          <span>{a.caveat}</span>
          <button
            type="button"
            className="stats__info"
            aria-label={a.aboutNumbers}
            onClick={() => setAboutOpen(true)}
          >
            i
          </button>
        </div>

        <CrisisLine />

        <button type="button" className="game-btn game-btn--primary stats__done" onClick={onDone}>
          {a.done}
        </button>
      </div>

      {aboutOpen && (
        <div className="safe stats__about fade-in">
          <div className="sheet" role="dialog" aria-labelledby="about-title">
            <h1 id="about-title">{a.aboutNumbers}</h1>
            {result.ending === 'stopped' && <p>{s.stopped}</p>}
            <p>
              <Rich text={sentence} />
            </p>
            <p>
              {s.note}
              {result.usedFallbackInput
                ? fill(s.noteFallback, { input: inputLabel.toLowerCase() })
                : ''}
            </p>
            <p style={{ color: 'var(--hud-text)' }}>{s.exit}</p>
            <CrisisRail />
            <div className="sheet__actions">
              <button type="button" className="game-btn" onClick={onShare}>
                {s.save}
              </button>
              <button type="button" className="game-btn game-btn--quiet" onClick={() => setAboutOpen(false)}>
                {a.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
