import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useLanguage } from '@fathom/shell/i18n';
import { formatMetres } from '@fathom/shell/format';
import { ProgressRing } from '@fathom/shell/ui';
import type { PromptStep } from '@fathom/game/session/conductor';
import type { SessionState } from '@fathom/game/session/sessionMachine';
import type { SpacebarBreathEngine } from '@fathom/game/input/spacebarEngine';
import { useAppStrings } from '../strings';
import { SettingsButton } from '../screens/SettingsSheet';
import { CreatureIcon } from '../journal/CreatureIcon';
import { useCreatureWords } from '../journal/creatureStrings';
import type { CreatureId } from '../journal/catalogue';
import { ZONE_CSS } from '../journal/zoneColours';
import '../journal/journal.css';

export interface RingView {
  step: PromptStep | 'calibrating' | null;
  sweepMs: number;
  seq: number;
}

/** Visual scale of the gauge: a full column is this many metres. */
const GAUGE_METRES = 400;

/**
 * Everything drawn over the water during a dive: depth, the breath ring, the
 * zone name as you enter it, a way out, and — on touch — the whole screen as
 * the thing you hold.
 */
export function DiveHud({
  state,
  zone,
  depth,
  ring,
  touch,
  notice,
  unheard,
  onLeave,
  onSettings,
  discovery,
}: {
  state: SessionState;
  zone: number | null;
  depth: number;
  ring: RingView;
  touch: SpacebarBreathEngine | null;
  notice: string | null;
  /** a microphone dive is not hearing the breaths out it asks for */
  unheard: boolean;
  onLeave: () => void;
  onSettings: () => void;
  /** the latest find, keyed so each one shows its own toast */
  discovery: { id: CreatureId; zone: number; key: number } | null;
}) {
  const { t, language } = useLanguage();
  const a = useAppStrings();
  const words = useCreatureWords();
  const [cardZone, setCardZone] = useState<number | null>(null);

  // A zone card each time the arc enters a new zone; it animates itself out.
  useEffect(() => {
    if (zone !== null) setCardZone(zone);
  }, [zone]);

  const label =
    ring.step === 'calibrating'
      ? t.dive.prompt.calibrating
      : ring.step === 'inhale'
        ? t.dive.prompt.inhale
        : ring.step === 'top-up'
          ? t.dive.prompt.topUp
          : ring.step === 'exhale'
            ? t.dive.prompt.exhale
            : ring.step === 'rest'
              ? t.dive.prompt.rest
              : '';
  const caption =
    state === 'surfacing'
      ? t.dive.prompt.surfacing
      : ring.step === 'calibrating'
        ? t.dive.prompt.calibratingCaption
        : ring.step === 'exhale' && !touch
          ? t.dive.prompt.exhaleMic
          : undefined;

  // One finger is one breath: a second finger landing or lifting must not
  // start or end the hold the first one is making.
  const holding = useRef<number | null>(null);
  const press = (down: boolean) => (event: PointerEvent<HTMLDivElement>) => {
    if (!touch) return;
    event.preventDefault();
    if (down) {
      if (holding.current !== null) return;
      holding.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      touch.beginHold();
    } else if (event.pointerId === holding.current) {
      holding.current = null;
      touch.endHold();
    }
  };

  // Nothing to hold while the diver is still rolling in off the boat.
  const holdable = touch !== null && state !== 'idle';

  const gaugeTop = `${Math.min(100, (depth / GAUGE_METRES) * 100)}%`;

  return (
    <div className="safe hud">
      {holdable && (
        <div
          className="hud__press"
          role="button"
          aria-label={a.holdHint}
          onPointerDown={press(true)}
          onPointerUp={press(false)}
          onPointerCancel={press(false)}
          onLostPointerCapture={press(false)}
        />
      )}

      <div className="hud__depth" aria-live="off">
        <div className="hud__depth-value">{formatMetres(depth, t, language)}</div>
        <div className="hud__depth-label">{t.dive.depth}</div>
      </div>
      <div className="hud__gauge" aria-hidden="true">
        <div className="hud__gauge-mark" style={{ top: gaugeTop }} />
      </div>

      {cardZone !== null && (
        <div key={cardZone} className="zone-card" aria-live="polite">
          <div className="zone-card__over">
            {a.zoneLabel} {cardZone + 1}
          </div>
          <div className="zone-card__name">{a.zones[cardZone]}</div>
        </div>
      )}

      {discovery && (
        <div
          key={discovery.key}
          className="found-toast"
          role="status"
          style={{ ['--zc' as string]: ZONE_CSS[discovery.zone] }}
        >
          <CreatureIcon id={discovery.id} found colour={ZONE_CSS[discovery.zone]} size={40} />
          <span>
            <span className="found-toast__label">{a.found}</span>
            <br />
            <span className="found-toast__name">{words[discovery.id].name}</span>
          </span>
        </div>
      )}

      {notice && (
        <p style={{ position: 'absolute', top: '18%', left: 24, right: 24, textAlign: 'center' }}>
          {notice}
        </p>
      )}

      {/* VoiceOver hears each breath prompt as it changes; the haptic taps carry the rhythm. */}
      <p className="visually-hidden" aria-live="polite">
        {label}
      </p>

      <p className="hud__unheard" role="status">
        {unheard ? a.micUnheard : ''}
      </p>

      {ring.step && (
        <div className="hud__ring">
          <ProgressRing
            mode="sweep"
            tone="hud"
            size={132}
            durationMs={ring.sweepMs}
            seq={ring.seq}
            label={label}
            caption={caption}
            glow={ring.step === 'exhale'}
          />
        </div>
      )}
      {holdable && <p className="hud__hint">{a.holdHint}</p>}

      <button
        type="button"
        className="game-btn hud__leave"
        aria-label={t.dive.leave}
        onClick={onLeave}
      >
        ×
      </button>
      <SettingsButton className="hud__settings" onClick={onSettings} />
    </div>
  );
}
