export type EffectKind = "mode" | "mood" | "queued" | "need" | "buff";

export interface Effect {
  id: string;
  label: string;
  emoji: string;
  kind: EffectKind;
  /** Effects sharing a mutex group replace each other when applied. */
  mutex?: string;
}

export interface ActiveEffect {
  effectId: string;
  /** For queued effects, a free-text note (e.g. what was queued). */
  detail?: string;
  appliedAt: number;
}

const effectModules = import.meta.glob<Effect>("../data/effects/*.json", {
  eager: true,
  import: "default",
});

export const effects: Record<string, Effect> = Object.fromEntries(
  Object.values(effectModules).map((e) => [e.id, e]),
);

export function getEffect(id: string): Effect {
  const e = effects[id];
  if (!e) throw new Error(`Unknown effect id: ${id}`);
  return e;
}

export function isStackable(effect: Effect): boolean {
  return effect.kind === "queued";
}

/**
 * Apply a potion's effect to the active list.
 * - Stackable: always push a new instance (with optional detail).
 * - Already active (non-stackable): toggle off.
 * - Mutex group: remove other effects in the same group first.
 */
export function applyEffect(
  active: ActiveEffect[],
  effect: Effect,
  detail?: string,
): ActiveEffect[] {
  if (isStackable(effect)) {
    return [...active, { effectId: effect.id, detail, appliedAt: Date.now() }];
  }
  const existingIdx = active.findIndex((a) => a.effectId === effect.id);
  if (existingIdx >= 0) {
    return active.filter((_, i) => i !== existingIdx);
  }
  let next = active;
  if (effect.mutex) {
    next = active.filter((a) => {
      const e = effects[a.effectId];
      return !e || e.mutex !== effect.mutex;
    });
  }
  return [...next, { effectId: effect.id, appliedAt: Date.now() }];
}

export function removeEffectAt(active: ActiveEffect[], index: number): ActiveEffect[] {
  return active.filter((_, i) => i !== index);
}
