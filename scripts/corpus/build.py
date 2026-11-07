"""Assemble le corpus de l'application.

    python -I scripts/corpus/build.py

Entrées :
  corpus/lot*.json              fiches rédigées (familles et mots), relues par lots
  sources/lexique/Lexique383.tsv formes fléchies, fréquences, taux de connaissance
Sortie :
  src/data/corpus.json          lu par l'application

Chaque fiche reçoit : toutes ses formes (accords, conjugaisons) tirées de Lexique,
sa fréquence dans les livres, le taux de connaissance, et le lien vers le Wiktionnaire.
"""
import csv
import json
import pathlib
import sys
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[2]
CAT = {'adjectif': 'ADJ', 'verbe': 'VER'}


def cat_of(pos: str) -> str:
    return 'NOM' if pos.startswith('nom') else CAT.get(pos.split()[0], 'ADJ')


def conjugate(inf: str) -> set:
    """Formes simples des verbes réguliers en -er et en -dre (comme entendre).
    Complète Lexique, qui ne contient que les formes attestées dans ses textes."""
    out = set()
    if inf.endswith('er'):
        r = inf[:-2]
        # é → è devant une syllabe muette : tempérer → tempère, suggérer → suggère
        m = r
        i = r.rfind('é')
        if i != -1 and i >= len(r) - 3 and all(c not in 'aeiouyéèêâîôû' for c in r[i + 1:]):
            m = r[:i] + 'è' + r[i + 1:]
        pres = [m + 'e', m + 'es', m + 'e', r + 'ons', r + 'ez', m + 'ent']
        impf = [r + s for s in ('ais', 'ais', 'ait', 'ions', 'iez', 'aient')]
        ps = [r + s for s in ('ai', 'as', 'a', 'âmes', 'âtes', 'èrent')]
        fut = [b + s for b in (inf, m + 'er') for s in ('ai', 'as', 'a', 'ons', 'ez', 'ont')]
        cond = [b + s for b in (inf, m + 'er') for s in ('ais', 'ait', 'ions', 'iez', 'aient')]
        subj = [m + 'e', m + 'es', r + 'ions', r + 'iez', m + 'ent']
        part = [r + 'é', r + 'ée', r + 'és', r + 'ées', r + 'ant']
        out.update(pres + impf + ps + fut + cond + subj + part + [inf])
    elif inf.endswith('indre'):  # enjoindre, craindre, peindre : enjoin-s, enjoign-ons
        r = inf[:-5]  # enjo-
        pres = [r + s for s in ('ins', 'ins', 'int', 'ignons', 'ignez', 'ignent')]
        impf = [r + 'ign' + s for s in ('ais', 'ait', 'ions', 'iez', 'aient')]
        ps = [r + 'ign' + s for s in ('is', 'it', 'îmes', 'îtes', 'irent')]
        fut = [inf[:-1] + s for s in ('ai', 'as', 'a', 'ons', 'ez', 'ont', 'ais', 'ait', 'ions', 'iez', 'aient')]
        subj = [r + 'ign' + s for s in ('e', 'es', 'ions', 'iez', 'ent')]
        part = [r + s for s in ('int', 'inte', 'ints', 'intes', 'ignant')]
        out.update(pres + impf + ps + fut + subj + part + [inf])
    elif inf.endswith('dre'):
        r = inf[:-2]  # entend-
        pres = [r + 's', r + 's', r, r + 'ons', r + 'ez', r + 'ent']
        impf = [r + s for s in ('ais', 'ais', 'ait', 'ions', 'iez', 'aient')]
        ps = [r + s for s in ('is', 'it', 'îmes', 'îtes', 'irent')]
        fut = [inf[:-1] + s for s in ('ai', 'as', 'a', 'ons', 'ez', 'ont', 'ais', 'ait', 'ions', 'iez', 'aient')]
        subj = [r + s for s in ('e', 'es', 'ions', 'iez', 'ent')]
        part = [r + 'u', r + 'ue', r + 'us', r + 'ues', r + 'ant']
        out.update(pres + impf + ps + fut + subj + part + [inf])
    return out


def read_lexique(wanted):
    forms = {k: set() for k in wanted}
    stats = {}
    with open(ROOT / 'sources' / 'lexique' / 'Lexique383.tsv', encoding='utf-8', newline='') as fh:
        for r in csv.DictReader(fh, delimiter='\t'):
            k = (r['lemme'], r['cgram'])
            if k in forms:
                forms[k].add(r['ortho'])
                if k not in stats:
                    stats[k] = {'freqLivres': float(r['freqlemlivres'] or 0)}
                if r['deflem'] and 'connu' not in stats[k]:
                    stats[k]['connu'] = float(r['deflem'])
    return forms, stats


def main():
    families, words = [], []
    for path in sorted((ROOT / 'corpus').glob('lot*.json')):
        lot = json.loads(path.read_text(encoding='utf-8'))
        n = int(path.stem[3:])
        families += lot['families']
        for w in lot['words']:
            w['lot'] = n
            words.append(w)

    wanted = {(w['lemma'], cat_of(w['pos'])) for w in words}
    forms, stats = read_lexique(wanted)
    problems = []
    for w in words:
        k = (w['lemma'], cat_of(w['pos']))
        found = set(forms.get(k) or [])
        if k[1] == 'VER':
            found |= conjugate(w['lemma'])
        f = sorted(found, key=lambda s: (s != w['lemma'], len(s), s))
        if not f:
            problems.append(f"{w['lemma']} : absent de Lexique (formes par défaut)")
            f = [w['lemma']]
        if w['lemma'] not in f:
            f.insert(0, w['lemma'])
        w['forms'] = f
        src = w.setdefault('source', {})
        src['url'] = 'https://fr.wiktionary.org/wiki/' + urllib.parse.quote(w['lemma'])
        src.update(stats.get(k, {}))
        if w.get('clozeAnswer') and w['clozeAnswer'] not in f:
            problems.append(f"{w['lemma']} : la réponse « {w['clozeAnswer']} » n'est pas une forme connue")
        if w['cloze'].count('___') != 1:
            problems.append(f"{w['lemma']} : la phrase à compléter doit contenir un seul ___")
        if '{' not in w['example']:
            problems.append(f"{w['lemma']} : le mot n'est pas marqué dans l'exemple")

    ids = {w['id'] for w in words}
    for fam in families:
        for wid in fam['words']:
            if wid not in ids:
                problems.append(f"famille {fam['id']} : mot inconnu {wid}")
        for d in fam['discriminations']:
            if set(d['why']) != set(fam['words']):
                problems.append(f"famille {fam['id']} : explications incomplètes pour « {d['prompt'][:40]}… »")

    out = {'version': 1, 'families': families, 'words': words}
    (ROOT / 'src' / 'data' / 'corpus.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')
    print(f'{len(words)} mots, {len(families)} familles → src/data/corpus.json')
    for p in problems:
        print('  ⚠', p)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
