import { ANCHOR_IDS, FAMILIES, isAnchor, LEARNING_ORDER, WORD_BY_ID } from '../data/words';
import type { Discrimination } from '../data/types';
import { db, dayKey, getSettings, type ExerciseKind, type Progress } from './db';

export interface Item {
  key: string;
  kind: ExerciseKind;
  wordId: string;
  /** Pour « choose » : la question de distinction */
  discrimination?: Discrimination;
  /** Index de la situation à afficher */
  variant?: number;
  /** Premier passage d'un mot découvert aujourd'hui */
  fresh?: boolean;
}

export interface Plan {
  due: Progress[];
  fresh: string[];
}

const MAX_REVIEWS = 30;
let seq = 0;
const k = () => `i${++seq}`;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Choisit l'exercice selon la solidité du souvenir : on reconnaît d'abord, on produit ensuite. */
export function exerciseFor(p: Progress): ExerciseKind {
  const s = p.card.stability;
  if (s < 3) return pick<ExerciseKind>(['definition', 'definition', 'cloze']);
  if (s < 10) return pick<ExerciseKind>(['cloze', 'situation', 'definition']);
  return pick<ExerciseKind>(['situation', 'situation', 'cloze']);
}

export async function planToday(now = new Date()): Promise<Plan> {
  const settings = await getSettings();
  const all = (await db.progress.toArray()).filter((p) => WORD_BY_ID[p.wordId] && !isAnchor(p.wordId));
  const known = new Map(all.map((p) => [p.wordId, p]));

  const due = all
    .filter((p) => p.card.due.getTime() <= now.getTime())
    .sort((a, b) => a.card.due.getTime() - b.card.due.getTime())
    .slice(0, MAX_REVIEWS);

  const today = await db.days.get(dayKey(now));
  const newLeft = Math.max(0, settings.newPerDay - (today?.newWords ?? 0));
  const fresh = LEARNING_ORDER.filter((id) => !known.has(id)).slice(0, newLeft);

  return { due, fresh };
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Construit la session : révisions, découvertes espacées, une distinction, une phrase à écrire. */
export async function buildSession(now = new Date()): Promise<Item[]> {
  const plan = await planToday(now);
  const items: Item[] = [];

  const reviews: Item[] = plan.due.map((p) => ({
    key: k(),
    kind: exerciseFor(p),
    wordId: p.wordId,
    variant: Math.floor(Math.random() * WORD_BY_ID[p.wordId].situations.length),
  }));

  // Révisions d'abord (le plus utile si la session est interrompue), sauf une part
  // gardée pour espacer les découvertes.
  const spacers = Math.min(reviews.length, plan.fresh.length * 2);
  items.push(...reviews.splice(0, reviews.length - spacers));

  // Chaque nouveau mot : sa fiche, puis son premier rappel après la découverte suivante,
  // pour que le souvenir ne vienne pas simplement de l'écran précédent.
  const pending: Item[] = [];
  const perGap = plan.fresh.length ? Math.ceil(spacers / plan.fresh.length) : 0;
  for (const id of plan.fresh) {
    items.push({ key: k(), kind: 'discover', wordId: id, fresh: true });
    items.push(...reviews.splice(0, perGap));
    if (pending.length) items.push(pending.shift()!);
    pending.push({ key: k(), kind: 'definition', wordId: id, fresh: true });
  }
  items.push(...reviews);

  // Une distinction entre mots proches, dans une famille dont on connaît au moins deux mots.
  const knownIds = new Set<string>([...(await db.progress.toCollection().primaryKeys()), ...plan.fresh, ...ANCHOR_IDS]);

  const families = FAMILIES.filter(
    // au moins deux mots connus, dont un mot réellement appris (pas seulement des repères)
    (f) => f.words.filter((w) => knownIds.has(w)).length >= 2 && f.words.some((w) => !isAnchor(w) && knownIds.has(w)),
  );
  if (families.length) {
    const fam = pick(families);
    const options = fam.discriminations.filter((d) => knownIds.has(d.answer));
    if (options.length) {
      const d = pick(options);
      items.push({ key: k(), kind: 'choose', wordId: d.answer, discrimination: d });
    }
  }
  items.push(...pending);

  // Une phrase personnelle avec un mot déjà vu avant aujourd'hui.
  const older = plan.due.length ? plan.due : (await db.progress.toArray()).filter((p) => WORD_BY_ID[p.wordId] && !isAnchor(p.wordId));
  const candidates = older.filter((p) => p.introducedAt.getTime() < startOfDay(now).getTime());
  if (candidates.length) items.push({ key: k(), kind: 'produce', wordId: pick(candidates).wordId });

  return items;
}

export function freshItem(kind: ExerciseKind, wordId: string): Item {
  return { key: k(), kind, wordId, fresh: true };
}

/** Prochain mot jamais vu, hors de ceux déjà prévus dans la session. */
export async function nextFreshWord(exclude: Set<string>): Promise<string | undefined> {
  const seen = new Set<string>((await db.progress.toCollection().primaryKeys()) as string[]);
  return LEARNING_ORDER.find((id) => !seen.has(id) && !exclude.has(id));
}

/** Après un oubli, le mot revient trois exercices plus loin, sous une forme plus facile. */
export function requeue(items: Item[], index: number): Item[] {
  const failed = items[index];
  const copy = items.slice();
  copy.splice(Math.min(copy.length, index + 4), 0, { key: k(), kind: 'definition', wordId: failed.wordId });
  return copy;
}

export function minutesFor(items: { kind: ExerciseKind }[]): number {
  const cost: Record<ExerciseKind, number> = { discover: 1.2, definition: 0.5, cloze: 0.6, situation: 0.8, choose: 0.6, produce: 2 };
  return Math.max(1, Math.round(items.reduce((s, i) => s + cost[i.kind], 0)));
}
