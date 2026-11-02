"""Kopiert Buchhaltung und Rechnungen auf die Website: www.nasuvia.ch/buchhaltung/.
So liegen Admin, Offerten, Buchhaltung und Rechnungen unter einer Adresse und
das iPhone zeigt beim Wechseln keine Adressleiste. Nach Änderungen hier erneut ausführen."""
import json, pathlib, shutil
HOME = pathlib.Path.home()
QUELLE = pathlib.Path(__file__).resolve().parent.parent
ZIEL = HOME / 'Nasuvia/09 Website/Website nasuvia.ch/buchhaltung'

if ZIEL.exists():
    shutil.rmtree(ZIEL)
shutil.copytree(QUELLE, ZIEL, ignore=shutil.ignore_patterns('.git', '.DS_Store', '.claude', 'fati', 'werkzeug', 'README*'))

# Als App auf dem Home-Bildschirm gilt die ganze Adresse nasuvia.ch
for pfad, start in [(ZIEL / 'manifest.webmanifest', '/buchhaltung/'), (ZIEL / 'rechnungen/manifest.webmanifest', '/buchhaltung/rechnungen/')]:
    m = json.loads(pfad.read_text())
    m['start_url'] = start
    m['scope'] = '/'
    m['icons'] = [{**i, 'src': '/buchhaltung/' + i['src'].lstrip('./').replace('../', '')} for i in m['icons']]
    pfad.write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n')
print('Buchhaltung und Rechnungen kopiert nach', ZIEL)
