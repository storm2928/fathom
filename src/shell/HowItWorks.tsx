import type { ReactNode } from 'react';
import { useLanguage } from './i18n';
import {
  Button,
  Card,
  Chip,
  IconCheck,
  IconChevron,
  IconDive,
  IconLock,
  IconLungs,
  IconMic,
  IconNumbers,
  IconScale,
  IconSpacebar,
  IconWave,
} from './ui';
import './HowItWorks.css';

/** How it works: four ordered steps, the device banner, what the game rewards and what it cannot see. */
export function HowItWorks() {
  const { t } = useLanguage();

  const steps: { num: string; pic: ReactNode; title: string; body: string }[] = [
    {
      num: '01',
      pic: (
        <span className="how__pic how__pic--row">
          <IconMic size={20} />
          <span className="how__pic-slash">/</span>
          <IconSpacebar size={20} />
        </span>
      ),
      title: t.how.step1Title,
      body: t.how.step1Body,
    },
    {
      num: '02',
      pic: (
        <span className="how__pic how__pic--row">
          <IconWave size={20} />
          <IconChevron size={12} className="how__pic-arrow" />
          <IconNumbers size={20} />
        </span>
      ),
      title: t.how.step2Title,
      body: t.how.step2Body,
    },
    {
      num: '03',
      pic: (
        <span className="how__pic how__pic--stack">
          <IconLungs size={28} />
          <span className="how__pic-mark how__pic-mark--tick">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true" focusable="false">
              <path d="M12 20V6" />
              <path d="M12 6l4 5" />
            </svg>
          </span>
          <span className="how__pic-mark how__pic-mark--check">
            <IconCheck size={12} />
          </span>
        </span>
      ),
      title: t.how.step3Title,
      body: t.how.step3Body,
    },
    {
      num: '04',
      pic: (
        <span className="how__pic">
          <IconScale size={28} />
        </span>
      ),
      title: t.how.step4Title,
      body: t.how.step4Body,
    },
  ];

  return (
    <div className="how">
      <header className="how__head">
        <Chip tone="accent">{t.how.eyebrow}</Chip>
        <h1 tabIndex={-1}>{t.how.title}</h1>
        <p className="t-lead how__intro">{t.how.intro}</p>
      </header>

      <ol className="how__flow">
        {steps.map((step, index) => (
          <li key={step.num} className="how__step">
            <Card as="div" plain className="how__card">
              <span className="how__num" aria-hidden="true">
                {step.num}
              </span>
              {step.pic}
              <h2 className="how__step-title">{step.title}</h2>
              <p className="how__step-body">{step.body}</p>
            </Card>
            {index < steps.length - 1 && (
              <span className="how__connector" aria-hidden="true">
                <IconChevron size={24} />
              </span>
            )}
          </li>
        ))}
      </ol>

      <Card accent plain className="how__banner">
        <span className="how__banner-icon">
          <IconLock size={24} />
        </span>
        <p className="t-lead">{t.how.deviceBanner}</p>
      </Card>

      <div className="how__pair">
        <Card title={t.how.rulesTitle} titleId="how-rules">
          <ul>
            <li>{t.how.rule1}</li>
            <li>{t.how.rule2}</li>
            <li>{t.how.rule3}</li>
            <li>{t.how.rule4}</li>
          </ul>
        </Card>
        <Card title={t.how.limitsTitle} titleId="how-limits">
          <ul>
            <li>{t.how.limit1}</li>
            <li>{t.how.limit2}</li>
            <li>{t.how.limit3}</li>
          </ul>
        </Card>
      </div>

      <div className="how__cta">
        <Button variant="primary" size="lg" href="#/" icon={<IconDive size={18} />}>
          {t.how.cta}
        </Button>
        <Button variant="ghost" href="#/research">
          {t.how.toResearch}
        </Button>
      </div>
    </div>
  );
}
