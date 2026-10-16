import type { CSSProperties } from 'react';
import type { InputChoice } from '../app/flow';
import { useAppStrings } from '../strings';
import { useLanguage } from '@fathom/shell/i18n';
import { LANGUAGES } from '@fathom/shell/strings';

/**
 * Volume and breathing mode, from the title or mid-dive. A dive already under
 * way keeps the input it started with; a new mode applies from the next dive.
 */
export function SettingsSheet({
  volume,
  input,
  diving,
  haptics,
  onVolume,
  onInput,
  onHaptics,
  onReread,
  onPrivacy,
  onClose,
}: {
  onReread: () => void;
  onPrivacy: () => void;
  volume: number;
  haptics: boolean;
  onHaptics: (on: boolean) => void;
  input: InputChoice;
  diving: boolean;
  onVolume: (volume: number) => void;
  onInput: (input: InputChoice) => void;
  onClose: () => void;
}) {
  const a = useAppStrings();
  const { language, setLanguage } = useLanguage();
  return (
    <div className="safe settings fade-in" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sheet" role="dialog" aria-labelledby="settings-title">
        <h1 id="settings-title">{a.settings}</h1>

        <label className="settings__row" htmlFor="settings-volume">
          <span>{a.volume}</span>
          <span className="settings__value">{Math.round(volume * 100)}%</span>
        </label>
        <input
          id="settings-volume"
          className="settings__slider"
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(volume * 100)}
          onChange={(e) => onVolume(Number(e.target.value) / 100)}
          style={{ '--fill': `${volume * 100}%` } as CSSProperties}
        />

        <button
          type="button"
          className="settings__toggle"
          role="switch"
          aria-checked={haptics}
          onClick={() => onHaptics(!haptics)}
        >
          <span>
            {a.haptics}
            <span className="settings__hint">{a.hapticsHint}</span>
          </span>
          <span className="settings__switch" aria-hidden="true" />
        </button>

        <p className="settings__row">{a.breathingMode}</p>
        <div className="choice">
          <button
            type="button"
            className="game-btn choice__opt"
            aria-pressed={input === 'mic'}
            onClick={() => onInput('mic')}
          >
            {a.useMic}
            <span className="choice__hint">{a.useMicHint}</span>
          </button>
          <button
            type="button"
            className="game-btn choice__opt"
            aria-pressed={input === 'touch'}
            onClick={() => onInput('touch')}
          >
            {a.useTouch}
            <span className="choice__hint">{a.useTouchHint}</span>
          </button>
        </div>
        {diving && <p className="settings__note">{a.modeNextDive}</p>}

        <p className="settings__row">{a.language}</p>
        <div className="settings__segmented" role="radiogroup" aria-label={a.language}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="radio"
              aria-checked={language === l.code}
              onClick={() => setLanguage(l.code)}
            >
              {l.code === 'en' ? 'English' : 'Français'}
            </button>
          ))}
        </div>

        <button type="button" className="game-btn game-btn--quiet settings__reread" onClick={onReread}>
          {a.reread}
        </button>
        <button type="button" className="game-btn game-btn--quiet settings__reread" onClick={onPrivacy}>
          {a.privacyPolicy}
        </button>

        <div className="sheet__actions">
          <button type="button" className="game-btn game-btn--primary" onClick={onClose}>
            {a.close}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The gear that opens settings. */
export function SettingsButton({ onClick, className }: { onClick: () => void; className?: string }) {
  const a = useAppStrings();
  return (
    <button
      type="button"
      className={`game-btn icon-btn ${className ?? ''}`}
      aria-label={a.settings}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
          d="M10.3 3h3.4l.5 2.4 1.7.7 2-1.4 2.4 2.4-1.4 2 .7 1.7 2.4.5v3.4l-2.4.5-.7 1.7 1.4 2-2.4 2.4-2-1.4-1.7.7-.5 2.4h-3.4l-.5-2.4-1.7-.7-2 1.4-2.4-2.4 1.4-2-.7-1.7L3 13.7v-3.4l2.4-.5.7-1.7-1.4-2 2.4-2.4 2 1.4 1.7-.7z"
        />
        <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    </button>
  );
}
