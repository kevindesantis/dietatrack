# DietaTrack PWA

Web app installabile su iPhone per gestire dieta, diario alimentare, calorie/macros, misure corporee, statistiche e allenamenti.

Questa versione è già collegata al tuo progetto Supabase:

- Project URL: `https://ryhjtlehmhihmeabekjx.supabase.co`
- Anon public key: già inserita in `lib/supabaseClient.js`

Non serve creare `.env.local`.

> Importante: la anon public key può stare nel frontend. Non inserire mai nel codice la `service_role key` di Supabase.

## Funzioni incluse

- Login/registrazione con email e password tramite Supabase
- Profilo personale: sesso, data nascita, altezza, peso iniziale, peso attuale, peso obiettivo e data obiettivo
- Preferenze alimentari, alimenti da evitare, allergie e intolleranze selezionabili
- Calcolo indicativo di calorie, proteine, carboidrati e grassi
- Controllo obiettivo realistico: se il tempo richiesto è troppo aggressivo, la web app propone un ritmo più sostenibile
- Generatore dieta personalizzata settimanale con opzioni modificabili per colazione, pranzo, merenda e cena
- Filtri automatici nel generatore per lattosio, glutine/celiachia, uova, pesce, crostacei/molluschi, frutta secca, arachidi, soia, sesamo, nichel alto e preferenze come vegetariano/vegano/no maiale/no pesce
- Blocco di sicurezza quando provi ad aggiungere al diario un alimento che corrisponde alle restrizioni impostate nel profilo
- Archivio alimenti con valori per 100 g
- Alimenti base già inclusi nel database
- Inserimento manuale alimenti
- Import prodotto tramite codice a barre da Open Food Facts
- Diario giornaliero diviso in colazione, pranzo, merenda, cena, extra
- Calcolo automatico calorie/macros in base ai grammi
- Obiettivi giornalieri e valori rimanenti
- Dieta settimanale con opzioni cliccabili
- Stato giornata: completata, parziale, sgarro, saltata
- Peso e misure corporee con grafico peso
- Programma allenamento settimanale e stato allenamento giornaliero
- Manifest PWA e icone per installazione su iPhone

## 1. Prima cosa: crea le tabelle su Supabase

Apri Supabase, entra nel tuo progetto e vai su **SQL Editor**.

Incolla tutto il contenuto di:

```text
supabase/database.sql
```

Poi premi **Run**.

Questo crea:

- tabelle utenti/profili
- archivio alimenti
- diario alimentare
- obiettivi giornalieri
- dieta settimanale manuale e generata
- storico generazioni dieta
- misure corporee
- allenamenti
- policy RLS per proteggere i dati utente
- alimenti base pubblici con allergeni/tag principali

## 2. Caricamento su GitHub

Crea una repository GitHub vuota, ad esempio:

```text
dietatrack-pwa
```

Carica dentro la cartella del progetto. La root della repository deve contenere direttamente:

```text
app/
lib/
public/
supabase/
package.json
next.config.mjs
README.md
```

Non caricare la cartella esterna se contiene un'altra cartella `dietatrack` dentro, altrimenti Vercel potrebbe non trovare `app/`.

## 3. Deploy su Vercel

Importa la repository GitHub su Vercel.

Impostazioni consigliate:

```text
Framework Preset: Next.js
Build Command: npm run build
Install Command: npm install
Output Directory: lascia vuoto
```

Non devi aggiungere variabili ambiente, perché Supabase è già configurato in `lib/supabaseClient.js`.

## 4. Installazione su iPhone

Quando Vercel ti dà il link pubblico:

1. Aprilo da Safari su iPhone.
2. Tocca il pulsante di condivisione.
3. Tocca **Aggiungi alla schermata Home**.
4. Aprila dalla Home come una web app.

## Nota salute

Il calcolo calorie/macros è indicativo. Per dieta clinica, analisi alterate, farmaci, patologie o obiettivi importanti serve medico/nutrizionista. In caso di allergie vere, la web app aiuta a filtrare gli alimenti ma non può garantire l’assenza di contaminazioni: bisogna controllare sempre etichette e indicazioni mediche.


## Problema registrazione/email Supabase

Se dopo la registrazione non arriva nessuna email e non riesci ad accedere, controlla Supabase:

1. Per test veloci: vai in `Authentication > Providers > Email` e disattiva `Confirm email`. In questo modo l'utente entra subito dopo la registrazione.
2. Se vuoi mantenere la conferma email: vai in `Authentication > URL Configuration`, imposta `Site URL` con il dominio Vercel della web app e aggiungi lo stesso dominio in `Redirect URLs`.
3. Per uso reale: configura un SMTP personalizzato in `Authentication > SMTP Settings`, altrimenti il servizio email predefinito di Supabase è molto limitato.

Il codice usa già `emailRedirectTo: window.location.origin`, quindi il link di conferma torna al dominio dove è pubblicata la web app.
