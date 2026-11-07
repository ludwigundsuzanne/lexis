import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';
import { db, dayKey, type ExerciseKind, type Progress } from './db';

/* Moteur FSRS : rétention visée 90 %, avec un léger flou sur les intervalles
   pour éviter que tous les mots d'un même jour reviennent ensemble. */
const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: true }));

export { Rating };
export type { Grade };

export const PRODUCTION_KINDS: ExerciseKind[] = ['cloze', 'situation', 'produce'];

/** Un mot est maîtrisé quand il est stable (≥ 21 jours) ET retrouvé seul au moins deux fois de suite. */
export function isMastered(p: Progress): boolean {
  return p.card.state === State.Review && p.card.stability >= 21 && p.productionStreak >= 2;
}

export type WordStatus = 'nouveau' | 'en cours' | 'maîtrisé';
export function statusOf(p?: Progress): WordStatus {
  if (!p) return 'nouveau';
  return isMastered(p) ? 'maîtrisé' : 'en cours';
}

export function newCard(now = new Date()): Card {
  return createEmptyCard(now);
}

/** Intervalle prévu pour chaque note, pour l'afficher sous les boutons. */
export function previewIntervals(card: Card, now = new Date()): Record<Grade, string> {
  const rec = scheduler.repeat(card, now);
  const out = {} as Record<Grade, string>;
  for (const g of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]) {
    out[g] = formatInterval(rec[g].card.due.getTime() - now.getTime());
  }
  return out;
}

export function formatInterval(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return d === 1 ? '1 jour' : `${d} jours`;
  const m = Math.round(d / 30);
  return m < 12 ? `${m} mois` : `${Math.round(d / 365)} an${d >= 730 ? 's' : ''}`;
}

/** Enregistre une réponse : met à jour la carte FSRS, la série de production et le journal. */
export async function grade(
  wordId: string,
  kind: ExerciseKind,
  rating: Grade,
  correct: boolean,
  answer?: string,
  opts: { countNew?: boolean } = {},
) {
  const now = new Date();
  await db.transaction('rw', [db.progress, db.reviews, db.days], async () => {
    const existing = await db.progress.get(wordId);
    const isNew = !existing;
    const p: Progress = existing ?? {
      wordId,
      card: newCard(now),
      introducedAt: now,
      productionStreak: 0,
      lapses: 0,
    };
    p.card = scheduler.next(p.card, now, rating).card;
    if (PRODUCTION_KINDS.includes(kind)) p.productionStreak = correct ? p.productionStreak + 1 : 0;
    if (!correct) p.lapses += 1;
    await db.progress.put(p);
    await db.reviews.add({ wordId, at: now, day: dayKey(now), kind, correct, rating, answer });
    const day = (await db.days.get(dayKey(now))) ?? { day: dayKey(now), sessions: 0, reviews: 0, newWords: 0 };
    day.reviews += 1;
    if (isNew && opts.countNew !== false) day.newWords += 1;
    await db.days.put(day);
  });
}

/** Journalise un exercice qui ne modifie pas la carte (choix entre mots proches, phrase personnelle). */
export async function logOnly(wordId: string, kind: ExerciseKind, correct: boolean, answer?: string) {
  const now = new Date();
  await db.transaction('rw', [db.progress, db.reviews], async () => {
    await db.reviews.add({ wordId, at: now, day: dayKey(now), kind, correct, answer });
    const p = await db.progress.get(wordId);
    if (p && kind === 'produce') {
      p.productionStreak = correct ? p.productionStreak + 1 : 0;
      await db.progress.put(p);
    }
  });
}

export async function markSessionDone() {
  const k = dayKey();
  const day = (await db.days.get(k)) ?? { day: k, sessions: 0, reviews: 0, newWords: 0 };
  day.sessions += 1;
  await db.days.put(day);
}

/** Série : jours consécutifs avec au moins une session terminée, jusqu'à aujourd'hui ou hier. */
export async function currentStreak(): Promise<{ count: number; doneToday: boolean; last7: boolean[] }> {
  const days = new Set((await db.days.toArray()).filter((d) => d.sessions > 0).map((d) => d.day));
  const today = new Date();
  const doneToday = days.has(dayKey(today));
  const cursor = new Date(today);
  if (!doneToday) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(dayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  const last7: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    last7.push(days.has(dayKey(d)));
  }
  return { count, doneToday, last7 };
}
