// Logika quizu – czyste funkcje bez dostępu do DOM, dzięki czemu można je testować w Node.

const SUBSKRYPTY = '₀₁₂₃₄₅₆₇₈₉';

/** Zamienia cyfry we wzorze sumarycznym na indeksy dolne, np. C6H12O6 → C₆H₁₂O₆. */
export function formatujWzor(wzor) {
  return wzor.replace(/\d/g, (c) => SUBSKRYPTY[Number(c)]);
}

export function adresStruktury(cid) {
  return `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG`;
}

export function adresPubChem(cid) {
  return `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;
}

const tylkoAminokwasy = (z) => z.kategoria === 'aminokwas';

/**
 * Typy pytań. Każdy typ opisuje:
 *  - pasuje(z)       – czy pytanie można zadać o dany związek,
 *  - tresc(z, db)    – treść pytania,
 *  - odpowiedz(z, db) – poprawna odpowiedź (tekst),
 *  - klucz(z)        – związki o tym samym kluczu nie mogą być dystraktorami
 *                      (np. izomery przy pytaniu „wzór → nazwa”),
 *  - pula(cel, z)    – opcjonalnie zawęża zbiór związków, z których losujemy dystraktory,
 *  - stale           – opcjonalnie stały zestaw odpowiedzi (np. Tak/Nie).
 */
export const TYPY_PYTAN = [
  {
    id: 'nazwa-wzor',
    etykieta: 'Nazwa → wzór sumaryczny',
    pasuje: (z) => Boolean(z.wzor),
    tresc: (z) => `Jaki jest wzór sumaryczny związku: ${z.nazwa}?`,
    odpowiedz: (z) => formatujWzor(z.wzor),
  },
  {
    id: 'wzor-nazwa',
    etykieta: 'Wzór sumaryczny → nazwa',
    pasuje: (z) => Boolean(z.wzor),
    tresc: (z) => `Który związek ma wzór sumaryczny ${formatujWzor(z.wzor)}?`,
    odpowiedz: (z) => z.nazwa,
    klucz: (z) => z.wzor,
  },
  {
    id: 'opis-nazwa',
    etykieta: 'Opis → nazwa',
    pasuje: (z) => Boolean(z.opis),
    tresc: (z) => `Który związek pasuje do opisu?\n„${ukryjNazwe(z)}”`,
    odpowiedz: (z) => z.nazwa,
    klucz: (z) => z.id,
  },
  {
    id: 'struktura-nazwa',
    etykieta: 'Struktura → nazwa (obrazek z PubChem)',
    pasuje: (z) => Boolean(z.pubchem_cid),
    tresc: () => 'Jaki związek przedstawia ta struktura?',
    obrazek: (z) => adresStruktury(z.pubchem_cid),
    odpowiedz: (z) => z.nazwa,
    klucz: (z) => z.id,
  },
  {
    id: 'nazwa-kategoria',
    etykieta: 'Nazwa → klasa związku',
    pasuje: (z) => Boolean(z.kategoria),
    tresc: (z) => `Do jakiej klasy związków należy: ${z.nazwa}?`,
    odpowiedz: (z, db) => db.kategorie[z.kategoria] ?? z.kategoria,
    klucz: (z) => z.kategoria,
  },
  {
    id: 'nazwa-grupa',
    etykieta: 'Nazwa → grupa w obrębie klasy',
    pasuje: (z) => Boolean(z.grupa),
    tresc: (z, db) =>
      `Do jakiej grupy (w klasie: ${(db.kategorie[z.kategoria] ?? z.kategoria).toLowerCase()}) należy: ${z.nazwa}?`,
    odpowiedz: (z) => z.grupa,
    klucz: (z) => z.grupa,
    pula: (cel, z) => z.kategoria === cel.kategoria,
  },
  {
    id: 'aa-skrot3',
    etykieta: 'Aminokwas → kod trzyliterowy',
    pasuje: (z) => tylkoAminokwasy(z) && Boolean(z.skrot3),
    tresc: (z) => `Jaki jest kod trzyliterowy aminokwasu: ${z.nazwa}?`,
    odpowiedz: (z) => z.skrot3,
  },
  {
    id: 'aa-skrot1',
    etykieta: 'Aminokwas → kod jednoliterowy',
    pasuje: (z) => tylkoAminokwasy(z) && Boolean(z.skrot1),
    tresc: (z) => `Jaki jest kod jednoliterowy aminokwasu: ${z.nazwa}?`,
    odpowiedz: (z) => z.skrot1,
  },
  {
    id: 'aa-kod-nazwa',
    etykieta: 'Kod jednoliterowy → aminokwas',
    pasuje: (z) => tylkoAminokwasy(z) && Boolean(z.skrot1),
    tresc: (z) => `Który aminokwas oznacza się literą „${z.skrot1}”?`,
    odpowiedz: (z) => z.nazwa,
    klucz: (z) => z.skrot1,
  },
  {
    id: 'aa-egzogenny',
    etykieta: 'Czy aminokwas jest egzogenny?',
    pasuje: tylkoAminokwasy,
    tresc: (z) => `Czy ${z.nazwa.toLowerCase()} jest aminokwasem egzogennym (niezbędnym) dla dorosłego człowieka?`,
    odpowiedz: (z) => (z.egzogenny ? 'Tak' : 'Nie'),
    stale: ['Tak', 'Nie'],
  },
];

/** Usuwa nazwę związku z opisu, żeby pytanie „opis → nazwa” nie zdradzało odpowiedzi. */
export function ukryjNazwe(z) {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let opis = z.opis;
  const rdzen = z.nazwa.replace(/\s*\(.*\)\s*/g, '').trim();
  if (rdzen.length >= 4) {
    opis = opis.replace(new RegExp(escape(rdzen.slice(0, Math.max(4, rdzen.length - 2))) + '\\p{L}*', 'giu'), '…');
  }
  if (z.skrot3 && z.skrot3.length >= 3) {
    opis = opis.replace(new RegExp(`(?<![\\p{L}])${escape(z.skrot3)}(?![\\p{L}])`, 'gu'), '…');
  }
  return opis;
}

export function typPytania(id) {
  return TYPY_PYTAN.find((t) => t.id === id);
}

/** Tasowanie Fishera–Yatesa. */
export function tasuj(tablica, rng = Math.random) {
  const kopia = [...tablica];
  for (let i = kopia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [kopia[i], kopia[j]] = [kopia[j], kopia[i]];
  }
  return kopia;
}

/** Prosty deterministyczny generator liczb losowych (mulberry32) – przydatny w testach. */
export function rngZZiarnem(ziarno) {
  let a = ziarno >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tworzy jedno pytanie danego typu o danym związku.
 * Dystraktory są losowane z całej bazy (nie tylko z wybranych kategorii),
 * żeby nawet przy jednej kategorii było z czego wybierać.
 * Zwraca null, jeśli nie da się zbudować co najmniej dwóch odpowiedzi.
 */
export function utworzPytanie(typ, cel, db, { liczbaOdpowiedzi = 4, rng = Math.random } = {}) {
  if (!typ.pasuje(cel)) return null;
  const poprawna = typ.odpowiedz(cel, db);

  let opcje;
  if (typ.stale) {
    opcje = [...typ.stale];
  } else {
    const klucz = typ.klucz ?? ((z) => typ.odpowiedz(z, db));
    const kluczCelu = klucz(cel);
    const kandydaci = new Set();
    // Najpierw związki z tej samej klasy – dzięki temu błędne odpowiedzi są bardziej podchwytliwe.
    const kolejnosc = tasuj(db.zwiazki, rng).sort(
      (a, b) => (b.kategoria === cel.kategoria) - (a.kategoria === cel.kategoria),
    );
    for (const z of kolejnosc) {
      if (z === cel || !typ.pasuje(z)) continue;
      if (typ.pula && !typ.pula(cel, z)) continue;
      if (klucz(z) === kluczCelu) continue;
      const odp = typ.odpowiedz(z, db);
      if (odp !== poprawna) kandydaci.add(odp);
    }
    const dystraktory = [...kandydaci].slice(0, liczbaOdpowiedzi - 1);
    opcje = tasuj([poprawna, ...dystraktory], rng);
  }
  if (opcje.length < 2) return null;

  return {
    typ: typ.id,
    zwiazekId: cel.id,
    tresc: typ.tresc(cel, db),
    obrazek: typ.obrazek ? typ.obrazek(cel) : null,
    opcje,
    poprawna: opcje.indexOf(poprawna),
  };
}

/**
 * Generuje quiz.
 * @param db           baza w formacie data/compounds.json
 * @param opts.kategorie  lista identyfikatorów kategorii (pusta/undefined = wszystkie)
 * @param opts.typy       lista identyfikatorów typów pytań (pusta/undefined = wszystkie)
 * @param opts.tylkoId    opcjonalny zbiór id związków (np. tryb powtórki błędów)
 * @param opts.liczba     liczba pytań
 */
export function generujQuiz(db, { kategorie, typy, tylkoId, liczba = 10, rng = Math.random } = {}) {
  const zwiazki = db.zwiazki.filter(
    (z) => (!kategorie?.length || kategorie.includes(z.kategoria)) && (!tylkoId || tylkoId.has(z.id)),
  );
  const wybraneTypy = TYPY_PYTAN.filter((t) => !typy?.length || typy.includes(t.id));

  // Dla każdego typu lista związków, o które można zapytać.
  const pary = new Map();
  for (const typ of wybraneTypy) {
    const pasujace = zwiazki.filter((z) => typ.pasuje(z));
    if (pasujace.length) pary.set(typ, tasuj(pasujace, rng));
  }

  const pytania = [];
  const uzyteZwiazki = new Map(); // id → ile razy pytano
  while (pytania.length < liczba && pary.size) {
    const typ = tasuj([...pary.keys()], rng)[0];
    const lista = pary.get(typ);
    // Preferuj związki, o które jeszcze nie pytano.
    lista.sort((a, b) => (uzyteZwiazki.get(a.id) ?? 0) - (uzyteZwiazki.get(b.id) ?? 0));
    const cel = lista.shift();
    if (!lista.length) pary.delete(typ);

    const pytanie = utworzPytanie(typ, cel, db, { rng });
    if (!pytanie) continue;
    pytania.push(pytanie);
    uzyteZwiazki.set(cel.id, (uzyteZwiazki.get(cel.id) ?? 0) + 1);
  }
  return pytania;
}
