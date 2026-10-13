import { useLanguage } from '@fathom/shell/i18n';
import type { DivePlan } from '../app/flow';
import { useAppStrings } from '../strings';

/** The last stop before the water. Begin is the tap that may open the microphone. */
export function PreDive({
  plan,
  busy,
  error,
  onBegin,
  onBack,
}: {
  plan: DivePlan;
  busy: boolean;
  error: string | null;
  onBegin: () => void;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const a = useAppStrings();
  return (
    <div className="safe fade-in">
      <div className="sheet">
        <h1>{plan === 'full' ? a.dive : a.quick}</h1>
        <p>{a.headphones}</p>
        <p>{t.dive.prompt.calibratingCaption}</p>
        {error && <p style={{ color: 'var(--alert)' }}>{error}</p>}
        <div className="sheet__actions">
          <button type="button" className="game-btn game-btn--primary" disabled={busy} onClick={onBegin}>
            {a.begin}
          </button>
          <button type="button" className="game-btn game-btn--quiet" onClick={onBack}>
            {a.back}
          </button>
        </div>
      </div>
    </div>
  );
}
