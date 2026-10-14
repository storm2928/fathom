import type { SavedChoices } from './storage';

/**
 * Where the player is in the app. Pure: the UI renders `screen` and sends
 * events; nothing else moves it.
 *
 * Two rules live here so no screen can break them: nothing is reachable before
 * the safety scope is acknowledged, and the results screen leads back to the
 * title only — never into another dive.
 */

export type Screen = 'safety' | 'title' | 'predive' | 'dive' | 'results';
export type DivePlan = 'full' | 'quick';
export type InputChoice = 'mic' | 'touch';

export interface FlowState {
  screen: Screen;
  acknowledged: boolean;
  plan: DivePlan;
  input: InputChoice;
}

export type FlowEvent =
  | { type: 'acknowledge'; input: InputChoice }
  /** From settings, on any screen. Takes effect from the next dive. */
  | { type: 'set-input'; input: InputChoice }
  | { type: 'choose-dive'; plan: DivePlan }
  | { type: 'begin' }
  | { type: 'back' }
  | { type: 'surfaced' }
  | { type: 'done' };

export function initialFlow(saved: SavedChoices | null): FlowState {
  return saved
    ? { screen: 'title', acknowledged: true, plan: 'full', input: saved.input }
    : { screen: 'safety', acknowledged: false, plan: 'full', input: 'mic' };
}

export function nextFlow(state: FlowState, event: FlowEvent): FlowState {
  if (!state.acknowledged) {
    return event.type === 'acknowledge'
      ? { ...state, screen: 'title', acknowledged: true, input: event.input }
      : state;
  }
  if (event.type === 'set-input') return { ...state, input: event.input };
  switch (state.screen) {
    case 'title':
      return event.type === 'choose-dive' ? { ...state, screen: 'predive', plan: event.plan } : state;
    case 'predive':
      if (event.type === 'begin') return { ...state, screen: 'dive' };
      if (event.type === 'back') return { ...state, screen: 'title' };
      return state;
    case 'dive':
      return event.type === 'surfaced' ? { ...state, screen: 'results' } : state;
    case 'results':
      return event.type === 'done' ? { ...state, screen: 'title' } : state;
    case 'safety':
      return event.type === 'done' ? { ...state, screen: 'title' } : state;
  }
}
