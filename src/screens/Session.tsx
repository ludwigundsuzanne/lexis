import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Card } from 'ts-fsrs';
import { FAMILY_BY_ID, WORD_BY_ID, WORDS } from '../data/words';
import type { Word } from '../data/types';
import { IconCheck, IconClose } from '../components/Icons';
import { fr, Marked, quoted, WordEntry } from '../components/WordEntry';
import { checkAnswer, hintFor, type Verdict } from '../lib/answer';
import { db } from '../lib/db';
import { go, href } from '../lib/router';
import { buildSession, freshItem, nextFreshWord, requeue, type Item } from '../lib/session';
import { grade, logOnly, markSessionDone, newCard, previewIntervals, Rating, type Grade } from '../lib/srs';

interface Result {
  wordId: string;
  correct: boolean;
  kind: Item['kind'];
  /** Mot écarté avec « Je le connais déjà » */
  known?: boolean;
}

export function Session() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const finished = useRef(false);

  useEffect(() => {
    buildSession().then(setItems);
  }, []);

  const done = items !== null && index >= items.length;
  useEffect(() => {
    if (done && items!.length > 0 && !finished.current) {
      finished.current = true;
      markSessionDone();
    }
  }, [done, items]);

  if (!items) return <div className="session" aria-busy="true" />;
  if (items.length === 0 || done) return <Done results={results} empty={items.length === 0} />;

  const item = items[index];
  const next = (correct: boolean, retry = false) => {
    setResults((r) => [...r, { wordId: item.wordId, correct, kind: item.kind }]);
    if (retry) setItems(requeue(items, index));
    setIndex((i) => i + 1);
  };

  // « Je le connais déjà » : le mot reviendra dans quelques semaines sous forme de situation,
  // son rappel du jour est retiré et un autre mot nouveau prend sa place.
  const known = async () => {
    await grade(item.wordId, 'discover', Rating.Easy, true, undefined, { countNew: false });
    const rest = items.filter((it, i) => !(i > index && it.wordId === item.wordId && it.fresh));
    const inSession = new Set(rest.map((it) => it.wordId));
    const id = await nextFreshWord(inSession);
    if (id) {
      rest.splice(index + 1, 0, freshItem('discover', id));
      rest.splice(Math.min(rest.length, index + 4), 0, freshItem('definition', id));
    }
    setItems(rest);
    setResults((r) => [...r, { wordId: item.wordId, correct: true, kind: 'discover', known: true }]);
    setIndex((i) => i + 1);
  };

  return (
    <div className="session">
      <div className="session-top">
        <button className="icon-btn" aria-label="Quitter la session" onClick={() => go('')}>
          <IconClose />
        </button>
        <span className="bar" aria-hidden="true">
          <i style={{ width: `${(index / items.length) * 100}%` }} />
        </span>
        <span className="count">
          {index + 1}/{items.length}
        </span>
      </div>
      <Exercise key={item.key} item={item} onNext={next} onKnown={known} />
    </div>
  );
}

function Exercise({ item, onNext, onKnown }: { item: Item; onNext: (correct: boolean, retry?: boolean) => void; onKnown: () => void }) {
  const word = WORD_BY_ID[item.wordId];
  switch (item.kind) {
    case 'discover':
      return <Discover word={word} onNext={() => onNext(true)} onKnown={onKnown} />;
    case 'choose':
      return <Choose item={item} onNext={onNext} />;
    case 'produce':
      return <Produce word={word} onNext={onNext} />;
    default:
      return <Typed item={item} word={word} onNext={onNext} />;
  }
}

/* ── Découverte ─────────────────────────────────────────────── */
function Discover({ word, onNext, onKnown }: { word: Word; onNext: () => void; onKnown: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="session-body enter">
        <p className="label">Nouveau mot</p>
        <WordEntry word={word} linkNeighbours={false} />
      </div>
      <div className="session-actions">
        <button className="btn btn-primary btn-block" onClick={onNext} autoFocus>
          Je l'ai lu
        </button>
        <button
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onKnown();
          }}
        >
          Je le connais déjà
        </button>
      </div>
    </>
  );
}

