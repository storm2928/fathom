import { useState } from 'react';
import { useLanguage } from './i18n';
import { DepthScale, IconExternal, Overline, Tabs } from './ui';
import { useMediaQuery } from './ui/useMediaQuery';
import { CATEGORY_ORDER, STUDIES } from './studies';
import type { Category, Study } from './studies';
import './Research.css';

type Filter = 'all' | Category;

/**
 * Sources page, set as a bibliography: a category list beside a single
 * column of hairline-separated entries. The list is an ARIA tablist (vertical
 * at desktop widths, a scrollable row below) and the column is its panel.
 */
export function Research() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>('all');
  const wide = useMediaQuery('(min-width: 1024px)');

  const tabs = [
    { id: 'all', label: t.research.all },
    ...CATEGORY_ORDER.map((id) => ({ id, label: t.research.categories[id].title })),
  ];
  const visible = filter === 'all' ? CATEGORY_ORDER : CATEGORY_ORDER.filter((id) => id === filter);

  return (
    <div className="research">
      <DepthScale labels={30} />

      <header className="page__head">
        <h1 tabIndex={-1}>{t.research.title}</h1>
        <p className="t-lead">{t.research.intro}</p>
      </header>

      <div className="research__body">
        <div className="research__nav">
          <Tabs
            items={tabs}
            selected={filter}
            onSelect={(id) => setFilter(id as Filter)}
            orientation={wide ? 'vertical' : 'horizontal'}
            aria-label={t.research.filterLabel}
          />
        </div>

        <div className="research__col">
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
                <section key={category} className="sec research__group" aria-labelledby={`cat-${category}`}>
                  <Overline as="h2" id={`cat-${category}`}>
                    {t.research.categories[category].title}
                  </Overline>
                  <p className="t-small research__group-intro">{t.research.categories[category].intro}</p>
                  {studies.map((study) => (
                    <StudyEntry key={study.id} study={study} />
                  ))}
                </section>
              );
            })}
          </div>

          <section className="sec research__limits" aria-labelledby="research-limits">
            <Overline as="h2" id="research-limits">
              {t.research.limitsTitle}
            </Overline>
            <ul className="prose">
              <li>{t.research.limit1}</li>
              <li>{t.research.limit2}</li>
              <li>{t.research.limit3}</li>
            </ul>
          </section>

          <p className="t-small research__readme">{t.research.readme}</p>
        </div>
      </div>
    </div>
  );
}

/** One bibliography entry: venue and year, the title as the link, authors, then the Finding / In FATHOM pair. */
function StudyEntry({ study }: { study: Study }) {
  const { t } = useLanguage();
  const text = t.research.studies[study.id];
  const hasLinks = Boolean(study.extraLink || study.doi);

  return (
    <article className="study" aria-labelledby={`study-${study.id}`}>
      <Overline as="p" className="study__meta">
        {study.venue} · {study.year}
      </Overline>
      <h3 className="study__title" id={`study-${study.id}`}>
        <a href={study.url} target="_blank" rel="noreferrer">
          {study.title}
          <IconExternal size={16} />
          <span className="visually-hidden"> {t.common.newTab}</span>
        </a>
      </h3>
      <p className="t-small study__authors">{study.authors}</p>
      <dl className="study__kv">
        <div>
          <Overline as="dt">{t.research.finding}</Overline>
          <dd>{text.finding}</dd>
        </div>
        <div>
          <Overline as="dt">{t.research.shapes}</Overline>
          <dd>{text.shapes}</dd>
        </div>
      </dl>
      {hasLinks && (
        <p className="t-small study__links">
          {study.extraLink && (
            <a href={study.extraLink} target="_blank" rel="noreferrer">
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
        </p>
      )}
    </article>
  );
}
