"""Liste les mots candidats pour les prochains lots, selon le niveau calibré sur la relecture du lot 1.

    python -I scripts/corpus/candidats.py            → sources/candidats.tsv

Critère (relecture du lot 1, 6 novembre 2026) : les mots jugés trop faciles étaient fréquents à l'oral
ou connus de presque tous ; les mots gardés sont des mots de l'écrit. On retient donc :
  - fréquence dans les livres entre 0,3 et 12 occurrences par million de mots ;
  - fréquence dans les films ≤ 0,6 et au plus 35 % de celle des livres (mot de l'écrit) ;
  - connu de 50 % à 85 % des lecteurs (ou inconnu de la base) ;
    (relecture du lot 2, 7 novembre 2026 : les mots connus de 86 à 91 % étaient encore trop faciles) ;
  - adjectif, verbe ou nom, sans espace ni chiffre, d'au moins 5 lettres ;
  - pas déjà dans le corpus.
Le choix final reste éditorial : les mots techniques, régionaux ou vieillis sont écartés
à la lecture du Wiktionnaire.
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from lexique import lemmas  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]


def main():
    deja = set()
    for p in (ROOT / 'corpus').glob('lot*.json'):
        lot = json.loads(p.read_text(encoding='utf-8'))
        deja |= {w['lemma'] for w in lot['words']}
        deja |= set(lot.get('relecture', {}).get('retires_lemmes', []))
    rows = []
    for (w, cat), e in lemmas().items():
        if w in deja or len(w) < 5 or ' ' in w or any(c.isdigit() for c in w):
            continue
        if not (0.3 <= e['livres'] <= 12):
            continue
        if e['films'] > 0.6 or e['films'] > 0.35 * e['livres']:
            continue
        if e['connu'] is not None and not (50 <= e['connu'] <= 85):
            continue
        rows.append((cat, w, e['livres'], e['films'], e['connu']))
    rows.sort(key=lambda r: (r[0], -r[2]))
    out = ROOT / 'sources' / 'candidats.tsv'
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write('cat\tmot\tlivres\tfilms\tconnu\n')
        for r in rows:
            fh.write('\t'.join(str(x) for x in r) + '\n')
    sys.stdout.reconfigure(encoding='utf-8')
    from collections import Counter
    print(f'{len(rows)} candidats → {out.relative_to(ROOT)}', dict(Counter(r[0] for r in rows)))


if __name__ == '__main__':
    main()
