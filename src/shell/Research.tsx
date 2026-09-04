import { useState } from 'react';
import { useLanguage } from './i18n';
import { Card, Chip, IconExternal, Tabs } from './ui';
import { CATEGORY_ORDER, STUDIES } from './studies';
import type { Category, Study } from './studies';
import './Research.css';

type Filter = 'all' | Category;

/** Sources page: an intro, category tabs, one labelled group of study cards per category. */
export function Research() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>('all');

  const tabs = [
    { id: 'all', label: t.research.all },
    ...CATEGORY_ORDER.map((id) => ({ id, label: t.research.categories[id].title })),
  ];
  const visible = filter === 'all' ? CATEGORY_ORDER : CATEGORY_ORDER.filter((id) => id === filter);

  return (
    <div className="research">
      <header className="research__head">
        <Chip tone="accent">{t.research.eyebrow}</Chip>
        <h1 tabIndex={-1}>{t.research.title}</h1>
        <p className="t-lead research__intro">{t.research.intro}</p>
      </header>

      <Tabs
        className="research__tabs"
        items={tabs}
        selected={filter}
        onSelect={(id) => setFilter(id as Filter)}
        aria-label={t.research.filterLabel}
      />

      <div
        className="research__groups"
        id={`panel-${filter}`}
        role="tabpanel"
        aria-labelledby={`tab-${filter}`}
        tabIndex={-1}
      >
        {visible.map((category) => {
          const studies = STUDIES.filter((study) => study.category === category);
          if (studies.length === 0) return null;
          return (
            <section key={category} className="research__group" aria-labelledby={`cat-${category}`}>
              <h2 id={`cat-${category}`}>{t.research.categories[category].title}</h2>
              <p className="t-small research__group-intro">{t.research.categories[category].intro}</p>
              <div className="research__grid">
                {studies.map((study) => (
                  <StudyCard key={study.id} study={study} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Card className="research__limits" title={t.research.limitsTitle} titleId="research-limits">
        <ul>
          <li>{t.research.limit1}</li>
          <li>{t.research.limit2}</li>
          <li>{t.research.limit3}</li>
        </ul>
      </Card>

      <p className="t-small research__readme">{t.research.readme}</p>
    </div>
  );
}

function StudyCard({ study }: { study: Study }) {
  const { t } = useLanguage();
  const text = t.research.studies[study.id];

  return (
    <Card as="article" plain className="study" aria-labelledby={`study-${study.id}`}>
      <div className="study__meta">
        <Chip tone="muted">{t.research.categories[study.category].title}</Chip>
        <span className="t-mono-sm study__year">{study.year}</span>
      </div>
      <h3 className="study__title" id={`study-${study.id}`}>
        {study.title}
      </h3>
      <p className="t-small study__authors">
        {study.authors} — <span className="study__venue">{study.venue}</span>
      </p>
      <div className="study__finding">
        <span className="t-label">{t.research.finding}</span>
        <p>{text.finding}</p>
      </div>
      <div className="study__shapes">
        <span className="t-label">{t.research.shapes}</span>
        <p>{text.shapes}</p>
      </div>
      <div className="study__links">
        <a className="study__link" href={study.url} target="_blank" rel="noreferrer">
          {t.research.source}
          <IconExternal size={16} />
          <span className="visually-hidden"> {t.common.newTab}</span>
        </a>
        {study.extraLink && (
          <a className="study__link" href={study.extraLink} target="_blank" rel="noreferrer">
            {t.research.handouts}
            <IconExternal size={16} />
            <span className="visually-hidden"> {t.common.newTab}</span>
          </a>
        )}
        {study.doi && (
          <span className="t-mono-sm study__doi">
            {t.research.doi} {study.doi}
          </span>
        )}
      </div>
    </Card>
  );
}
