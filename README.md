# Poziv na klik — online pozivnice sa potvrdom dolaska

*Tvoja pozivnica. Tvoj stil. Jedan klik.*

Sajt za elektronske pozivnice, na srpskom (latinica) sa prekidačem za engleski. Klijent napravi nalog, izabere dizajn, upiše podatke i dobije link. Gosti otvore link, pogledaju pozivnicu i potvrde ili otkažu dolazak. Domaćin na jednoj strani vidi ko je pozvan, ko je otvorio, ko dolazi (i koliko osoba) i ko ne dolazi.

## Paketi i cene

| Paket | Cena | Šta gost dobija | Dizajni |
|---|---|---|---|
| **Osnovna** | 1.190 din · 10 € | Ilustrovana pozivnica sa nežnom animacijom, otvara se odmah | Bela ruža, Maslinova grana, Zeka i baloni, Leteći balon, Zlatna noć, Golubica |
| **Koverta** | 2.349 din · 20 € | Koverta sa voštanim pečatom i šarenom postavom, pozivnica izlazi iz koverte, efekat (latice, zvezde, oblaci, baloni, odsjaji disko kugli) | Vrt božura, Ponoć, Oblačak, Medeni piknik, Disko veče, Bela čipka (bordo papir pod belom čipkom: gost lomi pečat i čipka klizi sa pozivnice) |
| **Premium** | 4.499 din · 40 € | Cela priča na jednoj stranici, sa muzikom | Medeni meda (prvi rođendan: gost meša med da otvori, podaci o rođenju, prva godina, fotografije, odbrojavanje), Naša pesma (venčanje kao ploča), Premijera (rođendan kao filmska premijera, sa fotografijom), Disko jubilej (rođendan i godišnjica firme kao disko noć: dva razloga za slavlje, dress code i muzika), Satenska mašna (venčanje: gost odvezuje mašnu, program dana, mesto sa fotografijom, odbrojavanje i muzička kutija) |

Sve ilustracije su napravljene za ovaj sajt i ugrađene su u `public/index.html`, pa nema spoljnih slika koje mogu da nestanu.

## Dizajn po želji

Na stranici **Po želji** (`#custom`) posetioci bez naloga mogu da pošalju opis pozivnice koju žele, link (npr. sa Pinteresta) i do 3 slike. Zahtevi se pojavljuju na dnu stranice **Porudžbine** (samo za vlasnika), sa kontaktom, opisom i slikama, i mogu se označiti kao rešeni.

## Kako ide porudžbina i uplata

1. Klijent napravi pozivnicu. Ona se sačuva sa statusom **„Čeka uplatu"**, a klijent vidi iznos, podatke za uplatu i poziv na broj (kod pozivnice).
2. Dok uplata nije potvrđena, gosti na linku vide poruku da pozivnica još nije aktivna. Klijent može da je pregleda i menja.
3. Vi (vlasnik) otvorite **Porudžbine** u meniju i kliknete **Potvrdi uplatu**. Link odmah počinje da radi za goste.

### Podešavanje vlasnika

Pokrenite server sa svojim imejlom kao administratorom:

```bash
ADMIN_EMAILS=vas@imejl.com npm start
```

Napravite nalog na sajtu sa tim imejlom. U meniju će se pojaviti **Porudžbine**. Više imejlova odvojite zarezom.

### Podaci za uplatu

Upišite ih u `config.json`:

```json
{
  "payment": {
    "recipient": "Ime i prezime ili firma",
    "account": "160-0000000000000-00",
    "bank": "Naziv banke",
    "phone": "+381 6x xxx xxxx",
    "note": "Uplatu potvrđujemo istog dana."
  }
}
```

Ili kroz promenljive okruženja: `PAY_RECIPIENT`, `PAY_ACCOUNT`, `PAY_BANK`, `PAY_PHONE`, `PAY_NOTE`. Ako polja ostanu prazna, klijent vidi poruku da će podatke dobiti imejlom.

## Pokretanje na računaru

Potreban je Node.js 18 ili noviji. Nema dodatnih paketa.

```bash
cd paperlace
ADMIN_EMAILS=vas@imejl.com npm start
```

Otvorite http://localhost:3000.

## Postavljanje na internet

Radi na bilo kom Node hostingu. Primer sa **Render**:

1. Postavite ovaj folder u GitHub repozitorijum.
2. Na render.com: **New → Web Service**, povežite repozitorijum.
3. Build command: *(prazno)* · Start command: `npm start`.
4. Dodajte **Persistent Disk** na `/var/data` i promenljive `DATA_DIR=/var/data` i `ADMIN_EMAILS=vas@imejl.com`. Bez diska se nalozi i odgovori brišu pri restartu servera.
5. Linkovi za goste izgledaju ovako: `https://vas-sajt.onrender.com/i/AbC12xyz`.

## Linkovi za goste

- **Zajednički link** `/i/<kod>`: jedan link za sve; gost upisuje ime kada odgovara.
- **Lični link** `/i/<kod>?g=<token>`: po jedan za svakog gosta dodatog na strani pozivnice; beleži da je gost otvorio pozivnicu i pozdravlja ga imenom.

## Šta je u folderu

```
paperlace/
├── server.js          # Node server i API (bez zavisnosti)
├── config.json        # podaci za uplatu
├── package.json
└── public/index.html  # ceo sajt: strane, dizajni, ilustracije, animacije
```

Podaci se čuvaju u `data/db.json` (pravi se automatski). Lozinke su zaštićene scrypt-om, sesije koriste HTTP-only kolačiće. Starije pozivnice napravljene pre uvođenja paketa ostaju aktivne.
