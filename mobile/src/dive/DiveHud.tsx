import { useEffect, useState } from 'react';
import type { PointerEvent } from 'react';
import { useLanguage } from '@fathom/shell/i18n';
import { formatMetres } from '@fathom/shell/format';
import { ProgressRing } from '@fathom/shell/ui';
import type { PromptStep } from '@fathom/game/session/conductor';
import type { SessionState } from '@fathom/game/session/sessionMachine';
import type { SpacebarBreathEngine } from '@fathom/game/input/spacebarEngine';
import { useAppStrings } from '../strings';

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
  onLeave,
}: {
  state: SessionState;
  zone: number | null;
  depth: number;
  ring: RingView;
  touch: SpacebarBreathEngine | null;
  notice: string | null;
  onLeave: () => void;
}) {
  const { t, language } = useLanguage();
  const a = useAppStrings();
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

  const press = (down: boolean) => (event: PointerEvent<HTMLDivElement>) => {
    if (!touch) return;
    event.preventDefault();
    if (down) {
      event.currentTarget.setPointerCapture(event.pointerId);
      touch.beginHold();
    } else {
      touch.endHold();
    }
  };

  const gaugeTop = `${Math.min(100, (depth / GAUGE_METRES) * 100)}%`;

  return (
    <div className="safe hud">
      {touch && (
        <div
          className="hud__press"
          onPointerDown={press(true)}
          onPointerUp={press(false)}
          onPointerCancel={press(false)}
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

      {notice && (
        <p style={{ position: 'absolute', top: '18%', left: 24, right: 24, textAlign: 'center' }}>
          {notice}
        </p>
      )}

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
      {touch && <p className="hud__hint">{a.holdHint}</p>}

      <button
        type="button"
        className="game-btn hud__leave"
        aria-label={t.dive.leave}
        onClick={onLeave}
      >
        ×
      </button>
    </div>
  );
}
