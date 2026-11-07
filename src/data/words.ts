import type { Corpus, Family, Word } from './types';
import corpus from './corpus.json';

/*
 * Corpus de Lexis : fiches rédigées dans corpus/lot*.json, enrichies par
 * scripts/corpus/build.py (formes et fréquences de Lexique 3.83, lien Wiktionnaire).
 */
const data = corpus as unknown as Corpus;

export const FAMILIES: Family[] = data.families;
export const WORDS: Word[] = data.words;
export const WORD_BY_ID: Record<string, Word> = Object.fromEntries(WORDS.map((w) => [w.id, w]));
export const FAMILY_BY_ID: Record<string, Family> = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));

/** Mots repères : déjà maîtrisés, présents dans les familles pour comparer, jamais enseignés. */
export const isAnchor = (id: string) => WORD_BY_ID[id]?.role === 'repère';
export const ANCHOR_IDS: string[] = WORDS.filter((w) => w.role === 'repère').map((w) => w.id);

/** Mot à apprendre (présent dans le corpus et pas repère). */
export const isTarget = (id: string) => !!WORD_BY_ID[id] && !isAnchor(id);

/** Mots à apprendre. */
export const TARGET_WORDS: Word[] = WORDS.filter((w) => w.role !== 'repère');

/** Ordre d'apprentissage : famille par famille, pour pouvoir comparer les mots proches. */
export const LEARNING_ORDER: string[] = FAMILIES.flatMap((f) => f.words).filter((id) => !isAnchor(id));
