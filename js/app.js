import { TYPY_PYTAN, generujQuiz, formatujWzor, adresStruktury, adresPubChem } from './quiz.js';

const KLUCZ_TRUDNE = 'bioquiz-trudne';
const KLUCZ_USTAWIENIA = 'bioquiz-ustawienia';

const $ = (sel) => document.querySelector(sel);

/** Tworzy element DOM: el('p', { class: 'x' }, 'tekst', dziecko). */
function el(tag, atrybuty = {}, ...dzieci) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(atrybuty)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...dzieci.flat().filter((d) => d !== null && d !== undefined && d !== false));
  return e;
}

// --- Pamięć przeglądarki (może być niedostępna, np. w trybie prywatnym) ---
function czytaj(klucz, domyslnie) {
  try {
    return JSON.parse(localStorage.getItem(klucz)) ?? domyslnie;
  } catch {
    return domyslnie;
  }
}
function zapisz(klucz, wartosc) {
  try {
    localStorage.setItem(klucz, JSON.stringify(wartosc));
  } catch {
    /* brak pamięci – trudno */
  }
}

// --- Stan aplikacji ---
let db;
let indeks; // id → związek
const stan = { pytania: [], nr: 0, punkty: 0, pominiete: 0, bledy: [], odpowiedziano: false };

async function init() {
  try {
    const odp = await fetch('data/compounds.json');
    if (!odp.ok) throw new Error(`HTTP ${odp.status}`);
    db = await odp.json();
  } catch (e) {
    document.querySelector('main').replaceChildren(
      el('p', { class: 'komunikat' },
        `Nie udało się wczytać bazy związków (${e.message}). `,
        'Jeśli otwierasz plik lokalnie, uruchom serwer: python3 -m http.server'),
    );
    return;
  }
  indeks = new Map(db.zwiazki.map((z) => [z.id, z]));
  zbudujStart();
  zbudujBaze();
  podepnijZdarzenia();
}

// --- Ekran startowy ---
function zbudujStart() {
  const ustawienia = czytaj(KLUCZ_USTAWIENIA, {});
  const liczności = {};
  for (const z of db.zwiazki) liczności[z.kategoria] = (liczności[z.kategoria] ?? 0) + 1;

  $('#lista-kategorii').replaceChildren(
    ...Object.entries(db.kategorie).map(([id, nazwa]) =>
      el('label', { class: 'opcja' },
        el('input', { type: 'checkbox', name: 'kategoria', value: id,
          checked: !ustawienia.kategorie || ustawienia.kategorie.includes(id) }),
        ` ${nazwa} `, el('small', {}, `(${liczności[id] ?? 0})`)),
    ),
  );
  $('#lista-typow').replaceChildren(
    ...TYPY_PYTAN.map((t) =>
      el('label', { class: 'opcja' },
        el('input', { type: 'checkbox', name: 'typ', value: t.id,
          checked: !ustawienia.typy || ustawienia.typy.includes(t.id) }),
        ` ${t.etykieta}`),
    ),
  );
  if (ustawienia.liczba) $('#liczba-pytan').value = String(ustawienia.liczba);
  odswiezLicznikBledow();
}

function odswiezLicznikBledow() {
  const trudne = Object.keys(czytaj(KLUCZ_TRUDNE, {})).filter((id) => indeks.has(id));
  $('#liczba-bledow').textContent = trudne.length;
  $('#tryb-bledow').disabled = trudne.length === 0;
  if (!trudne.length) $('#tryb-bledow').checked = false;
}

const zaznaczone = (nazwa) =>
  [...document.querySelectorAll(`input[name="${nazwa}"]:checked`)].map((i) => i.value);

function rozpocznij({ tylkoId } = {}) {
  const kategorie = zaznaczone('kategoria');
  const typy = zaznaczone('typ');
  const liczba = Number($('#liczba-pytan').value);
  zapisz(KLUCZ_USTAWIENIA, { kategorie, typy, liczba });

  if (!tylkoId && $('#tryb-bledow').checked) {
    tylkoId = new Set(Object.keys(czytaj(KLUCZ_TRUDNE, {})));
  }
  const komunikat = $('#komunikat-start');
  if (!kategorie.length || !typy.length) {
    komunikat.textContent = 'Zaznacz co najmniej jedną klasę związków i jeden rodzaj pytań.';
    komunikat.hidden = false;
    return;
  }
  // W trybie powtórki nie zawężamy kategoriami – liczy się lista związków.
  const pytania = generujQuiz(db, { kategorie: tylkoId ? [] : kategorie, typy, tylkoId, liczba });
  if (!pytania.length) {
    komunikat.textContent = 'Dla wybranych ustawień nie da się ułożyć żadnego pytania – zmień klasy lub rodzaje pytań.';
    komunikat.hidden = false;
    return;
  }
  komunikat.hidden = true;
  Object.assign(stan, { pytania, nr: 0, punkty: 0, pominiete: 0, bledy: [] });
  pokazEkran('quiz');
  pokazPytanie();
}

