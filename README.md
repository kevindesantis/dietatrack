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

## Modalità admin / supervisore

Questa versione include una scheda **Admin**. L'utente admin può selezionare qualsiasi profilo registrato e poi usare le sezioni **Oggi**, **Dieta**, **Misure**, **Allenamento** e **Profilo** per vedere o modificare i dati di quell'utente.

Per impostazione predefinita l'admin è:

```text
kevindavide31@gmail.com
```

Per aggiungere altri admin, vai su Supabase → SQL Editor ed esegui:

```sql
insert into public.app_admins (email, active)
values ('email-admin@example.com', true)
on conflict (email) do update set active = true;
```

Dopo aver caricato questa versione devi eseguire di nuovo `supabase/database.sql` nel SQL Editor. Gli utenti normali continuano a vedere solo i propri dati grazie alle policy RLS; solo gli admin presenti in `app_admins` possono vedere e modificare gli altri utenti.

## Aggiornamento archivio alimenti ampliato

Questa versione include un archivio pubblico molto più grande rispetto alla prima prova. Sono stati aggiunti piatti comuni italiani e alimenti pronti come pasta al sugo, pasta alla carbonara, cotolette, spinacine, bastoncini di pesce, Nippon, pizza, panini, latticini, salumi, frutta, verdura, snack e bevande.

I valori sono salvati sempre per 100 g/ml. Per i prodotti confezionati controllare sempre l'etichetta: marca, ricetta e formato possono cambiare. Se un prodotto non è presente, dalla scheda **Alimenti** puoi cercarlo online su Open Food Facts per nome o codice a barre e importarlo nel tuo archivio personale.

Quando esegui `supabase/database.sql`, la versione 3 del seed elimina il vecchio archivio pubblico base e reinserisce quello nuovo senza duplicati. Gli alimenti già registrati nel diario restano salvati con nome e valori del momento in cui li hai inseriti.

## Generatore allenamento personalizzato

Questa versione integra anche la creazione dell'allenamento. Nel profilo o nella scheda **Allenamento** puoi scegliere:

- obiettivo: dimagrimento, tonificazione, massa, resistenza oppure salute/mobilità;
- livello: principiante, intermedio, avanzato;
- giorni a settimana: da 1 a 6;
- luogo: al chiuso, all'aperto o entrambi;
- attrezzatura: senza attrezzi, attrezzi semplici, palestra/professionali o misto;
- durata indicativa della seduta;
- note personali/limiti, per esempio no corsa, preferisco camminata, fastidio al ginocchio.

Premendo **Genera allenamento**, l'app cancella solo le vecchie schede generate automaticamente e crea una nuova settimana di allenamenti. Gli allenamenti manuali restano salvati. Ogni seduta include riscaldamento, esercizi, recuperi, cardio/mobilità quando utile e defaticamento. Gli utenti possono segnare l'allenamento del giorno come fatto, saltato o fatto modificato.

La scheda è prudente e modificabile: non sostituisce un personal trainer o un medico, soprattutto in caso di patologie, dolori articolari, problemi cardiaci/respiratori o inattività prolungata.

## Aggiornamento: porzioni rapide e alimenti pratici

Questa versione aggiunge l'inserimento senza conoscere i grammi esatti:

- modalità “So i grammi”;
- modalità “Non so il peso: uso pezzi/porzioni”;
- porzioni rapide per Nippon, cotolette, spinacine, bastoncini, caffè, cappuccino, acqua, pasta al piatto;
- varianti fritte/forno per evitare sottostime caloriche;
- colonna `default_serving_g`, `serving_label`, `serving_note` nella tabella `foods`;
- nuovi alimenti pratici come caffè amaro, cappuccino senza zucchero, cotoletta fritta, spinacina generica fritta, bastoncini di spinaci, olio assorbito in frittura.

Dopo aver caricato il progetto su GitHub/Vercel, esegui di nuovo `supabase/database.sql` in Supabase SQL Editor.

## Aggiornamento: ricerca alimenti autocomplete e archivio esteso

Questa versione migliora la ricerca degli alimenti nella Dashboard:

- scrivi nella barra e si apre un menu a tendina;
- clicchi direttamente l'alimento dal menu, senza doverlo riscrivere o selezionarlo sotto;
- la ricerca usa anche marca, categoria, allergeni e tag, quindi trova meglio parole come “carbonara”, “spinacina”, “bastoncini”, “Nippon”, “caffè”, “fritta”, “forno”;
- quando usi la modalità porzioni, il diario mostra “5 × 1 quadratino/snack piccolo” invece dei grammi;
- i grammi restano usati solo internamente per calcolare calorie e macro;
- l'archivio base pubblico è stato ampliato a oltre 400 alimenti/piatti/porzioni pratiche.

Se un alimento manca ancora, usa **Alimenti → Cerca prodotto online per nome** oppure **codice a barre**. Per non rischiare blocchi API, la ricerca online non parte a ogni lettera digitata: scrivi il nome e premi il pulsante.
