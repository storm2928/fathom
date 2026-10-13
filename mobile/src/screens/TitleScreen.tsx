import type { DivePlan } from '../app/flow';
import { useAppStrings } from '../strings';

export function TitleScreen({ onChoose }: { onChoose: (plan: DivePlan) => void }) {
  const a = useAppStrings();
  return (
    <div className="safe title fade-in">
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
        </div>
        <p className="title__scope">{a.scopeLine}</p>
      </div>
    </div>
  );
}
