# Génère les déclinaisons du logo original à partir de design/logo/lexis-original.svg.
#   python -I design/outils/logo_variantes.py
import pathlib
import re

root = pathlib.Path(__file__).resolve().parents[2]
src = (root / 'design' / 'logo' / 'lexis-original.svg').read_text(encoding='utf-8')

shapes = re.findall(r'<g fill="#E6D5C3">(.*?)</g>', src, re.S)[0]
shape_d = re.findall(r'd="([^"]+)"', shapes)
vein_d = re.findall(r'<path fill="#22513F" d="([^"]+)"', src)[0]

FOREST, CREAM, PAPER, NIGHT = '#22513F', '#E6D5C3', '#F3ECE2', '#0F201A'
# Cadre carré centré sur le symbole (x 158→640, y 133→672).
MARK_BOX = '119 122 560 560'


def paths(mark, ground):
    body = ''.join(f'<path d="{d}"/>' for d in shape_d)
    return f'<g fill="{mark}">{body}</g><path fill="{ground}" d="{vein_d}"/>'


def svg(view, inner, extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}"{extra}>{inner}</svg>\n'


out = {}
# Symbole seul, sur fond clair et sur fond foncé
out['design/logo/lexis-mark-forest.svg'] = svg(MARK_BOX, paths(FOREST, PAPER))
out['design/logo/lexis-mark-cream.svg'] = svg(MARK_BOX, paths(CREAM, NIGHT))
# Icône arrondie (identique à l'original) pour le favicon et l'app
icon = svg('0 0 800 800', f'<rect width="800" height="800" rx="176" fill="{FOREST}"/>' + paths(CREAM, FOREST))
out['design/logo/lexis-icon.svg'] = icon
out['public/icons/favicon.svg'] = icon
out['public/icons/icon.svg'] = icon

for path, content in out.items():
    (root / path).write_text(content, encoding='utf-8')
    print('écrit', path)

# Page de rendu des PNG Android : carré plein (any) et zone de sécurité (maskable)
full = f'<rect width="800" height="800" fill="{FOREST}"/>'
def png_svg(size, scale):
    t = 400 - 400 * scale
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">{full}'
            f'<g transform="translate({t} {t}) scale({scale})">{paths(CREAM, FOREST)}</g></svg>')

html = ('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}div{display:inline-block;line-height:0}</style></head><body>'
        f'<div id="i512">{png_svg(512, 1.0)}</div><div id="i192">{png_svg(192, 1.0)}</div>'
        f'<div id="mask">{png_svg(512, 0.78)}</div></body></html>')
(root / 'design' / 'outils' / 'icones.html').write_text(html, encoding='utf-8')
print('écrit design/outils/icones.html')
print('MARK_PATHS', repr(shape_d), repr(vein_d))
