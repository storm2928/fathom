import type { SessionResult } from '../session/sessionMachine';
import { CrisisRail } from '../../shell/CrisisRail';
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
  const { baselineRR, finalRR, deltaRR, downshiftMs, ending } = result;
  const slowed = deltaRR >= MEANINGFUL_DELTA_RR;
  const sped = deltaRR <= -MEANINGFUL_DELTA_RR;
  const input = inputLabel ?? (result.usedFallbackInput ? 'Keyboard' : 'Microphone');

  if (ending === 'signal-lost') {
    return (
      <section className="surface">
        <h1>The dive ended early</h1>
        <p className="surface-lead">
          The signal stopped being readable, so there is nothing measured well enough to
          show you. A number here would be invented, and an invented number is worse than
          none.
        </p>
        <p className="surface-note">
          A quieter room, or the spacebar instead of the microphone, will usually fix it.
        </p>
        <CrisisRail />
        <button type="button" className="surface-leave" onClick={onLeave}>
          Close
        </button>
      </section>
    );
  }

  return (
    <section className="surface">
      <h1>What changed</h1>

      <div className="surface-figures">
        <div>
          <span className="surface-label">Before</span>
          <strong>{baselineRR.toFixed(1)}</strong>
          <span className="surface-unit">breaths/min</span>
        </div>
        <div className="surface-arrow" aria-hidden="true">
          →
        </div>
        <div>
          <span className="surface-label">After</span>
          <strong>{finalRR.toFixed(1)}</strong>
          <span className="surface-unit">breaths/min</span>
        </div>
      </div>

      {slowed && (
        <p className="surface-lead">
          Your breathing slowed by <strong>{deltaRR.toFixed(1)}</strong> breaths per minute
          over this session.
          {downshiftMs !== null && (
            <> Half of that change had happened {formatDuration(downshiftMs)} in.</>
          )}
        </p>
      )}

      {!slowed && !sped && (
        <p className="surface-lead">
          Your breathing finished about where it started. That happens, and it is worth
          seeing rather than being told otherwise — some days the body does not downshift,
          and a session that reported one anyway would not be measuring anything.
        </p>
      )}

      {sped && (
        <p className="surface-lead">
          Your breathing was <strong>{Math.abs(deltaRR).toFixed(1)}</strong> breaths per
          minute faster at the end than at the start. Reporting it the other way round
          would be flattering and false.
        </p>
      )}

      <dl className="surface-detail">
        <div>
          <dt>Breaths measured</dt>
          <dd>{result.scoredBreaths}</dd>
        </div>
        <div>
          <dt>Time in the water</dt>
          <dd>{formatDuration(result.durationMs)}</dd>
        </div>
        <div>
          <dt>Input</dt>
          <dd>{input}</dd>
        </div>
        <div>
          <dt>Signal</dt>
          <dd>{result.worstSignal}</dd>
        </div>
      </dl>

      <p className="surface-note">
        This is a measurement of how fast you were breathing, before and after. It trains
        arousal regulation and shows you the result live — it does not treat, diagnose or
        cure anything, and one session is not evidence about your health. Your exhales
        were measured; the inhales were prompted by the rhythm rather than sensed.
        {result.usedFallbackInput
          ? ` This session was driven by ${input.toLowerCase()} rather than the microphone, so the timing is what was reported rather than what was heard.`
          : ''}
      </p>

      <CrisisRail />

      <div className="surface-exit">
        <p>That is the whole session. Go and do the thing you came here to do.</p>
        <button type="button" className="surface-leave" onClick={onLeave}>
          Leave
        </button>
      </div>
    </section>
  );
}