/* ── Rappel tapé : définition, phrase à compléter, situation ── */
function Typed({ item, word, onNext }: { item: Item; word: Word; onNext: (correct: boolean, retry?: boolean) => void }) {
  const [value, setValue] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [hint, setHint] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    db.progress.get(word.id).then((p) => setCard(p?.card ?? newCard()));
  }, [word.id]);

  const intervals = useMemo(() => (card ? previewIntervals(card) : null), [card]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (verdict || !value.trim()) return;
    setVerdict(checkAnswer(value, word));
  };
  const giveUp = () => setVerdict({ ok: false });

  const rate = async (r: Grade) => {
    await grade(word.id, item.kind, r, true, value);
    onNext(true);
  };
  const failed = async () => {
    await grade(word.id, item.kind, Rating.Again, false, value);
    onNext(false, true);
  };

  let label = 'Trouve le mot juste';
  let prompt: ReactNode;
  if (item.kind === 'definition') {
    label = item.fresh ? 'Tu viens de le lire : quel est ce mot ?' : 'Quel mot correspond à cette définition ?';
    prompt = (
      <>
        <p className="prompt">{fr(word.definition)}</p>
        <p className="faint" style={{ fontStyle: 'italic', fontFamily: 'var(--serif)' }}>
          {word.pos}, {word.register}
        </p>
      </>
    );
  } else if (item.kind === 'cloze') {
    label = 'Complète la phrase';
    const [a, b] = word.cloze.split('___');
    prompt = (
      <p className="prompt">
        {a}
        {verdict ? <mark className="underline-gold" style={{ background: 'none', color: 'inherit' }}>{word.clozeAnswer ?? word.lemma}</mark> : <span className="blank" />}
        {b}
      </p>
    );
  } else {
    prompt = <p className="prompt">{fr(word.situations[item.variant ?? 0]?.prompt ?? word.situations[0].prompt)}</p>;
  }

  // Mot tapé qui existe ailleurs dans Lexis : on explique la différence.
  const confused = verdict && !verdict.ok && value.trim()
    ? WORDS.find((w) => w.id !== word.id && checkAnswer(value, w).ok)
    : undefined;

  return (
    <>
      <form className="session-body enter" onSubmit={submit} id="answer-form">
        <p className="label">{label}</p>
        {prompt}
        <label className={`answer${verdict ? ' locked' : ''}`}>
          <span className="sr-only">Ta réponse</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            readOnly={!!verdict}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="Ta réponse"
          />
        </label>
        {hint && !verdict && <p className="hint">{hintFor(word)}</p>}

        {verdict?.ok && (
          <div className="feedback good" role="status">
            <IconCheck />
            <div>
              <b>{verdict.exact ? 'Juste.' : 'Presque juste.'}</b>
              {word.lemma} : {word.nuance}.
              {verdict.note && <p className="note">{verdict.note}</p>}
            </div>
          </div>
        )}
        {verdict && !verdict.ok && (
          <div className="feedback bad" role="status">
            <IconClose />
            <div>
              <b>C'était « {word.lemma} ».</b>
              {word.definition}
              {confused && (
                <p className="note">
                  Proche, mais pas identique :<br />
                  <i>{confused.lemma}</i> {confused.nuance} ;<br />
                  <i>{word.lemma}</i> {word.nuance}.
                </p>
              )}
              <p className="note">Il reviendra dans quelques minutes.</p>
            </div>
          </div>
        )}
      </form>

      <div className="session-actions">
        {!verdict && (
          <>
            <button className="btn btn-primary btn-block" type="submit" form="answer-form" disabled={!value.trim()}>
              Valider
            </button>
            <div className="row-actions">
              <button className="btn btn-ghost" type="button" onClick={() => { setHint(true); inputRef.current?.focus(); }} disabled={hint}>
                Indice
              </button>
              <button className="btn btn-ghost" type="button" onClick={giveUp}>
                Je ne sais pas
              </button>
            </div>
          </>
        )}
        {verdict?.ok && intervals && (
          <>
            <p className="ask">C'était facile ?</p>
            <div className="ratings">
              <button className="rate" onClick={() => rate(Rating.Hard)}>Difficile<small>{intervals[Rating.Hard]}</small></button>
              <button className="rate" onClick={() => rate(Rating.Good)}>Bien<small>{intervals[Rating.Good]}</small></button>
              <button className="rate" onClick={() => rate(Rating.Easy)}>Facile<small>{intervals[Rating.Easy]}</small></button>
            </div>
          </>
        )}
        {verdict && !verdict.ok && (
          <button className="btn btn-primary btn-block" onClick={failed} autoFocus>
            Continuer
          </button>
        )}
      </div>
    </>
  );
}

