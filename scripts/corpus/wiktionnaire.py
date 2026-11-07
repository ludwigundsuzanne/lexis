"""Récupère et analyse les articles du Wiktionnaire (section française) pour une liste de mots.

    python -I scripts/corpus/wiktionnaire.py perspicace clairvoyant ...

Les réponses brutes sont mises en cache dans sources/wiktionnaire/ (une requête par mot,
espacées d'une seconde). Le résultat analysé s'affiche en JSON.
Contenu du Wiktionnaire : licence CC BY-SA.
"""
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
CACHE = ROOT / 'sources' / 'wiktionnaire'
CACHE.mkdir(parents=True, exist_ok=True)
API = 'https://fr.wiktionary.org/w/api.php'
UA = 'LexisPersonalProject/0.1 (application personnelle de vocabulaire)'

POS = {'adjectif': 'ADJ', 'verbe': 'VER', 'nom': 'NOM'}
REGISTRES = ['soutenu', 'littéraire', 'familier', 'vieilli', 'désuet', 'populaire', 'péjoratif', 'mélioratif',
             'figuré', 'vulgaire', 'rare', 'archaïsme', 'technique', 'droit', 'didactique', 'régional', 'ironique']


def fetch(word: str) -> str:
    path = CACHE / (urllib.parse.quote(word, safe='') + '.json')
    if path.exists():
        return json.loads(path.read_text(encoding='utf-8'))['content']
    q = urllib.parse.urlencode({'action': 'query', 'titles': word, 'prop': 'revisions', 'rvprop': 'content',
                                'rvslots': 'main', 'format': 'json', 'formatversion': 2})
    req = urllib.request.Request(f'{API}?{q}', headers={'User-Agent': UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.load(r)
            break
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5:
                raise
            wait = int(e.headers.get('Retry-After') or 0) or 10 * (attempt + 1)
            print(f'… limite de débit, nouvel essai dans {wait} s', file=sys.stderr)
            time.sleep(wait)
    page = data['query']['pages'][0]
    content = page['revisions'][0]['slots']['main']['content'] if 'revisions' in page else ''
    path.write_text(json.dumps({'word': word, 'content': content}, ensure_ascii=False), encoding='utf-8')
    time.sleep(3)
    return content


def etyl(m):
    args = dict(a.split('=', 1) for a in m.group(1).split('|') if '=' in a)
    mot, sens = args.get('mot', '').strip(), args.get('sens', '').strip()
    return f"{mot} (« {sens} »)" if mot and sens else mot


def clean(s: str) -> str:
    s = re.sub(r'\{\{(?:étyl|étylp)\|([^{}]*)\}\}', etyl, s)
    s = re.sub(r'\{\{exemple\s*\|\s*(?:lang=fr\s*\|)?\s*([^|{}]+)[^{}]*\}\}', r'\1', s)
    s = re.sub(r'\{\{(?:lien|l|term)\|([^|}]+)[^}]*\}\}', r'\1', s)
    s = re.sub(r'\{\{w\|([^|}]+)[^}]*\}\}', r'\1', s)
    s = re.sub(r'\{\{([^|}]+)\|fr\}\}', r'(\1)', s)       # {{soutenu|fr}} → (soutenu)
    s = re.sub(r'\{\{[^{}]*\}\}', '', s)
    s = re.sub(r'\[\[[^|\]]*\|([^\]]+)\]\]', r'\1', s)
    s = re.sub(r'\[\[([^\]]+)\]\]', r'\1', s)
    s = re.sub(r"'''?", '', s)
    s = re.sub(r'<[^>]+>', '', s)
    return re.sub(r'\s+', ' ', s).strip()


def parse(word: str, text: str) -> dict:
    m = re.search(r'== \{\{langue\|fr\}\} ==(.*?)(?=\n== \{\{langue\||\Z)', text, re.S)
    fr = m.group(1) if m else ''
    out = {'mot': word, 'etymologie': '', 'sections': []}
    ety = re.search(r'\{\{S\|étymologie\}\} ===\n(.*?)(?=\n===)', fr, re.S)
    if ety:
        out['etymologie'] = clean(' '.join(l.lstrip(':* ') for l in ety.group(1).splitlines()))[:400]
    for sec in re.finditer(r'=== \{\{S\|(adjectif|verbe|nom)\|fr[^}]*\}\} ===\n(.*?)(?=\n=== \{\{S\||\Z)', fr, re.S):
        body = sec.group(2)
        pron = re.search(r'\{\{pron\|([^|}]+)\|fr\}\}', body)
        defs, regs = [], set()
        for line in body.splitlines():
            if re.match(r'^#(?![*:])', line):
                raw = line.lstrip('# ')
                tags = [t for t in REGISTRES if re.search(r'\{\{' + t + r'\|', raw)]
                regs.update(tags)
                d = clean(raw)
                if d:
                    defs.append({'def': d, 'tags': tags})
            elif line.startswith('#*') and defs and len(defs[-1].setdefault('ex', [])) < 1:
                ex = clean(line.lstrip('#*: '))
                if ex and not ex.startswith('—'):
                    defs[-1]['ex'].append(ex[:300])

        def lst(name):
            s = re.search(r'\{\{S\|' + name + r'\}\} ====\n(.*?)(?=\n====|\n===|\Z)', body, re.S)
            if not s:
                return []
            return [clean(x) for x in re.findall(r'^\*\s*(.+)$', s.group(1), re.M)][:12]

        out['sections'].append({
            'cat': POS[sec.group(1)], 'pron': pron.group(1) if pron else '',
            'registres': sorted(regs), 'definitions': defs[:6],
            'synonymes': lst('synonymes'), 'antonymes': lst('antonymes'),
        })
    return out


if __name__ == '__main__':
    res = [parse(w, fetch(w)) for w in sys.argv[1:]]
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(res, ensure_ascii=False, indent=1))
