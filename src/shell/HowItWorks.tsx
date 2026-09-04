import { useLanguage } from './i18n';
import { Button, DepthScale, IconDive, Overline, Timeline, TimelineStep } from './ui';
import './HowItWorks.css';

/** How it works: four steps on one timeline, the device statement, what the game rewards and what it cannot see. */
export function HowItWorks() {
  const { t } = useLanguage();

  const steps = [
    { num: '01', title: t.how.step1Title, body: t.how.step1Body },
    { num: '02', title: t.how.step2Title, body: t.how.step2Body },
    { num: '03', title: t.how.step3Title, body: t.how.step3Body },
    { num: '04', title: t.how.step4Title, body: t.how.step4Body },
  ];

  return (
    <div className="how">
      <DepthScale />

      <header className="page__head">
        <h1 tabIndex={-1}>{t.how.title}</h1>
        <p className="t-lead">{t.how.intro}</p>
      </header>

      <div className="page__col">
        <Timeline>
          {steps.map((step) => (
            <TimelineStep key={step.num} num={step.num} title={step.title} titleId={`how-step-${step.num}`}>
              <p>{step.body}</p>
            </TimelineStep>
          ))}
        </Timeline>

        <p className="bounded t-lead how__statement">{t.how.deviceBanner}</p>

        <div className="how__pair">
          <section aria-labelledby="how-rules">
            <Overline as="h2" id="how-rules">
              {t.how.rulesTitle}
            </Overline>
            <ul className="prose">
              <li>{t.how.rule1}</li>
              <li>{t.how.rule2}</li>
              <li>{t.how.rule3}</li>
              <li>{t.how.rule4}</li>
            </ul>
          </section>
          <section aria-labelledby="how-limits">
            <Overline as="h2" id="how-limits">
              {t.how.limitsTitle}
            </Overline>
            <ul className="prose">
              <li>{t.how.limit1}</li>
              <li>{t.how.limit2}</li>
              <li>{t.how.limit3}</li>
            </ul>
          </section>
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
    </div>
  );
}
