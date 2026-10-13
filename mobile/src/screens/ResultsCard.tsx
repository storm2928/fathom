import { Rich, useLanguage } from '@fathom/shell/i18n';
import { CrisisRail } from '@fathom/shell/CrisisRail';
import { fill } from '@fathom/shell/strings';
import { formatDecimal, formatDuration } from '@fathom/shell/format';
import type { SessionResult } from '@fathom/game/session/sessionMachine';
import { verdictFor } from '@fathom/game/surface/verdict';
import { useAppStrings } from '../strings';

/**
 * What the dive measured, then the door. Same claims, same wording as the
 * website's surface screen; one exit, back to the title.
 */
export function ResultsCard({
  result,
  inputLabel,
  onDone,
}: {
  result: SessionResult;
  /** What actually drove the dive, as people read it: microphone, touch and hold. */
  inputLabel: string;
  onDone: () => void;
}) {
  const { t, language } = useLanguage();
  const a = useAppStrings();
  const s = t.surface;

  if (result.ending === 'signal-lost') {
    return (
      <div className="safe fade-in">
        <div className="sheet">
          <h1>{s.lostTitle}</h1>
          <p>{s.lostBody}</p>
          <p>{s.lostFix}</p>
          <CrisisRail />
          <div className="sheet__actions">
            <button type="button" className="game-btn game-btn--primary" onClick={onDone}>
              {a.done}
            </button>
          </div>
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
        <div className="sheet__actions">
          <button type="button" className="game-btn game-btn--primary" onClick={onDone}>
            {a.done}
          </button>
        </div>
      </div>
    </div>
  );
}
