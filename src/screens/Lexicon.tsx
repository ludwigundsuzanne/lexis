import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { isTarget, TARGET_WORDS, WORD_BY_ID } from '../data/words';
import { IconSearch } from '../components/Icons';
import { db } from '../lib/db';
import { href } from '../lib/router';
import { statusOf } from '../lib/srs';

type Filter = 'tous' | 'en cours' | 'maîtrisé' | 'à revoir';

const strip = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function Lexicon() {
  const progress = useLiveQuery(async () => (await db.progress.toArray()).filter((p) => isTarget(p.wordId)), []);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('tous');
  if (!progress) return <main className="page" aria-busy="true" />;

  const now = Date.now();
  const rows = progress
    .map((p) => ({ p, w: WORD_BY_ID[p.wordId], status: statusOf(p), due: p.card.due.getTime() <= now }))
    .filter((r) => r.w)
    .filter((r) => (filter === 'tous' ? true : filter === 'à revoir' ? r.due : r.status === filter))
    .filter((r) => !q || strip(r.w.lemma).includes(strip(q)) || strip(r.w.definition).includes(strip(q)))
    .sort((a, b) => a.w.lemma.localeCompare(b.w.lemma, 'fr'));

  const remaining = TARGET_WORDS.length - progress.length;

  return (
    <main className="page">
      <div className="page-head">
        <h1 className="page-title">Mon lexique</h1>
        <span className="faint" style={{ fontSize: 14 }}>
          {progress.length} {progress.length > 1 ? 'mots' : 'mot'}
        </span>
      </div>

      {progress.length > 0 && (
        <>
          <label className="search">
            <IconSearch />
            <span className="sr-only">Chercher un mot</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Chercher un mot ou un sens"
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="search"
            />
          </label>
          <div className="filters" role="group" aria-label="Filtrer">
            {(['tous', 'à revoir', 'en cours', 'maîtrisé'] as Filter[]).map((f) => (
              <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'tous' ? 'Tous' : f === 'à revoir' ? 'À revoir' : f === 'en cours' ? 'En cours' : 'Maîtrisés'}
              </button>
            ))}
          </div>
        </>
      )}

      {rows.length > 0 ? (
        <ul className="word-list">
          {rows.map(({ w, status }) => (
            <li key={w.id}>
              <a href={href('mot/' + w.id)}>
                <span className="w">{w.lemma}</span>
                <span className={`status${status === 'maîtrisé' ? ' mastered' : ''}`}>{status}</span>
                <span className="d">{w.definition}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          {progress.length === 0 ? (
            <>
              <b>Ton lexique est vide.</b>
              <span>Les mots que tu découvres pendant les sessions s'ajoutent ici.</span>
              <a className="btn btn-primary" href={href('session')} style={{ justifySelf: 'center', marginTop: 8 }}>
                Commencer la session
              </a>
            </>
          ) : (
            <>
              <b>Aucun mot ici.</b>
              <span>{q ? `Rien ne correspond à « ${q} ».` : 'Aucun mot dans cette catégorie pour le moment.'}</span>
            </>
          )}
        </div>
      )}

      {remaining > 0 && progress.length > 0 && (
        <p className="faint" style={{ fontSize: 13.5 }}>
          Encore {remaining} {remaining > 1 ? 'mots' : 'mot'} à découvrir.
        </p>
      )}
    </main>
  );
}
