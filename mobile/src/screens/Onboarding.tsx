import { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Rich, useLanguage } from '@fathom/shell/i18n';
import type { InputChoice } from '../app/flow';
import { FathomMic } from '../native/fathomMic';
import { useAppStrings } from '../strings';
import { CrisisLine } from './CrisisLine';
import './onboarding.css';

/**
 * First run, in three cards: how to breathe, how you will breathe (microphone
 * or touch), and what this is and is not. Every statement the website marks as
 * required-visible (not1, care1–3, voiceShort, measuredShort) is on a card,
 * verbatim. Re-readable from Settings, where the last button says Close.
 */
export function Onboarding({
  initialInput,
  review = false,
  onDone,
}: {
  initialInput: InputChoice;
  /** opened from Settings: nothing is saved, and the last button closes */
  review?: boolean;
  onDone: (input: InputChoice) => void;
}) {
  const { t } = useLanguage();
  const a = useAppStrings();
  const s = t.safety;
  const [input, setInput] = useState<InputChoice>(initialInput);
  const [declined, setDeclined] = useState(false);
  const [card, setCard] = useState(0);
  const track = useRef<HTMLDivElement | null>(null);

  const goTo = (index: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  };

  const chooseMic = async () => {
    setInput('mic');
    setDeclined(false);
    // Ask now, where the choice is made, rather than in the middle of a dive.
    if (!review && Capacitor.isNativePlatform() && FathomMic.requestPermission) {
      const { granted } = await FathomMic.requestPermission().catch(() => ({ granted: false }));
      if (!granted) {
        setInput('touch');
        setDeclined(true);
      }
    }
  };

  return (
    <div className="onboard fade-in">
      <div
        className="onboard__track"
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          setCard(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
      >
        {/* 1. How to breathe */}
        <section className="onboard__card" aria-labelledby="onboard-breathe">
          <div className="onboard__body">
            <div className="orb" aria-hidden="true">
              <div className="orb__ring" />
              <span className="orb__label orb__label--in">{a.orbIn}</span>
              <span className="orb__label orb__label--more">{a.orbMore}</span>
              <span className="orb__label orb__label--out">{a.orbOut}</span>
            </div>
            <h1 id="onboard-breathe">{a.onboardBreatheTitle}</h1>
            <p>{a.onboardBreathe}</p>
            <p className="onboard__small">
              <Rich text={s.measuredShort} />
            </p>
          </div>
          <button type="button" className="game-btn game-btn--primary" onClick={() => goTo(1)}>
            {a.next}
          </button>
        </section>

        {/* 2. Microphone or touch */}
        <section className="onboard__card" aria-labelledby="onboard-input">
          <div className="onboard__body">
            <h1 id="onboard-input">{a.onboardInputTitle}</h1>
            <div className="choice">
              <button
                type="button"
                className="game-btn choice__opt"
                aria-pressed={input === 'mic'}
                onClick={() => void chooseMic()}
              >
                {a.useMic}
                <span className="choice__hint">{a.useMicHint}</span>
              </button>
              <button
                type="button"
                className="game-btn choice__opt"
                aria-pressed={input === 'touch'}
                onClick={() => {
                  setInput('touch');
                  setDeclined(false);
                }}
              >
                {a.useTouch}
                <span className="choice__hint">{a.useTouchHint}</span>
              </button>
            </div>
            {declined && <p className="onboard__note">{a.micDeclined}</p>}
            <p className="onboard__small">{s.voiceShort}</p>
          </div>
          <button type="button" className="game-btn game-btn--primary" onClick={() => goTo(2)}>
            {a.next}
          </button>
        </section>

        {/* 3. Before you dive */}
        <section className="onboard__card" aria-labelledby="onboard-safety">
          <div className="onboard__body">
            <h1 id="onboard-safety">{s.title}</h1>
            <p>{s.lead}</p>
            <p>
              <Rich text={s.not1} />
            </p>
            <ul className="onboard__care">
              <li>{s.care1}</li>
              <li>{s.care2}</li>
              <li>{s.care3}</li>
            </ul>
            <p>{s.stopAnyTime}</p>
            <CrisisLine />
          </div>
          <button type="button" className="game-btn game-btn--primary" onClick={() => onDone(input)}>
            {review ? a.close : s.begin}
          </button>
        </section>
      </div>

      <div className="onboard__dots" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className={i === card ? 'is-on' : ''} />
        ))}
      </div>
    </div>
  );
}