// --- Ekran pytania ---
function pokazPytanie() {
  const p = stan.pytania[stan.nr];
  stan.odpowiedziano = false;
  $('#postep').style.width = `${(stan.nr / stan.pytania.length) * 100}%`;
  $('#numer-pytania').textContent = `Pytanie ${stan.nr + 1} z ${stan.pytania.length}`;
  $('#wynik-biezacy').textContent = `${stan.punkty}`;
  $('#tresc-pytania').textContent = p.tresc;

  const wrap = $('#obrazek-wrap');
  const img = $('#obrazek-pytania');
  $('#obrazek-blad').hidden = true;
  if (p.obrazek) {
    wrap.hidden = false;
    img.hidden = false;
    img.src = p.obrazek;
  } else {
    wrap.hidden = true;
    img.removeAttribute('src');
  }

  $('#odpowiedzi').replaceChildren(
    ...p.opcje.map((tekst, i) =>
      el('button', { class: 'odpowiedz', 'data-i': i, onclick: () => odpowiedz(i) },
        el('span', { class: 'klawisz' }, String(i + 1)), tekst),
    ),
  );
  $('#wyjasnienie').hidden = true;
  $('#przycisk-dalej').hidden = true;
}

function odpowiedz(i) {
  if (stan.odpowiedziano) return;
  stan.odpowiedziano = true;
  const p = stan.pytania[stan.nr];
  const dobrze = i === p.poprawna;
  const przyciski = [...document.querySelectorAll('.odpowiedz')];
  przyciski.forEach((b) => (b.disabled = true));
  przyciski[p.poprawna].classList.add('dobrze');
  if (!dobrze) przyciski[i].classList.add('zle');

  const trudne = czytaj(KLUCZ_TRUDNE, {});
  if (dobrze) {
    stan.punkty++;
    if (trudne[p.zwiazekId]) {
      trudne[p.zwiazekId]--;
      if (trudne[p.zwiazekId] <= 0) delete trudne[p.zwiazekId];
    }
  } else {
    stan.bledy.push({ pytanie: p, wybrana: p.opcje[i] });
    trudne[p.zwiazekId] = Math.min((trudne[p.zwiazekId] ?? 0) + 1, 3);
  }
  zapisz(KLUCZ_TRUDNE, trudne);

  $('#wynik-biezacy').textContent = `${stan.punkty}`;
  const karta = $('#wyjasnienie');
  karta.replaceChildren(
    el('p', { class: dobrze ? 'werdykt dobrze' : 'werdykt zle' },
      dobrze ? '✔ Dobrze!' : `✘ Poprawna odpowiedź: ${p.opcje[p.poprawna]}`),
    kartaZwiazku(indeks.get(p.zwiazekId), { bezObrazka: Boolean(p.obrazek) }),
  );
  karta.hidden = false;
  $('#przycisk-dalej').hidden = false;
  $('#przycisk-dalej').focus();
}

function dalej() {
  stan.nr++;
  if (stan.nr >= stan.pytania.length) pokazWynik();
  else pokazPytanie();
}

function bladObrazka() {
  if (stan.odpowiedziano) return;
  $('#obrazek-pytania').hidden = true;
  $('#obrazek-blad').hidden = false;
  document.querySelectorAll('.odpowiedz').forEach((b) => (b.disabled = true));
  stan.odpowiedziano = true;
  stan.pominiete++;
  $('#przycisk-dalej').hidden = false;
}

// --- Ekran wyników ---
function pokazWynik() {
  const ocenione = stan.pytania.length - stan.pominiete;
  const procent = ocenione ? Math.round((stan.punkty / ocenione) * 100) : 0;
  const ocena = procent >= 90 ? '🏆 Świetnie!' : procent >= 70 ? '👍 Dobrze!' : procent >= 50 ? '📚 Nieźle, ale warto powtórzyć.' : '💪 Trzeba jeszcze poćwiczyć.';
  $('#podsumowanie').textContent = `${stan.punkty} / ${ocenione} (${procent}%) – ${ocena}` +
    (stan.pominiete ? ` Pominięto pytań: ${stan.pominiete}.` : '');

  $('#lista-bledow').replaceChildren(
    ...(stan.bledy.length
      ? [el('h3', {}, 'Do powtórki'),
        ...stan.bledy.map(({ pytanie, wybrana }) =>
          el('div', { class: 'karta blad' },
            el('p', { class: 'pytanie' }, pytanie.tresc),
            el('p', {}, el('span', { class: 'zle-tekst' }, `Twoja odpowiedź: ${wybrana}`), el('br'),
              el('span', { class: 'dobrze-tekst' }, `Poprawna: ${pytanie.opcje[pytanie.poprawna]}`)),
          ))]
      : [el('p', {}, 'Bez błędów – gratulacje! 🎉')]),
  );
  $('#przycisk-powtorz').hidden = !stan.bledy.length;
  odswiezLicznikBledow();
  pokazEkran('wynik');
}

