# Lexis

Application personnelle pour enrichir son vocabulaire **actif** en français : découvrir des mots précis,
en saisir les nuances, et surtout les retrouver seul au bon moment.

- Répétition espacée (algorithme FSRS), rappel actif sans QCM, distinction entre mots proches,
  production de phrases personnelles.
- Application web installable (PWA), qui fonctionne hors ligne. La progression reste sur l'appareil :
  pas de compte, pas de serveur.

## Développement

```bash
npm install
npm run dev        # serveur local
npm run build      # version de production dans dist/
```

Le corpus est rédigé dans `corpus/lot*.json` et assemblé par `scripts/corpus/build.py`
(qui a besoin de Lexique 3.83 dans `sources/lexique/`, non versionné). Chaque envoi sur `main`
publie l'application sur GitHub Pages (`.github/workflows/deploy.yml`).

## Sources et licences

- Définitions adaptées du [Wiktionnaire](https://fr.wiktionary.org), sous licence
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr). Le contenu des fiches
  (`corpus/`, `src/data/corpus.json`) est diffusé sous la même licence.
- Fréquences, taux de connaissance et formes fléchies : [Lexique 3.83](http://www.lexique.org)
  (New, Pallier et al.), licence CC BY-SA 4.0.
- Polices Newsreader et Instrument Sans, licence SIL Open Font.
- Logo : © son auteur, tous droits réservés.
