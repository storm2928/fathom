import { test, equal } from '@fathom/game/testing/harness.ts';
import { initialFlow, nextFlow } from './flow.ts';
import type { FlowEvent, FlowState } from './flow.ts';

/**
 * The app's one-way arc: scope first, then title → pre-dive → dive → results
 * → title. The results screen has exactly one way out, and it is not "again".
 */

const run = (state: FlowState, ...events: FlowEvent[]) => events.reduce(nextFlow, state);

test('first launch opens on the safety scope', () => {
  equal(initialFlow(null).screen, 'safety');
});

test('a returning player opens on the title with their input', () => {
  const state = initialFlow({ acknowledged: true, input: 'touch' });
  equal(state.screen, 'title');
  equal(state.input, 'touch');
});

test('nothing gets past the scope except acknowledging it', () => {
  const start = initialFlow(null);
  for (const event of [
    { type: 'choose-dive', plan: 'full' },
    { type: 'begin' },
    { type: 'surfaced' },
    { type: 'done' },
  ] as FlowEvent[]) {
    equal(nextFlow(start, event).screen, 'safety', `${event.type} skipped the scope`);
  }
  const after = nextFlow(start, { type: 'acknowledge', input: 'mic' });
  equal(after.screen, 'title');
  equal(after.acknowledged, true);
});

test('the full arc, and results lead only back to the title', () => {
  const state = run(
    initialFlow({ acknowledged: true, input: 'mic' }),
    { type: 'choose-dive', plan: 'quick' },
    { type: 'begin' },
    { type: 'surfaced' },
  );
  equal(state.screen, 'results');
  equal(state.plan, 'quick');
  equal(nextFlow(state, { type: 'begin' }).screen, 'results', 'results offered another dive');
  equal(nextFlow(state, { type: 'choose-dive', plan: 'full' }).screen, 'results');
  equal(nextFlow(state, { type: 'done' }).screen, 'title');
});

test('the title cannot jump straight into a dive', () => {
  const title = initialFlow({ acknowledged: true, input: 'mic' });
  equal(nextFlow(title, { type: 'begin' }).screen, 'title');
});

test('pre-dive can go back to the title', () => {
  const state = run(
    initialFlow({ acknowledged: true, input: 'mic' }),
    { type: 'choose-dive', plan: 'full' },
    { type: 'back' },
  );
  equal(state.screen, 'title');
});
