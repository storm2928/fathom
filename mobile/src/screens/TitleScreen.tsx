import type { DivePlan } from '../app/flow';
import { useAppStrings } from '../strings';
import { SettingsButton } from './SettingsSheet';

export function TitleScreen({
  onChoose,
  onSettings,
  onJournal,
}: {
  onChoose: (plan: DivePlan) => void;
  onSettings: () => void;
  onJournal: () => void;
}) {
  const a = useAppStrings();
  return (
    <div className="safe title fade-in">
      <SettingsButton className="title__settings" onClick={onSettings} />
      <div className="title__brand">
        <span className="wordmark">Fathom</span>
        <p className="title__tagline">{a.tagline}</p>
      </div>
      <div>
        <div className="title__actions">
          <button type="button" className="game-btn game-btn--primary" onClick={() => onChoose('full')}>
            {a.dive}
            <span className="title__sub">{a.diveLength}</span>
          </button>
          <button type="button" className="game-btn" onClick={() => onChoose('quick')}>
            {a.quick}
            <span className="title__sub">{a.quickLength}</span>
          </button>
          <button type="button" className="game-btn game-btn--quiet" onClick={onJournal}>
            {a.journal}
          </button>
        </div>
        <p className="title__scope">{a.scopeLine}</p>
      </div>
    </div>
  );
}
