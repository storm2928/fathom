import { useState } from 'react';
import { useLanguage } from '@fathom/shell/i18n';
import { CrisisLine } from './CrisisLine';
import type { InputChoice } from '../app/flow';
import { useAppStrings } from '../strings';

/**
 * The scope, before anything that could ask for a microphone. Plan 5 splits
 * this into the three onboarding cards; the wording here is the website's.
 */
export function SafetyGate({ onAcknowledge }: { onAcknowledge: (input: InputChoice) => void }) {
  const { t } = useLanguage();
  const a = useAppStrings();
  const [input, setInput] = useState<InputChoice>('mic');

  return (
    <div className="safe fade-in">
      <div className="sheet" role="dialog" aria-labelledby="safety-title">
        <h1 id="safety-title">{t.safety.title}</h1>
        <p>{t.safety.lead}</p>
        <p>{a.scopeLine}</p>
        <p>{t.safety.stopAnyTime}</p>

        <p style={{ marginTop: 18, color: 'var(--hud-text)' }}>{a.chooseInput}</p>
        <div className="choice">
          <button
            type="button"
            className="game-btn choice__opt"
            aria-pressed={input === 'mic'}
            onClick={() => setInput('mic')}
          >
            {a.useMic}
            <span className="choice__hint">{a.useMicHint}</span>
          </button>
          <button
            type="button"
            className="game-btn choice__opt"
            aria-pressed={input === 'touch'}
            onClick={() => setInput('touch')}
          >
            {a.useTouch}
            <span className="choice__hint">{a.useTouchHint}</span>
          </button>
        </div>

        <CrisisLine />

        <div className="sheet__actions">
          <button
            type="button"
            className="game-btn game-btn--primary"
            onClick={() => onAcknowledge(input)}
          >
            {t.safety.begin}
          </button>
        </div>
      </div>
    </div>
  );
}
