// Abgleich mit Supabase: Login und automatisches Hoch- und Herunterladen.
// Lokal bleibt alles in IndexedDB; Supabase hält die gemeinsame Fassung für iPhone und Mac.
(() => {
  const URL_PROJEKT = 'https://dyepnomhidubsfwyorke.supabase.co';
  const SCHLUESSEL = 'sb_publishable_zEmC1R5vq234zR6ST7PTmA_uY7Z1-ph';
  const ARTEN = ['buchungen', 'belege', 'einstellungen'];
  const K_SEIT = 'nb.abgleich.seit';
  const K_ZULETZT = 'nb.abgleich.zuletzt';

  const sb = window.supabase.createClient(URL_PROJEKT, SCHLUESSEL, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nb.anmeldung' },
  });

  let benutzer = null;
  let laeuft = null;
  let nochmal = false;
  let fehler = '';
  const zuhoerer = new Set();

  const lies = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const setz = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const melden = (geholt) => zuhoerer.forEach((f) => { try { f(geholt); } catch {} });

  // Was auf den Server geht: alles ausser dem Abgleich-Merker und der Belegdatei
  const fuerServer = (e) => { const { offen, daten, ...rest } = e; return rest; };

  async function hochladen(uid) {
    for (const art of ARTEN) {
      const offen = (await Speicher.alleMitGeloeschten(art)).filter((e) => e.offen !== false);
      if (!offen.length) continue;
      if (art === 'belege') {
        for (const b of offen) {
          if (b.geloescht) await sb.storage.from('belege').remove([`${uid}/${b.id}`]);
          else if (b.daten) {
            const { error } = await sb.storage.from('belege').upload(`${uid}/${b.id}`, b.daten, { upsert: true, contentType: b.typ || 'application/octet-stream' });
            if (error) throw error;
          }
        }
      }
      for (let i = 0; i < offen.length; i += 200) {
        const teil = offen.slice(i, i + 200);
        const { error } = await sb.from('datensaetze').upsert(teil.map((e) => ({
          user_id: uid, id: e.id, art, daten: fuerServer(e),
          geaendert: e.geaendert || new Date().toISOString(), geloescht: !!e.geloescht,
        })), { onConflict: 'user_id,id' });
        if (error) throw error;
        // Nur als abgeglichen markieren, was sich in der Zwischenzeit nicht wieder geändert hat
        const jetzt = new Map((await Speicher.alleMitGeloeschten(art)).map((e) => [e.id, e]));
        await Speicher.roh(art, teil.filter((e) => jetzt.get(e.id) && jetzt.get(e.id).geaendert === e.geaendert)
          .map((e) => ({ ...jetzt.get(e.id), offen: false })));
      }
    }
  }

  async function herunterholen(uid) {
    // Eine Minute Puffer, falls Änderungen anderer Geräte zeitgleich eintreffen
    const seit = lies(K_SEIT);
    const ab = seit ? new Date(new Date(seit).getTime() - 60000).toISOString() : '1970-01-01T00:00:00Z';
    let geholt = 0;
    let neuester = seit;
    for (let von = 0; ; von += 500) {
      const { data, error } = await sb.from('datensaetze').select('id,art,daten,geaendert,geloescht,aktualisiert')
        .gt('aktualisiert', ab).order('aktualisiert').range(von, von + 499);
      if (error) throw error;
      for (const art of ARTEN) {
        const zeilen = data.filter((z) => z.art === art);
        if (!zeilen.length) continue;
        const lokal = new Map((await Speicher.alleMitGeloeschten(art)).map((e) => [e.id, e]));
        const neu = [];
        for (const z of zeilen) {
          const l = lokal.get(z.id);
          if (l && new Date(l.geaendert || 0) >= new Date(z.geaendert)) continue;
          const e = { ...z.daten, id: z.id, geaendert: z.geaendert, geloescht: z.geloescht, offen: false };
          if (art === 'belege') {
            e.daten = null;
            if (!z.geloescht) {
              const { data: blob } = await sb.storage.from('belege').download(`${uid}/${z.id}`);
              e.daten = blob || (l && l.daten) || null;
            }
          }
          neu.push(e);
        }
        if (neu.length) { await Speicher.roh(art, neu); geholt += neu.length; }
      }
      if (data.length) neuester = data[data.length - 1].aktualisiert;
      if (data.length < 500) break;
    }
    if (neuester) setz(K_SEIT, neuester);
    return geholt;
  }

  async function abgleichen() {
    if (!benutzer) return;
    if (laeuft) { nochmal = true; return laeuft; }
    laeuft = (async () => {
      let geholt = 0;
      try {
        do {
          nochmal = false;
          await hochladen(benutzer.id);
          geholt += await herunterholen(benutzer.id);
        } while (nochmal);
        fehler = '';
        setz(K_ZULETZT, new Date().toISOString());
      } catch (e) {
        fehler = navigator.onLine === false ? 'Kein Internet. Der Abgleich läuft, sobald die Verbindung wieder da ist.'
          : 'Abgleich hat nicht geklappt: ' + (e.message || e);
      } finally {
        laeuft = null;
        melden(geholt);
      }
    })();
    return laeuft;
  }

  let zeitgeber;
  const baldAbgleichen = () => { clearTimeout(zeitgeber); zeitgeber = setTimeout(abgleichen, 1500); };
  Speicher.beiAenderung = baldAbgleichen;

  sb.auth.onAuthStateChange((ereignis, sitzung) => {
    const vorher = benutzer && benutzer.id;
    benutzer = sitzung ? sitzung.user : null;
    if (benutzer && benutzer.id !== vorher) setTimeout(abgleichen, 0);
    if (!benutzer) melden(0);
  });
  addEventListener('online', abgleichen);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') abgleichen(); });
  setInterval(() => { if (document.visibilityState === 'visible') abgleichen(); }, 60000);

  const deutsch = (e) => {
    const m = (e && e.message) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'E-Mail oder Passwort stimmt nicht.';
    if (/Email not confirmed/i.test(m)) return 'Bitte zuerst die E-Mail bestätigen (Link im Posteingang).';
    if (/already registered/i.test(m)) return 'Für diese E-Mail gibt es schon ein Konto. Bitte anmelden.';
    if (/at least 6/i.test(m) || /Password should/i.test(m)) return 'Das Passwort muss mindestens 6 Zeichen haben.';
    if (/Signups not allowed/i.test(m)) return 'Neue Konten sind gesperrt. Bitte mit dem bestehenden Konto anmelden.';
    return m;
  };

  window.Abgleich = {
    get benutzer() { return benutzer; },
    get laeuft() { return !!laeuft; },
    get fehler() { return fehler; },
    get zuletzt() { return lies(K_ZULETZT); },
    beiAenderung(f) { zuhoerer.add(f); },
    jetzt: abgleichen,
    // Rechnungen aus der Rechnungs-App (gleiche Tabelle, Art „rechnung“)
    async rechnungenHolen() {
      if (!benutzer) return [];
      const { data, error } = await sb.from('datensaetze').select('daten,geloescht').eq('art', 'rechnung');
      if (error) throw error;
      return data.map((z) => ({ ...z.daten, geloescht: z.geloescht }));
    },
    async anmelden(email, passwort) {
      const { error } = await sb.auth.signInWithPassword({ email, password: passwort });
      if (error) throw new Error(deutsch(error));
    },
    async registrieren(email, passwort) {
      const { data, error } = await sb.auth.signUp({ email, password: passwort });
      if (error) throw new Error(deutsch(error));
      return !data.session; // true: E-Mail muss noch bestätigt werden
    },
    async abmelden() {
      // Nur auf diesem Gerät abmelden: klappt sofort, auch ohne Netz
      await sb.auth.signOut({ scope: 'local' });
      setz(K_SEIT, null);
      setz(K_ZULETZT, null);
    },
  };
})();
