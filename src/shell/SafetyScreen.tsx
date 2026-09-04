import { useEffect, useRef } from 'react';
import { CrisisRail } from './CrisisRail';
import { LanguageToggle } from './LanguageToggle';
import { Rich, useLanguage } from './i18n';
import { hashForRoute } from './router';
import {
  BrandMark,
  Button,
  Card,
  Chip,
  Expandable,
  IconCaution,
  IconLock,
  IconShieldOff,
  IconWave,
} from './ui';
import './SafetyScreen.css';

/**
 * What this is, what it is not, and who should be careful — before anything
 * asks for a microphone.
 *
 * Ordering is the point. Permission prompts arrive after someone has read what
 * the thing does, not before, so nobody is deciding whether to hand over a
 * microphone to something they have not been told about yet.
 *
 * Layout carries the honesty: every required statement (not therapy, the
 * three cautions, audio stays on the device, exhales measured and inhales
 * prompted) is static text at the top of its card. The disclosures beneath
 * hold only the "why".
 *
 * Two modes. `gate` is the first visit: the screen is the whole document, so
 * it carries the brand and the language toggle itself. `reference` is
 * `#/safety` inside the normal layout, where the top nav already has both.
 */

export interface SafetyScreenProps {
  mode: 'gate' | 'reference';
  /** Required in gate mode: acknowledges the screen and moves on. */
  onContinue?: () => void;
}

export function SafetyScreen({ mode, onContinue }: SafetyScreenProps) {
  const { t } = useLanguage();
  const s = t.safety;
  const gate = mode === 'gate';
  const titleRef = useRef<HTMLHeadingElement>(null);

  // In gate mode there is no nav and no `main` above this screen, so the
  // heading is the first thing a screen reader should land on.
  useEffect(() => {
    if (gate) titleRef.current?.focus({ preventScroll: true });
  }, [gate]);

  const screen = (
    <section className={gate ? 'safety safety--gate' : 'safety'} aria-labelledby="safety-title">
      {gate && (
        <div className="safety__top">
          <span className="safety__brand">
            <BrandMark size={22} className="safety__mark" />
            <span className="safety__word">{t.common.appName}</span>
          </span>
          <LanguageToggle />
        </div>
      )}

      <header className="safety__head">
        <div className="safety__eyebrow">
          <Chip tone="accent">{s.eyebrow}</Chip>
        </div>
        <h1 id="safety-title" ref={titleRef} tabIndex={gate ? -1 : undefined}>
          {s.title}
        </h1>
        <p className="t-lead safety__lead">{s.lead}</p>
      </header>

      <div className="safety__grid">
        <Card icon={<IconShieldOff size={24} />} title={s.notTitle} titleId="safety-not">
          <p>
            <Rich text={s.not1} />
          </p>
          <p>{s.not2}</p>
        </Card>

        <Card
          icon={<IconCaution size={24} />}
          tone="caution"
          title={s.careTitle}
          titleId="safety-care"
        >
          <ul className="safety__cautions">
            <li>{s.care1}</li>
            <li>{s.care2}</li>
            <li>{s.care3}</li>
          </ul>
          <p className="t-small">{s.stopAnyTime}</p>
        </Card>

        <Card icon={<IconLock size={24} />} title={s.voiceTitle} titleId="safety-voice">
          <p>{s.voiceShort}</p>
          <Expandable>
            <p>{s.voiceMore}</p>
          </Expandable>
        </Card>

        <Card icon={<IconWave size={24} />} title={s.measuredTitle} titleId="safety-measured">
          <p>
            <Rich text={s.measuredShort} />
          </p>
          <Expandable>
            <p>{s.measuredMore}</p>
          </Expandable>
        </Card>
      </div>

      <CrisisRail />

      <div className="safety__actions">
        {gate ? (
          <Button variant="primary" size="lg" onClick={onContinue}>
            {s.begin}
          </Button>
        ) : (
          <Button variant="primary" size="lg" href={hashForRoute('dive')}>
            {s.backToDive}
          </Button>
        )}
        {gate && <p className="t-small safety__after">{s.afterBegin}</p>}
      </div>
    </section>
  );

  // Standalone on first visit: the screen is the page, so it is also the
  // document's main landmark and carries the page frame itself.
  if (gate) {
    return (
      <main id="main" className="page page--narrow safety-gate">
        {screen}
      </main>
    );
  }
  return screen;
}
