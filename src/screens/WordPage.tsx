import { useLiveQuery } from 'dexie-react-hooks';
import { WORD_BY_ID } from '../data/words';
import { IconBack } from '../components/Icons';
import { WordEntry } from '../components/WordEntry';
import { db } from '../lib/db';
import { href } from '../lib/router';
import { formatInterval, statusOf } from '../lib/srs';

const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

export function WordPage({ id }: { id: string }) {
  const word = WORD_BY_ID[id];
  const progress = useLiveQuery(() => db.progress.get(id), [id]);
  const knownIds = useLiveQuery(async () => new Set((await db.progress.toCollection().primaryKeys()) as string[]), []);
  const sentences = useLiveQuery(() => db.sentences.where('wordId').equals(id).reverse().sortBy('at'), [id]);
  const reviews = useLiveQuery(() => db.reviews.where('wordId').equals(id).count(), [id]);

  if (!word) {
    return (
      <main className="page">
        <div className="empty">
          <b>Mot introuvable.</b>
          <a href={href('lexique')}>Retour au lexique</a>
        </div>
      </main>
    );
  }

  const status = statusOf(progress ?? undefined);
  const dueIn = progress ? progress.card.due.getTime() - Date.now() : 0;

  return (
    <main className="page">
      <div className="page-head">
        <a className="icon-btn" href={href('lexique')} aria-label="Retour au lexique" onClick={(e) => { if (history.length > 1) { e.preventDefault(); history.back(); } }}>
          <IconBack />
        </a>
        <span className={`status${status === 'maîtrisé' ? ' mastered' : ''}`}>{status}</span>
      </div>

      <WordEntry word={word} knownIds={knownIds} />

      {progress && (
        <section className="section">
          <p className="label">Ta mémoire de ce mot</p>
          <div className="summary">
            <div className="stat">
              <span className="n" style={{ fontSize: 20 }}>{dueIn <= 0 ? 'maintenant' : formatInterval(dueIn)}</span>
              <span className="l">prochain rappel</span>
            </div>
            <div className="stat">
              <span className="n">{reviews ?? 0}</span>
              <span className="l">exercices</span>
            </div>
            <div className="stat">
              <span className="n">{progress.lapses}</span>
              <span className="l">{progress.lapses > 1 ? 'oublis' : 'oubli'}</span>
            </div>
          </div>
          <p className="faint" style={{ fontSize: 13 }}>Découvert le {fmt.format(progress.introducedAt)}.</p>
        </section>
      )}

      {sentences && sentences.length > 0 && (
        <section className="section">
          <p className="label">Tes phrases</p>
          {sentences.map((s) => (
            <p key={s.id} className="entry-example" style={{ fontSize: 17 }}>
              {s.text}
            </p>
          ))}
        </section>
      )}
    </main>
  );
}
