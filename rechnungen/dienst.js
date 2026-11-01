// Ersetzt im Browser den lokalen Mac-Dienst der Rechnungs-App.
// Die App ruft weiterhin /health und /api/... auf; diese Aufrufe werden hier beantwortet.
// Rechnungen, Entwürfe, Kunden und Zahlungsempfänger liegen auf dem Gerät (IndexedDB)
// und gleichen sich über Supabase mit allen Geräten ab. Die PDFs liegen privat im Speicher „belege“.
(() => {
  const URL_PROJEKT = 'https://dyepnomhidubsfwyorke.supabase.co';
  const SCHLUESSEL = 'sb_publishable_zEmC1R5vq234zR6ST7PTmA_uY7Z1-ph';
  const KEY_KUNDEN = 'nasuvia.kunden.v1';
  const KEY_EMPF = 'nasuvia.empfaenger.v1';
  const K_SEIT = 'nr.abgleich.seit';
  const K_ZULETZT = 'nr.abgleich.zuletzt';
  // Speicher auf dem Gerät und die Art, unter der er in Supabase liegt
  const ARTEN = { rechnung: 'rechnung', entwurf: 'rechnungsentwurf', stamm: 'rechnungsstamm' };
  const VON_ART = Object.fromEntries(Object.entries(ARTEN).map(([s, a]) => [a, s]));

  const sb = window.supabase.createClient(URL_PROJEKT, SCHLUESSEL, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nb.anmeldung' },
  });

  const lies = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const setz = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const jetzt = () => new Date().toISOString();
  const heute = () => new Date().toISOString().slice(0, 10);

  /* ---------- Speicher auf dem Gerät ---------- */
  let dbOffen;
  const anfrage = (r) => new Promise((ok, f) => { r.onsuccess = () => ok(r.result); r.onerror = () => f(r.error); });
  function db() {
    if (!dbOffen) {
      const r = indexedDB.open('nasuvia-rechnungen', 1);
      r.onupgradeneeded = () => ['rechnung', 'entwurf', 'stamm', 'pdf'].forEach((s) => {
        if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' });
      });
      dbOffen = anfrage(r);
    }
    return dbOffen;
  }
  const alle = async (s) => anfrage((await db()).transaction(s).objectStore(s).getAll());
  const eins = async (s, id) => anfrage((await db()).transaction(s).objectStore(s).get(id));
  async function roh(s, liste) {
    const t = (await db()).transaction(s, 'readwrite');
    liste.forEach((e) => t.objectStore(s).put(e));
    return new Promise((ok, f) => { t.oncomplete = ok; t.onerror = () => f(t.error); });
  }
  async function speichern(s, liste) {
    const z = jetzt();
    await roh(s, liste.map((e) => ({ ...e, geaendert: z, offen: true })));
    baldAbgleichen();
  }
  const gueltig = async (s) => (await alle(s)).filter((e) => !e.geloescht);

  /* ---------- Hilfen wie im Mac-Dienst ---------- */
  const sauber = (t, ersatz = '-') => String(t).replace(/[^\p{L}\p{N}_\s.-]/gu, '').trim().replace(/\s+/g, ersatz) || 'Rechnung';
  const dateiname = (d) => {
    const datum = d.datum || heute();
    return `${datum}_Rechnung-${sauber(d.nr || 'ohne-Nummer')}_${sauber(d.kundeName || 'Kunde')}.pdf`;
  };
  const OHNE = ['html', 'htmlEingebettet', 'text', 'betreff', 'an', 'absender', 'pdfErzeugen', 'pdfPfad'];
  const nurDaten = (d) => Object.fromEntries(Object.entries(d).filter(([k]) => !OHNE.includes(k)));
  const PFAD = 'cloud/';
  const nachDatei = async (datei) => (await gueltig('rechnung')).find((r) => r.datei === datei);

  /* ---------- PDF aus der Vorschau ---------- */
  async function blattAlsPdf() {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const quelle = document.getElementById('sheet');
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-30000px;top:0;width:210mm;height:297mm;background:#fff;pointer-events:none';
    const kopie = quelle.cloneNode(true);
    kopie.removeAttribute('id');
    kopie.style.transform = 'none';
    box.appendChild(kopie);
    document.body.appendChild(box);
    try {
      const leinwand = await window.html2canvas(kopie, { scale: 3, backgroundColor: '#ffffff', logging: false, useCORS: true });
      const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
      pdf.addImage(leinwand.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      return pdf.output('blob');
    } finally {
      box.remove();
    }
  }

  // Wie der Mac-Dienst: eine Nummer steht für genau eine Rechnung
  async function eintragen(daten, blob, gesendet, an) {
    const datei = dateiname(daten);
    const nr = String(daten.nr || '').trim();
    const liste = await gueltig('rechnung');
    const ersetzt = liste.filter((r) => nr && String(r.nr) === nr && r.datei !== datei).map((r) => ({ ...r, geloescht: true }));
    const vorher = liste.find((r) => r.datei === datei);
    const eintrag = {
      id: 'rg-' + datei.replace(/\.pdf$/, ''), datei, nr,
      kunde: daten.kundeName || '', empfaenger: daten.empfName || '',
      datum: daten.datum || heute(), faellig: daten.faellig || '',
      betragRappen: parseInt(daten.totalRappen, 10) || 0, mwstRappen: parseInt(daten.mwstRappen, 10) || 0,
      erstellt: (vorher && vorher.erstellt) || jetzt(), zuletztGesichert: jetzt(), daten: nurDaten(daten),
      gesendet: !!(gesendet || (vorher && vorher.gesendet)),
      gesendetAm: gesendet ? jetzt() : ((vorher && vorher.gesendetAm) || ''),
      gesendetAn: gesendet ? (an || '') : ((vorher && vorher.gesendetAn) || ''),
      bezahlt: !!(vorher && vorher.bezahlt), bezahltAm: (vorher && vorher.bezahltAm) || '',
    };
    await speichern('rechnung', [...ersetzt, eintrag]);
    if (blob) {
      await roh('pdf', [{ id: eintrag.id, blob, hochgeladen: false }]);
      baldAbgleichen();
    }
    return eintrag;
  }

  async function pdfHolen(eintrag) {
    const lokal = await eins('pdf', eintrag.id);
    if (lokal && lokal.blob) return lokal.blob;
    if (!benutzer) return null;
    const { data } = await sb.storage.from('belege').download(`${benutzer.id}/rechnungen/${eintrag.datei}`);
    if (data) await roh('pdf', [{ id: eintrag.id, blob: data, hochgeladen: true }]);
    return data || null;
  }

  /* ---------- Fenster zum Teilen, Öffnen und Herunterladen ---------- */
  const stil = document.createElement('style');
  stil.textContent = `
    .nr-dlg{margin:auto;border:0;border-radius:18px;padding:24px;max-width:420px;width:calc(100% - 32px);box-shadow:0 30px 80px -20px rgba(12,18,38,.45);font-family:inherit;color:#0C1226}
    .nr-dlg::backdrop{background:rgba(12,18,38,.38);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
    .nr-dlg[open],.nr-ue[open]{animation:nrEin .34s cubic-bezier(.2,.9,.3,1)}
    @keyframes nrEin{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}
    .nr-dlg h3{margin:0 0 6px;font-size:1.25rem}
    .nr-dlg p{margin:0 0 16px;color:#47506B;line-height:1.5}
    .nr-dlg .reihe{display:flex;flex-direction:column;gap:10px}
    .nr-dlg a,.nr-dlg button{display:flex;align-items:center;justify-content:center;gap:8px;font:600 1rem inherit;padding:13px 18px;border-radius:12px;border:0;cursor:pointer;text-decoration:none;font-family:inherit}
    .nr-dlg .haupt{background:#3B55E6;color:#fff}
    .nr-dlg .zweit{background:#EEF1F8;color:#1C2A7B}
    .nr-dlg .leise{background:none;color:#47506B;font-weight:500}
    .nr-dlg input{width:100%;box-sizing:border-box;font:inherit;padding:12px 14px;border:1.5px solid rgba(28,42,123,.18);border-radius:10px;margin-bottom:10px}
    .nr-fehler{color:#E5484D;font-size:.9rem;min-height:1.2em;margin:-2px 0 8px}
    .nr-status{position:fixed;right:14px;bottom:14px;z-index:50;display:flex;align-items:center;gap:8px;background:#fff;border-radius:100px;padding:9px 14px;box-shadow:0 10px 30px -12px rgba(12,18,38,.35);font-size:.85rem;color:#0C1226;cursor:pointer;border:0;font-family:inherit}
    .nr-status i{width:9px;height:9px;border-radius:50%;background:#B7791F}
    .nr-status.ok i{background:#0E9F6E}.nr-status.aus i{background:#E5484D}
    body.server #btnOrdner{display:none}
    @media print{.nr-status{display:none}}
  `;
  document.head.appendChild(stil);

  const dialog = (html) => {
    const d = document.createElement('dialog');
    d.className = 'nr-dlg';
    d.innerHTML = html;
    document.body.appendChild(d);
    d.addEventListener('close', () => setTimeout(() => d.remove(), 300));
    d.showModal();
    return d;
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function pdfZeigen(blob, datei, mail) {
    const url = URL.createObjectURL(blob);
    const datei_ = new File([blob], datei, { type: 'application/pdf' });
    const teilenGeht = navigator.canShare && navigator.canShare({ files: [datei_] });
    const mailto = mail ? `mailto:${encodeURIComponent(mail.an || '')}?subject=${encodeURIComponent(mail.betreff || '')}&body=${encodeURIComponent(mail.text || '')}` : '';
    const d = dialog(`
      <h3>${mail ? 'Rechnung versenden' : 'Rechnung als PDF'}</h3>
      <p>${mail ? (teilenGeht ? 'Tippen Sie auf „Teilen“ und wählen Sie Mail. Die Rechnung ist schon angehängt.' : 'Laden Sie das PDF herunter und hängen Sie es an die Mail an.') : esc(datei)}</p>
      <div class="reihe">
        ${teilenGeht ? '<button class="haupt" data-teilen>Teilen</button>' : ''}
        <a class="${teilenGeht ? 'zweit' : 'haupt'}" href="${url}" target="_blank" rel="noopener">PDF öffnen</a>
        <a class="zweit" href="${url}" download="${esc(datei)}">Herunterladen</a>
        ${mail && !teilenGeht ? `<a class="zweit" href="${mailto}">Mail öffnen</a>` : ''}
        <button class="leise" data-zu>Schliessen</button>
      </div>`);
    d.querySelector('[data-zu]').onclick = () => d.close();
    const t = d.querySelector('[data-teilen]');
    if (t) t.onclick = async () => {
      try {
        await navigator.share({ files: [datei_], title: (mail && mail.betreff) || datei, text: (mail && mail.text) || '' });
        d.close();
      } catch (e) { if (e && e.name !== 'AbortError') window.open(url, '_blank'); }
    };
  }

  /* ---------- Antworten auf die Aufrufe der App ---------- */
  async function statistik() {
    const e = await gueltig('rechnung');
    const d = new Date();
    const monatJetzt = d.toISOString().slice(0, 7), jahrJetzt = String(d.getFullYear()), h = heute();
    const summe = (l) => l.reduce((s, x) => s + (x.betragRappen || 0), 0);
    const monate = {}, kunden = {};
    e.forEach((x) => {
      const m = (x.datum || '').slice(0, 7);
      if (m) { monate[m] = monate[m] || { monat: m, anzahl: 0, betragRappen: 0 }; monate[m].anzahl++; monate[m].betragRappen += x.betragRappen || 0; }
      const k = x.kunde || '—';
      kunden[k] = kunden[k] || { kunde: k, anzahl: 0, betragRappen: 0 }; kunden[k].anzahl++; kunden[k].betragRappen += x.betragRappen || 0;
    });
    const jahr = e.filter((x) => (x.datum || '').startsWith(jahrJetzt));
    const monat = e.filter((x) => (x.datum || '').startsWith(monatJetzt));
    const gesendet = e.filter((x) => x.gesendet);
    const unbezahlt = e.filter((x) => !x.bezahlt);
    const ueber = unbezahlt.filter((x) => (x.faellig || '9999') < h);
    return {
      anzahl: e.length, gesendet: gesendet.length, offen: e.length - gesendet.length,
      unbezahlt: unbezahlt.length, offenRappen: summe(unbezahlt),
      ueberfaellig: ueber.length, ueberfaelligRappen: summe(ueber),
      bezahltRappen: summe(e.filter((x) => x.bezahlt)), umsatzRappen: summe(e),
      jahr: jahrJetzt, umsatzJahrRappen: summe(jahr), anzahlJahr: jahr.length,
      umsatzMonatRappen: summe(monat), anzahlMonat: monat.length,
      mwstJahrRappen: jahr.reduce((s, x) => s + (x.mwstRappen || 0), 0),
      monate: Object.values(monate).sort((a, b) => b.monat.localeCompare(a.monat)).slice(0, 12),
      kunden: Object.values(kunden).sort((a, b) => b.betragRappen - a.betragRappen).slice(0, 8),
      letzte: [...e].sort((a, b) => (b.erstellt || '').localeCompare(a.erstellt || '')).slice(0, 10).map(({ daten, ...r }) => r),
    };
  }

  async function naechsteNr() {
    const nummern = (await gueltig('rechnung')).map((r) => String(r.nr || '').trim()).filter((n) => /^\d+$/.test(n));
    if (!nummern.length) return '';
    const hoechste = nummern.reduce((a, b) => (+b > +a || (+b === +a && b.length > a.length) ? b : a));
    return String(+hoechste + 1).padStart(hoechste.length, '0');
  }

  function csvExport(liste, jahr) {
    const feld = (w) => { const t = String(w ?? ''); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const b = (r) => ((r || 0) / 100).toFixed(2);
    const zeilen = liste.filter((e) => (e.datum || '').startsWith(jahr)).sort((a, c) => (a.datum + a.nr).localeCompare(c.datum + c.nr));
    const aus = [['Datum', 'Rechnungsnr', 'Kunde', 'Zahlungsempfänger', 'Betrag CHF', 'davon MwSt CHF', 'Netto CHF', 'Fällig', 'Bezahlt', 'Versendet', 'Datei'].join(';')];
    zeilen.forEach((e) => aus.push([e.datum, e.nr, e.kunde, e.empfaenger, b(e.betragRappen), b(e.mwstRappen), b(e.betragRappen - e.mwstRappen),
      e.faellig, e.bezahlt ? 'ja' : 'nein', e.gesendet ? 'ja' : 'nein', e.datei].map(feld).join(';')));
    const s = zeilen.reduce((x, e) => x + (e.betragRappen || 0), 0), m = zeilen.reduce((x, e) => x + (e.mwstRappen || 0), 0);
    aus.push(['', '', '', 'Summe ' + jahr, b(s), b(m), b(s - m), '', '', '', ''].join(';'));
    const blob = new Blob(['﻿' + aus.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `Buchhaltung-${jahr}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    return zeilen.length;
  }

  const fehler = (text, code = 404) => ({ code, body: { fehler: text } });

  async function beantworten(pfad, d) {
    switch (pfad) {
      case '/health': return { body: { ok: true, archiv: 'Abgleich' } };
      case '/api/rechnungen': {
        const liste = (await gueltig('rechnung')).sort((a, b) => (b.erstellt || '').localeCompare(a.erstellt || ''));
        return { body: { ordner: benutzer ? 'Abgeglichen mit allen Geräten' : 'Nur auf diesem Gerät (nicht angemeldet)', rechnungen: liste.slice(0, 60).map((r) => ({
          name: r.datei, pfad: PFAD + r.datei, groesse: 0, zeit: new Date(r.erstellt || r.geaendert).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' }),
          sortier: Date.parse(r.erstellt || 0) / 1000, nr: r.nr, kunde: r.kunde, datum: r.datum, faellig: r.faellig,
          betragRappen: r.betragRappen, gesendet: !!r.gesendet, bezahlt: !!r.bezahlt, bearbeitbar: !!r.daten })) } };
      }
      case '/api/statistik': return { body: await statistik() };
      case '/api/entwuerfe': return { body: { entwuerfe: (await gueltig('entwurf')).sort((a, b) => (b.zeit || '').localeCompare(a.zeit || '')).map(({ daten, offen, ...e }) => ({ ...e, id: e.id.replace(/^rgentwurf-/, ''), geaendert: e.zeit })) } };
      case '/api/naechsteNr': return { body: { nr: await naechsteNr(), vergeben: (await gueltig('rechnung')).map((r) => String(r.nr || '')) } };
      case '/api/pdf': {
        const blob = await blattAlsPdf();
        const e = await eintragen(d, blob, false);
        pdfZeigen(blob, e.datei);
        return { body: { ok: true, pfad: PFAD + e.datei, name: e.datei } };
      }
      case '/api/mail': {
        let e, blob;
        if (d.pdfErzeugen || !d.pdfPfad) { blob = await blattAlsPdf(); e = await eintragen(d, blob, true, d.an); }
        else {
          e = await nachDatei(String(d.pdfPfad).replace(PFAD, ''));
          if (!e) return fehler('Rechnung nicht gefunden.');
          blob = await pdfHolen(e);
          await speichern('rechnung', [{ ...e, gesendet: true, gesendetAm: jetzt(), gesendetAn: d.an || e.gesendetAn || '' }]);
        }
        if (!blob) return fehler('Das PDF ist auf diesem Gerät noch nicht da. Bitte kurz warten, bis der Abgleich fertig ist.', 500);
        pdfZeigen(blob, e.datei, { an: d.an, betreff: d.betreff, text: d.text });
        return { body: { ok: true, pfad: PFAD + e.datei, weg: 'teilen' } };
      }
      case '/api/laden': {
        const e = await nachDatei(d.datei || '');
        if (!e || !e.daten) return fehler('Zu dieser Rechnung sind keine Eingaben gespeichert.');
        const { daten, offen, ...eintrag } = e;
        return { body: { daten, eintrag } };
      }
      case '/api/bezahlt': {
        const e = await nachDatei(d.datei || '');
        if (!e) return fehler('Rechnung nicht im Verzeichnis.');
        await speichern('rechnung', [{ ...e, bezahlt: !!d.bezahlt, bezahltAm: d.bezahlt ? heute() : '' }]);
        return { body: { ok: true, bezahlt: !!d.bezahlt } };
      }
      case '/api/entwurf': {
        const kennung = String(d.id || '') || 'entwurf-' + Date.now();
        const { id, titel, ...daten } = d;
        const e = { id: 'rgentwurf-' + kennung, titel: (titel || '').trim() || 'Ohne Titel', kunde: d.kundeName || '', nr: String(d.nr || ''),
          betragRappen: parseInt(d.totalRappen, 10) || 0, zeit: jetzt(), daten };
        await speichern('entwurf', [e]);
        return { body: { ok: true, id: kennung, titel: e.titel } };
      }
      case '/api/entwurf-laden': {
        const e = await eins('entwurf', 'rgentwurf-' + d.id);
        if (!e || e.geloescht) return fehler('Entwurf nicht gefunden.');
        return { body: { daten: e.daten || {}, titel: e.titel } };
      }
      case '/api/entwurf-loeschen': {
        const e = await eins('entwurf', 'rgentwurf-' + d.id);
        if (e) await speichern('entwurf', [{ ...e, geloescht: true }]);
        return { body: { ok: true } };
      }
      case '/api/export': {
        const jahr = String(d.jahr || new Date().getFullYear());
        const anzahl = csvExport(await gueltig('rechnung'), jahr);
        return { body: { ok: true, pfad: '', anzahl, name: `Buchhaltung-${jahr}.csv` } };
      }
      case '/api/oeffnen': {
        const e = d.pfad ? await nachDatei(String(d.pfad).replace(PFAD, '')) : null;
        if (!e) return { body: { ok: true } };
        const blob = await pdfHolen(e);
        if (!blob) return fehler('Das PDF ist noch nicht auf diesem Gerät. Bitte kurz warten, bis der Abgleich fertig ist.', 500);
        pdfZeigen(blob, e.datei);
        return { body: { ok: true } };
      }
    }
    return fehler('nicht gefunden');
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = function (eingabe, optionen) {
    const roh = typeof eingabe === 'string' ? eingabe : (eingabe && eingabe.url) || '';
    let pfad;
    try { pfad = new URL(roh, location.href).pathname; } catch { pfad = ''; }
    pfad = pfad.replace(/^.*?(\/health|\/api\/[\w-]+)$/, '$1');
    if (pfad !== '/health' && !pfad.startsWith('/api/')) return originalFetch(eingabe, optionen);
    let daten = {};
    try { daten = optionen && optionen.body ? JSON.parse(optionen.body) : {}; } catch {}
    return beantworten(pfad, daten)
      .catch((e) => fehler(e.message || String(e), 500))
      .then(({ code = 200, body }) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json' } }));
  };

  /* ---------- Kunden und Zahlungsempfänger mitnehmen ---------- */
  const STAMM = { [KEY_KUNDEN]: 'rgstamm-kunden', [KEY_EMPF]: 'rgstamm-empfaenger' };
  const setItemOriginal = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    setItemOriginal.call(this, k, v);
    if (this === window.localStorage && STAMM[k] && !stammSchreibt) {
      try { speichern('stamm', [{ id: STAMM[k], schluessel: k, liste: JSON.parse(v) }]); } catch {}
    }
  };
  let stammSchreibt = false;
  async function stammAnwenden(eintraege) {
    stammSchreibt = true;
    try { eintraege.forEach((e) => { if (e.schluessel && Array.isArray(e.liste) && e.liste.length) localStorage.setItem(e.schluessel, JSON.stringify(e.liste)); }); }
    finally { stammSchreibt = false; }
    if (window.__nasuvia && window.__nasuvia.stammNeu) window.__nasuvia.stammNeu();
  }

  /* ---------- Abgleich mit Supabase ---------- */
  let benutzer = null, laeuft = null, nochmal = false, letzterFehler = '';
  const fuerServer = ({ offen, ...rest }) => rest;

  async function hochladen(uid) {
    for (const p of (await alle('pdf')).filter((x) => !x.hochgeladen && x.blob)) {
      const r = await eins('rechnung', p.id);
      if (!r) continue;
      const { error } = await sb.storage.from('belege').upload(`${uid}/rechnungen/${r.datei}`, p.blob, { upsert: true, contentType: 'application/pdf' });
      if (error) throw error;
      await roh('pdf', [{ ...p, hochgeladen: true }]);
    }
    for (const r of (await alle('rechnung')).filter((x) => x.offen && x.geloescht && x.datei)) {
      // Ersetzte Fassungen behalten ihr PDF nicht: gleicher Dateiname heisst gleiche Rechnung
      const aktiv = (await gueltig('rechnung')).some((x) => x.datei === r.datei);
      if (!aktiv) await sb.storage.from('belege').remove([`${uid}/rechnungen/${r.datei}`]);
    }
    for (const [speicher, art] of Object.entries(ARTEN)) {
      const offen = (await alle(speicher)).filter((e) => e.offen);
      for (let i = 0; i < offen.length; i += 200) {
        const teil = offen.slice(i, i + 200);
        const { error } = await sb.from('datensaetze').upsert(teil.map((e) => ({
          user_id: uid, id: e.id, art, daten: fuerServer(e), geaendert: e.geaendert || jetzt(), geloescht: !!e.geloescht,
        })), { onConflict: 'user_id,id' });
        if (error) throw error;
        const nun = new Map((await alle(speicher)).map((e) => [e.id, e]));
        await roh(speicher, teil.filter((e) => nun.get(e.id) && nun.get(e.id).geaendert === e.geaendert).map((e) => ({ ...nun.get(e.id), offen: false })));
      }
    }
  }

  async function herunterholen() {
    const seit = lies(K_SEIT);
    const ab = seit ? new Date(Date.parse(seit) - 60000).toISOString() : '1970-01-01T00:00:00Z';
    let neuester = seit, geholt = 0;
    for (let von = 0; ; von += 500) {
      const { data, error } = await sb.from('datensaetze').select('id,art,daten,geaendert,geloescht,aktualisiert')
        .in('art', Object.values(ARTEN)).gt('aktualisiert', ab).order('aktualisiert').range(von, von + 499);
      if (error) throw error;
      for (const [art, speicher] of Object.entries(VON_ART)) {
        const zeilen = data.filter((z) => z.art === art);
        if (!zeilen.length) continue;
        const lokal = new Map((await alle(speicher)).map((e) => [e.id, e]));
        const neu = zeilen.filter((z) => { const l = lokal.get(z.id); return !l || new Date(l.geaendert || 0) < new Date(z.geaendert); })
          .map((z) => ({ ...z.daten, id: z.id, geaendert: z.geaendert, geloescht: z.geloescht, offen: false }));
        if (!neu.length) continue;
        await roh(speicher, neu);
        geholt += neu.length;
        if (speicher === 'stamm') await stammAnwenden(neu.filter((e) => !e.geloescht));
      }
      if (data.length) neuester = data[data.length - 1].aktualisiert;
      if (data.length < 500) break;
    }
    if (neuester) setz(K_SEIT, neuester);
    return geholt;
  }

  async function abgleichen() {
    if (!benutzer) return melden();
    if (laeuft) { nochmal = true; return laeuft; }
    laeuft = (async () => {
      let geholt = 0;
      try {
        do { nochmal = false; await hochladen(benutzer.id); geholt += await herunterholen(); } while (nochmal);
        letzterFehler = '';
        setz(K_ZULETZT, jetzt());
      } catch (e) {
        letzterFehler = navigator.onLine === false ? 'Kein Internet' : (e.message || String(e));
      } finally {
        laeuft = null;
        melden();
        // Neue Rechnungen von anderen Geräten in der Liste zeigen
        if (geholt && document.body.classList.contains('server')) {
          if (window.__nasuvia && window.__nasuvia.listenNeu) window.__nasuvia.listenNeu();
        }
      }
    })();
    return laeuft;
  }
  let zeitgeber;
  const baldAbgleichen = () => { clearTimeout(zeitgeber); zeitgeber = setTimeout(abgleichen, 1500); };

  /* ---------- Anzeige und Anmeldung ---------- */
  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = 'nr-status';
  function melden() {
    if (!document.body) return;
    if (!knopf.isConnected) document.body.appendChild(knopf);
    const z = lies(K_ZULETZT);
    knopf.className = 'nr-status ' + (!benutzer ? 'aus' : letzterFehler ? '' : 'ok');
    knopf.innerHTML = '<i></i>' + (!benutzer ? 'Anmelden für Abgleich' : laeuft ? 'Gleicht ab …' : letzterFehler ? 'Abgleich offen' : 'Abgeglichen' + (z ? ' ' + new Date(z).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) : ''));
  }
  knopf.addEventListener('click', () => (benutzer ? kontoZeigen() : anmeldenZeigen()));

  function anmeldenZeigen() {
    const d = dialog(`
      <h3>Anmelden</h3>
      <p>Mit demselben Konto wie die Buchhaltung. Danach sind die Rechnungen auf iPhone und Mac gleich.</p>
      <form method="dialog" data-form>
        <input type="email" name="email" placeholder="E-Mail" autocomplete="username" required>
        <input type="password" name="pw" placeholder="Passwort" autocomplete="current-password" required>
        <p class="nr-fehler" data-fehler></p>
        <div class="reihe"><button class="haupt" type="submit">Anmelden</button><button class="leise" type="button" data-zu>Abbrechen</button></div>
      </form>`);
    d.querySelector('[data-zu]').onclick = () => d.close();
    d.querySelector('[data-form]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.pw.value });
      if (error) { d.querySelector('[data-fehler]').textContent = /Invalid login/i.test(error.message) ? 'E-Mail oder Passwort stimmt nicht.' : error.message; return; }
      d.close();
    });
  }

  function kontoZeigen() {
    const z = lies(K_ZULETZT);
    const d = dialog(`
      <h3>Abgleich</h3>
      <p>Angemeldet als ${esc(benutzer.email)}.<br>${letzterFehler ? 'Letzter Versuch: ' + esc(letzterFehler) : z ? 'Zuletzt abgeglichen: ' + new Date(z).toLocaleString('de-CH') : ''}</p>
      <div class="reihe">
        <button class="haupt" data-jetzt>Jetzt abgleichen</button>
        <button class="zweit" data-import>Rechnungen vom Mac übernehmen</button>
        <button class="leise" data-ab style="color:#E5484D">Abmelden</button>
        <button class="leise" data-zu>Schliessen</button>
      </div>`);
    d.querySelector('[data-zu]').onclick = () => d.close();
    d.querySelector('[data-jetzt]').onclick = () => { d.close(); abgleichen(); };
    // Abmelden nur auf diesem Gerät: klappt sofort, auch ohne Netz
    d.querySelector('[data-ab]').onclick = async () => { await sb.auth.signOut({ scope: 'local' }); setz(K_SEIT, null); setz(K_ZULETZT, null); benutzer = null; melden(); d.close(); };
    d.querySelector('[data-import]').onclick = () => { d.close(); importieren(); };
  }

  /* ---------- Übersicht: was gespeichert, gesendet und bezahlt ist ---------- */
  const stilUebersicht = document.createElement('style');
  stilUebersicht.textContent = `
    .nr-ue-knopf{display:inline-flex;align-items:center;gap:7px;margin-left:auto;border:0;cursor:pointer;font:600 .9rem inherit;font-family:inherit;color:#fff;background:linear-gradient(135deg,#3B55E6,#1C2A7B);border-radius:100px;padding:9px 15px;box-shadow:0 6px 16px -8px rgba(28,42,123,.7)}
    .nr-zurueck{display:inline-flex;align-self:flex-start;align-items:center;gap:4px;margin:0 0 10px 2px;font:600 .9rem inherit;font-family:inherit;color:#3B55E6;text-decoration:none;padding:6px 12px 6px 6px;border-radius:100px;background:rgba(59,85,230,.08)}
    .nr-zurueck:hover{background:rgba(59,85,230,.14)}
    .nr-zurueck svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
    .nr-ue-knopf svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .nr-ue{margin:auto;border:0;padding:0;width:min(980px,calc(100% - 48px));max-height:calc(100vh - 64px);overflow:hidden;border-radius:20px;box-shadow:0 40px 100px -30px rgba(12,18,38,.5);color:#0C1226;font-family:inherit}
    .nr-ue::backdrop{background:rgba(12,18,38,.38);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
    .nr-ue-innen{display:flex;flex-direction:column;max-height:calc(100vh - 64px)}
    .nr-ue-kopf{padding:22px 26px 14px;border-bottom:1px solid rgba(28,42,123,.1);background:linear-gradient(180deg,#F4F6FD,#fff)}
    .nr-ue-kopf .zeile1{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .nr-ue-kopf h3{margin:0;font-size:1.35rem}
    .nr-ue-zu{border:0;background:#EEF1F8;border-radius:100px;width:36px;height:36px;font-size:1.2rem;cursor:pointer;color:#1C2A7B}
    .nr-ue-summen{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:14px 0 12px}
    .nr-ue-summen div{background:#F6F8FC;border-radius:12px;padding:10px 12px}
    .nr-ue-summen b{display:block;font-size:1.05rem}
    .nr-ue-summen span{font-size:.78rem;color:#47506B}
    .nr-ue-summen .blau{background:rgba(59,85,230,.08)}.nr-ue-summen .blau b{color:#1C2A7B}
    .nr-ue-summen .rot{background:rgba(229,72,77,.08)}.nr-ue-summen .rot b{color:#C7383D}
    .nr-ue-summen .gruen{background:rgba(14,159,110,.09)}.nr-ue-summen .gruen b{color:#0A7150}
    .nr-ue-filter{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
    .nr-ue-filter::-webkit-scrollbar{display:none}
    .nr-ue-filter button{border:1.5px solid rgba(28,42,123,.15);background:#fff;border-radius:100px;padding:7px 12px;font:500 .86rem inherit;font-family:inherit;white-space:nowrap;cursor:pointer;color:#0C1226}
    .nr-ue-filter button.an{border-color:#3B55E6;background:rgba(59,85,230,.08);color:#1C2A7B;font-weight:600}
    .nr-ue-suche{width:100%;box-sizing:border-box;margin-top:10px;font:inherit;font-size:16px;padding:10px 12px;border:1.5px solid rgba(28,42,123,.15);border-radius:10px}
    .nr-ue-liste{overflow-y:auto;padding:16px 26px 26px;display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));gap:12px;align-content:start;-webkit-overflow-scrolling:touch}
    .nr-ue-liste > .nr-ue-leer{grid-column:1/-1}
    .nr-ue-karte{transition:box-shadow .2s,border-color .2s}.nr-ue-karte:hover{border-color:rgba(59,85,230,.35);box-shadow:0 10px 26px -18px rgba(28,42,123,.5)}
    .nr-ue-karte{border:1px solid rgba(28,42,123,.1);border-radius:14px;padding:14px 16px}
    .nr-ue-karte .oben{display:flex;justify-content:space-between;gap:12px;align-items:baseline}
    .nr-ue-karte .oben b{font-size:1.02rem}
    .nr-ue-karte .oben .betrag{font-weight:700;white-space:nowrap}
    .nr-ue-karte .klein{font-size:.85rem;color:#47506B;margin-top:2px}
    .nr-ue-weg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:12px 0 10px}
    .nr-ue-schritt{border-radius:10px;padding:8px 10px;background:#F6F8FC;font-size:.8rem;line-height:1.35;color:#47506B}
    .nr-ue-schritt b{display:flex;align-items:center;gap:6px;font-size:.84rem;color:#0C1226;margin-bottom:2px}
    .nr-ue-schritt b i{width:16px;height:16px;border-radius:50%;flex:none;background:#E3E8F4}
    .nr-ue-schritt.ja{background:rgba(14,159,110,.08)}
    .nr-ue-schritt.ja b i{background:#0E9F6E url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4.5 8.5l2.2 2.2L11.5 6' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/100% no-repeat}
    .nr-ue-schritt.warn{background:rgba(229,72,77,.08)}
    .nr-ue-schritt.warn b i{background:#E5484D}
    .nr-ue-schritt span{display:block;word-break:break-word}
    .nr-ue-knoepfe{display:flex;gap:6px;flex-wrap:wrap}
    .nr-ue-knoepfe button{border:0;border-radius:9px;padding:8px 12px;font:600 .84rem inherit;font-family:inherit;cursor:pointer;background:#EEF1F8;color:#1C2A7B}
    .nr-ue-knoepfe button.gruen{background:rgba(14,159,110,.12);color:#0A7150}
    .nr-ue-knoepfe button.rot{background:none;color:#E5484D;margin-left:auto}
    .nr-ue-leer{text-align:center;color:#47506B;padding:30px 10px}
    @media (max-width:640px){
      .nr-ue{width:100%;max-width:100%;height:100%;max-height:100%;margin:0;border-radius:0}
      .nr-ue-innen{max-height:100%;height:100%}
      .nr-ue[open]{animation:nrHoch .36s cubic-bezier(.2,.9,.3,1)}
      @keyframes nrHoch{from{transform:translateY(100%)}to{transform:none}}
      .nr-ue-liste{grid-template-columns:minmax(0,1fr)}
      .nr-ue-kopf{padding:calc(14px + env(safe-area-inset-top)) 16px 10px}
      .nr-ue-liste{padding:10px 16px calc(24px + env(safe-area-inset-bottom))}
      .nr-ue-summen{grid-template-columns:repeat(2,minmax(0,1fr))}
      .nr-ue-weg{grid-template-columns:minmax(0,1fr)}
      .nr-ue-schritt{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
      .nr-ue-schritt b{margin:0}
    }
  `;
  document.head.appendChild(stilUebersicht);

  const chfText = (r) => 'CHF ' + ((r || 0) / 100).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const datumText = (iso) => iso ? new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const zeitText = (iso) => iso && iso.length > 10 ? datumText(iso) + ', ' + new Date(iso).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) : datumText(iso);
  // Empfängeradresse: beim Versand gemerkt, sonst die beim Kunden hinterlegte
  const adresseVon = (r) => {
    if (r.gesendetAn) return r.gesendetAn;
    const d = r.daten || {};
    const k = (d.kunden || []).find((x) => x.id === d.kundeId);
    return (k && k.mail) || '';
  };
  const ueberfaellig = (r) => !r.bezahlt && r.faellig && r.faellig < heute();

  let ueFilter = 'alle', ueSuche = '';
  async function uebersichtZeigen() {
    const d = dialog('');
    d.className = 'nr-ue';
    d.innerHTML = `<div class="nr-ue-innen">
      <div class="nr-ue-kopf">
        <div class="zeile1"><h3>Alle Rechnungen</h3><button class="nr-ue-zu" data-zu aria-label="Schliessen">×</button></div>
        <div class="nr-ue-summen" data-summen></div>
        <div class="nr-ue-filter" data-filter>
          <button data-f="alle">Alle</button><button data-f="nichtGesendet">Nicht gesendet</button><button data-f="gesendet">Gesendet, offen</button><button data-f="ueberfaellig">Überfällig</button><button data-f="bezahlt">Bezahlt</button>
        </div>
        <input class="nr-ue-suche" type="search" placeholder="Suchen: Nummer, Kunde oder E-Mail" data-suche value="${esc(ueSuche)}">
      </div>
      <div class="nr-ue-liste" data-liste></div>
    </div>`;
    d.querySelector('[data-zu]').onclick = () => d.close();

    async function zeichnen() {
      const alle_ = (await gueltig('rechnung')).sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || String(b.nr).localeCompare(String(a.nr), 'de', { numeric: true }));
      const offen = alle_.filter((r) => !r.bezahlt), ueber = alle_.filter(ueberfaellig);
      const summe = (l) => l.reduce((s, r) => s + (r.betragRappen || 0), 0);
      d.querySelector('[data-summen]').innerHTML =
        `<div><b>${alle_.length}</b><span>Rechnungen</span></div>` +
        `<div><b>${alle_.filter((r) => !r.gesendet).length}</b><span>Nicht gesendet</span></div>` +
        `<div class="${ueber.length ? 'rot' : 'blau'}"><b>${chfText(summe(offen))}</b><span>Offen${ueber.length ? `, davon ${ueber.length} überfällig` : ''}</span></div>` +
        `<div class="gruen"><b>${chfText(summe(alle_.filter((r) => r.bezahlt)))}</b><span>Bezahlt</span></div>`;
      d.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('an', b.getAttribute('data-f') === ueFilter));
      const s = ueSuche.trim().toLowerCase();
      const liste = alle_.filter((r) => ({
        alle: true, nichtGesendet: !r.gesendet, gesendet: r.gesendet && !r.bezahlt, ueberfaellig: ueberfaellig(r), bezahlt: r.bezahlt,
      })[ueFilter]).filter((r) => !s || [r.nr, r.kunde, r.empfaenger, adresseVon(r)].join(' ').toLowerCase().includes(s));
      const box = d.querySelector('[data-liste]');
      if (!liste.length && !alle_.length) {
        box.innerHTML = `<div class="nr-ue-leer"><p>Hier sind noch keine Rechnungen.</p>
          <p>${benutzer ? 'Ihre bisherigen Rechnungen vom Mac holen Sie mit diesem Knopf herein.' : 'Melden Sie sich zuerst an. Danach können Sie Ihre bisherigen Rechnungen vom Mac übernehmen.'}</p>
          <div class="nr-ue-knoepfe" style="justify-content:center;margin-top:12px"><button class="gruen" data-leer>${benutzer ? 'Rechnungen vom Mac übernehmen' : 'Anmelden'}</button></div></div>`;
        box.querySelector('[data-leer]').onclick = () => { d.close(); benutzer ? importieren() : anmeldenZeigen(); };
        return;
      }
      if (!liste.length) { box.innerHTML = '<p class="nr-ue-leer">Keine Rechnung passt zu dieser Auswahl.</p>'; return; }
      box.innerHTML = liste.map((r) => {
        const an = adresseVon(r);
        const gesendetText = !r.gesendet ? 'Noch nicht gesendet'
          : (r.gesendetAm ? zeitText(r.gesendetAm) : 'Ja') + (an ? `<span>an ${esc(an)}</span>` : '');
        const bezahltText = r.bezahlt ? (r.bezahltAm ? datumText(r.bezahltAm) : 'Ja')
          : ueberfaellig(r) ? `Überfällig seit ${datumText(r.faellig)}` : (r.faellig ? `Fällig am ${datumText(r.faellig)}` : 'Offen');
        return `<div class="nr-ue-karte" data-datei="${esc(r.datei)}">
          <div class="oben"><b>Nr. ${esc(r.nr || '?')} · ${esc(r.kunde || 'Ohne Kunde')}</b><span class="betrag">${chfText(r.betragRappen)}</span></div>
          <div class="klein">Rechnung vom ${datumText(r.datum)}${r.empfaenger ? ' · Zahlung an ' + esc(r.empfaenger) : ''}</div>
          <div class="nr-ue-weg">
            <div class="nr-ue-schritt ja"><b><i></i>Gespeichert</b><span>${zeitText(r.zuletztGesichert || r.erstellt)}</span></div>
            <div class="nr-ue-schritt ${r.gesendet ? 'ja' : ''}"><b><i></i>Gesendet</b><span>${gesendetText}</span></div>
            <div class="nr-ue-schritt ${r.bezahlt ? 'ja' : ueberfaellig(r) ? 'warn' : ''}"><b><i></i>Bezahlt</b><span>${bezahltText}</span></div>
          </div>
          <div class="nr-ue-knoepfe">
            <button data-a="pdf">PDF ansehen</button>
            <button data-a="bearbeiten">Bearbeiten</button>
            <button data-a="bezahlt" class="${r.bezahlt ? '' : 'gruen'}">${r.bezahlt ? 'Wieder offen' : 'Als bezahlt markieren'}</button>
            <button data-a="loeschen" class="rot">Löschen</button>
          </div>
        </div>`;
      }).join('');
    }

    d.querySelector('[data-filter]').onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) { ueFilter = b.getAttribute('data-f'); zeichnen(); } };
    d.querySelector('[data-suche]').oninput = (e) => { ueSuche = e.target.value; zeichnen(); };
    d.querySelector('[data-liste]').onclick = async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const r = await nachDatei(b.closest('[data-datei]').getAttribute('data-datei'));
      if (!r) return;
      const a = b.getAttribute('data-a');
      if (a === 'pdf') {
        const blob = await pdfHolen(r);
        if (blob) pdfZeigen(blob, r.datei);
        else alert('Das PDF ist auf diesem Gerät noch nicht da. Bitte kurz warten, bis der Abgleich fertig ist.');
      } else if (a === 'bearbeiten') {
        d.close();
        if (window.__nasuvia && window.__nasuvia.rechnungOeffnen) window.__nasuvia.rechnungOeffnen(r.datei);
      } else if (a === 'loeschen') {
        if (!confirm(`Rechnung Nr. ${r.nr} an ${r.kunde || 'Kunde'} über ${chfText(r.betragRappen)} wirklich löschen?\n\nSie verschwindet auf allen Geräten und aus der Buchhaltung. Das lässt sich nicht rückgängig machen.`)) return;
        await speichern('rechnung', [{ ...r, geloescht: true }]);
        const t = (await db()).transaction('pdf', 'readwrite'); t.objectStore('pdf').delete(r.id);
        if (window.__nasuvia && window.__nasuvia.listenNeu) window.__nasuvia.listenNeu();
        zeichnen();
      } else if (a === 'bezahlt') {
        await speichern('rechnung', [{ ...r, bezahlt: !r.bezahlt, bezahltAm: r.bezahlt ? '' : heute() }]);
        if (window.__nasuvia && window.__nasuvia.listenNeu) window.__nasuvia.listenNeu();
        zeichnen();
      }
    };
    zeichnen();
  }

  function uebersichtKnopf() {
    const kopf = document.querySelector('.panel-head');
    if (!kopf || kopf.querySelector('.nr-ue-knopf')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nr-ue-knopf';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Übersicht';
    b.onclick = uebersichtZeigen;
    kopf.appendChild(b);
    // Zurück zur Buchhaltung, gleich über dem Logo
    const z = document.createElement('a');
    z.href = '../';
    z.className = 'nr-zurueck';
    z.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Zur Buchhaltung';
    kopf.parentNode.insertBefore(z, kopf);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', uebersichtKnopf); else uebersichtKnopf();

  /* ---------- Bisherige Rechnungen aus der Mac-App übernehmen ---------- */
  function importieren() {
    const d = dialog(`
      <h3>Rechnungen vom Mac übernehmen</h3>
      <p>Öffnen Sie auf dem Schreibtisch den Ordner „Nasuvia Rechnungen“. Wählen Sie dort die Datei <b>rechnungen.json</b> und alle PDFs im Ordner des Jahres aus (mit gedrückter Befehlstaste mehrere anklicken).</p>
      <input type="file" multiple accept=".json,.pdf,application/json,application/pdf" data-dateien>
      <p class="nr-fehler" data-fehler></p>
      <div class="reihe"><button class="haupt" data-los>Übernehmen</button><button class="leise" data-zu>Abbrechen</button></div>`);
    d.querySelector('[data-zu]').onclick = () => d.close();
    d.querySelector('[data-los]').onclick = async () => {
      const dateien = [...d.querySelector('[data-dateien]').files];
      const json = dateien.find((f) => /\.json$/i.test(f.name) && /rechnungen/i.test(f.name));
      const ent = dateien.find((f) => /entwuerfe\.json$/i.test(f.name));
      if (!json) { d.querySelector('[data-fehler]').textContent = 'Bitte die Datei rechnungen.json mit auswählen.'; return; }
      try {
        const register = JSON.parse(await json.text());
        const pdfs = new Map(dateien.filter((f) => /\.pdf$/i.test(f.name)).map((f) => [f.name, f]));
        const eintraege = [], blobs = [];
        for (const r of register) {
          if (!r.datei) continue;
          const id = 'rg-' + r.datei.replace(/\.pdf$/, '');
          const { pfad, ...rest } = r;
          eintraege.push({ ...rest, id, daten: r.daten ? nurDaten(r.daten) : null });
          if (pdfs.has(r.datei)) blobs.push({ id, blob: pdfs.get(r.datei), hochgeladen: false });
        }
        await speichern('rechnung', eintraege);
        await roh('pdf', blobs);
        // Kunden und Zahlungsempfänger aus der neuesten Rechnung
        const neueste = [...register].filter((r) => r.daten).sort((a, b) => (b.erstellt || '').localeCompare(a.erstellt || ''))[0];
        if (neueste) {
          const mische = (alt, neu) => { const ids = new Set(alt.map((x) => x.id)); return alt.concat((neu || []).filter((x) => !ids.has(x.id))); };
          const k = mische(JSON.parse(lies(KEY_KUNDEN) || '[]'), neueste.daten.kunden);
          const e = mische(JSON.parse(lies(KEY_EMPF) || '[]'), neueste.daten.empfaengerListe);
          if (k.length) localStorage.setItem(KEY_KUNDEN, JSON.stringify(k));
          if (e.length) localStorage.setItem(KEY_EMPF, JSON.stringify(e));
          if (window.__nasuvia && window.__nasuvia.stammNeu) window.__nasuvia.stammNeu();
        }
        if (ent) {
          const liste = JSON.parse(await ent.text());
          await speichern('entwurf', liste.map((x) => ({ ...x, id: 'rgentwurf-' + x.id, zeit: x.geaendert })));
        }
        d.close();
        if (window.__nasuvia && window.__nasuvia.listenNeu) window.__nasuvia.listenNeu();
        abgleichen();
        const fertig = dialog(`<h3>Übernommen</h3><p>${eintraege.length} Rechnungen und ${blobs.length} PDFs sind übernommen. Sie werden jetzt mit allen Geräten abgeglichen.</p><div class="reihe"><button class="haupt" data-zu>Gut</button></div>`);
        fertig.querySelector('[data-zu]').onclick = () => fertig.close();
      } catch (e) {
        d.querySelector('[data-fehler]').textContent = 'Das hat nicht geklappt: ' + (e.message || e);
      }
    };
  }

  sb.auth.onAuthStateChange((ereignis, sitzung) => {
    const vorher = benutzer && benutzer.id;
    benutzer = sitzung ? sitzung.user : null;
    if (benutzer && benutzer.id !== vorher) setTimeout(abgleichen, 0);
    melden();
  });
  addEventListener('online', abgleichen);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') abgleichen(); });
  setInterval(() => { if (document.visibilityState === 'visible') abgleichen(); }, 60000);
  document.addEventListener('DOMContentLoaded', melden);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
})();
