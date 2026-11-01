"""Baut aus der Nasuvia-Rechnungs-App die Rechnungs-App für Fati Sanitär und Hauswartungen.

Ziel: fati/ in diesem Projekt (nasufienes-bit.github.io/nasuvia-buchhaltung/fati/).
Ohne Datenbank: Rechnungen bleiben nur auf dem Gerät. Speicher auf dem Gerät hat
eigene Namen, damit sich nichts mit den Nasuvia-Apps vermischt.
Firmenangaben stehen in fati.json. Erneut ausführen, wenn sich die Rechnungs-App ändert.
"""
import base64, json, pathlib, re, shutil

HIER = pathlib.Path(__file__).parent
WURZEL = HIER.parent
QUELLE = WURZEL / 'rechnungen'
ZIEL = WURZEL / 'fati'
F = json.loads((HIER / 'fati.json').read_text())
ort = f"{F['plz']} {F['ort']}"

def ers(t, alt, neu):
    assert alt in t, f'nicht gefunden: {alt[:70]}'
    return t.replace(alt, neu)

if ZIEL.exists():
    shutil.rmtree(ZIEL)
ZIEL.mkdir()
for name in ('logo.png', 'icon-180.png', 'icon-192.png', 'icon-512.png'):
    shutil.copy(HIER / 'fati-bilder' / name, ZIEL / name)

# ---------- Seite ----------
t = (QUELLE / 'index.html').read_text()
logo64 = 'data:image/png;base64,' + base64.b64encode((HIER / 'fati-bilder/logo.png').read_bytes()).decode()
t = re.sub(r'const LOGO_SRC = "data:image/png;base64,[^"]+";', lambda m: f'const LOGO_SRC = "{logo64}";', t)
fuss_kontakt = ' · '.join(x for x in [F['tel'], F['mail'], F['web']] if x)
for alt, neu in [
    ('<title>Nasuvia Rechnungen</title>', f"<title>{F['kurz']} Rechnungen</title>"),
    ('<link rel="apple-touch-icon" href="../icon-180.png" />', '<link rel="apple-touch-icon" href="icon-180.png" />'),
    ('content="Rechnungen" />', f"content=\"{F['kurz']} Rechnungen\" />"),
    ('id="panelLogo" alt="Nasuvia"', f"id=\"panelLogo\" alt=\"{F['name']}\""),
    ('id="sheetLogo" alt="Nasuvia"', f"id=\"sheetLogo\" alt=\"{F['name']}\""),
    ('NASUVIA — TÖSSFELDSTRASSE 37 — 8406 WINTERTHUR', f"{F['name']} — {F['strasse']} — {ort}".upper()),
    ('<span class="b mono">NASUVIA</span> · Tössfeldstrasse 37 · 8406 Winterthur', f"<span class=\"b mono\">{F['name'].upper()}</span> · {F['strasse']} · {ort}"),
    ('+41 79 821 84 08 · info@nasuvia.ch · www.nasuvia.ch', fuss_kontakt),
    ('<span>CHE-345.606.175 MWST</span>', f"<span>{F['uid']}</span>"),
    ('placeholder="z. B. Nasuvia (direkt)"', f"placeholder=\"z. B. {F['kurz']} (direkt)\""),
    ('id="eName" placeholder="Nasuvia"', f"id=\"eName\" placeholder=\"{F['name']}\""),
    ('im Nasuvia-Design', f"im {F['kurz']}-Design"),
    ('const LOGO_CID = "cid:nasuvia-logo";', 'const LOGO_CID = "cid:fati-logo";'),
    ("const ABSENDER = 'info@nasuvia.ch';", f"const ABSENDER = '{F['mail']}';"),
    ("name: 'Nasuvia',\n    zusatz: 'Glasfasertechnik',\n    strasse: 'Tössfeldstrasse 37',\n    ort: '8406 Winterthur',",
     f"name: '{F['name']}',\n    zusatz: '{F['zusatz']}',\n    strasse: '{F['strasse']}',\n    ort: '{ort}',"),
    ("tel: '+41 79 821 84 08',\n    mail: 'info@nasuvia.ch',\n    web: 'www.nasuvia.ch',\n    uid: 'CHE-345.606.175 MWST',",
     f"tel: '{F['tel']}',\n    mail: '{F['mail']}',\n    web: '{F['web']}',\n    uid: '{F['uid']}',"),
    ("{ id: 'nasuvia', bez: 'Nasuvia (direkt an uns)', name: 'Nasuvia',\n      iban: '', strasse: 'Tössfeldstrasse', nr: '37', plz: '8406', ort: 'Winterthur',",
     "{ id: 'firma', bez: '" + F['kurz'] + " (direkt an uns)', name: '" + F['name'] + "',\n      iban: '', strasse: '" + F['strasse'].rsplit(' ', 1)[0] + "', nr: '" + (F['strasse'].rsplit(' ', 1) + [''])[1] + "', plz: '" + F['plz'] + "', ort: '" + F['ort'] + "',"),
    ('GLASFASER? WIR ZIEHEN DURCH.', F['spruch'].upper()),
    ('Glasfaser? Wir ziehen durch.`', F['spruch'] + '.`'),
    ('info@nasuvia.ch, Rechnung', f"{F['mail']}, Rechnung"),
    ('das Konto info@nasuvia.ch wählen', f"das Konto {F['mail']} wählen"),
    ('WINTERTHUR</td>', f"{F['ort'].upper()}</td>"),
    ('.panel-logo { height: 21px;', '.panel-logo { height: 30px;'),
    ('.sheet .logo { height: 9mm;', '.sheet .logo { height: 11mm;'),
]:
    t = ers(t, alt, neu)
