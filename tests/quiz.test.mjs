import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TYPY_PYTAN, generujQuiz, utworzPytanie, formatujWzor, ukryjNazwe, rngZZiarnem, typPytania } from '../js/quiz.js';
import { waliduj, masaZeWzoru } from '../scripts/validate.mjs';

const db = JSON.parse(await readFile(new URL('../data/compounds.json', import.meta.url), 'utf8'));
const zwiazek = (id) => db.zwiazki.find((z) => z.id === id);

test('baza danych przechodzi walidację', () => {
  assert.deepEqual(waliduj(db), []);
});

test('masaZeWzoru liczy masę glukozy', () => {
  assert.ok(Math.abs(masaZeWzoru('C6H12O6') - 180.16) < 0.01);
  assert.throws(() => masaZeWzoru('C6H12Xx6'), /nieznany pierwiastek/);
});

test('walidator wykrywa błędną masę i zduplikowane id', () => {
  const zla = {
    kategorie: { cukier: 'Cukry' },
    zwiazki: [
      { id: 'a', nazwa: 'A', nazwa_en: 'A', kategoria: 'cukier', wzor: 'C6H12O6', masa: 100, opis: 'x' },
      { id: 'a', nazwa: 'B', nazwa_en: 'B', kategoria: 'cukier', wzor: 'C6H12O6', masa: 180.16, opis: 'x' },
    ],
  };
  const bledy = waliduj(zla);
  assert.ok(bledy.some((b) => b.includes('nie zgadza się')));
  assert.ok(bledy.some((b) => b.includes('zduplikowane id')));
});

test('formatujWzor zamienia cyfry na indeksy dolne', () => {
  assert.equal(formatujWzor('C6H12O6'), 'C₆H₁₂O₆');
});

test('ukryjNazwe usuwa nazwę związku z opisu', () => {
  assert.ok(!ukryjNazwe({ nazwa: 'Glicyna', opis: 'Glicyna jest najmniejsza.' }).includes('Glicyna'));
  assert.ok(!ukryjNazwe({ nazwa: 'Cykliczny AMP (cAMP)', skrot3: 'cAMP', opis: 'cAMP aktywuje PKA.' }).includes('cAMP'));
});

test('każde pytanie ma jedną poprawną, unikalne odpowiedzi', () => {
  const rng = rngZZiarnem(42);
  for (let i = 0; i < 20; i++) {
    for (const p of generujQuiz(db, { liczba: 50, rng })) {
      assert.ok(p.poprawna >= 0 && p.poprawna < p.opcje.length);
      assert.equal(new Set(p.opcje).size, p.opcje.length, `powtórzone odpowiedzi w: ${p.tresc}`);
      assert.ok(p.opcje.length >= 2);
    }
  }
});

test('pytanie „wzór → nazwa” nie podsuwa izomerów jako błędnych odpowiedzi', () => {
  const typ = typPytania('wzor-nazwa');
  const glukoza = zwiazek('glukoza');
  for (let i = 0; i < 50; i++) {
    const p = utworzPytanie(typ, glukoza, db, { rng: rngZZiarnem(i) });
    assert.ok(!p.opcje.includes('Fruktoza'));
    assert.ok(!p.opcje.includes('Galaktoza'));
  }
});

test('pytanie o grupę losuje dystraktory z tej samej klasy', () => {
  const typ = typPytania('nazwa-grupa');
  const p = utworzPytanie(typ, zwiazek('adenina'), db, { rng: rngZZiarnem(1) });
  assert.deepEqual([...p.opcje].sort(), ['puryna', 'pirymidyna'].sort());
});

test('filtr kategorii i typów jest respektowany', () => {
  const pytania = generujQuiz(db, { kategorie: ['aminokwas'], typy: ['aa-skrot1'], liczba: 100, rng: rngZZiarnem(7) });
  assert.equal(pytania.length, 20); // każdy aminokwas dokładnie raz
  assert.ok(pytania.every((p) => p.typ === 'aa-skrot1' && zwiazek(p.zwiazekId).kategoria === 'aminokwas'));
});

test('tryb powtórki ogranicza pytania do wskazanych związków', () => {
  const tylkoId = new Set(['atp', 'glukoza']);
  const pytania = generujQuiz(db, { tylkoId, liczba: 10, rng: rngZZiarnem(3) });
  assert.ok(pytania.length > 0);
  assert.ok(pytania.every((p) => tylkoId.has(p.zwiazekId)));
});

test('egzogenność aminokwasów zgadza się z listą 9 aminokwasów niezbędnych', () => {
  const egzogenne = db.zwiazki.filter((z) => z.egzogenny).map((z) => z.skrot3).sort();
  assert.deepEqual(egzogenne, ['His', 'Ile', 'Leu', 'Lys', 'Met', 'Phe', 'Thr', 'Trp', 'Val']);
});

test('każdy typ pytania da się zbudować dla jakiegoś związku', () => {
  for (const typ of TYPY_PYTAN) {
    const ok = db.zwiazki.some((z) => utworzPytanie(typ, z, db, { rng: rngZZiarnem(0) }));
    assert.ok(ok, `typ ${typ.id} nie generuje pytań`);
  }
});
