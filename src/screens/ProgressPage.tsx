import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { ANCHOR_IDS, isTarget, TARGET_WORDS, WORDS } from '../data/words';

const LOTS = [...new Set(WORDS.map((w) => w.lot ?? 1))].sort((a, b) => a - b);
import { db, dayKey, exportData, getSettings, importData, requestPersistence, setSetting, type Settings } from '../lib/db';
import { isMastered } from '../lib/srs';
import { href } from '../lib/router';

export function ProgressPage() {
  const progress = useLiveQuery(async () => (await db.progress.toArray()).filter((p) => isTarget(p.wordId)), []);
  const reviews = useLiveQuery(() => db.reviews.toArray(), []);
  const days = useLiveQuery(() => db.days.toArray(), []);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then(setSettings);
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  if (!progress || !reviews || !days || !settings) return <main className="page" aria-busy="true" />;

  const mastered = progress.filter(isMastered).length;
  const since = Date.now() - 30 * 86400000;
  const recent = reviews.filter((r) => r.at.getTime() >= since && r.kind !== 'discover');
  const rate = recent.length ? Math.round((recent.filter((r) => r.correct).length / recent.length) * 100) : null;

  // 4 dernières semaines, du lundi au dimanche
  const active = new Set(days.filter((d) => d.sessions > 0).map((d) => d.day));
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 27 - ((today.getDay() + 6) % 7));
  const cells: { key: string; on: boolean; today: boolean; future: boolean }[] = [];
  for (let d = new Date(start); cells.length < 35; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d);
    cells.push({ key: k, on: active.has(k), today: k === dayKey(today), future: d > today });
  }

  const changeNew = async (n: number) => {
    await setSetting('newPerDay', n);
    setSettings({ ...settings, newPerDay: n });
  };

  const doExport = async () => {
    const blob = new Blob([await exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lexis-sauvegarde-${dayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMessage('Sauvegarde téléchargée.');
  };

  const doImport = async (file?: File) => {
    if (!file) return;
    if (!confirm('Remplacer ta progression actuelle par celle de ce fichier ?')) return;
    try {
      await importData(await file.text());
      setMessage('Progression restaurée.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ce fichier est illisible.');
    }
  };

  const keep = async () => {
    const ok = await requestPersistence();
    setPersisted(ok);
    setMessage(ok ? 'Tes données sont protégées.' : "Le navigateur n'a pas accepté pour l'instant. Installe Lexis sur l'écran d'accueil, puis réessaie.");
  };

  return (
    <main className="page">
      <div className="page-head">
        <h1 className="page-title">Progrès</h1>
      </div>

      <div className="big-stats">
        <div className="stat"><span className="n">{progress.length}</span><span className="l">découverts sur {TARGET_WORDS.length}</span></div>
        <div className="stat"><span className="n">{mastered}</span><span className="l">retrouvés seul</span></div>
        <div className="stat"><span className="n">{rate === null ? '–' : `${rate} %`}</span><span className="l">réussite sur 30 jours</span></div>
      </div>

      <section className="section">
        <p className="label">Tes quatre dernières semaines</p>
        <div className="calendar" aria-label="Jours avec une session terminée">
          {cells.map((c) => (
            <span key={c.key} className={`${c.on ? 'on' : ''}${c.today ? ' today' : ''}`} style={c.future ? { opacity: 0.35 } : undefined} title={c.key} />
          ))}
        </div>
      </section>

      <p className="notice">
        Un mot compte comme <i>retrouvé seul</i> quand ta mémoire le garde au moins trois semaines et que tu l'as retrouvé deux fois de suite à partir d'une situation ou d'une phrase.
      </p>

      <section className="section">
        <h2>Nouveaux mots par jour</h2>
        <div className="segmented" role="group" aria-label="Nouveaux mots par jour">
          {[2, 4, 6, 8].map((n) => (
            <button key={n} aria-pressed={settings.newPerDay === n} onClick={() => changeNew(n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="faint" style={{ fontSize: 13.5 }}>Quatre est un bon rythme : chaque nouveau mot ajoute des révisions les jours suivants.</p>
      </section>

      <section className="section">
        <h2>Tes données</h2>
        <p className="muted" style={{ fontSize: 14.5 }}>
          Ta progression reste sur ce téléphone, sans compte ni serveur. Garde une sauvegarde de temps en temps.
        </p>
        {persisted === false && (
          <button className="btn btn-secondary" onClick={keep}>Protéger mes données</button>
        )}
        <div className="row-actions">
          <button className="btn btn-secondary" onClick={doExport}>Sauvegarder</button>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>Restaurer</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
        {message && <p className="notice" role="status">{message}</p>}
      </section>

      <section className="section">
        <h2>Contenu</h2>
        <p className="muted" style={{ fontSize: 14.5 }}>
          {TARGET_WORDS.length} mots à apprendre et {ANCHOR_IDS.length} mots repères (déjà maîtrisés, gardés pour comparer), choisis avec
          Lexique 3.83 et définis d'après le Wiktionnaire (CC BY-SA).
        </p>
        <div className="row-actions">
          {LOTS.map((n) => (
            <a key={n} className="btn btn-secondary" href={href('relecture/' + n)}>
              Relire le lot {n}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
