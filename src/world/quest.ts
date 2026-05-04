/**
 * Quest model.
 *
 * Quests live on the player and persist in localStorage. JSON files in
 * `src/data/quests/` act as seed data on first boot (or after a reset).
 * A reserved quest with `id === "default"` holds ad-hoc tasks added via the
 * top-left "Now" input.
 */

export type QuestCategory = "project" | "maintenance" | "sidequests";

export interface Task {
  id: string;
  label: string;
  done?: boolean;
}

export interface Quest {
  id: string;
  label: string;
  category: QuestCategory;
  active: boolean;
  tasks: Task[];
}

export const CATEGORIES: QuestCategory[] = ["project", "maintenance", "sidequests"];

export const CATEGORY_LABEL: Record<QuestCategory, string> = {
  project: "Projects",
  maintenance: "Maintenance",
  sidequests: "Sidequests",
};

export const DEFAULT_QUEST_ID = "default";

// Load seed quest JSON files at build time.
const seedModules = import.meta.glob("../data/quests/*.json", { eager: true, import: "default" }) as Record<string, Quest>;

export const seedQuests: Quest[] = Object.values(seedModules).map((q) => normalize(q));

function normalize(raw: Quest): Quest {
  return {
    id: raw.id,
    label: raw.label,
    category: (raw.category ?? "sidequests") as QuestCategory,
    active: raw.active ?? true,
    tasks: (raw.tasks ?? []).map((t) => ({
      id: t.id,
      label: t.label,
      done: !!t.done,
    })),
  };
}

/** Returns `current` if it already has every seeded quest, otherwise a merged list. */
export function mergeWithSeeds(current: Quest[]): Quest[] {
  const byId = new Map(current.map((q) => [q.id, q]));
  let changed = false;
  for (const seed of seedQuests) {
    if (!byId.has(seed.id)) {
      byId.set(seed.id, seed);
      changed = true;
    }
  }
  return changed ? Array.from(byId.values()) : current;
}

export function ensureDefaultQuest(quests: Quest[]): Quest[] {
  if (quests.some((q) => q.id === DEFAULT_QUEST_ID)) return quests;
  return [
    ...quests,
    {
      id: DEFAULT_QUEST_ID,
      label: "Default",
      category: "sidequests",
      active: true,
      tasks: [],
    },
  ];
}

/** Groups active quests by category (preserving CATEGORIES order) and returns the inactive list. */
export function groupQuests(quests: Quest[]): {
  active: Record<QuestCategory, Quest[]>;
  inactive: Quest[];
} {
  const active: Record<QuestCategory, Quest[]> = {
    project: [],
    maintenance: [],
    sidequests: [],
  };
  const inactive: Quest[] = [];
  for (const q of quests) {
    if (q.active) active[q.category].push(q);
    else inactive.push(q);
  }
  return { active, inactive };
}

export function addTaskToDefault(quests: Quest[], label: string): Quest[] {
  const trimmed = label.trim();
  if (!trimmed) return quests;
  const newTask = { id: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, label: trimmed, done: false };
  return quests.map((q) =>
    q.id === DEFAULT_QUEST_ID ? { ...q, tasks: [...q.tasks, newTask] } : q,
  );
}

export function toggleQuestActive(quests: Quest[], questId: string): Quest[] {
  return quests.map((q) => (q.id === questId ? { ...q, active: !q.active } : q));
}

export function findQuest(quests: Quest[], questId: string): Quest | undefined {
  return quests.find((q) => q.id === questId);
}
