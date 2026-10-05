import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { DiveView } from './game/scene/DiveView';
import { ScriptedEnginePanel } from './game/input/dev/ScriptedEnginePanel';
import { SafetyScreen } from './shell/SafetyScreen';
import { Research } from './shell/Research';
import { HowItWorks } from './shell/HowItWorks';
import { LanguageToggle } from './shell/LanguageToggle';
import { LanguageProvider, useLanguage } from './shell/i18n';
import type { Strings } from './shell/strings';
import { hashForRoute, navigate, useRoute } from './shell/router';
import type { Route } from './shell/router';
import { BrandMark, IconBook, IconDive, IconHow, IconNumbers, IconShield } from './shell/ui';
import './shell/ui/ui.css';
import './App.css';

/** The input harness is a development surface; visitors never see it. */
const DEV_TOOLS = import.meta.env.DEV;

/**
 * Per browser session rather than remembered forever. Re-reading a short safety
 * screen costs a few seconds; a stored flag that quietly suppresses it for good
 * is how people end up never having seen it.
 */
const ACK_KEY = 'fathom.scope-acknowledged';

interface NavItem {
  route: Route;
  label: (t: Strings) => string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { route: 'dive', label: (t) => t.nav.dive, icon: <IconDive size={22} /> },
  { route: 'how', label: (t) => t.nav.how, icon: <IconHow size={22} /> },
  { route: 'research', label: (t) => t.nav.research, icon: <IconBook size={22} /> },
  { route: 'safety', label: (t) => t.nav.safety, icon: <IconShield size={22} /> },
];

const DEV_NAV_ITEM: NavItem = {
  route: 'harness',
  label: (t) => t.nav.harness,
  icon: <IconNumbers size={22} />,
};

function TopNav({ route }: { route: Route }) {
  const { t } = useLanguage();
  const items = DEV_TOOLS ? [...NAV_ITEMS, DEV_NAV_ITEM] : NAV_ITEMS;
  return (
    <header className="topnav">
      <a className="topnav__brand" href={hashForRoute('dive')} aria-label={t.common.brandHome}>
        <BrandMark size={22} className="brand-mark" />
        <span className="topnav__word">{t.common.appName}</span>
      </a>
      <nav className="topnav__links" aria-label={t.nav.label}>
        {items.map((item) => (
          <a
            key={item.route}
            className="topnav__link"
            href={hashForRoute(item.route)}
            aria-current={item.route === route ? 'page' : undefined}
          >
            {item.label(t)}
          </a>
        ))}
      </nav>
      <div className="topnav__end">
        <LanguageToggle />
      </div>
    </header>
  );
}

function TabBar({ route }: { route: Route }) {
  const { t } = useLanguage();
  return (
    <nav className="tabbar" aria-label={t.nav.label}>
      {NAV_ITEMS.map((item) => (
        <a
          key={item.route}
          className="tabbar__item"
          href={hashForRoute(item.route)}
          aria-current={item.route === route ? 'page' : undefined}
        >
          {item.icon}
          <span>{item.label(t)}</span>
        </a>
      ))}
    </nav>
  );
}

function Shell() {
  const { t } = useLanguage();
  const route = useRoute();
  const [acknowledged, setAcknowledged] = useState(
    () => sessionStorage.getItem(ACK_KEY) === 'yes',
  );
  const mainRef = useRef<HTMLElement>(null);
  const firstRoute = useRef(true);

  useEffect(() => {
    document.title = t.common.docTitle[route];
  }, [route, t]);

  // On a route change: top of the page, focus on the new main. Not on the
  // first render, where the document's own focus is the right one.
  useEffect(() => {
    if (!acknowledged) return;
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    mainRef.current?.focus({ preventScroll: true });
  }, [route, acknowledged]);

  const handleContinue = () => {
    sessionStorage.setItem(ACK_KEY, 'yes');
    setAcknowledged(true);
    // A deep link to another route lands there after the gate; from the
    // safety route itself, continue means the dive.
    if (route === 'safety') navigate('dive');
  };

  const skipToMain = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    mainRef.current?.focus();
  };

  // The gate: the safety screen alone, for every route, before anything
  // that could ask for a microphone.
  if (!acknowledged) return <SafetyScreen mode="gate" onContinue={handleContinue} />;

  // The three reading pages carry the depth scale in their left gutter
  // (`page--scale`); the dive owns its own frame.
  let content: ReactNode;
  let mainClass = 'app-main page';
  switch (route) {
    case 'dive':
      content = <DiveView />;
      mainClass = 'app-main app-main--dive';
      break;
    case 'how':
      content = <HowItWorks />;
      mainClass = 'app-main page page--scale';
      break;
    case 'research':
      content = <Research />;
      mainClass = 'app-main page page--scale';
      break;
    case 'safety':
      content = <SafetyScreen mode="reference" />;
      mainClass = 'app-main page page--scale';
      break;
    case 'harness':
      content = DEV_TOOLS ? <ScriptedEnginePanel /> : <DiveView />;
      break;
  }

  return (
    <>
      <a className="skip" href="#main" onClick={skipToMain}>
        {t.common.skipToContent}
      </a>
      <TopNav route={route} />
      <main key={route} id="main" className={mainClass} tabIndex={-1} ref={mainRef}>
        {content}
      </main>
      <TabBar route={route} />
    </>
  );
}

function App() {
  return (
    <LanguageProvider>
      <Shell />
    </LanguageProvider>
  );
}

export default App;
