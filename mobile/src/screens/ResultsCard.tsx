import { Rich, useLanguage } from '@fathom/shell/i18n';
import { CrisisRail } from '@fathom/shell/CrisisRail';
import { fill } from '@fathom/shell/strings';
import { formatDecimal, formatDuration } from '@fathom/shell/format';
import type { SessionResult } from '@fathom/game/session/sessionMachine';
import type { InputCode } from '@fathom/game/surface/diveLog';
import type { Strings } from '@fathom/shell/strings';
import { verdictFor } from '@fathom/game/surface/verdict';
import { useAppStrings } from '../strings';

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
  onDone,
}: {
  result: SessionResult;
  /** What actually drove the dive — not what was chosen. */
  input: InputCode;
  onDone: () => void;
}) {
  const { t, language } = useLanguage();
  const a = useAppStrings();
  const s = t.surface;
  const inputLabel = INPUT_LABEL[input](t);

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

  const verdict = verdictFor(result.deltaRR);
  const delta = formatDecimal(Math.abs(result.deltaRR), language, t);
  const sentence =
    verdict === 'slowed'
      ? fill(s.slowed, { delta })
      : verdict === 'sped'
        ? fill(s.sped, { delta })
        : s.unchanged;

  return (
    <div className="safe fade-in">
      <div className="sheet" role="dialog" aria-labelledby="results-title">
        <h1 id="results-title">{s.title}</h1>
        {result.ending === 'stopped' && <p>{s.stopped}</p>}
        <div className="results__figures">
          <div className="results__figure">
            <span className="results__over">{s.before}</span>
            <span className="results__num">{formatDecimal(result.baselineRR, language, t)}</span>
            <span className="results__unit">{s.unit}</span>
          </div>
          <div className="results__figure">
            <span className="results__over">{s.after}</span>
            <span className="results__num">{formatDecimal(result.finalRR, language, t)}</span>
            <span className="results__unit">{s.unit}</span>
          </div>
        </div>
        <p>
          <Rich text={sentence} />
        </p>
        <p>
          {s.duration}: {formatDuration(result.durationMs, t)}
        </p>
        <p style={{ fontSize: 13 }}>
          {s.note}
          {result.usedFallbackInput ? fill(s.noteFallback, { input: inputLabel.toLowerCase() }) : ''}
        </p>
        <p style={{ color: 'var(--hud-text)' }}>{s.exit}</p>
        <CrisisRail />
        {done}
      </div>
    </div>
  );
}
