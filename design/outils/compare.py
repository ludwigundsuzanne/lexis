# Génère compare.html : contours du tracé (rouge) posés sur le logo original.
import re, pathlib
root = pathlib.Path(__file__).resolve().parents[1]
svg = (root / 'logo' / 'lexis-original.svg').read_text(encoding='utf-8')
paths = re.findall(r'<path[^>]*d="([^"]+)"', svg)
inner = ''.join(f'<path d="{d}" fill="none" stroke="#ff2a2a" stroke-width="1.6"/>' for d in paths)
html = f'''<!doctype html><html><head><meta charset="utf-8"><title>Comparaison</title><style>body{{margin:0;background:#111}}.wrap{{position:relative;width:800px;height:800px;overflow:hidden}}.wrap img{{position:absolute;width:2048px;left:-624px;top:-620px}}.wrap svg{{position:absolute;inset:0}}</style></head><body>
<div class="wrap" id="ov"><img src="../assets/logo-original.jpg"><svg viewBox="0 0 800 800" width="800" height="800">{inner}</svg></div></body></html>'''
(root / 'outils' / 'compare.html').write_text(html, encoding='utf-8')
