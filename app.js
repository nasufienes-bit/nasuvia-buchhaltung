// Nasuvia Buchhaltung: Einnahmen, Ausgaben, Belege, MWST (effektive Methode) und Jahresabschluss.
(() => {
  'use strict';

  /* ================= Grunddaten ================= */
  // ziffer: wohin die Vorsteuer im MWST-Formular gehört (400 Material/Dienstleistungen, 405 Investitionen/übriger Aufwand)
  const KAT_AUS = [
    { id: 'material', name: 'Material', ziffer: 400, satz: 8.1 },
    { id: 'fremd', name: 'Subunternehmer und Fremdarbeiten', ziffer: 400, satz: 8.1 },
    { id: 'werkzeug', name: 'Werkzeug und Kleingeräte', ziffer: 405, satz: 8.1 },
    { id: 'anschaffung', name: 'Anschaffungen (Geräte, Maschinen)', ziffer: 405, satz: 8.1 },
    { id: 'fahrzeug', name: 'Fahrzeug (Benzin, Service, Leasing)', ziffer: 405, satz: 8.1 },
    { id: 'telefon', name: 'Telefon und Internet', ziffer: 405, satz: 8.1 },
    { id: 'software', name: 'Software und Abos', ziffer: 405, satz: 8.1 },
    { id: 'buero', name: 'Miete und Büro', ziffer: 405, satz: 8.1 },
    { id: 'werbung', name: 'Werbung und Website', ziffer: 405, satz: 8.1 },
    { id: 'spesen', name: 'Spesen und Verpflegung', ziffer: 405, satz: 8.1 },
    { id: 'weiterbildung', name: 'Weiterbildung', ziffer: 405, satz: 8.1 },
    { id: 'versicherung', name: 'Versicherungen', ziffer: 405, satz: 0 },
    { id: 'bank', name: 'Bank- und Kartengebühren', ziffer: 405, satz: 0 },
    { id: 'gebuehren', name: 'Gebühren und Abgaben', ziffer: 405, satz: 0 },
    { id: 'uebrig', name: 'Übriges', ziffer: 405, satz: 8.1 },
  ];
  const KAT_EIN = [
    { id: 'dienstleistung', name: 'Dienstleistungen', satz: 8.1 },
    { id: 'materialverkauf', name: 'Materialverkauf', satz: 8.1 },
    { id: 'uebrig-ein', name: 'Übrige Einnahmen', satz: 8.1 },
  ];
  const SAETZE = [8.1, 2.6, 3.8, 0];
  const ZAHLUNG = ['Bank', 'Karte', 'TWINT', 'Bar'];
  const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  const ICON = {
    uebersicht: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    buchungen: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    mwst: '<svg viewBox="0 0 24 24"><path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></svg>',
    abschluss: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></svg>',
    mehr: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  };
  const ANSICHTEN = [
    ['uebersicht', 'Übersicht'], ['buchungen', 'Buchungen'], ['mwst', 'MWST'], ['abschluss', 'Abschluss'], ['mehr', 'Einstellungen'],
  ];

  /* ================= Hilfen ================= */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const zahl = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const chf = (r) => zahl.format((r || 0) / 100);
  const chfVoll = (r) => 'CHF ' + chf(r);
  const heute = () => new Date().toLocaleDateString('sv-SE');
  const datumKurz = (d) => (d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '');
  const quartalVon = (d) => Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1;
  const katAus = (id) => KAT_AUS.find((k) => k.id === id) || KAT_AUS[KAT_AUS.length - 1];
  const katName = (b) => (b.typ === 'ausgabe' ? katAus(b.kategorie).name : (KAT_EIN.find((k) => k.id === b.kategorie) || KAT_EIN[0]).name);
  const netto = (b) => (b.betragRappen || 0) - (b.mwstRappen || 0);
  const mwstAus = (brutto, satz) => Math.round(brutto * satz / (100 + satz));

  function betragLesen(text) {
    let t = String(text || '').trim().replace(/[’'\s]/g, '').replace(/^CHF/i, '');
    if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
    t = t.replace(/,/g, '');
    const n = Number(t);
    return Number.isFinite(n) ? Math.round(n * 100) : NaN;
  }

  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('zeigen');
    clearTimeout(toast.z);
    toast.z = setTimeout(() => t.classList.remove('zeigen'), 2600);
  }

  function herunterladen(name, inhalt, typ) {
    const blob = inhalt instanceof Blob ? inhalt : new Blob([inhalt], { type: typ });
    const datei = new File([blob], name, { type: blob.type });
    if (navigator.canShare && /iPhone|iPad/.test(navigator.userAgent) && navigator.canShare({ files: [datei] })) {
      navigator.share({ files: [datei] }).catch(() => {});
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function dateiWaehlen(accept) {
    return new Promise((ok) => {
      const inp = $('dateiWahl');
      inp.value = '';
      inp.accept = accept;
      inp.onchange = () => ok(inp.files[0] || null);
      inp.click();
    });
  }

  /* ================= Zustand ================= */
  const Z = {
    buchungen: [],
    einst: { id: 'haupt', abrechnung: 'vereinbart' },
    ansicht: 'uebersicht',
    jahr: String(new Date().getFullYear()),
    quartal: quartalVon(heute()),
    filter: { typ: 'alle', monat: '', kat: '', suche: '' },
  };
  try { const a = localStorage.getItem('nb.ansicht'); if (a && ANSICHTEN.some(([id]) => id === a)) Z.ansicht = a; } catch {}

  async function laden() {
    Z.buchungen = await Speicher.alle('buchungen');
    const e = await Speicher.holen('einstellungen', 'haupt');
    if (e) Z.einst = { ...Z.einst, ...e };
  }

  const jahre = () => {
    const s = new Set(Z.buchungen.map((b) => (b.datum || '').slice(0, 4)).filter(Boolean));
    s.add(String(new Date().getFullYear()));
    return [...s].sort().reverse();
  };
  const imJahr = (j) => Z.buchungen.filter((b) => (b.datum || '').startsWith(j));
  const sortiert = (l) => [...l].sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || (b.geaendert || '').localeCompare(a.geaendert || ''));
  const istOffen = (b) => b.typ === 'einnahme' && b.quelle === 'rechnung' && !b.bezahlt;

  /* ================= Navigation ================= */
  function navZeichnen() {
    $('navPc').innerHTML = ANSICHTEN.map(([id, name]) =>
      `<button class="nav-knopf ${Z.ansicht === id ? 'aktiv' : ''}" data-ansicht="${id}">${ICON[id]}${name}</button>`).join('');
    $('navHandy').innerHTML = ANSICHTEN.map(([id, name]) =>
      `<button class="${Z.ansicht === id ? 'aktiv' : ''}" data-ansicht="${id}">${ICON[id]}${id === 'mehr' ? 'Mehr' : name}</button>`).join('');
  }
  document.addEventListener('click', (e) => {
    const k = e.target.closest('[data-ansicht]');
    if (!k) return;
    Z.ansicht = k.dataset.ansicht;
    try { localStorage.setItem('nb.ansicht', Z.ansicht); } catch {}
    zeichnen();
    window.scrollTo(0, 0);
  });
  $('fab').addEventListener('click', () => buchungBearbeiten());

  function jahrWahl() {
    return `<select class="auswahl-klein" data-jahr>${jahre().map((j) => `<option ${j === Z.jahr ? 'selected' : ''}>${j}</option>`).join('')}</select>`;
  }
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-jahr]')) { Z.jahr = e.target.value; zeichnen(); }
  });

  function zeichnen() {
    navZeichnen();
    const f = { uebersicht: uebersicht, buchungen: buchungenAnsicht, mwst: mwstAnsicht, abschluss: abschluss, mehr: mehr }[Z.ansicht];
    $('inhalt').innerHTML = f();
    statusZeigen();
  }

  function statusText() {
    if (!window.Abgleich || !Abgleich.benutzer) return 'Nur auf diesem Gerät gespeichert';
    if (Abgleich.laeuft) return 'Wird abgeglichen …';
    if (Abgleich.fehler) return Abgleich.fehler;
    const z = Abgleich.zuletzt;
    return z ? `Abgeglichen um ${new Date(z).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}` : 'Angemeldet';
  }

  function statusZeigen() {
    const offen = Z.buchungen.filter(istOffen).length;
    $('speicherInfo').innerHTML = `${Z.buchungen.length} Buchungen${offen ? `, ${offen} offen` : ''}<br>${esc(statusText())}`;
    const s = document.querySelector('[data-abgleich-status]');
    if (s) s.textContent = statusText();
  }

  /* ================= Übersicht ================= */
  function summen(liste) {
    let ein = 0, aus = 0;
    for (const b of liste) {
      if (b.typ === 'einnahme') ein += netto(b); else aus += netto(b);
    }
    return { ein, aus, gewinn: ein - aus };
  }

  function uebersicht() {
    const liste = imJahr(Z.jahr);
    const s = summen(liste);
    const offen = Z.buchungen.filter(istOffen);
    const offenSumme = offen.reduce((a, b) => a + b.betragRappen, 0);
    const ohneBeleg = liste.filter((b) => b.typ === 'ausgabe' && !b.belegId).length;

    // Monatsbalken (netto)
    const m = Array.from({ length: 12 }, () => ({ ein: 0, aus: 0 }));
    for (const b of liste) {
      const i = Number(b.datum.slice(5, 7)) - 1;
      if (b.typ === 'einnahme') m[i].ein += netto(b); else m[i].aus += netto(b);
    }
    const max = Math.max(1, ...m.map((x) => Math.max(x.ein, x.aus)));
    const balken = m.map((x, i) => `<div class="balken-monat" title="${MONATE[i]}: Einnahmen ${chf(x.ein)}, Ausgaben ${chf(x.aus)}">
      <div class="balken-paar"><i class="ein" style="height:${(x.ein / max) * 100}%"></i><i class="aus" style="height:${(x.aus / max) * 100}%"></i></div>
      <span>${MONATE[i].slice(0, 1)}</span></div>`).join('');

    // Ausgaben nach Kategorie
    const kat = {};
    for (const b of liste) if (b.typ === 'ausgabe') kat[b.kategorie] = (kat[b.kategorie] || 0) + netto(b);
    const katListe = Object.entries(kat).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const katMax = Math.max(1, ...katListe.map((k) => k[1]));

    // MWST im laufenden Quartal
    const jetztJahr = String(new Date().getFullYear());
    const q = quartalVon(heute());
    const mw = mwstRechnen(jetztJahr, q);

    return `
    <div class="kopf">
      <div><h1>Übersicht</h1><p class="unter">Alle Beträge ohne MWST</p></div>
      <div class="kopf-aktionen">${jahrWahl()}<a class="btn" href="rechnungen/" style="text-decoration:none">Rechnung schreiben</a><button class="btn btn-haupt nur-pc" onclick="NB.neu()">+ Neue Buchung</button></div>
    </div>
    <div class="raster raster-4">
      <div class="card kennzahl"><div class="label">Einnahmen</div><div class="wert">${chf(s.ein)}</div><div class="klein">CHF im Jahr ${Z.jahr}</div></div>
      <div class="card kennzahl"><div class="label">Ausgaben</div><div class="wert">${chf(s.aus)}</div><div class="klein">CHF im Jahr ${Z.jahr}</div></div>
      <div class="card kennzahl"><div class="label">Gewinn</div><div class="wert ${s.gewinn < 0 ? 'minus' : 'plus'}">${chf(s.gewinn)}</div><div class="klein">Einnahmen minus Ausgaben</div></div>
      <div class="card kennzahl"><div class="label">Offene Rechnungen</div><div class="wert">${chf(offenSumme)}</div><div class="klein">${offen.length} ${offen.length === 1 ? 'Rechnung' : 'Rechnungen'} noch nicht bezahlt</div></div>
    </div>
    <div class="raster raster-2 abstand">
      <div class="card">
        <h2>Monate ${Z.jahr}</h2>
        <div class="balken">${balken}</div>
        <div class="legende"><span><i style="background:var(--elektrik)"></i>Einnahmen</span><span><i style="background:rgba(28,42,123,.22)"></i>Ausgaben</span></div>
      </div>
      <div class="card">
        <h2>MWST ${q}. Quartal ${jetztJahr}</h2>
        <table>
          <tr><td>MWST auf Ihren Einnahmen</td><td class="b">${chf(mw.steuer)}</td></tr>
          <tr><td>Vorsteuer auf Ihren Ausgaben</td><td class="b">minus ${chf(mw.vorsteuer)}</td></tr>
          <tr class="summe"><td>${mw.zahlen >= 0 ? 'Voraussichtlich zu bezahlen' : 'Guthaben'}</td><td class="b">${chf(Math.abs(mw.zahlen))}</td></tr>
        </table>
        <p class="hinweis abstand">Einreichen bis ${datumKurz(fristVon(jetztJahr, q))}. <button class="link" data-ansicht="mwst">Zur Abrechnung</button></p>
      </div>
    </div>
    <div class="raster raster-2 abstand">
      <div class="card">
        <h2>Ausgaben nach Kategorie</h2>
        ${katListe.length ? katListe.map(([id, r]) => `<div class="kat-zeile"><span>${esc(katAus(id).name)}</span><span class="num">${chf(r)}</span><div class="spur"><i style="width:${(r / katMax) * 100}%"></i></div></div>`).join('')
          : '<p class="leer">Noch keine Ausgaben in diesem Jahr.</p>'}
      </div>
      <div class="card">
        <h2>Zuletzt erfasst</h2>
        ${ohneBeleg ? `<p class="hinweis" style="margin:-4px 0 8px"><span class="marke marke-offen">${ohneBeleg} ${ohneBeleg === 1 ? 'Ausgabe' : 'Ausgaben'} ohne Beleg</span></p>` : ''}
        ${zeilen(sortiert(liste).slice(0, 6)) || '<p class="leer">Noch nichts erfasst. Tippen Sie auf „+“, um die erste Buchung zu machen.</p>'}
      </div>
    </div>`;
  }

  /* ================= Buchungen ================= */
  function zeilen(liste) {
    return liste.length ? `<div class="liste">${liste.map((b) => {
      const ein = b.typ === 'einnahme';
      const marke = istOffen(b) ? '<span class="marke marke-offen">offen</span>'
        : (b.quelle === 'rechnung' ? '<span class="marke marke-ok">bezahlt</span>' : '');
      const beleg = b.belegId ? '<span title="Beleg vorhanden">📎</span>' : '';
      return `<div class="zeile" data-buchung="${b.id}">
        <div class="datum">${datumKurz(b.datum)}</div>
        <div style="min-width:0">
          <div class="titel">${esc(b.text || b.partner || katName(b))}</div>
          <div class="info"><span class="nur-handy-datum">${datumKurz(b.datum)}</span><span>${esc(katName(b))}</span>${b.partner && b.text ? `<span>${esc(b.partner)}</span>` : ''}${marke}${beleg}</div>
        </div>
        <div class="betrag ${ein ? 'plus' : ''}">${ein ? '+' : '−'} ${chf(b.betragRappen)}<small>MWST ${chf(b.mwstRappen)}</small></div>
      </div>`;
    }).join('')}</div>` : '';
  }
  document.addEventListener('click', (e) => {
    const z = e.target.closest('[data-buchung]');
    if (z) buchungBearbeiten(Z.buchungen.find((b) => b.id === z.dataset.buchung));
  });

  function gefiltert() {
    const f = Z.filter;
    const q = f.suche.trim().toLowerCase();
    return sortiert(imJahr(Z.jahr).filter((b) =>
      (f.typ === 'alle' || (f.typ === 'offen' ? istOffen(b) : b.typ === f.typ))
      && (!f.monat || b.datum.slice(5, 7) === f.monat)
      && (!f.kat || b.kategorie === f.kat)
      && (!q || [b.text, b.partner, katName(b), b.rechnungNr, chf(b.betragRappen)].join(' ').toLowerCase().includes(q))));
  }

  function buchungenAnsicht() {
    const f = Z.filter;
    const liste = gefiltert();
    const s = summen(liste);
    const typen = [['alle', 'Alle'], ['ausgabe', 'Ausgaben'], ['einnahme', 'Einnahmen'], ['offen', 'Offen']];
    const kats = f.typ === 'einnahme' ? KAT_EIN : f.typ === 'ausgabe' ? KAT_AUS : [...KAT_AUS, ...KAT_EIN];
    return `
    <div class="kopf">
      <div><h1>Buchungen</h1><p class="unter">${liste.length} Einträge, Einnahmen ${chf(s.ein)}, Ausgaben ${chf(s.aus)} (ohne MWST)</p></div>
      <div class="kopf-aktionen">${jahrWahl()}<button class="btn btn-haupt nur-pc" onclick="NB.neu()">+ Neue Buchung</button></div>
    </div>
    <div class="filter">
      <div class="segment">${typen.map(([id, n]) => `<button class="${f.typ === id ? 'an' : ''}" data-ftyp="${id}">${n}</button>`).join('')}</div>
      <select class="auswahl-klein" data-fmonat><option value="">Alle Monate</option>${MONATE.map((n, i) => { const v = String(i + 1).padStart(2, '0'); return `<option value="${v}" ${f.monat === v ? 'selected' : ''}>${n}</option>`; }).join('')}</select>
      <select class="auswahl-klein" data-fkat><option value="">Alle Kategorien</option>${kats.map((k) => `<option value="${k.id}" ${f.kat === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select>
      <input type="search" placeholder="Suchen" value="${esc(f.suche)}" data-fsuche />
    </div>
    <div class="card">${zeilen(liste) || '<p class="leer">Keine Buchungen gefunden.</p>'}</div>`;
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-ftyp]');
    if (t) { Z.filter.typ = t.dataset.ftyp; Z.filter.kat = ''; zeichnen(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches('[data-fmonat]')) { Z.filter.monat = e.target.value; zeichnen(); }
    if (e.target.matches('[data-fkat]')) { Z.filter.kat = e.target.value; zeichnen(); }
  });
  document.addEventListener('input', (e) => {
    if (!e.target.matches('[data-fsuche]')) return;
    Z.filter.suche = e.target.value;
    const pos = e.target.selectionStart;
    zeichnen();
    const neu = document.querySelector('[data-fsuche]');
    neu.focus();
    neu.setSelectionRange(pos, pos);
  });

  /* ================= Buchung erfassen / bearbeiten ================= */
  async function buchungBearbeiten(vorhanden) {
    const b = vorhanden ? { ...vorhanden } : {
      typ: 'ausgabe', datum: heute(), kategorie: 'material', mwstSatz: 8.1, zahlung: 'Bank', quelle: 'manuell',
    };
    let beleg = b.belegId ? await Speicher.holen('belege', b.belegId) : null;
    let neuerBeleg = null;
    let mwstVonHand = vorhanden != null;
    const partner = [...new Set(Z.buchungen.map((x) => x.partner).filter(Boolean))].sort();
    const dlg = $('dlg');

    const katOptionen = () => (b.typ === 'ausgabe' ? KAT_AUS : KAT_EIN)
      .map((k) => `<option value="${k.id}" ${b.kategorie === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('');

    function belegHtml() {
      const x = neuerBeleg || beleg;
      if (!x || !x.daten) return `<div class="beleg-feld"><p class="hinweis" style="margin-bottom:10px">Foto der Quittung oder PDF</p><button type="button" class="btn" data-beleg-neu>📷 Beleg hinzufügen</button></div>`;
      const bild = x.typ && x.typ.startsWith('image/') ? `<img src="${URL.createObjectURL(x.daten)}" alt="Beleg" />` : '';
      return `<div class="beleg-feld">${bild}<div class="beleg-name">${esc(x.name || 'Beleg')}</div>
        <button type="button" class="btn btn-klein" data-beleg-zeigen>Ansehen</button>
        <button type="button" class="btn btn-klein" data-beleg-neu>Ersetzen</button>
        <button type="button" class="btn btn-klein btn-rot" data-beleg-weg>Entfernen</button></div>`;
    }

    function formular() {
      const ein = b.typ === 'einnahme';
      const rechnung = b.quelle === 'rechnung';
      dlg.innerHTML = `
      <form method="dialog" id="bForm">
        <div class="dlg-kopf"><h3>${vorhanden ? 'Buchung bearbeiten' : 'Neue Buchung'}</h3><button type="button" class="x" data-zu aria-label="Schliessen">×</button></div>
        <div class="dlg-inhalt">
          ${rechnung ? `<p class="hinweis"><span class="marke marke-info">Rechnung ${esc(b.rechnungNr || '')}</span> aus der Rechnungs-App</p>`
            : `<div class="segment"><button type="button" class="${!ein ? 'an' : ''}" data-btyp="ausgabe">Ausgabe</button><button type="button" class="${ein ? 'an' : ''}" data-btyp="einnahme">Einnahme</button></div>`}
          <div class="feld-zeile">
            <div class="feld"><label for="fBetrag">Betrag inkl. MWST (CHF)</label><input type="text" id="fBetrag" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${b.betragRappen != null ? chf(b.betragRappen).replace(/’/g, '') : ''}" required /></div>
            <div class="feld"><label for="fDatum">Datum</label><input type="date" id="fDatum" value="${b.datum}" required /></div>
          </div>
          <div class="feld-zeile">
            <div class="feld"><label for="fSatz">MWST-Satz</label><select id="fSatz">${SAETZE.map((s) => `<option value="${s}" ${Number(b.mwstSatz) === s ? 'selected' : ''}>${s ? s.toFixed(1) + ' %' : 'ohne MWST'}</option>`).join('')}</select></div>
            <div class="feld"><label for="fMwst">${ein ? 'MWST' : 'Vorsteuer'} (CHF)</label><input type="text" id="fMwst" inputmode="decimal" autocomplete="off" value="${b.mwstRappen != null ? chf(b.mwstRappen).replace(/’/g, '') : ''}" /></div>
          </div>
          <div class="feld"><label for="fKat">Kategorie</label><select id="fKat">${katOptionen()}</select></div>
          <div class="feld"><label for="fText">Beschreibung</label><input type="text" id="fText" value="${esc(b.text || '')}" placeholder="${ein ? 'z. B. Spleissarbeiten Winterthur' : 'z. B. Kabel und OTO-Dosen'}" /></div>
          <div class="feld-zeile">
            <div class="feld"><label for="fPartner">${ein ? 'Kunde' : 'Lieferant'}</label><input type="text" id="fPartner" list="partnerListe" value="${esc(b.partner || '')}" /><datalist id="partnerListe">${partner.map((p) => `<option value="${esc(p)}">`).join('')}</datalist></div>
            <div class="feld"><label for="fZahlung">Bezahlt mit</label><select id="fZahlung">${ZAHLUNG.map((z) => `<option ${b.zahlung === z ? 'selected' : ''}>${z}</option>`).join('')}</select></div>
          </div>
          ${rechnung ? `<div class="feld-zeile">
            <label class="haken"><input type="checkbox" id="fBezahlt" ${b.bezahlt ? 'checked' : ''} />Rechnung ist bezahlt</label>
            <div class="feld"><label for="fBezahltAm">Bezahlt am</label><input type="date" id="fBezahltAm" value="${b.bezahltAm || ''}" ${b.bezahlt ? '' : 'disabled'} /></div>
          </div>` : ''}
          <div id="belegBox">${belegHtml()}</div>
        </div>
        <div class="dlg-fuss">
          ${vorhanden ? '<button type="button" class="btn btn-rot" data-loeschen>Löschen</button>' : ''}
          <div class="rechts"><button type="button" class="btn" data-zu>Abbrechen</button><button type="submit" class="btn btn-haupt">Speichern</button></div>
        </div>
      </form>`;
    }

    function mwstNachfuehren() {
      if (mwstVonHand) return;
      const brutto = betragLesen($('fBetrag').value);
      const satz = Number($('fSatz').value);
      $('fMwst').value = Number.isFinite(brutto) ? chf(mwstAus(brutto, satz)).replace(/’/g, '') : '';
    }

    function felderMerken() {
      if (!$('fBetrag')) return;
      const r = betragLesen($('fBetrag').value);
      b.betragRappen = Number.isFinite(r) ? r : null;
      b.datum = $('fDatum').value;
      b.mwstSatz = Number($('fSatz').value);
      const m = betragLesen($('fMwst').value);
      b.mwstRappen = Number.isFinite(m) ? m : null;
      b.kategorie = $('fKat').value;
      b.text = $('fText').value.trim();
      b.partner = $('fPartner').value.trim();
      b.zahlung = $('fZahlung').value;
      if ($('fBezahlt')) { b.bezahlt = $('fBezahlt').checked; b.bezahltAm = b.bezahlt ? ($('fBezahltAm').value || heute()) : ''; }
    }

    formular();
    dlg.showModal();
    if (!vorhanden && !matchMedia('(max-width: 820px)').matches) $('fBetrag').focus();

    dlg.oninput = (e) => {
      if (e.target.id === 'fMwst') mwstVonHand = true;
      if (e.target.id === 'fBetrag') mwstNachfuehren();
    };
    dlg.onchange = (e) => {
      if (e.target.id === 'fSatz') { mwstVonHand = false; mwstNachfuehren(); }
      if (e.target.id === 'fKat' && !vorhanden) {
        const k = (b.typ === 'ausgabe' ? KAT_AUS : KAT_EIN).find((x) => x.id === e.target.value);
        if (k) { $('fSatz').value = String(k.satz); mwstVonHand = false; mwstNachfuehren(); }
      }
      if (e.target.id === 'fBezahlt') {
        $('fBezahltAm').disabled = !e.target.checked;
        if (e.target.checked && !$('fBezahltAm').value) $('fBezahltAm').value = heute();
      }
    };
    dlg.onclick = async (e) => {
      const t = e.target.closest('button');
      if (e.target === dlg) { dlg.close(); return; }
      if (!t) return;
      if (t.matches('[data-zu]')) dlg.close();
      if (t.matches('[data-btyp]')) {
        felderMerken();
        b.typ = t.dataset.btyp;
        b.kategorie = b.typ === 'ausgabe' ? 'material' : 'dienstleistung';
        formular();
      }
      if (t.matches('[data-beleg-neu]')) {
        const datei = await dateiWaehlen('image/*,application/pdf');
        if (!datei) return;
        neuerBeleg = await belegVorbereiten(datei);
        $('belegBox').innerHTML = belegHtml();
      }
      if (t.matches('[data-beleg-weg]')) {
        neuerBeleg = null; beleg = null;
        $('belegBox').innerHTML = belegHtml();
      }
      if (t.matches('[data-beleg-zeigen]')) belegZeigen(neuerBeleg || beleg);
      if (t.matches('[data-loeschen]')) {
        if (!confirm('Diese Buchung wirklich löschen?')) return;
        await Speicher.loeschen('buchungen', b.id);
        if (b.belegId) await Speicher.loeschen('belege', b.belegId);
        dlg.close();
        await neuLaden('Buchung gelöscht');
      }
    };
    $('bForm').onsubmit = async (e) => {
      e.preventDefault();
      felderMerken();
      if (!Number.isFinite(b.betragRappen) || b.betragRappen === null || b.betragRappen <= 0) { $('fBetrag').focus(); toast('Bitte einen Betrag eingeben'); return; }
      if (!b.datum) { $('fDatum').focus(); return; }
      if (b.mwstRappen == null) b.mwstRappen = mwstAus(b.betragRappen, b.mwstSatz);
      if (neuerBeleg) {
        if (b.belegId) await Speicher.loeschen('belege', b.belegId);
        const gespeichert = await Speicher.speichern('belege', neuerBeleg);
        b.belegId = gespeichert.id;
      } else if (!beleg && b.belegId) {
        await Speicher.loeschen('belege', b.belegId);
        b.belegId = null;
      }
      await Speicher.speichern('buchungen', b);
      dlg.close();
      await neuLaden(vorhanden ? 'Gespeichert' : (b.typ === 'ausgabe' ? 'Ausgabe erfasst' : 'Einnahme erfasst'));
    };
  }

  async function belegVorbereiten(datei) {
    let daten = datei, typ = datei.type || 'application/octet-stream';
    if (typ.startsWith('image/')) {
      try { daten = await bildVerkleinern(datei); typ = 'image/jpeg'; } catch { /* Original behalten */ }
    }
    const name = typ === 'image/jpeg' && !/\.jpe?g$/i.test(datei.name) ? datei.name.replace(/\.[^.]+$/, '') + '.jpg' : datei.name;
    return { name: name || 'Beleg', typ, daten };
  }

  function bildVerkleinern(datei) {
    return new Promise((ok, fehler) => {
      const img = new Image();
      const url = URL.createObjectURL(datei);
      img.onload = () => {
        const max = 1800;
        const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * f);
        c.height = Math.round(img.naturalHeight * f);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((blob) => (blob ? ok(blob) : fehler(new Error('leer'))), 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error('Bild')); };
      img.src = url;
    });
  }

  function belegZeigen(x) {
    if (!x || !x.daten) return;
    const url = URL.createObjectURL(x.daten);
    if (!x.typ.startsWith('image/')) { window.open(url, '_blank'); return; }
    const dlg = $('dlg2');
    dlg.innerHTML = `<div class="dlg-kopf"><h3>${esc(x.name)}</h3><button type="button" class="x" data-zurueck aria-label="Schliessen">×</button></div>
      <div class="dlg-inhalt"><img class="beleg-ansicht" src="${url}" alt="Beleg" /></div>
      <div class="dlg-fuss"><div class="rechts"><button class="btn" data-laden>Herunterladen</button><button class="btn btn-haupt" data-zurueck>Schliessen</button></div></div>`;
    dlg.onclick = (e) => {
      const t = e.target.closest('button');
      if (e.target === dlg) { dlg.close(); return; }
      if (!t) return;
      if (t.matches('[data-laden]')) herunterladen(x.name, x.daten);
      if (t.matches('[data-zurueck]')) dlg.close();
    };
    dlg.onclose = () => URL.revokeObjectURL(url);
    dlg.showModal();
  }

  async function neuLaden(meldung) {
    await laden();
    zeichnen();
    if (meldung) toast(meldung);
  }

  /* ================= MWST ================= */
  function fristVon(jahr, q) {
    // 60 Tage nach Ende der Abrechnungsperiode
    const ende = new Date(Number(jahr), q * 3, 0);
    ende.setDate(ende.getDate() + 60);
    return ende.toLocaleDateString('sv-SE');
  }

  function mwstRechnen(jahr, q) {
    const vereinnahmt = Z.einst.abrechnung === 'vereinnahmt';
    const imQuartal = (d) => d && d.startsWith(jahr) && quartalVon(d) === q;
    const ein = Z.buchungen.filter((b) => b.typ === 'einnahme' && imQuartal(vereinnahmt && b.quelle === 'rechnung' ? (b.bezahlt ? b.bezahltAm : '') : b.datum));
    const aus = Z.buchungen.filter((b) => b.typ === 'ausgabe' && imQuartal(b.datum));
    const proSatz = {};
    for (const b of ein) {
      const s = Number(b.mwstSatz) || 0;
      proSatz[s] = proSatz[s] || { netto: 0, steuer: 0 };
      proSatz[s].netto += netto(b);
      proSatz[s].steuer += b.mwstRappen || 0;
    }
    const umsatz = ein.reduce((a, b) => a + netto(b), 0);
    const steuer = ein.reduce((a, b) => a + (b.mwstRappen || 0), 0);
    const v400 = aus.filter((b) => katAus(b.kategorie).ziffer === 400).reduce((a, b) => a + (b.mwstRappen || 0), 0);
    const v405 = aus.filter((b) => katAus(b.kategorie).ziffer === 405).reduce((a, b) => a + (b.mwstRappen || 0), 0);
    const ohneMwst = proSatz[0] ? proSatz[0].netto : 0;
    return { ein, aus, proSatz, umsatz, ohneMwst, steuer, v400, v405, vorsteuer: v400 + v405, zahlen: steuer - v400 - v405 };
  }

  function mwstAnsicht() {
    const q = Z.quartal;
    const r = mwstRechnen(Z.jahr, q);
    const zeile = (z, text, betrag, klasse = '') => `<tr class="${klasse}"><td class="z">${z}</td><td>${text}</td><td class="b">${betrag}</td></tr>`;
    const satzZeilen = [[8.1, '303', 'Normalsatz 8.1 %'], [2.6, '313', 'Reduzierter Satz 2.6 %'], [3.8, '343', 'Beherbergung 3.8 %']]
      .filter(([s]) => r.proSatz[s])
      .map(([s, z, n]) => `<tr><td class="z">${z}</td><td>${n}<br><span class="hinweis">Umsatz ${chf(r.proSatz[s].netto)}</span></td><td class="b">${chf(r.proSatz[s].steuer)}</td></tr>`).join('');
    const fehlend = r.aus.filter((b) => !b.belegId).length;
    return `
    <div class="kopf">
      <div><h1>MWST-Abrechnung</h1><p class="unter">Effektive Methode, ${Z.einst.abrechnung === 'vereinnahmt' ? 'nach vereinnahmten' : 'nach vereinbarten'} Entgelten</p></div>
      <div class="kopf-aktionen">${jahrWahl()}
        <div class="segment">${[1, 2, 3, 4].map((n) => `<button class="${q === n ? 'an' : ''}" data-quartal="${n}">Q${n}</button>`).join('')}</div>
      </div>
    </div>
    <div class="raster raster-2">
      <div class="card">
        <h2>Werte für das Formular der ESTV, ${q}. Quartal ${Z.jahr}</h2>
        <table>
          <tr><th>Ziffer</th><th></th><th class="b">CHF</th></tr>
          ${zeile('200', 'Total Umsatz (ohne MWST)', chf(r.umsatz))}
          ${r.ohneMwst ? zeile('', '<span class="hinweis">davon ohne MWST, bitte prüfen, unter welche Ziffer (220 bis 280) dieser Umsatz gehört</span>', chf(r.ohneMwst)) : ''}
          ${zeile('299', 'Steuerbarer Umsatz', chf(r.umsatz - r.ohneMwst))}
          ${satzZeilen || zeile('303', 'Normalsatz 8.1 %', '0.00')}
          ${zeile('399', 'Total geschuldete Steuer', chf(r.steuer), 'summe')}
          ${zeile('400', 'Vorsteuer auf Material und Dienstleistungen', chf(r.v400))}
          ${zeile('405', 'Vorsteuer auf Investitionen und übrigem Aufwand', chf(r.v405))}
          ${zeile('479', 'Total Vorsteuer', chf(r.vorsteuer), 'summe')}
          ${zeile(r.zahlen >= 0 ? '500' : '510', r.zahlen >= 0 ? 'Zu bezahlender Betrag' : 'Guthaben', chf(Math.abs(r.zahlen)), 'summe')}
        </table>
        <p class="hinweis abstand">Frist für Abrechnung und Zahlung: <strong>${datumKurz(fristVon(Z.jahr, q))}</strong>. Bitte die Werte vor dem Einreichen kurz prüfen.</p>
      </div>
      <div class="card">
        <h2>Woher die Zahlen kommen</h2>
        <div class="kennzahl"><div class="label">Einnahmen im Quartal</div><div class="wert">${r.ein.length}</div><div class="klein">Buchungen mit ${chf(r.steuer)} MWST</div></div>
        <div class="kennzahl abstand"><div class="label">Ausgaben im Quartal</div><div class="wert">${r.aus.length}</div><div class="klein">Buchungen mit ${chf(r.vorsteuer)} Vorsteuer</div></div>
        ${fehlend ? `<p class="abstand"><span class="marke marke-offen">${fehlend} ${fehlend === 1 ? 'Ausgabe' : 'Ausgaben'} ohne Beleg</span></p><p class="hinweis" style="margin-top:6px">Für den Vorsteuerabzug braucht es eine Quittung oder Rechnung. Bitte den Beleg noch hinzufügen.</p>` : ''}
        <div class="abstand" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-klein" onclick="NB.mwstCsv()">Als CSV speichern</button>
          <button class="btn btn-klein nur-pc" onclick="window.print()">Drucken</button>
        </div>
      </div>
    </div>`;
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-quartal]');
    if (t) { Z.quartal = Number(t.dataset.quartal); zeichnen(); }
  });

  function csv(zeilen) {
    const feld = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + zeilen.map((z) => z.map(feld).join(';')).join('\r\n');
  }
  const csvBetrag = (r) => ((r || 0) / 100).toFixed(2);
  const buchungsZeilen = (liste) => [
    ['Datum', 'Art', 'Kategorie', 'Beschreibung', 'Kunde/Lieferant', 'Betrag inkl. MWST', 'MWST-Satz', 'MWST/Vorsteuer', 'Betrag ohne MWST', 'Bezahlt mit', 'Rechnung', 'Bezahlt am', 'Beleg'],
    ...sortiert(liste).reverse().map((b) => [datumKurz(b.datum), b.typ === 'einnahme' ? 'Einnahme' : 'Ausgabe', katName(b), b.text, b.partner,
      csvBetrag(b.betragRappen), b.mwstSatz, csvBetrag(b.mwstRappen), csvBetrag(netto(b)), b.zahlung, b.rechnungNr || '',
      b.quelle === 'rechnung' ? (b.bezahlt ? datumKurz(b.bezahltAm) : 'offen') : '', b.belegId ? 'ja' : 'nein']),
  ];

  /* ================= Jahresabschluss ================= */
  function abschluss() {
    const liste = imJahr(Z.jahr);
    const gruppe = (typ, kats) => kats.map((k) => ({ k, r: liste.filter((b) => b.typ === typ && b.kategorie === k.id).reduce((a, b) => a + netto(b), 0) })).filter((x) => x.r);
    const ein = gruppe('einnahme', KAT_EIN);
    const aus = gruppe('ausgabe', KAT_AUS);
    const s = summen(liste);
    const offen = liste.filter(istOffen);
    const mwstJahr = [1, 2, 3, 4].map((q) => ({ q, ...mwstRechnen(Z.jahr, q) }));
    return `
    <div class="kopf">
      <div><h1>Jahresabschluss ${Z.jahr}</h1><p class="unter">Erfolgsrechnung für die Steuererklärung, Beträge ohne MWST</p></div>
      <div class="kopf-aktionen">${jahrWahl()}<button class="btn" onclick="NB.jahrCsv()">Alle Buchungen als CSV</button><button class="btn nur-pc" onclick="window.print()">Drucken</button></div>
    </div>
    <div class="raster raster-2">
      <div class="card">
        <h2>Erfolgsrechnung</h2>
        <table>
          <tr><th colspan="2">Ertrag</th></tr>
          ${ein.map((x) => `<tr><td>${esc(x.k.name)}</td><td class="b">${chf(x.r)}</td></tr>`).join('') || '<tr><td class="hinweis">Keine Einnahmen</td><td></td></tr>'}
          <tr class="summe"><td>Total Ertrag</td><td class="b">${chf(s.ein)}</td></tr>
          <tr><th colspan="2" style="padding-top:18px">Aufwand</th></tr>
          ${aus.map((x) => `<tr><td>${esc(x.k.name)}</td><td class="b">${chf(x.r)}</td></tr>`).join('') || '<tr><td class="hinweis">Keine Ausgaben</td><td></td></tr>'}
          <tr class="summe"><td>Total Aufwand</td><td class="b">${chf(s.aus)}</td></tr>
          <tr class="summe"><td>${s.gewinn >= 0 ? 'Gewinn' : 'Verlust'}</td><td class="b ${s.gewinn < 0 ? 'minus' : 'plus'}">${chf(Math.abs(s.gewinn))}</td></tr>
        </table>
      </div>
      <div>
        <div class="card">
          <h2>MWST im Jahr ${Z.jahr}</h2>
          <table>
            <tr><th>Quartal</th><th class="b">Steuer</th><th class="b">Vorsteuer</th><th class="b">Saldo</th></tr>
            ${mwstJahr.map((m) => `<tr><td>Q${m.q}</td><td class="b">${chf(m.steuer)}</td><td class="b">${chf(m.vorsteuer)}</td><td class="b">${chf(m.zahlen)}</td></tr>`).join('')}
            <tr class="summe"><td>Total</td><td class="b">${chf(mwstJahr.reduce((a, m) => a + m.steuer, 0))}</td><td class="b">${chf(mwstJahr.reduce((a, m) => a + m.vorsteuer, 0))}</td><td class="b">${chf(mwstJahr.reduce((a, m) => a + m.zahlen, 0))}</td></tr>
          </table>
        </div>
        <div class="card abstand">
          <h2>Offene Rechnungen Ende Jahr</h2>
          ${offen.length ? `<table>${offen.map((b) => `<tr><td>${esc(b.rechnungNr || '')} ${esc(b.partner || '')}</td><td class="b">${chf(b.betragRappen)}</td></tr>`).join('')}
            <tr class="summe"><td>Total Guthaben bei Kunden</td><td class="b">${chf(offen.reduce((a, b) => a + b.betragRappen, 0))}</td></tr></table>`
            : '<p class="hinweis">Alle Rechnungen aus diesem Jahr sind bezahlt.</p>'}
        </div>
        <p class="hinweis abstand">Für die Steuererklärung brauchen Sie zusätzlich die Vermögenslage per 31.12. (Kontostand, Fahrzeug, Geräte). Diese Übersicht geben Sie am besten zusammen mit der CSV-Datei Ihrem Treuhänder oder legen sie der Steuererklärung bei.</p>
      </div>
    </div>`;
  }

  /* ================= Einstellungen ================= */
  function letzteSicherung() {
    let d = null;
    try { d = localStorage.getItem('nb.sicherung'); } catch {}
    return d ? `Letzte Sicherung auf diesem Gerät: ${datumKurz(d.slice(0, 10))}` : 'Auf diesem Gerät wurde noch keine Sicherung gespeichert.';
  }

  function mehr() {
    const v = Z.einst.abrechnung;
    return `
    <div class="kopf"><div><h1>Einstellungen</h1><p class="unter">Daten, Sicherung und MWST</p></div></div>
    <div class="raster raster-2">
      <div class="card">
        <h2>Rechnungen übernehmen</h2>
        <p class="hinweis">Laden Sie die Datei <strong>rechnungen.json</strong> aus dem Ordner „Nasuvia Rechnungen“ auf dem Schreibtisch oder eine Sicherung aus der iPhone-App. Jede Rechnung wird als Einnahme übernommen. Schon vorhandene Rechnungen werden nur aktualisiert.</p>
        <button class="btn abstand" onclick="NB.rechnungenImport()">Rechnungen laden</button>
      </div>
      <div class="card">
        <h2>MWST</h2>
        <p class="hinweis" style="margin-bottom:10px">Effektive Methode, Abrechnung jedes Quartal. Wann zählt eine Rechnung als Umsatz?</p>
        <div class="segment"><button class="${v === 'vereinbart' ? 'an' : ''}" data-abrechnung="vereinbart">Rechnungsdatum</button><button class="${v === 'vereinnahmt' ? 'an' : ''}" data-abrechnung="vereinnahmt">Zahlungseingang</button></div>
        <p class="hinweis abstand">Üblich ist das Rechnungsdatum (vereinbarte Entgelte). Den Zahlungseingang (vereinnahmte Entgelte) nur wählen, wenn die ESTV Ihnen das bewilligt hat.</p>
      </div>
      <div class="card">
        <h2>Sicherung</h2>
        <p class="hinweis">Speichert alle Buchungen und Belege in einer Datei. Bewahren Sie diese Datei zum Beispiel in iCloud Drive auf. Geschäftsunterlagen müssen 10 Jahre aufbewahrt werden.</p>
        <div class="abstand" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-haupt" onclick="NB.sichern()">Sicherung speichern</button>
          <button class="btn" onclick="NB.zurueckholen()">Sicherung laden</button>
        </div>
        <p class="hinweis abstand">${letzteSicherung()}</p>
      </div>
      <div class="card">
        <h2>Abgleich zwischen iPhone und Mac</h2>
        ${abgleichKarte()}
      </div>
    </div>`;
  }
  function abgleichKarte() {
    const A = window.Abgleich;
    if (A && A.benutzer) {
      return `<p class="hinweis">Angemeldet als <strong>${esc(A.benutzer.email)}</strong>. Alles, was Sie hier erfassen, erscheint automatisch auch auf Ihren anderen Geräten.</p>
        <p class="hinweis abstand" data-abgleich-status>${esc(statusText())}</p>
        <div class="abstand" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-klein" data-abgleich-jetzt>Jetzt abgleichen</button>
          <button class="btn btn-klein btn-rot" data-abmelden>Abmelden</button>
        </div>`;
    }
    return `<p class="hinweis">Melden Sie sich auf jedem Gerät mit dem gleichen Konto an. Danach sind iPhone und Mac immer auf dem gleichen Stand.</p>
      <form class="abstand" data-login style="display:grid;gap:10px">
        <div class="feld"><label for="lMail">E-Mail</label><input type="text" id="lMail" inputmode="email" autocomplete="username" autocapitalize="off" required /></div>
        <div class="feld"><label for="lPw">Passwort</label><input type="password" id="lPw" autocomplete="current-password" required minlength="6" style="width:100%;background:var(--karte);border:1px solid var(--hairline-strong);border-radius:var(--r-feld);padding:8px 11px;color:var(--tinte)" /></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="submit" class="btn btn-haupt btn-klein">Anmelden</button>
          <button type="button" class="btn btn-klein" data-registrieren>Konto erstellen</button>
        </div>
      </form>`;
  }

  document.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-login]')) return;
    e.preventDefault();
    try {
      await Abgleich.anmelden($('lMail').value.trim(), $('lPw').value);
      toast('Angemeldet, Daten werden abgeglichen');
    } catch (f) { toast(f.message); }
  });
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-registrieren]')) {
      const mail = $('lMail').value.trim(), pw = $('lPw').value;
      if (!mail || pw.length < 6) { toast('Bitte E-Mail und ein Passwort mit mindestens 6 Zeichen eingeben'); return; }
      try {
        const bestaetigen = await Abgleich.registrieren(mail, pw);
        toast(bestaetigen ? 'Konto erstellt. Bitte den Link in der E-Mail bestätigen.' : 'Konto erstellt und angemeldet');
      } catch (f) { toast(f.message); }
    }
    if (e.target.closest('[data-abgleich-jetzt]')) { Abgleich.jetzt(); statusZeigen(); }
    if (e.target.closest('[data-abmelden]')) {
      if (!confirm('Abmelden? Die Daten bleiben auf diesem Gerät, werden aber nicht mehr abgeglichen.')) return;
      await Abgleich.abmelden();
      zeichnen();
    }
  });

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-abrechnung]');
    if (!t) return;
    Z.einst = await Speicher.speichern('einstellungen', { ...Z.einst, abrechnung: t.dataset.abrechnung });
    zeichnen();
    toast('Gespeichert');
  });

  function satzSchaetzen(betrag, mwst) {
    if (!mwst) return 0;
    const s = (mwst / (betrag - mwst)) * 100;
    return SAETZE.reduce((best, x) => (Math.abs(x - s) < Math.abs(best - s) ? x : best), 8.1);
  }

  async function rechnungenImport() {
    const datei = await dateiWaehlen('application/json,.json');
    if (!datei) return;
    let daten;
    try { daten = JSON.parse(await datei.text()); } catch { toast('Diese Datei kann ich nicht lesen'); return; }
    const register = Array.isArray(daten) ? daten : (daten && Array.isArray(daten.register) ? daten.register : null);
    if (!register) { toast('In dieser Datei sind keine Rechnungen'); return; }
    const { neu, aktualisiert } = await rechnungenEinbuchen(register);
    await neuLaden(`${neu} Rechnungen übernommen${aktualisiert ? `, ${aktualisiert} aktualisiert` : ''}`);
  }

  // Bucht Rechnungen als Einnahmen ein. Schreibt nur, was neu ist oder sich geändert hat.
  async function rechnungenEinbuchen(register) {
    const vorhanden = new Map((await Speicher.alleMitGeloeschten('buchungen')).filter((b) => b.quelle === 'rechnung').map((b) => [b.rechnungNr, b]));
    let neu = 0, aktualisiert = 0;
    const liste = [];
    for (const r of register) {
      const nr = String(r.nr || '').trim();
      const betrag = Number(r.betragRappen) || 0;
      if (!nr || !betrag) continue;
      const alt = vorhanden.get(nr);
      if (alt && alt.geloescht) continue;
      const mwst = Number(r.mwstRappen) || 0;
      const b = {
        ...(alt || {}),
        id: alt ? alt.id : 'rechnung-' + nr,
        typ: 'einnahme', quelle: 'rechnung', rechnungNr: nr,
        kategorie: alt ? alt.kategorie : 'dienstleistung',
        datum: (r.datum || '').slice(0, 10) || heute(),
        betragRappen: betrag, mwstRappen: mwst, mwstSatz: satzSchaetzen(betrag, mwst),
        partner: r.kunde || r.empfaenger || '',
        text: alt && alt.text ? alt.text : `Rechnung ${nr}`,
        zahlung: alt ? alt.zahlung : 'Bank',
        bezahlt: alt && alt.bezahlt ? true : !!r.bezahlt,
        bezahltAm: alt && alt.bezahltAm ? alt.bezahltAm : (r.bezahlt ? (r.bezahltAm || (r.datum || '').slice(0, 10)) : ''),
        geaendert: undefined,
      };
      if (alt && ['datum', 'betragRappen', 'mwstRappen', 'partner', 'bezahlt', 'bezahltAm'].every((k) => alt[k] === b[k])) continue;
      liste.push(b);
      if (alt) aktualisiert++; else neu++;
    }
    if (liste.length) await Speicher.mehrereSpeichern('buchungen', liste.map((b) => ({ ...b, geaendert: new Date().toISOString() })));
    return { neu, aktualisiert };
  }

  // Holt die Rechnungen aus der Rechnungs-App nach jedem Abgleich automatisch herein
  let rechnungenLaeuft = false;
  async function rechnungenAusApp() {
    if (rechnungenLaeuft || !window.Abgleich || !Abgleich.benutzer || !Abgleich.rechnungenHolen) return;
    rechnungenLaeuft = true;
    try {
      const { neu, aktualisiert } = await rechnungenEinbuchen(await Abgleich.rechnungenHolen());
      if (neu || aktualisiert) await neuLaden(neu ? `${neu} neue ${neu === 1 ? 'Rechnung' : 'Rechnungen'} aus der Rechnungs-App` : '');
    } catch { /* beim nächsten Abgleich wieder */ } finally { rechnungenLaeuft = false; }
  }

  const blobZuText = (blob) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  const textZuBlob = async (url) => (await fetch(url)).blob();

  async function sichern() {
    const belege = [];
    for (const x of await Speicher.alleMitGeloeschten('belege')) {
      belege.push({ ...x, daten: x.daten ? await blobZuText(x.daten) : null });
    }
    const inhalt = JSON.stringify({
      art: 'nasuvia-buchhaltung', version: 1, erstellt: new Date().toISOString(),
      buchungen: await Speicher.alleMitGeloeschten('buchungen'), einstellungen: Z.einst, belege,
    });
    herunterladen(`Nasuvia Buchhaltung Sicherung ${heute()}.json`, inhalt, 'application/json');
    try { localStorage.setItem('nb.sicherung', new Date().toISOString()); } catch {}
  }

  async function zurueckholen() {
    const datei = await dateiWaehlen('application/json,.json');
    if (!datei) return;
    let d;
    try { d = JSON.parse(await datei.text()); } catch { toast('Diese Datei kann ich nicht lesen'); return; }
    if (!d || d.art !== 'nasuvia-buchhaltung') { toast('Das ist keine Sicherung der Buchhaltung'); return; }
    if (!confirm(`Sicherung vom ${datumKurz((d.erstellt || '').slice(0, 10))} laden? Neuere Einträge auf diesem Gerät bleiben erhalten.`)) return;
    const jetzt = new Map((await Speicher.alleMitGeloeschten('buchungen')).map((b) => [b.id, b]));
    const neuer = (x) => !jetzt.get(x.id) || (jetzt.get(x.id).geaendert || '') < (x.geaendert || '');
    await Speicher.mehrereSpeichern('buchungen', (d.buchungen || []).filter(neuer));
    const belege = [];
    for (const x of d.belege || []) belege.push({ ...x, daten: x.daten ? await textZuBlob(x.daten) : null });
    await Speicher.mehrereSpeichern('belege', belege);
    if (d.einstellungen) Z.einst = await Speicher.speichern('einstellungen', { ...d.einstellungen, id: 'haupt' });
    await neuLaden('Sicherung geladen');
  }

  /* ================= Öffentliche Aktionen ================= */
  window.NB = {
    neu: () => buchungBearbeiten(),
    rechnungenImport,
    sichern,
    zurueckholen,
    jahrCsv: () => herunterladen(`Nasuvia Buchungen ${Z.jahr}.csv`, csv(buchungsZeilen(imJahr(Z.jahr))), 'text/csv'),
    mwstCsv: () => {
      const r = mwstRechnen(Z.jahr, Z.quartal);
      herunterladen(`Nasuvia MWST ${Z.jahr} Q${Z.quartal}.csv`, csv(buchungsZeilen([...r.ein, ...r.aus])), 'text/csv');
    },
  };

  /* ================= Start ================= */
  (async () => {
    await Speicher.dauerhaftAnfragen();
    await laden();
    zeichnen();
    if (window.Abgleich) {
      Abgleich.beiAenderung(async (geholt) => {
        if (geholt) {
          await laden();
          const suche = document.activeElement && document.activeElement.matches('[data-fsuche]');
          if (!suche && !$('dlg').open) { zeichnen(); return; }
        }
        if (Z.ansicht === 'mehr' && !document.querySelector('[data-login]')) zeichnen(); else statusZeigen();
        if (!Abgleich.laeuft) rechnungenAusApp();
      });
    }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  })();
})();
