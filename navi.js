// Gemeinsames Menü für Admin, Offerten, Rechnungen und Buchhaltung.
// Ein Knopf mit zwei Strichen öffnet links eine Seitenleiste, von der aus man zwischen allen Bereichen wechselt.
// Dazu eine einheitliche Kopfzeile: Menü-Knopf, Logo und Bereich links, die Knöpfe des Bereichs rechts.
// Einbinden: <script src="navi.js" data-hier="rechnungen" data-titel="Rechnungen" data-rechts="#kopfRechts"></script>
//   data-hier       welcher Bereich gerade offen ist (wird hervorgehoben)
//   data-titel      Name des Bereichs in der Kopfzeile
//   data-rechts     Element, dessen Inhalt rechts in die Kopfzeile wandert (optional)
//   data-kopf-in    Element, an dessen Anfang die Kopfzeile kommt (sonst ganz oben im body)
// Die Seite kann eigene Knöpfe rechts anfügen: NasuviaNavi.rechts(element)
// Elemente mit der Klasse nv-weg werden ausgeblendet, sobald die Kopfzeile da ist.
(function(){
  var skript = document.currentScript || {}, ds = skript.dataset || {};
  var MARKE = 'Nasuvia';
  var BEREICHE = [
    { id: 'admin', name: 'Anfragen', text: 'Admin, Anfragen von der Website', href: 'https://www.nasuvia.ch/admin/',
      icon: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>' },
    { id: 'offerten', name: 'Offerten', text: 'Erstellen, ablegen, senden', href: 'https://www.nasuvia.ch/admin/offerten/',
      icon: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h3"/><path d="m14.5 16.5 1.5 1.5 3-3"/>' },
    { id: 'rechnungen', name: 'Rechnungen', text: 'Schreiben und versenden', href: 'https://www.nasuvia.ch/buchhaltung/rechnungen/',
      icon: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>' },
    { id: 'buchhaltung', name: 'Buchhaltung', text: 'Einnahmen, Ausgaben, MWST', href: 'https://www.nasuvia.ch/buchhaltung/',
      icon: '<path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h13"/><path d="M9 8h6M9 12h4"/>' }
  ];
  var WEBSITE = { name: 'Website', text: 'www.nasuvia.ch', href: 'https://www.nasuvia.ch/' };
  var hier = ds.hier || '';

  var stil = document.createElement('style');
  stil.textContent = [
    '.nv-knopf{display:inline-grid;place-items:center;gap:6px;grid-auto-flow:column;height:40px;min-width:40px;padding:0 10px;border:0;border-radius:100px;background:#fff;color:#1C2A7B;cursor:pointer;font:600 .92rem inherit;font-family:inherit;box-shadow:0 1px 2px rgba(12,18,38,.06),0 8px 22px -12px rgba(28,42,123,.45);transition:transform .25s cubic-bezier(.3,1.5,.5,1),box-shadow .25s;flex:none;-webkit-tap-highlight-color:transparent}',
    '.nv-knopf:hover{transform:translateY(-1px);box-shadow:0 1px 2px rgba(12,18,38,.06),0 12px 26px -12px rgba(28,42,123,.55)}',
    '.nv-knopf:active{transform:scale(.94)}',
    '.nv-knopf svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}',
    '.nv-knopf svg path{transition:transform .35s cubic-bezier(.3,1.4,.5,1)}',
    '.nv-knopf:hover svg .nv-zwei{transform:translateX(3px)}',
    '.nv-schwebend{position:fixed;top:max(12px,env(safe-area-inset-top));right:14px;z-index:60}',
    '@media (min-width:821px){.nv-schwebend.nv-mobil{display:none}}',
    '.nv-kopfzeile{position:sticky;top:0;z-index:50;height:64px;background:rgba(247,249,253,.9);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid rgba(28,42,123,.1);font-family:"League Spartan",-apple-system,system-ui,sans-serif}',
    '.nv-kz{height:64px;display:flex;align-items:center;gap:12px;padding:0 clamp(14px,3vw,28px)}',
    '.nv-logo{display:inline-flex;align-items:center;gap:5px;text-decoration:none;padding:6px 8px 6px 4px;border-radius:100px}',
    '.nv-logo i{width:15px;height:15px;border-radius:50%;background:#1C2A7B;flex:none}',
    '.nv-logo img{height:18px;width:auto;display:block}',
    '.nv-bereich{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.68rem;font-weight:500;letter-spacing:.12em;text-transform:uppercase;line-height:1;background:#EEF1F8;color:#1C2A7B;border-radius:100px;padding:6px 10px}',
    '.nv-rechts{margin-left:auto;display:flex;gap:4px;align-items:center}',
    '.nv-rechts button,.nv-rechts a{display:inline-flex;align-items:center;gap:7px;height:40px;margin:0;padding:0 14px;border:0;border-radius:100px;background:none;box-shadow:none;color:#0C1226;font:500 .95rem "League Spartan",-apple-system,system-ui,sans-serif;text-decoration:none;white-space:nowrap;cursor:pointer;transition:background .2s}',
    '.nv-rechts button:hover,.nv-rechts a:hover{background:#EEF1F8}',
    '.nv-rechts svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
    '.nv-mit-kopf .nv-weg{display:none!important}',
    '.nv-umzug{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 10px;padding:10px 16px;background:#1C2A7B;color:#fff;text-decoration:none;font:500 .92rem "League Spartan",-apple-system,system-ui,sans-serif;text-align:center}',
    '.nv-umzug span{color:#8FA6FF;font-weight:600}',
    '@media (max-width:520px){.nv-bereich{display:none}.nv-rechts button,.nv-rechts a{padding:0 10px}}',
    '.nv-hinten{position:fixed;inset:0;z-index:9998;background:rgba(12,18,38,.32);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s}',
    '.nv-leiste{position:fixed;top:0;bottom:0;left:0;z-index:9999;width:min(320px,86vw);background:#F7F9FD;border-radius:0 26px 26px 0;box-shadow:30px 0 80px -30px rgba(12,18,38,.5);transform:translateX(-104%);transition:transform .42s cubic-bezier(.2,.9,.3,1);display:flex;flex-direction:column;padding:max(18px,env(safe-area-inset-top)) 16px max(18px,env(safe-area-inset-bottom));font-family:inherit;color:#0C1226;overflow-y:auto}',
    '.nv-offen .nv-hinten{opacity:1;visibility:visible}',
    '.nv-offen .nv-leiste{transform:none}',
    '.nv-kopf{display:flex;align-items:center;justify-content:space-between;padding:4px 4px 18px}',
    '.nv-marke{display:flex;align-items:center;gap:7px;font-weight:700;font-size:1.25rem;letter-spacing:-.02em;color:#0C1226}',
    '.nv-marke i{width:15px;height:15px;border-radius:50%;background:#1C2A7B;box-shadow:0 0 0 4px rgba(59,85,230,.14)}',
    '.nv-zu{width:38px;height:38px;border:0;border-radius:50%;background:#EEF1F8;color:#1C2A7B;cursor:pointer;display:grid;place-items:center}',
    '.nv-zu svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}',
    '.nv-titel{font-family:ui-monospace,"JetBrains Mono",monospace;font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;color:#8A90A3;margin:8px 8px 8px}',
    '.nv-ziel{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:16px;text-decoration:none;color:#0C1226;transition:background .2s,transform .25s cubic-bezier(.3,1.5,.5,1);opacity:0;transform:translateX(-14px)}',
    '.nv-offen .nv-ziel{opacity:1;transform:none;transition:background .2s,opacity .35s,transform .45s cubic-bezier(.2,.9,.3,1)}',
    '.nv-ziel:hover{background:rgba(59,85,230,.07)}',
    '.nv-ziel .nv-ic{width:42px;height:42px;border-radius:13px;flex:none;display:grid;place-items:center;background:linear-gradient(135deg,rgba(59,85,230,.14),rgba(143,166,255,.2));color:#1C2A7B}',
    '.nv-ziel .nv-ic svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
    '.nv-ziel b{display:block;font-size:1.02rem;line-height:1.2}',
    '.nv-ziel small{display:block;font-size:.8rem;color:#47506B;line-height:1.3;margin-top:2px}',
    '.nv-ziel.nv-hier{background:#fff;box-shadow:0 1px 2px rgba(12,18,38,.04),0 16px 34px -22px rgba(28,42,123,.45)}',
    '.nv-ziel.nv-hier .nv-ic{background:#3B55E6;color:#fff}',
    '.nv-ziel em{margin-left:auto;font-style:normal;font-family:ui-monospace,"JetBrains Mono",monospace;font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:#3B55E6;background:rgba(59,85,230,.1);border-radius:100px;padding:3px 8px}',
    '.nv-ziel .nv-pfeil{margin-left:auto;color:#3B55E6}',
    '.nv-trenner{height:1px;background:rgba(28,42,123,.1);margin:12px 8px}',
    '.nv-fuss{margin-top:auto;padding:16px 8px 0;font-size:.78rem;color:#8A90A3}',
    'html.nv-sperre,html.nv-sperre body{overflow:hidden}'
  ].join('\n');
  document.head.appendChild(stil);

  var svg = function(inhalt){ return '<svg viewBox="0 0 24 24" aria-hidden="true">' + inhalt + '</svg>'; };
  var huelle = document.createElement('div');
  huelle.className = 'nv';
  huelle.innerHTML = '<div class="nv-hinten" data-nv-zu></div>' +
    '<nav class="nv-leiste" aria-label="Bereiche" aria-hidden="true">' +
      '<div class="nv-kopf"><span class="nv-marke"><i></i>' + MARKE + '</span><button class="nv-zu" type="button" data-nv-zu aria-label="Menü schliessen">' + svg('<path d="M6 6l12 12M18 6 6 18"/>') + '</button></div>' +
      '<p class="nv-titel">Bereiche</p>' +
      BEREICHE.map(function(b, i){
        return '<a class="nv-ziel' + (b.id === hier ? ' nv-hier' : '') + '" href="' + b.href + '" style="transition-delay:' + (60 + i * 45) + 'ms">' +
          '<span class="nv-ic">' + svg(b.icon) + '</span><span><b>' + b.name + '</b><small>' + b.text + '</small></span>' + (b.id === hier ? '<em>Hier</em>' : '') + '</a>';
      }).join('') +
      '<div class="nv-trenner"></div>' +
      '<a class="nv-ziel" href="' + WEBSITE.href + '" target="_blank" rel="noopener" style="transition-delay:' + (60 + BEREICHE.length * 45) + 'ms"><span class="nv-ic">' + svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>') + '</span><span><b>' + WEBSITE.name + '</b><small>' + WEBSITE.text + '</small></span><span class="nv-pfeil">↗</span></a>' +
      '<p class="nv-fuss">Überall mit demselben Konto angemeldet.</p>' +
    '</nav>';

  var offen = false;
  function oeffnen(){
    if (!huelle.isConnected) document.body.appendChild(huelle);
    offen = true;
    requestAnimationFrame(function(){ huelle.classList.add('nv-offen'); });
    huelle.querySelector('.nv-leiste').setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('nv-sperre');
    setTimeout(function(){ var z = huelle.querySelector('.nv-hier') || huelle.querySelector('.nv-ziel'); z && z.focus({ preventScroll: true }); }, 200);
  }
  function schliessen(){
    offen = false;
    huelle.classList.remove('nv-offen');
    huelle.querySelector('.nv-leiste').setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('nv-sperre');
  }
  huelle.addEventListener('click', function(e){
    if (e.target.closest('[data-nv-zu]')) { schliessen(); return; }
    var a = e.target.closest('a.nv-hier'); if (a) { e.preventDefault(); schliessen(); }
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && offen) schliessen(); });
  // Mit dem Finger nach links wischen schliesst die Leiste
  var startX = null;
  huelle.addEventListener('touchstart', function(e){ startX = e.touches[0].clientX; }, { passive: true });
  huelle.addEventListener('touchend', function(e){ if (startX != null && e.changedTouches[0].clientX - startX < -60) schliessen(); startX = null; }, { passive: true });

  function knopf(text){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'nv-knopf';
    b.setAttribute('aria-label', 'Menü öffnen');
    b.innerHTML = svg('<path d="M4 9h16"/><path class="nv-zwei" d="M4 15h10"/>') + (text ? '<span>' + text + '</span>' : '');
    b.addEventListener('click', oeffnen);
    return b;
  }
  window.NasuviaNavi = { knopf: knopf, oeffnen: oeffnen, schliessen: schliessen };

  // Kopfzeile
  var kopfzeile = document.createElement('header'), rechtsSlot = document.createElement('div');
  kopfzeile.className = 'nv-kopfzeile';
  rechtsSlot.className = 'nv-rechts';
  function rechts(el){ rechtsSlot.appendChild(el); return el; }
  window.NasuviaNavi.rechts = rechts;

  function einbauen(){
    document.body.appendChild(huelle);
    if (ds.titel) {
      var kz = document.createElement('div'); kz.className = 'nv-kz';
      kz.appendChild(knopf());
      kz.insertAdjacentHTML('beforeend', '<a class="nv-logo" href="https://www.nasuvia.ch/admin/" aria-label="Nasuvia Admin"><i></i><img src="https://www.nasuvia.ch/logo-wort.png" alt="Nasuvia" width="94" height="18"></a><span class="nv-bereich">' + ds.titel + '</span>');
      kz.appendChild(rechtsSlot);
      kopfzeile.appendChild(kz);
      if (ds.rechts) { var quelle = document.querySelector(ds.rechts); if (quelle) { while (quelle.firstChild) rechtsSlot.appendChild(quelle.firstChild); quelle.remove(); } }
      var ort = ds.kopfIn ? document.querySelector(ds.kopfIn) : document.body;
      ort.insertBefore(kopfzeile, ort.firstChild);
      document.body.classList.add('nv-mit-kopf');
    }
    // Alte Adresse: Hinweis auf die neue unter nasuvia.ch
    if (/github\.io$/.test(location.hostname) && /nasuvia-buchhaltung/.test(location.pathname)) {
      var neu = 'https://www.nasuvia.ch/buchhaltung/' + location.pathname.replace(/^.*nasuvia-buchhaltung\//, '');
      var h = document.createElement('a');
      h.href = neu; h.className = 'nv-umzug';
      h.innerHTML = '<b>Neue Adresse:</b> www.nasuvia.ch/buchhaltung <span>Jetzt öffnen →</span>';
      document.body.insertBefore(h, document.body.firstChild);
    }
    if (ds.einfuegen) [].forEach.call(document.querySelectorAll(ds.einfuegen), function(z){ z.insertBefore(knopf(), z.firstChild); });
    if (ds.schwebend) {
      var s = knopf();
      s.classList.add('nv-schwebend');
      if (ds.schwebend === 'mobil') s.classList.add('nv-mobil');
      document.body.appendChild(s);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', einbauen); else einbauen();
})();