# Eigene Namen für alles, was auf dem Gerät gespeichert wird
t = t.replace("'nasuvia.", "'fati.")
assert not re.search(r'(?i)nasuvia\.ch|glasfaser|CHE-345|Tössfeld', t), 'Nasuvia-Angaben übrig'
t = ers(t, '<script src="../lib/supabase.js"></script>\n', '')
(ZIEL / 'index.html').write_text(t)

# ---------- Dienst (Abgleich, PDF, Übersicht) ----------
d = (QUELLE / 'dienst.js').read_text()
for alt, neu in [
    ("storageKey: 'nb.anmeldung'", "storageKey: 'fati.anmeldung'"),
    ("const K_SEIT = 'nr.abgleich.seit';", "const K_SEIT = 'fati.abgleich.seit';"),
    ("const K_ZULETZT = 'nr.abgleich.zuletzt';", "const K_ZULETZT = 'fati.abgleich.zuletzt';"),
    ("const KEY_KUNDEN = 'nasuvia.kunden.v1';", "const KEY_KUNDEN = 'fati.kunden.v1';"),
    ("const KEY_EMPF = 'nasuvia.empfaenger.v1';", "const KEY_EMPF = 'fati.empfaenger.v1';"),
    ("indexedDB.open('nasuvia-rechnungen'", "indexedDB.open('fati-rechnungen'"),
    ('Öffnen Sie auf dem Schreibtisch den Ordner „Nasuvia Rechnungen“. Wählen Sie dort die Datei <b>rechnungen.json</b> und alle PDFs im Ordner des Jahres aus (mit gedrückter Befehlstaste mehrere anklicken).',
     'Wählen Sie eine Datei <b>rechnungen.json</b> und die dazugehörigen PDFs aus (mit gedrückter Befehlstaste mehrere anklicken).'),
    ('Mit demselben Konto wie die Buchhaltung. Danach sind die Rechnungen auf iPhone und Mac gleich.', 'Mit Ihrer E-Mail und Ihrem Passwort. Danach sind die Rechnungen auf iPhone und Mac gleich.'),
    # Nur Rechnungen: kein Weg zur Buchhaltung, eigener Offline-Speicher bleibt in diesem Ordner
    ("navigator.serviceWorker.register('../sw.js', { scope: '../' })", "navigator.serviceWorker.register('sw.js', { scope: './' })"),
]:
    d = ers(d, alt, neu)
