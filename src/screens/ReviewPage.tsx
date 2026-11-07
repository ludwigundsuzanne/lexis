import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { FAMILIES, WORD_BY_ID, WORDS } from '../data/words';
import { IconBack } from '../components/Icons';
import { fr, Marked, WordEntry } from '../components/WordEntry';
import { db } from '../lib/db';
import { href } from '../lib/router';

type Verdict = 'ok' | 'corriger' | 'retirer';
interface Review {
  verdict?: Verdict;
  note?: string;
}
type Reviews = Record<string, Review>;

const KEY = (lot: number) => `relecture-lot${lot}`;
const LABEL: Record<Verdict, string> = { ok: 'OK', corriger: 'À corriger', retirer: 'À retirer' };

/** Relecture d'un lot de fiches : chaque fiche telle qu'elle apparaît, avec ses exercices. */
export function ReviewPage({ lot }: { lot: number }) {
  const stored = useLiveQuery(() => db.settings.get(KEY(lot)), [lot]);
  const [copied, setCopied] = useState<string | null>(null);
  const reviews: Reviews = (stored?.value as Reviews) ?? {};
  const words = WORDS.filter((w) => (w.lot ?? 1) === lot && w.role !== 'repère');
  const families = FAMILIES.filter((f) => f.words.some((id) => WORD_BY_ID[id]?.lot === lot));
  const done = words.filter((w) => reviews[w.id]?.verdict).length;

  const save = (id: string, patch: Review) =>
    db.settings.put({ key: KEY(lot), value: { ...reviews, [id]: { ...reviews[id], ...patch } } });

  const report = () => {
    const count = (v: Verdict) => words.filter((w) => reviews[w.id]?.verdict === v).length;
    const lines = [
      `Relecture du lot ${lot} : ${count('ok')} OK, ${count('corriger')} à corriger, ${count('retirer')} à retirer, ${words.length - done} non relus.`,
    ];
    for (const w of words) {
      const r = reviews[w.id];
      if (r?.verdict && r.verdict !== 'ok') lines.push(`- ${w.lemma} : ${LABEL[r.verdict]}${r.note ? ` — ${r.note}` : ''}`);
      else if (r?.note) lines.push(`- ${w.lemma} : OK — ${r.note}`);
    }
    return lines.join('\n');
  };

  const copy = async () => {
    const text = report();
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Copié. Colle ce texte dans la conversation avec Claude.');
    } catch {
      setCopied(text);
    }
  };

  return (
    <main className="page">
      <div className="page-head">
        <a className="icon-btn" href={href('progres')} aria-label="Retour">
          <IconBack />
        </a>
        <span className="faint" style={{ fontSize: 14 }}>
          {done}/{words.length} relus
        </span>
      </div>
      <h1 className="page-title">Relecture du lot {lot}</h1>
      <p className="muted" style={{ fontSize: 14.5 }}>
        Pour chaque fiche : le sens est-il juste, l'exemple naturel, la nuance convaincante ? Note ce qui te gêne, même
        un détail. Tes réponses sont enregistrées au fur et à mesure.
      </p>

      {families.map((fam) => (
        <section key={fam.id} className="section review-family">
          <p className="label">Famille</p>
          <h2>{fam.name}</h2>
          <details className="review-block">
            <summary>Questions « quel mot convient le mieux ? » ({fam.discriminations.length})</summary>
            {fam.discriminations.map((d, i) => (
              <div key={i} className="review-ex">
                <p>{fr(d.prompt)}</p>
                <p className="faint">
                  Réponse : <b>{WORD_BY_ID[d.answer].lemma}</b>
                </p>
              </div>
            ))}
          </details>

          {fam.words
            .map((id) => WORD_BY_ID[id])
            .filter((w) => w && (w.lot ?? 1) === lot && w.role !== 'repère')
            .map((w) => {
              const r = reviews[w.id] ?? {};
              return (
                <div key={w.id} className="review-word" id={`w-${w.id}`}>
                  <WordEntry word={w} linkNeighbours={false} />
                  <div className="review-block">
                    <p className="label">Exercices</p>
                    <div className="review-ex">
                      <p>
                        {fr(w.cloze.split('___')[0])}
                        <mark>{w.clozeAnswer ?? w.lemma}</mark>
                        {fr(w.cloze.split('___')[1])}
                      </p>
                    </div>
                    {w.situations.map((s, i) => (
                      <div key={i} className="review-ex">
                        <p>{fr(s.prompt)}</p>
                        <p className="faint">
                          Réponse : <b>{w.lemma}</b>
                        </p>
                      </div>
                    ))}
                    <p className="faint" style={{ fontSize: 13 }}>
                      Source : « <Marked text={w.source?.definition ?? ''} /> »
                      {w.source?.freqLivres !== undefined && ` · ${w.source.freqLivres.toLocaleString('fr-FR')} occurrences par million de mots dans les livres`}
                      {w.source?.connu !== undefined && ` · connu de ${w.source.connu} % des lecteurs`}
                    </p>
                  </div>
                  <div className="segmented review-verdict" role="group" aria-label={`Verdict pour ${w.lemma}`}>
                    {(['ok', 'corriger', 'retirer'] as Verdict[]).map((v) => (
                      <button key={v} aria-pressed={r.verdict === v} onClick={() => save(w.id, { verdict: v })}>
                        {LABEL[v]}
                      </button>
                    ))}
                  </div>
                  {(r.verdict === 'corriger' || r.verdict === 'retirer' || r.note) && (
                    <label className="answer">
                      <span className="sr-only">Remarque sur {w.lemma}</span>
                      <textarea
                        rows={2}
                        defaultValue={r.note ?? ''}
                        placeholder="Qu'est-ce qui ne va pas ?"
                        onBlur={(e) => save(w.id, { note: e.target.value.trim() })}
                        style={{ fontSize: 16, fontFamily: 'var(--sans)' }}
                      />
                    </label>
                  )}
                </div>
              );
            })}
        </section>
      ))}

      <section className="section">
        <button className="btn btn-primary btn-block" onClick={copy}>
          Copier mes retours
        </button>
        {copied && (
          <p className="notice" role="status" style={{ whiteSpace: 'pre-wrap' }}>
            {copied}
          </p>
        )}
      </section>
    </main>
  );
}
