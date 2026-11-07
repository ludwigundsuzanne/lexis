export type Register = 'courant' | 'soutenu' | 'littéraire' | 'familier';

export interface Situation {
  /** Mise en situation qui appelle le mot, terminée par « … » */
  prompt: string;
}

export interface Source {
  /** Définition du Wiktionnaire sur laquelle s'appuie la fiche */
  definition: string;
  url: string;
  /** Fréquence dans les livres (occurrences par million de mots, Lexique 3.83) */
  freqLivres?: number;
  /** Part des personnes qui connaissent le mot (Lexique 3.83) */
  connu?: number;
}

export interface Word {
  id: string;
  lemma: string;
  /** Formes acceptées comme bonne réponse (accords, conjugaisons), tirées de Lexique. */
  forms?: string[];
  phon: string;
  pos: string;
  register: Register;
  etymology?: string;
  family: string;
  definition: string;
  explanation: string;
  /** Pour les verbes et certains noms : comment le mot se construit. */
  construction?: string;
  /** Phrase d'exemple ; le mot est entre accolades : « une remarque {perspicace} » */
  example: string;
  /** Ce qui distingue ce mot de ses voisins de famille, en quelques mots */
  nuance: string;
  synonyms: string[];
  antonyms: string[];
  pitfall?: string;
  /** Phrase à compléter ; le trou est noté ___ ; la forme attendue est donnée par clozeAnswer si besoin */
  cloze: string;
  clozeAnswer?: string;
  situations: Situation[];
  source?: Source;
  /** Lot de relecture (1, 2, …) */
  lot?: number;
  /** « repère » : mot déjà maîtrisé, gardé pour comparer avec ses voisins, jamais enseigné. */
  role?: 'repère';
}

export interface Discrimination {
  prompt: string;
  answer: string; // id du mot attendu
  /** Pourquoi chaque mot convient ou non, par id */
  why: Record<string, string>;
}

export interface Family {
  id: string;
  name: string;
  words: string[]; // ids, dans l'ordre d'apprentissage
  discriminations: Discrimination[];
}

export interface Corpus {
  version: number;
  families: Family[];
  words: Word[];
}
