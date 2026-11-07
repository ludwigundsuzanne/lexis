import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { isTarget, TARGET_WORDS, WORD_BY_ID } from '../data/words';
import { AppIcon, Mark } from '../components/Logo';
import { db, dayKey } from '../lib/db';
import { href } from '../lib/router';
import { planToday } from '../lib/session';
import { currentStreak, isMastered } from '../lib/srs';

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return 'Bonsoir.';
  if (h < 12) return 'Bonjour.';
  if (h < 18) return 'Bon après-midi.';
  return 'Bonsoir.';
}

const fmtDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function plural(n: number, one: string, many: string) {
  return n <= 1 ? one : many;
}

export function Home() {
  const progress = useLiveQuery(async () => (await db.progress.toArray()).filter((p) => isTarget(p.wordId)), []);
  const days = useLiveQuery(() => db.days.toArray(), []);
  const [plan, setPlan] = useState<{ due: number; fresh: number } | null>(null);
  const [streak, setStreak] = useState<{ count: number; doneToday: boolean; last7: boolean[] } | null>(null);

  useEffect(() => {
    planToday().then((p) => setPlan({ due: p.due.length, fresh: p.fresh.length }));
    currentStreak().then(setStreak);
  }, [progress, days]);

  if (!progress || !plan || !streak) return <main className="page" aria-busy="true" />;

  const introduced = progress.length;
  const mastered = progress.filter(isMastered).length;
  const total = plan.due + plan.fresh;
  const firstTime = introduced === 0;
  const doneToday = days?.find((d) => d.day === dayKey())?.sessions;
  const struggling = [...progress].filter((p) => p.lapses > 0).sort((a, b) => b.lapses - a.lapses)[0];
  const minutes = Math.max(2, Math.round(plan.due * 0.6 + plan.fresh * 2 + 2));

  let title: string;
  if (firstTime) title = 'Quatre mots pour commencer.';
  else if (total === 0) title = 'Tout est à jour.';
  else if (plan.fresh > 0) title = `${plan.fresh === 1 ? 'Un mot' : `${plan.fresh} mots`} ${plural(plan.fresh, "t'attend", "t'attendent")}.`;
  else title = `${plan.due} ${plural(plan.due, 'mot revient', 'mots reviennent')} aujourd'hui.`;

  return (
    <main className="page">
      <div className="page-head">
        <AppIcon size={30} />
        <span className="date">{fmtDate.format(new Date())}</span>
      </div>

      <h1 className="greeting">
        {greeting()}
        <br />
        {title}
      </h1>

      <section className="session-card" aria-labelledby="session-title">
        <Mark className="ghost-mark" />
        {total > 0 ? (
          <>
            <div>
              <h2 id="session-title">Session du jour</h2>
              <div className="session-meta" style={{ marginTop: 12 }}>
                <span><b>{plan.due}</b>{plural(plan.due, 'révision', 'révisions')}</span>
                <span><b>{plan.fresh}</b>{plural(plan.fresh, 'nouveau', 'nouveaux')}</span>
                <span><b>≈ {minutes}</b>min</span>
              </div>
            </div>
            <a className="btn btn-block" href={href('session')}>
              {doneToday ? 'Continuer' : 'Commencer la session'}
            </a>
          </>
        ) : (
          <>
            <h2 id="session-title">C'est fait pour aujourd'hui</h2>
            <p>
              Les mots reviendront au bon moment pour ta mémoire.
              {introduced < TARGET_WORDS.length ? ' Tu pourras en découvrir de nouveaux demain.' : ''}
            </p>
          </>
        )}
      </section>

      {!firstTime && (
        <div className="stats-row">
          <div className="stat">
            <span className="n">
              {streak.count}
              <small>{plural(streak.count, 'jour', 'jours')}</small>
            </span>
            <div className="streak" aria-label={`Sessions des 7 derniers jours`}>
              {streak.last7.map((on, i) => (
                <span key={i} className={on ? (i === 6 ? 'today' : 'on') : ''} />
              ))}
            </div>
          </div>
          <div className="stat">
            <span className="n">
              {mastered}
              <small>/ {introduced}</small>
            </span>
            <span className="l">mots que tu retrouves seul</span>
          </div>
        </div>
      )}

      {struggling && (
        <a className="reminder" href={href('mot/' + struggling.wordId)}>
          <span className="label">À relire</span>
          <span className="w">{WORD_BY_ID[struggling.wordId].lemma}</span>
          <span className="muted" style={{ fontSize: 13.5 }}>
            {struggling.lapses === 1 ? 'oublié une fois' : `oublié ${struggling.lapses} fois`}
          </span>
        </a>
      )}

      {firstTime && (
        <p className="muted" style={{ fontSize: 14.5 }}>
          Chaque jour, quelques mots nouveaux et les révisions dont ta mémoire a besoin. Une session dure une dizaine de
          minutes.
        </p>
      )}
    </main>
  );
}
