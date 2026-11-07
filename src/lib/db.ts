import Dexie, { type EntityTable } from 'dexie';
import type { Card } from 'ts-fsrs';

/** Progression d'un mot (une carte FSRS par mot). */
export interface Progress {
  wordId: string;
  card: Card;
  introducedAt: Date;
  /** Réussites consécutives en production (situation, phrase à compléter, phrase personnelle) */
  productionStreak: number;
  lapses: number;
}

export type ExerciseKind = 'discover' | 'definition' | 'cloze' | 'situation' | 'choose' | 'produce';

export interface ReviewLog {
  id?: number;
  wordId: string;
  at: Date;
  day: string; // AAAA-MM-JJ, jour local
  kind: ExerciseKind;
  correct: boolean;
  rating?: number;
  answer?: string;
}

export interface DayLog {
  day: string; // AAAA-MM-JJ
  sessions: number;
  reviews: number;
  newWords: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface Sentence {
  id?: number;
  wordId: string;
  at: Date;
  text: string;
  selfCheck: 'juste' | 'hesitant' | 'faux';
}

export const db = new Dexie('lexis') as Dexie & {
  progress: EntityTable<Progress, 'wordId'>;
  reviews: EntityTable<ReviewLog, 'id'>;
  days: EntityTable<DayLog, 'day'>;
  settings: EntityTable<Setting, 'key'>;
  sentences: EntityTable<Sentence, 'id'>;
};

db.version(1).stores({
  progress: 'wordId, card.due',
  reviews: '++id, wordId, day, at',
  days: 'day',
  settings: 'key',
  sentences: '++id, wordId, at',
});

export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
}

export const DEFAULT_SETTINGS = { newPerDay: 4 };
export type Settings = typeof DEFAULT_SETTINGS;

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  return s as Settings;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.settings.put({ key, value });
}

/* ── Sauvegarde : export / import JSON ─────────────────────────── */

export async function exportData(): Promise<string> {
  const data = {
    app: 'lexis',
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: await db.progress.toArray(),
    reviews: await db.reviews.toArray(),
    days: await db.days.toArray(),
    settings: await db.settings.toArray(),
    sentences: await db.sentences.toArray(),
  };
  return JSON.stringify(data);
}

const DATE_KEYS = new Set(['due', 'last_review', 'introducedAt', 'at']);
function reviveDates(_k: string, v: unknown) {
  return typeof v === 'string' && DATE_KEYS.has(_k) ? new Date(v) : v;
}

export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json, reviveDates);
  if (data?.app !== 'lexis') throw new Error('Ce fichier ne vient pas de Lexis.');
  await db.transaction('rw', [db.progress, db.reviews, db.days, db.settings, db.sentences], async () => {
    await Promise.all([db.progress.clear(), db.reviews.clear(), db.days.clear(), db.settings.clear(), db.sentences.clear()]);
    await db.progress.bulkPut(data.progress ?? []);
    await db.reviews.bulkPut(data.reviews ?? []);
    await db.days.bulkPut(data.days ?? []);
    await db.settings.bulkPut(data.settings ?? []);
    await db.sentences.bulkPut(data.sentences ?? []);
  });
}

/** Demande au navigateur de ne pas effacer les données en cas de manque de place. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* navigateur sans prise en charge */
  }
  return false;
}