// --- Karta związku (wyjaśnienie i przeglądarka bazy) ---
function kartaZwiazku(z, { bezObrazka = false } = {}) {
  const kody = [z.skrot3, z.skrot1].filter(Boolean).join(' / ');
  return el('article', { class: 'zwiazek' },
    !bezObrazka && z.pubchem_cid
      ? el('img', { class: 'struktura', src: adresStruktury(z.pubchem_cid), alt: `Struktura: ${z.nazwa}`, loading: 'lazy',
        onerror: (e) => e.target.remove() })
      : null,
    el('div', {},
      el('h3', {}, z.nazwa, ' ', el('small', {}, z.nazwa_en)),
      el('p', { class: 'cechy' },
        el('span', { class: 'znacznik' }, db.kategorie[z.kategoria] ?? z.kategoria),
        z.grupa ? el('span', { class: 'znacznik jasny' }, z.grupa) : null,
        z.egzogenny ? el('span', { class: 'znacznik jasny' }, 'egzogenny') : null),
      el('p', {},
        el('strong', {}, formatujWzor(z.wzor)), ` · ${z.masa.toFixed(2)} g/mol`,
        kody ? ` · kod: ${kody}` : ''),
      el('p', {}, z.opis),
      z.pubchem_cid
        ? el('a', { href: adresPubChem(z.pubchem_cid), target: '_blank', rel: 'noopener' }, 'Zobacz w PubChem ↗')
        : null,
    ),
  );
}

// --- Przeglądarka bazy ---
function zbudujBaze() {
  $('#filtr-kategorii').append(
    ...Object.entries(db.kategorie).map(([id, nazwa]) => el('option', { value: id }, nazwa)),
  );
  filtrujBaze();
}

function normalizuj(s) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function filtrujBaze() {
  const fraza = normalizuj($('#szukaj').value.trim());
  const kat = $('#filtr-kategorii').value;
  const wyniki = db.zwiazki.filter((z) => {
    if (kat && z.kategoria !== kat) return false;
    if (!fraza) return true;
    const tekst = normalizuj([z.nazwa, z.nazwa_en, z.wzor, z.skrot3, z.skrot1, z.grupa, z.opis].filter(Boolean).join(' '));
    return tekst.includes(fraza);
  });
  $('#licznik-bazy').textContent = `Znaleziono: ${wyniki.length} z ${db.zwiazki.length}`;
  $('#lista-zwiazkow').replaceChildren(...wyniki.map((z) => el('div', { class: 'karta' }, kartaZwiazku(z))));
}

// --- Nawigacja i zdarzenia ---
function pokazEkran(nazwa) {
  for (const s of document.querySelectorAll('.ekran')) s.hidden = s.id !== `ekran-${nazwa}`;
  const zakladka = nazwa === 'baza' ? 'baza' : 'start';
  for (const b of document.querySelectorAll('.zakladka')) b.classList.toggle('aktywna', b.dataset.ekran === zakladka);
  window.scrollTo(0, 0);
}

function podepnijZdarzenia() {
  for (const b of document.querySelectorAll('.zakladka')) {
    b.addEventListener('click', () => {
      // Powrót do zakładki „Quiz” w trakcie quizu wraca do bieżącego pytania.
      if (b.dataset.ekran === 'start' && stan.pytania.length && stan.nr < stan.pytania.length) pokazEkran('quiz');
      else pokazEkran(b.dataset.ekran);
    });
  }
  for (const b of document.querySelectorAll('[data-zaznacz]')) {
    b.addEventListener('click', () => {
      const pola = document.querySelectorAll(`input[name="${b.dataset.zaznacz === 'typy' ? 'typ' : 'kategoria'}"]`);
      const wszystkie = [...pola].every((p) => p.checked);
      pola.forEach((p) => (p.checked = !wszystkie));
    });
  }
  $('#przycisk-start').addEventListener('click', () => rozpocznij());
  $('#przycisk-dalej').addEventListener('click', dalej);
  $('#przycisk-zakoncz').addEventListener('click', () => {
    stan.pytania = stan.pytania.slice(0, stan.nr + (stan.odpowiedziano ? 1 : 0));
    if (!stan.pytania.length) {
      pokazEkran('start');
      return;
    }
    stan.nr = stan.pytania.length;
    pokazWynik();
  });
  $('#przycisk-nowy').addEventListener('click', () => {
    stan.pytania = [];
    pokazEkran('start');
  });
  $('#przycisk-powtorz').addEventListener('click', () => {
    rozpocznij({ tylkoId: new Set(stan.bledy.map((b) => b.pytanie.zwiazekId)) });
  });
  $('#obrazek-pytania').addEventListener('error', bladObrazka);
  $('#szukaj').addEventListener('input', filtrujBaze);
  $('#filtr-kategorii').addEventListener('change', filtrujBaze);

  document.addEventListener('keydown', (e) => {
    if ($('#ekran-quiz').hidden || e.target.matches('input, select, textarea')) return;
    if (/^[1-9]$/.test(e.key) && !stan.odpowiedziano) {
      const i = Number(e.key) - 1;
      if (i < stan.pytania[stan.nr].opcje.length) odpowiedz(i);
    } else if (e.key === 'Enter' && stan.odpowiedziano && document.activeElement?.id !== 'przycisk-dalej') {
      dalej();
    }
  });
}

init();
