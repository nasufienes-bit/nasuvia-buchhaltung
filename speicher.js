// Speicher der Buchhaltung: IndexedDB auf dem Gerät.
// Jeder Datensatz trägt id, geaendert und geloescht. „offen“ heisst: noch nicht
// mit Supabase abgeglichen. Nach jeder lokalen Änderung meldet sich der Speicher
// über Speicher.beiAenderung, damit der Abgleich anlaufen kann.
(() => {
  const NAME = 'nasuvia-buchhaltung';
  const VERSION = 1;
  const SPEICHER = ['buchungen', 'belege', 'einstellungen'];
  let offen;

  const anfrage = (r) => new Promise((ok, fehler) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fehler(r.error);
  });

  function db() {
    if (!offen) {
      const r = indexedDB.open(NAME, VERSION);
      r.onupgradeneeded = () => {
        for (const s of SPEICHER) {
          if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' });
        }
      };
      offen = anfrage(r);
    }
    return offen;
  }

  async function laden(speicher) {
    const d = await db();
    return anfrage(d.transaction(speicher).objectStore(speicher).getAll());
  }

  async function holen(speicher, id) {
    const d = await db();
    return anfrage(d.transaction(speicher).objectStore(speicher).get(id));
  }

  async function schreiben(speicher, eintraege) {
    const d = await db();
    const t = d.transaction(speicher, 'readwrite');
    const s = t.objectStore(speicher);
    for (const e of eintraege) s.put(e);
    return new Promise((ok, fehler) => { t.oncomplete = ok; t.onerror = () => fehler(t.error); });
  }

  const gemeldet = () => { try { window.Speicher.beiAenderung && window.Speicher.beiAenderung(); } catch {} };

  const neueId = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));

  window.Speicher = {
    neueId,
    // Nur gültige (nicht gelöschte) Datensätze
    async alle(speicher) {
      return (await laden(speicher)).filter((e) => !e.geloescht);
    },
    alleMitGeloeschten: laden,
    holen,
    async speichern(speicher, eintrag) {
      const e = { ...eintrag, id: eintrag.id || neueId(), geaendert: new Date().toISOString(), offen: true };
      await schreiben(speicher, [e]);
      gemeldet();
      return e;
    },
    async mehrereSpeichern(speicher, liste) {
      const jetzt = new Date().toISOString();
      const fertig = liste.map((e) => ({ ...e, id: e.id || neueId(), geaendert: e.geaendert || jetzt, offen: true }));
      await schreiben(speicher, fertig);
      gemeldet();
      return fertig;
    },
    // Für den Abgleich: schreibt genau so, wie es kommt (Zeitstempel und offen bleiben)
    async roh(speicher, liste) {
      await schreiben(speicher, liste);
    },
    // Gelöscht wird nur markiert, damit andere Geräte die Löschung mitbekommen
    async loeschen(speicher, id) {
      const e = await holen(speicher, id);
      if (!e) return;
      const leer = speicher === 'belege' ? { daten: null } : {};
      await schreiben(speicher, [{ ...e, ...leer, geloescht: true, geaendert: new Date().toISOString(), offen: true }]);
      gemeldet();
    },
    async dauerhaftAnfragen() {
      try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch {}
    },
  };
})();