/* ── Distinction entre mots proches ─────────────────────────── */
function Choose({ item, onNext }: { item: Item; onNext: (correct: boolean) => void }) {
  const d = item.discrimination!;
  const fam = FAMILY_BY_ID[WORD_BY_ID[d.answer].family];
  const options = useMemo(() => [...fam.words].sort(() => Math.random() - 0.5), [fam]);
  const [picked, setPicked] = useState<string | null>(null);
  const correct = picked === d.answer;

  const cont = async () => {
    await logOnly(d.answer, 'choose', correct, picked ?? undefined);
    onNext(correct);
  };

  return (
    <>
      <div className="session-body enter">
        <p className="label">Quel mot convient le mieux ?</p>
        <p className="prompt">{fr(d.prompt)}</p>
        {/* Les choix descendent vers le bas de l'écran, à portée du pouce. */}
        <div aria-hidden="true" style={{ flex: 1 }} />
        <div className="choices" role="radiogroup" aria-label="Choisis un mot">
          {options.map((id) => {
            const state = !picked ? '' : id === d.answer ? 'right' : id === picked ? 'wrong' : 'dim';
            return (
              <button
                key={id}
                className={`choice ${state}`}
                role="radio"
                aria-checked={picked === id}
                onClick={() => !picked && setPicked(id)}
              >
                <span className="w">{WORD_BY_ID[id].lemma}</span>
                {picked && <span className="why">{d.why[id]}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="session-actions">
        {picked ? (
          <button className="btn btn-primary btn-block" onClick={cont} autoFocus>
            {correct ? 'Continuer' : 'Compris, continuer'}
          </button>
        ) : (
          <p className="ask">Touche le mot qui te semble le plus juste.</p>
        )}
      </div>
    </>
  );
}

/* ── Production personnelle ─────────────────────────────────── */
function containsWord(text: string, word: Word): boolean {
  const strip = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const t = strip(text);
  return (word.forms ?? [word.lemma]).some((f) => new RegExp(`(^|[^\\p{L}])${strip(f)}($|[^\\p{L}])`, 'u').test(t));
}

function claudePrompt(word: Word, sentence: string) {
  return [
    `Je m'entraîne à employer le mot « ${word.lemma} » (${word.pos}, registre ${word.register}) : ${word.definition}`,
    ``,
    `Ma phrase : « ${sentence.trim()} »`,
    ``,
    `Dis-moi si le mot est bien employé (sens, registre, construction), explique brièvement les maladresses éventuelles et propose une formulation plus naturelle. Réponds en français, en quelques lignes.`,
  ].join('\n');
}

function Produce({ word, onNext }: { word: Word; onNext: (correct: boolean) => void }) {
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const has = containsWord(text, word);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(claudePrompt(word, text));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const finish = async (selfCheck: 'juste' | 'hesitant' | 'faux') => {
    await db.sentences.add({ wordId: word.id, at: new Date(), text: text.trim(), selfCheck });
    await logOnly(word.id, 'produce', selfCheck === 'juste', text.trim());
    onNext(selfCheck === 'juste');
  };

  return (
    <>
      <div className="session-body enter">
        <p className="label">Écris une phrase à toi</p>
        <p className="prompt">
          Emploie <b style={{ fontWeight: 600 }}>{word.lemma}</b> dans une phrase de ta vie, de ton travail ou de tes lectures.
        </p>
        {!checked && <p className="muted" style={{ fontSize: 14.5 }}>{word.definition}</p>}
        <label className={`answer${checked ? ' locked' : ''}`}>
          <span className="sr-only">Ta phrase</span>
          <textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={checked}
            autoCapitalize="sentences"
            placeholder={`Une phrase avec « ${word.lemma} »`}
            style={{ fontSize: 19 }}
          />
        </label>
        {text.trim().length > 12 && !has && !checked && (
          <p className="faint" style={{ fontSize: 13.5 }}>Ta phrase doit contenir le mot « {word.lemma} ».</p>
        )}
        {checked && (
          <div className="enter" style={{ display: 'grid', gap: 14 }}>
            <p className="label">Relis-toi</p>
            <ul className="checklist">
              <li>Le sens : {word.definition.charAt(0).toLowerCase() + word.definition.slice(1)}</li>
              <li>Le registre : {word.register}. Ta phrase a-t-elle le même ton ?</li>
              {word.pitfall && <li>{word.pitfall}</li>}
            </ul>
            <p className="entry-example">
              <Marked text={quoted(word.example)} />
            </p>
            <div className="notice">
              Pour un vrai retour, copie ta phrase avec la consigne et colle-la dans Claude.
              <div className="row-actions" style={{ marginTop: 10 }}>
                <button className="btn btn-secondary" onClick={copy}>{copied ? 'Copié' : 'Copier'}</button>
                <a className="btn btn-secondary" href="https://claude.ai/new" target="_blank" rel="noreferrer" onClick={copy}>
                  Ouvrir Claude
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="session-actions">
        {!checked ? (
          <>
            <button className="btn btn-primary btn-block" disabled={!has} onClick={() => setChecked(true)}>
              Vérifier ma phrase
            </button>
            <button className="btn btn-ghost" onClick={() => onNext(false)}>
              Passer
            </button>
          </>
        ) : (
          <>
            <p className="ask">Selon toi, le mot est employé…</p>
            <div className="ratings">
              <button className="rate" onClick={() => finish('faux')}>Maladroitement</button>
              <button className="rate" onClick={() => finish('hesitant')}>Pas sûr</button>
              <button className="rate" onClick={() => finish('juste')}>Justement</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ── Fin de session ─────────────────────────────────────────── */
function Done({ results, empty }: { results: Result[]; empty: boolean }) {
  const graded = results.filter((r) => r.kind !== 'discover');
  const right = graded.filter((r) => r.correct).length;
  const discovered = results.filter((r) => r.kind === 'discover' && !r.known).map((r) => WORD_BY_ID[r.wordId]);

  return (
    <div className="session">
      <main className="session-body">
        <div className="done-hero enter">
          <p className="label">{empty ? 'Rien à faire' : 'Session terminée'}</p>
          <h1>{empty ? 'Tout est à jour pour aujourd’hui.' : right === graded.length && graded.length > 0 ? 'Un sans-faute.' : 'Bien travaillé.'}</h1>
          {!empty && (
            <p className="muted">
              Les mots que tu as manqués reviendront plus tôt ; les autres s'espacent.
            </p>
          )}
        </div>
        {!empty && (
          <div className="summary">
            <div className="stat"><span className="n">{graded.length}</span><span className="l">exercices</span></div>
            <div className="stat"><span className="n">{right}</span><span className="l">réussis</span></div>
            <div className="stat"><span className="n">{discovered.length}</span><span className="l">{discovered.length > 1 ? 'mots découverts' : 'mot découvert'}</span></div>
          </div>
        )}
        {discovered.length > 0 && (
          <section className="section">
            <p className="label">Tes nouveaux mots</p>
            <div className="word-chips">
              {discovered.map((w) => (
                <a key={w.id} href={href('mot/' + w.id)} style={{ color: 'inherit' }}>{w.lemma}</a>
              ))}
            </div>
          </section>
        )}
      </main>
      <div className="session-actions">
        <a className="btn btn-primary btn-block" href={href('')}>
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
}
