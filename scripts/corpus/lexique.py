"""Lecture de Lexique 3.83 : une entrée par lemme et par catégorie (ADJ, VER, NOM)."""
import csv
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
TSV = ROOT / 'sources' / 'lexique' / 'Lexique383.tsv'


def f(x):
    try:
        return float(x)
    except ValueError:
        return None


def lemmas(cats=('ADJ', 'VER', 'NOM')):
    """Renvoie {(lemme, cgram): {livres, films, connu, lettres}} à partir des lignes lemmes."""
    out = {}
    with open(TSV, encoding='utf-8', newline='') as fh:
        for r in csv.DictReader(fh, delimiter='\t'):
            if r['cgram'] not in cats:
                continue
            key = (r['lemme'], r['cgram'])
            e = out.setdefault(key, {'livres': f(r['freqlemlivres']) or 0, 'films': f(r['freqlemfilms2']) or 0,
                                     'connu': f(r['deflem']), 'lettres': len(r['lemme'])})
            if e['connu'] is None and f(r['deflem']) is not None:
                e['connu'] = f(r['deflem'])
    return out
