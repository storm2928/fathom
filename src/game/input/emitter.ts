import type { BreathEventMap } from '../../breath/types';

type Handler<K extends keyof BreathEventMap> = (payload: BreathEventMap[K]) => void;

/**
 * Typed fan-out for breath events, shared by every input source in this lane
 * (scripted, spacebar, and eventually the real engine's adapter).
 *
 * Handlers are copied before dispatch so a handler that unsubscribes itself —
 * which the session state machine does on every transition — cannot corrupt the
 * iteration it is running inside.
 */
export class BreathEmitter {
  /**
   * Handlers are stored with their payload erased to `never`, which every
   * concrete handler type is assignable to. TypeScript cannot keep the key and
   * the payload correlated across a generic write, so the pairing is enforced by
   * the signatures of `on` and `emit` and re-applied on dispatch.
   */
  private readonly handlers = new Map<keyof BreathEventMap, Set<(payload: never) => void>>();

  on<K extends keyof BreathEventMap>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  emit<K extends keyof BreathEventMap>(event: K, payload: BreathEventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;
    for (const handler of [...set]) (handler as Handler<K>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
