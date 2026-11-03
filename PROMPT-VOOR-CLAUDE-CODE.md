# Opdracht voor Claude Code

Je werkt in deze map: een statische website voor onze creative agency (Marcel & Menno).
Bestanden: index.html, diensten.html, werk.html, over-ons.html, contact.html, privacy.html,
style.css, main.js, package.json, .gitignore en api/cal/[...path].js (een Vercel serverless proxy naar de Cal.com API).

DOEL: zet deze site live op Vercel via GitHub, met een werkende Cal.com-koppeling.

## 1. Git & GitHub
- Initialiseer git in deze map, branch `main`.
- Remote: https://github.com/xyzmenno/portfolio-new (bestaat al, is leeg).
- Commit alles en push naar main. Gebruik mijn eigen git/gh-login op deze computer (laat mij inloggen met `gh auth login` als dat nodig is).

## 2. Vercel
- Gebruik de Vercel CLI (`npx vercel`). Laat mij inloggen als dat nodig is.
- Koppel het project aan de GitHub-repo, zodat elke push automatisch deployt.
- Framework preset: "Other", geen build command, output = de root van de repo.
- Controleer dat api/cal/[...path].js als serverless function wordt herkend (Node runtime, ESM via "type": "module" in package.json).

## 3. Cal.com API-sleutel
- De proxy leest de sleutel uit de environment variable CAL_API_KEY.
- Vraag mij om de sleutel en zet hem met `vercel env add CAL_API_KEY production` (en ook preview).
- Zet de sleutel NOOIT in code, in git of in een bestand in de repo.
- Deploy daarna opnieuw naar productie (`vercel --prod`).

## 4. Testen (niet overslaan)
- Test de proxy op de live URL:
  GET https://<live-url>/api/cal/slots?username=menno-mooibroek-vlkffv&eventTypeSlug=kennismaking&start=<vandaag ISO>&end=<over 14 dagen ISO>&timeZone=Europe/Amsterdam
  met header `cal-api-version: 2024-09-04`. Verwacht: JSON met status "success" en data per datum.
- Bij een fout: lees de response en de Vercel function logs (`vercel logs`) en los het op
  (bijv. query-parsing van de catch-all route, auth of headers).
- main.js gebruikt online eerst /api/cal en daarna pas api.cal.com (API_LIST). Controleer dat dit werkt.
- Controleer op de live site dat "Plan een call" ons eigen boekingsvenster opent met echte vrije dagen en tijden,
  en dat de knop "Eerstvolgende" op de homepage een echte tijd toont.
- Maak GEEN testboeking zonder het eerst aan mij te vragen.

## 5. Opleveren
- Geef mij de live URL.
- Vertel kort wat je hebt aangepast en of alle tests geslaagd zijn.
- Leg uit hoe ik later ons eigen domein koppel in Vercel (Settings → Domains).

Regels: verander niets aan het ontwerp of de teksten van de site, alleen wat nodig is om het werkend live te krijgen.
Vraag het als iets onduidelijk is. Praat Nederlands met mij.
