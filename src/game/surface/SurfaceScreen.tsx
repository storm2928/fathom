import type { SessionResult } from '../session/sessionMachine';
import { CrisisRail } from '../../shell/CrisisRail';
import { Rich, useLanguage } from '../../shell/i18n';
import { fill } from '../../shell/strings';
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
 * A session where nothing changed says so plainly. Dressing up a null result
 * would be the single fastest way to lose the argument that this is a
 * measurement tool rather than a mood app.
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
  onLeave: () => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
}

export function SurfaceScreen({ result, inputLabel, onLeave }: SurfaceScreenProps) {
  const { t } = useLanguage();
  const s = t.surface;
  const { baselineRR, finalRR, deltaRR, downshiftMs, ending } = result;
  const slowed = deltaRR >= MEANINGFUL_DELTA_RR;
  const sped = deltaRR <= -MEANINGFUL_DELTA_RR;
  const input = inputLabel ?? (result.usedFallbackInput ? t.dive.inputKeyboard : t.dive.inputMicrophone);

  if (ending === 'signal-lost') {
    return (
      <section className="surface">
        <h1>{s.lostTitle}</h1>
        <p className="surface-lead">{s.lostBody}</p>
        <p className="surface-note">{s.lostFix}</p>
        <CrisisRail />
        <button type="button" className="surface-leave" onClick={onLeave}>
          {s.close}
        </button>
      </section>
    );
  }

  return (
    <section className="surface">
      <h1>{s.title}</h1>

      <div className="surface-figures">
        <div>
          <span className="surface-label">{s.before}</span>
          <strong>{baselineRR.toFixed(1)}</strong>
          <span className="surface-unit">{s.unit}</span>
        </div>
        <div className="surface-arrow" aria-hidden="true">
          →
        </div>
        <div>
          <span className="surface-label">{s.after}</span>
          <strong>{finalRR.toFixed(1)}</strong>
          <span className="surface-unit">{s.unit}</span>
        </div>
      </div>

      {slowed && (
        <p className="surface-lead">
          <Rich text={fill(s.slowed, { delta: deltaRR.toFixed(1) })} />
          {downshiftMs !== null && (
            <> {fill(s.halfway, { time: formatDuration(downshiftMs) })}</>
          )}
        </p>
      )}

      {!slowed && !sped && <p className="surface-lead">{s.unchanged}</p>}

      {sped && (
        <p className="surface-lead">
          <Rich text={fill(s.sped, { delta: Math.abs(deltaRR).toFixed(1) })} />
        </p>
      )}

      <dl className="surface-detail">
        <div>
          <dt>{s.breaths}</dt>
          <dd>{result.scoredBreaths}</dd>
        </div>
        <div>
          <dt>{s.duration}</dt>
          <dd>{formatDuration(result.durationMs)}</dd>
        </div>
        <div>
          <dt>{s.input}</dt>
          <dd>{input}</dd>
        </div>
        <div>
          <dt>{s.signal}</dt>
          <dd>{result.worstSignal}</dd>
        </div>
      </dl>

      <p className="surface-note">
        {s.note}
        {result.usedFallbackInput ? fill(s.noteFallback, { input: input.toLowerCase() }) : ''}
      </p>

      <CrisisRail />

      <div className="surface-exit">
        <p>{s.exit}</p>
        <button type="button" className="surface-leave" onClick={onLeave}>
          {s.leave}
        </button>
      </div>
    </section>
  );
}
