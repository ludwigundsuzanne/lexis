import { useEffect } from 'react';
import { IconBook, IconLexicon, IconProgress } from './components/Icons';
import { requestPersistence } from './lib/db';
import { href, useRoute } from './lib/router';
import { Home } from './screens/Home';
import { Lexicon } from './screens/Lexicon';
import { ProgressPage } from './screens/ProgressPage';
import { ReviewPage } from './screens/ReviewPage';
import { Session } from './screens/Session';
import { WordPage } from './screens/WordPage';

const TABS = [
  { path: '', label: "Aujourd'hui", Icon: IconBook },
  { path: 'lexique', label: 'Lexique', Icon: IconLexicon },
  { path: 'progres', label: 'Progrès', Icon: IconProgress },
];

export function App() {
  const [section, param] = useRoute();

  useEffect(() => {
    // Une fois l'app installée, Chrome accepte de protéger les données contre l'effacement automatique.
    requestPersistence();
  }, []);

  if (section === 'session') return <Session />;

  let screen;
  if (section === 'lexique') screen = <Lexicon />;
  else if (section === 'progres') screen = <ProgressPage />;
  else if (section === 'mot' && param) screen = <WordPage id={param} />;
  else if (section === 'relecture') screen = <ReviewPage lot={Number(param) || 1} />;
  else screen = <Home />;

  const current = section === 'mot' ? 'lexique' : section === 'relecture' ? 'progres' : section ?? '';

  return (
    <div className="app">
      {screen}
      <nav className="tabbar" aria-label="Navigation principale">
        {TABS.map(({ path, label, Icon }) => (
          <a key={path} href={href(path)} aria-current={current === path ? 'page' : undefined}>
            <Icon />
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}
