// Sprawdza poprawność bazy data/compounds.json.
// Uruchom: npm run validate   (lub: node scripts/validate.mjs)
import { readFile } from 'node:fs/promises';

const MASY_ATOMOWE = { H: 1.008, C: 12.011, N: 14.007, O: 15.999, P: 30.974, S: 32.06, Fe: 55.845, Mg: 24.305, Co: 58.933, Na: 22.99, K: 39.098, Cl: 35.45, I: 126.904, Se: 78.971 };
const WYMAGANE = ['id', 'nazwa', 'nazwa_en', 'kategoria', 'wzor', 'masa', 'opis'];
const TOLERANCJA_MASY = 0.5; // g/mol

/** Liczy masę molową ze wzoru sumarycznego (bez nawiasów), np. C6H12O6. */
export function masaZeWzoru(wzor) {
  if (!/^([A-Z][a-z]?\d*)+$/.test(wzor)) throw new Error(`nieprawidłowy wzór „${wzor}”`);
  let masa = 0;
  for (const [, pierwiastek, liczba] of wzor.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    const m = MASY_ATOMOWE[pierwiastek];
    if (m === undefined) throw new Error(`nieznany pierwiastek „${pierwiastek}” we wzorze ${wzor}`);
    masa += m * (liczba ? Number(liczba) : 1);
  }
  return masa;
}

export function waliduj(db) {
  const bledy = [];
  if (!db.kategorie || typeof db.kategorie !== 'object') bledy.push('brak obiektu „kategorie”');
  if (!Array.isArray(db.zwiazki)) return [...bledy, 'brak tablicy „zwiazki”'];

  const ids = new Set();
  const kodyAA = { skrot1: new Set(), skrot3: new Set() };
  for (const [i, z] of db.zwiazki.entries()) {
    const gdzie = `zwiazki[${i}]${z.id ? ` (${z.id})` : ''}`;
    for (const pole of WYMAGANE) {
      if (z[pole] === undefined || z[pole] === '') bledy.push(`${gdzie}: brak pola „${pole}”`);
    }
    if (z.id) {
      if (!/^[a-z0-9-]+$/.test(z.id)) bledy.push(`${gdzie}: id może zawierać tylko małe litery, cyfry i „-”`);
      if (ids.has(z.id)) bledy.push(`${gdzie}: zduplikowane id`);
      ids.add(z.id);
    }
    if (z.kategoria && db.kategorie && !(z.kategoria in db.kategorie)) {
      bledy.push(`${gdzie}: nieznana kategoria „${z.kategoria}”`);
    }
    if (z.wzor && typeof z.masa === 'number') {
      try {
        const obliczona = masaZeWzoru(z.wzor);
        if (Math.abs(obliczona - z.masa) > TOLERANCJA_MASY) {
          bledy.push(`${gdzie}: masa ${z.masa} nie zgadza się ze wzorem ${z.wzor} (obliczona ${obliczona.toFixed(2)})`);
        }
      } catch (e) {
        bledy.push(`${gdzie}: ${e.message}`);
      }
    }
    if (z.pubchem_cid !== undefined && !(Number.isInteger(z.pubchem_cid) && z.pubchem_cid > 0)) {
      bledy.push(`${gdzie}: pubchem_cid musi być dodatnią liczbą całkowitą`);
    }
    if (z.kategoria === 'aminokwas') {
      for (const pole of ['skrot1', 'skrot3']) {
        if (!z[pole]) bledy.push(`${gdzie}: aminokwas bez pola „${pole}”`);
        else if (kodyAA[pole].has(z[pole])) bledy.push(`${gdzie}: zduplikowany kod ${pole} „${z[pole]}”`);
        else kodyAA[pole].add(z[pole]);
      }
    }
  }
  return bledy;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sciezka = new URL('../data/compounds.json', import.meta.url);
  const db = JSON.parse(await readFile(sciezka, 'utf8'));
  const bledy = waliduj(db);
  if (bledy.length) {
    console.error(`Znaleziono błędy w bazie (${bledy.length}):`);
    for (const b of bledy) console.error(`  ✘ ${b}`);
    process.exit(1);
  }
  console.log(`✔ Baza poprawna: ${db.zwiazki.length} związków w ${Object.keys(db.kategorie).length} kategoriach.`);
}
