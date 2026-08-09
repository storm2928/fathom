import { CrisisRail } from './CrisisRail';
import { LanguageToggle } from './LanguageToggle';
import { Rich, useLanguage } from './i18n';
import './Onboarding.css';

/**
 * What this is, what it is not, and who should be careful — before anything
 * asks for a microphone.
 *
 * Ordering is the point. Permission prompts arrive after someone has read what
 * the thing does, not before, so nobody is deciding whether to hand over a
 * microphone to something they have not been told about yet. It is also short
 * on purpose: a scope screen nobody finishes reading protects nobody.
 */

interface OnboardingProps {
  onBegin: () => void;
}

export function Onboarding({ onBegin }: OnboardingProps) {
  const { t } = useLanguage();
  const o = t.onboarding;

  return (
    <section className="onboarding">
      <div className="onboarding-top">
        <LanguageToggle />
      </div>

      <h1>{o.title}</h1>
      <p className="onboarding-lead">{o.lead}</p>

      <h2>{o.notTitle}</h2>
      <p>
        <Rich text={o.not1} />
      </p>
      <p>{o.not2}</p>

      <h2>{o.careTitle}</h2>
      <ul className="onboarding-cautions">
        <li>{o.care1}</li>
        <li>{o.care2}</li>
        <li>{o.care3}</li>
      </ul>
      <p className="onboarding-quiet">{o.stopAnyTime}</p>

      <h2>{o.voiceTitle}</h2>
      <p>{o.voice}</p>

      <h2>{o.measuredTitle}</h2>
      <p>
        <Rich text={o.measured} />
      </p>

      <CrisisRail />

      <button type="button" className="onboarding-begin" onClick={onBegin}>
        {o.begin}
      </button>
      <p className="onboarding-quiet">{o.afterBegin}</p>
    </section>
  );
}
