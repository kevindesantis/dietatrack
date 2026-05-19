# Guida veloce GitHub + Vercel

## Metodo senza terminale

1. Vai su GitHub.
2. Crea una nuova repository chiamata `dietatrack-pwa`.
3. Non aggiungere README, .gitignore o licenza, perché sono già nel progetto.
4. Estrai lo ZIP.
5. Entra nella cartella `dietatrack`.
6. Carica su GitHub tutti i file che vedi dentro `dietatrack`, non la cartella esterna.
7. Fai Commit.
8. Vai su Vercel.
9. Importa la repository.
10. Premi Deploy.

## Metodo con terminale

Dentro la cartella `dietatrack`:

```bash
git init
git add .
git commit -m "Initial DietaTrack PWA"
git branch -M main
git remote add origin https://github.com/TUO-USERNAME/dietatrack-pwa.git
git push -u origin main
```

Poi importi la repository su Vercel.

## Se Vercel dà errore "Couldn't find any pages or app directory"

Hai caricato la cartella sbagliata. La root della repository deve contenere direttamente:

```text
app/
lib/
public/
package.json
```

Non deve essere così:

```text
dietatrack/app/
dietatrack/lib/
dietatrack/package.json
```
