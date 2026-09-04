import { useEffect, useRef } from 'react';
import { CrisisRail } from './CrisisRail';
import { LanguageToggle } from './LanguageToggle';
import { Rich, useLanguage } from './i18n';
import { hashForRoute } from './router';
import { BrandMark, Button, DepthScale, Expandable, Overline } from './ui';
import './SafetyScreen.css';

/**
 * What this is, what it is not, and who should be careful — before anything
 * asks for a microphone.
 *
 * Ordering is the point. Permission prompts arrive after someone has read what
 * the thing does, not before, so nobody is deciding whether to hand over a
 * microphone to something they have not been told about yet.
 *
 * It reads as a short document: a title, one paragraph, four sections opened
 * by a hairline and a small tracked heading. Every required statement (not
 * therapy, the three cautions, audio stays on the device, exhales measured and
 * inhales prompted) is static text at the top of its section. The disclosures
 * beneath hold only the "why". The crisis rail is the one thing on the page
 * that looks like a container, because it is one.
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
      {!gate && <DepthScale />}

      {gate && (
        <div className="safety__top">
          <span className="safety__brand">
            <BrandMark size={22} className="safety__mark" />
            <span className="safety__word">{t.common.appName}</span>
          </span>
          <LanguageToggle />
        </div>
      )}

      <header className="page__head">
        <h1 id="safety-title" ref={titleRef} tabIndex={gate ? -1 : undefined}>
          {s.title}
        </h1>
        <p className="t-lead">{s.lead}</p>
      </header>

      <div className="page__col">
        <section className="sec" aria-labelledby="safety-not">
          <Overline as="h2" id="safety-not">
            {s.notTitle}
          </Overline>
          <div className="prose">
            <p>
              <Rich text={s.not1} />
            </p>
            <p>{s.not2}</p>
          </div>
        </section>

        <section className="sec" aria-labelledby="safety-care">
          <Overline as="h2" id="safety-care">
            {s.careTitle}
          </Overline>
          <ul className="safety__cautions">
            <li>{s.care1}</li>
            <li>{s.care2}</li>
            <li>{s.care3}</li>
          </ul>
          <p className="t-small safety__stop">{s.stopAnyTime}</p>
        </section>

        <section className="sec" aria-labelledby="safety-voice">
          <Overline as="h2" id="safety-voice">
            {s.voiceTitle}
          </Overline>
          <p>{s.voiceShort}</p>
          <Expandable>
            <p>{s.voiceMore}</p>
          </Expandable>
        </section>

        <section className="sec" aria-labelledby="safety-measured">
          <Overline as="h2" id="safety-measured">
            {s.measuredTitle}
          </Overline>
          <p>
            <Rich text={s.measuredShort} />
          </p>
          <Expandable>
            <p>{s.measuredMore}</p>
          </Expandable>
        </section>
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
  // document's main landmark and carries the page frame itself, depth scale
  // included.
  if (gate) {
    return (
      <main id="main" className="page page--scale safety-gate">
        <DepthScale />
        {screen}
      </main>
    );
  }
  return screen;
}
