# 🧬 BioQuiz – nauka związków biologicznych

Aplikacja webowa w formie quizu, która pomaga studentom (bio)informatyki, biotechnologii i biologii
nauczyć się najważniejszych związków: aminokwasów, zasad azotowych, nukleotydów, koenzymów, cukrów,
metabolitów, lipidów, neuroprzekaźników i witamin.

Pytania są **generowane automatycznie z bazy danych** (`data/compounds.json`), więc dodanie nowego
związku do bazy od razu daje nowe pytania – bez zmian w kodzie.

## Funkcje

- **10 rodzajów pytań**, m.in.:
  - nazwa → wzór sumaryczny i wzór → nazwa,
  - opis (funkcja biologiczna) → nazwa,
  - struktura chemiczna (obrazek z PubChem) → nazwa,
  - klasa związku oraz grupa w obrębie klasy (np. puryna/pirymidyna, aminokwas polarny/zasadowy),
  - kody aminokwasów (trzyliterowe i jednoliterowe) w obie strony,
  - czy aminokwas jest egzogenny.
- **Inteligentne błędne odpowiedzi** – losowane głównie z tej samej klasy związków; izomery
  (np. glukoza/fruktoza/galaktoza) nigdy nie są podsuwane jako „błędne” przy pytaniu o wzór.
- **Wyjaśnienie po każdej odpowiedzi** – karta związku z wzorem, masą molową, opisem i linkiem do PubChem.
- **Powtórka błędów** – aplikacja zapamiętuje (w przeglądarce) związki, z którymi masz problem,
  i pozwala zrobić quiz tylko z nich.
- **Przeglądarka bazy** z wyszukiwarką (nazwa, wzór, skrót, opis).
- Obsługa klawiatury (1–4, Enter), tryb ciemny, widok mobilny.

## Uruchomienie lokalne

Aplikacja to statyczna strona (HTML + JavaScript, bez frameworków i bez instalowania zależności).
Ze względu na wczytywanie pliku JSON trzeba ją otworzyć przez serwer HTTP, a nie bezpośrednio z dysku:

```bash
python3 -m http.server 8000
# lub: npm start
```

i otworzyć <http://localhost:8000>.

## Publikacja na GitHub Pages

Workflow `.github/workflows/pages.yml` publikuje stronę po każdym pushu na gałąź `main`.
Jednorazowo trzeba go włączyć: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Strona będzie dostępna pod adresem `https://<użytkownik>.github.io/bioinfa/`.

## Baza danych związków

Plik `data/compounds.json` zawiera słownik kategorii i listę związków. Przykładowy rekord:

```json
{
  "id": "gly",
  "nazwa": "Glicyna",
  "nazwa_en": "Glycine",
  "kategoria": "aminokwas",
  "grupa": "niepolarny",
  "wzor": "C2H5NO2",
  "masa": 75.07,
  "skrot3": "Gly",
  "skrot1": "G",
  "pubchem_cid": 750,
  "opis": "Najmniejszy aminokwas – łańcuchem bocznym jest atom wodoru, jedyny aminokwas achiralny."
}
```

| Pole | Wymagane | Opis |
|---|---|---|
| `id` | tak | unikalny identyfikator (małe litery, cyfry, `-`) |
| `nazwa`, `nazwa_en` | tak | nazwa polska i angielska |
| `kategoria` | tak | klucz z obiektu `kategorie` |
| `wzor` | tak | wzór sumaryczny bez ładunku i nawiasów, np. `C6H12O6` |
| `masa` | tak | masa molowa w g/mol – walidator sprawdza zgodność ze wzorem |
| `opis` | tak | krótki opis funkcji/cech (używany w pytaniach „opis → nazwa”) |
| `grupa` | nie | podgrupa w obrębie kategorii (pytania „nazwa → grupa”) |
| `skrot3`, `skrot1` | nie* | skróty; *wymagane dla aminokwasów |
| `egzogenny` | nie | `true` dla aminokwasów egzogennych |
| `pubchem_cid` | nie | identyfikator PubChem – pozwala pokazać strukturę |

### Jak dodać związek

1. Dopisz rekord do `data/compounds.json` (CID i wzór najłatwiej znaleźć na <https://pubchem.ncbi.nlm.nih.gov/>).
2. Uruchom walidację i testy (wymagany Node.js ≥ 20):
   ```bash
   npm run validate
   npm test
   ```
3. Zrób commit i pull request – GitHub Actions automatycznie sprawdzi bazę.

Nowy rodzaj pytania dodaje się, dopisując obiekt do tablicy `TYPY_PYTAN` w `js/quiz.js`.

## Struktura projektu

```
index.html               – interfejs
css/style.css            – wygląd
js/quiz.js               – logika generowania pytań (czyste funkcje, testowane)
js/app.js                – obsługa interfejsu
data/compounds.json      – baza związków
scripts/validate.mjs     – walidator bazy (pola, duplikaty, masa vs wzór)
tests/quiz.test.mjs      – testy (node --test)
.github/workflows/       – CI i publikacja na GitHub Pages
```

## Źródła

Wzory, masy molowe i identyfikatory struktur pochodzą z bazy [PubChem](https://pubchem.ncbi.nlm.nih.gov/) (NCBI).
