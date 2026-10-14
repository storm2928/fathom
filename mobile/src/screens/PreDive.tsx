import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '@fathom/shell/i18n';
import { FathomSound } from '../native/fathomSound';
import type { DivePlan } from '../app/flow';
import { useAppStrings } from '../strings';

/** The last stop before the water. Begin is the tap that may open the microphone. */
export function PreDive({
  plan,
  mic,
  busy,
  error,
  onBegin,
  onBack,
}: {
  plan: DivePlan;
  /** this dive will listen with the microphone */
  mic: boolean;
  busy: boolean;
  error: string | null;
  onBegin: () => void;
  onBack: () => void;
}) {
  const { t } = useLanguage();
  const a = useAppStrings();
  const [otherAudio, setOtherAudio] = useState(false);

  // Music from another app reaches the breath microphone like room noise.
  useEffect(() => {
    if (!mic || !Capacitor.isNativePlatform()) return;
    let live = true;
    void FathomSound.getRoute()
      .then((route) => {
        if (live) setOtherAudio(Boolean(route.otherAudio) && !route.headphones);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [mic]);

  return (
    <div className="safe fade-in">
      <div className="sheet">
        <h1>{plan === 'full' ? a.dive : a.quick}</h1>
        <p>{a.headphones}</p>
        <p>{t.dive.prompt.calibratingCaption}</p>
        {otherAudio && <p style={{ color: 'var(--caution)' }}>{a.otherAudio}</p>}
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