# Nur auf dem Gerät: keine Verbindung zu Supabase, kein Login, kein Abgleich
d = re.sub(r"  const sb = window\.supabase\.createClient\(URL_PROJEKT, SCHLUESSEL, \{.*?\}\);\n", """  // Diese Fassung speichert nur auf dem Gerät: ein stiller Ersatz statt der Datenbank
  const leer = async () => ({ data: null, error: null });
  const sb = { auth: { onAuthStateChange() {}, signInWithPassword: leer, signOut: leer },
    storage: { from: () => ({ download: leer, upload: leer, remove: leer }) },
    from: () => ({ upsert: leer, select: () => ({ in: () => ({ gt: () => ({ order: () => ({ range: async () => ({ data: [], error: null }) }) }) }) }) }) };
""", d, flags=re.S)
assert "createClient" not in d
d = re.sub(r"  const URL_PROJEKT = '[^']+';\n  const SCHLUESSEL = '[^']+';\n", '', d)
d = re.sub(r"\A// .*?\n\(\(\) => \{", "// Ersetzt im Browser den lokalen Mac-Dienst der Rechnungs-App.\n// Diese Fassung speichert Rechnungen, Entwürfe, Kunden und PDFs nur auf dem Gerät (IndexedDB).\n(() => {", d, count=1, flags=re.S)
assert 'dyepnomhidubsfwyorke' not in d
d = ers(d, ".nr-status{position:fixed;", ".nr-status{display:none!important;position:fixed;")
d = re.sub(r"      if \(!liste\.length && !alle_\.length\) \{.*?\n        return;\n      \}\n",
           "      if (!liste.length && !alle_.length) { box.innerHTML = '<p class=\"nr-ue-leer\">Noch keine Rechnungen. Sobald Sie eine Rechnung sichern, erscheint sie hier.</p>'; return; }\n", d, flags=re.S)
assert 'Rechnungen vom Mac übernehmen' not in d.split('function importieren')[0].split('uebersichtZeigen')[1]
d = re.sub(r"    // Zurück zur Buchhaltung, gleich über dem Logo\n.*?kopf\.parentNode\.insertBefore\(z, kopf\);\n", '', d, flags=re.S)
assert 'Zur Buchhaltung' not in d
(ZIEL / 'dienst.js').write_text(d)

(ZIEL / 'manifest.webmanifest').write_text(json.dumps({
    'name': f"{F['kurz']} Rechnungen", 'short_name': 'Rechnungen', 'start_url': './', 'scope': './', 'display': 'standalone',
    'background_color': '#F7F9FD', 'theme_color': '#F7F9FD', 'lang': 'de-CH',
    'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'}],
}, ensure_ascii=False, indent=2) + '\n')

# Eigener, kleiner Offline-Speicher nur für diesen Ordner
(ZIEL / 'sw.js').write_text("""// Hält die Fati-Rechnungen offline verfügbar. Bei jeder neuen Fassung VERSION erhöhen.
const VERSION = 'fati-1';
const DATEIEN = ['./', 'index.html', 'dienst.js', 'logo.png', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest',
  '../lib/html2canvas.min.js', '../lib/jspdf.umd.min.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n.startsWith('fati-') && n !== VERSION).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});
// Zuerst das Netz, damit Änderungen sofort ankommen; ohne Netz aus dem Zwischenspeicher
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    const kopie = r.clone();
    caches.open(VERSION).then((c) => c.put(e.request, kopie));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
""")
print('Fati-Rechnungen gebaut in', ZIEL)
