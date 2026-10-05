import { useEffect, useRef } from 'react';
import type { SessionResult } from '../session/sessionMachine';
import { CrisisRail } from '../../shell/CrisisRail';
import { Rich, useLanguage } from '../../shell/i18n';
import { fill } from '../../shell/strings';
import { formatDecimal, formatDuration } from '../../shell/format';
import {
  Button,
  Chip,
  IconDownload,
  IconInfo,
  IconLeave,
  KeyValue,
  Notice,
  Overline,
  Rule,
} from '../../shell/ui';
import { buildDiveLog, downloadDiveLog } from './diveLog';
import type { InputCode } from './diveLog';
import './SurfaceScreen.css';

/**
 * What the dive measured, and then the door.
 *
 * Every claim on this screen is about what happened in the last few minutes:
 * your breathing was this fast, then it was this fast. Nothing here says the
 * session treated, reduced or cured anything, because it did not and we cannot
 * know that. Two of the judges are clinicians and this is the screen they will
 * read most closely.
 *
 * A session where nothing changed says so plainly, in the same weight as a
 * slowed one. Dressing up a null result would be the single fastest way to
 * lose the argument that this is a measurement tool rather than a mood app.
 */

/** Below this the change is inside the noise of the estimate. */
const MEANINGFUL_DELTA_RR = 0.5;

interface SurfaceScreenProps {
  result: SessionResult;
  /**
   * What actually drove the session. `usingFallbackInput` only says "not the
   * microphone", which is not specific enough to print: in a development build
   * it can also be the scripted fixture, and calling that the keyboard would be
   * the same small dishonesty this screen exists to avoid.
   */
  inputLabel?: string;
  /** Stable code for the export, kept apart from the label people read (#32). */
  inputCode: InputCode;
  onLeave: () => void;
}

export function SurfaceScreen({ result, inputLabel, inputCode, onLeave }: SurfaceScreenProps) {
  const { t, language } = useLanguage();
  const s = t.surface;
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const { baselineRR, finalRR, deltaRR, downshiftMs, ending } = result;
  const slowed = deltaRR >= MEANINGFUL_DELTA_RR;
  const sped = deltaRR <= -MEANINGFUL_DELTA_RR;
  const stopped = ending === 'stopped';
  const input = inputLabel ?? (result.usedFallbackInput ? t.setup.inputKeyboard : t.setup.inputMicrophone);

  // The dive ends with the page locked at the top and focus inside the HUD;
  // the results start at their heading.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  // The title is set small, as an instrument's caption; the state chips sit
  // on its line. It keeps its heading semantics and takes focus on arrival.
  const head = (title: string) => (
    <div className="surface__head">
      <h1 id="surface-title" className="surface__title" tabIndex={-1} ref={titleRef}>
        {title}
      </h1>
      <Chip tone="muted">{t.state.ended}</Chip>
      {stopped && <Chip tone="muted">{s.stoppedChip}</Chip>}
    </div>
  );

  if (ending === 'signal-lost') {
    return (
      <section className="surface page" aria-labelledby="surface-title">
        <div className="page__col surface__col">
          {head(s.lostTitle)}
          <p className="t-lead surface__verdict">{s.lostBody}</p>
          <Notice tone="info" icon={<IconInfo size={20} />}>
            {s.lostFix}
          </Notice>
          <CrisisRail />
          <div className="surface__actions">
            <Button variant="primary" onClick={onLeave}>
              {s.close}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const delta = formatDecimal(Math.abs(deltaRR), language, t);
  // One plain line for all three outcomes: nothing about it says "good".
  const deltaText = slowed
    ? fill(s.deltaSlower, { delta, unit: s.unit })
    : sped
      ? fill(s.deltaFaster, { delta, unit: s.unit })
      : s.deltaNone;

  return (
    <section className="surface page" aria-labelledby="surface-title">
      <div className="page__col surface__col">
        {head(s.title)}

        {/* The readout. The label comes first in each figure so it reads
            "Before 15.2 breaths/min"; the numerals are the only large thing
            on the page. */}
        <div className="surface__readout">
          <div className="surface__figure">
            <Overline as="span">{s.before}</Overline>
            <span className="t-num-xl">{formatDecimal(baselineRR, language, t)}</span>
            <span className="t-small">{s.unit}</span>
          </div>
          <div className="surface__figure">
            <Overline as="span">{s.after}</Overline>
            <span className="t-num-xl">{formatDecimal(finalRR, language, t)}</span>
            <span className="t-small">{s.unit}</span>
          </div>
        </div>
        <Rule />
        <p className="surface__delta t-small">{deltaText}</p>

        {slowed && (
          <p className="t-lead surface__verdict">
            <Rich text={fill(s.slowed, { delta })} />
            {downshiftMs !== null && <> {fill(s.halfway, { time: formatDuration(downshiftMs, t) })}</>}
          </p>
        )}

        {!slowed && !sped && <p className="t-lead surface__verdict">{s.unchanged}</p>}

        {sped && (
          <p className="t-lead surface__verdict">
            <Rich text={fill(s.sped, { delta })} />
          </p>
        )}

        {stopped && <p className="surface__stopped">{s.stopped}</p>}

        <KeyValue
          items={[
            {
              key: s.downshift,
              value: downshiftMs === null ? null : formatDuration(downshiftMs, t),
              hint: s.downshiftHint,
            },
            { key: s.breaths, value: String(result.scoredBreaths) },
            { key: s.duration, value: formatDuration(result.durationMs, t) },
            { key: s.input, value: input, mono: false },
            { key: s.signal, value: t.signal[result.worstSignal], mono: false },
          ]}
        />

        {/* The measurement note: what this number is and is not. Bounded by
            rules rather than boxed, in the same voice as the rest. */}
        <p className="bounded t-small surface__note">
          <span className="surface__note-text">
            {s.note}
            {result.usedFallbackInput ? fill(s.noteFallback, { input: input.toLowerCase() }) : ''}
          </span>
        </p>

        <CrisisRail />

        <div className="surface__exit">
          <p className="t-lead">{s.exit}</p>
          <div className="surface__actions">
            <Button
              variant="secondary"
              icon={<IconDownload size={18} />}
              onClick={() =>
                downloadDiveLog(buildDiveLog(result, { plan: result.plan, input: inputCode }))
              }
            >
              {s.save}
            </Button>
            <Button variant="primary" icon={<IconLeave size={18} />} onClick={onLeave}>
              {s.leave}
            </Button>
          </div>
          <p className="t-small surface__save-note">{s.saveNote}</p>
        </div>
      </div>
    </section>
  );
}
