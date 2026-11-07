import type { Word } from '../data/types';

export type Verdict =
  | { ok: true; exact: boolean; note?: string }
  | { ok: false; note?: string };

function clean(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[.!?…,;:«»"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/**
 * Vérifie une réponse tapée. Tolère les accords (formes), signale les accents
 * oubliés et accepte une seule faute de frappe sur les mots longs, en le disant.
 */
export function checkAnswer(input: string, word: Word): Verdict {
  const a = clean(input);
  if (!a) return { ok: false };
  const forms = (word.forms ?? [word.lemma]).map(clean);
  if (forms.includes(a)) return { ok: true, exact: true };

  const bare = stripAccents(a);
  const accentMatch = forms.find((f) => stripAccents(f) === bare);
  if (accentMatch) return { ok: true, exact: false, note: `Attention aux accents : « ${accentMatch} ».` };

  if (a.length >= 6) {
    const near = forms.find((f) => distance(stripAccents(f), bare) === 1);
    if (near) return { ok: true, exact: false, note: `À une lettre près : on écrit « ${near} ».` };
  }
  return { ok: false };
}

/** Indice : première lettre et longueur du mot. */
export function hintFor(word: Word): string {
  const l = word.lemma;
  return `${l[0].toUpperCase()}${' _'.repeat(l.length - 1)}  (${l.length} lettres)`;
}
