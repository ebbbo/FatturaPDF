# 🧾 FatturaPDF

**Converti la fattura elettronica italiana (FatturaPA XML) in un PDF leggibile — in italiano o in inglese. Gratis, senza pubblicità, 100% nel tuo browser.**

*Convert an Italian electronic invoice (FatturaPA XML) into a readable PDF — in Italian or English. Free, ad-free, 100% in your browser.*

➡️ **Demo: https://fatturapdf.app/**

---

## 🇮🇹 Italiano

### Perché
I convertitori online di fatture elettroniche sono quasi tutti solo in italiano, pieni di pubblicità, e ti chiedono di **caricare la fattura sui loro server**. Le fatture contengono dati sensibili (partita IVA, IBAN, importi): non dovrebbero finire chissà dove solo per ottenere un PDF.

### Come funziona
- Trascini il file `.xml` (o `.xml.p7m` firmato) nella pagina
- Scegli la lingua del PDF: 🇮🇹 italiano o 🇬🇧 inglese
- Il PDF viene generato **interamente nel tuo browser** con [jsPDF](https://github.com/parallax/jsPDF) e scaricato subito
- **Nessun dato lascia il tuo computer.** Niente server, niente upload, niente tracciamento. Puoi verificarlo: il codice è tutto qui.

### Funzionalità
- ✅ FatturaPA v1.2 (FPR12 / FPA12)
- ✅ File firmati `.p7m` (estrazione automatica dell'XML)
- ✅ Più file insieme (batch)
- ✅ Codici tecnici tradotti (TD01, RF19, MP05, N2.1, …) nel formato `codice - descrizione`
- ✅ Righe, riepilogo IVA, bollo, pagamenti, IBAN, dati trasmissione SDI
- ✅ File con più corpi fattura (multi-body)
- ✅ Funziona anche offline dopo il primo caricamento

### Usalo in locale
Nessuna build, nessuna dipendenza da installare:

```bash
git clone https://github.com/ebbbo/fatturapdf.git
cd fatturapdf
python3 -m http.server 8000
# apri http://localhost:8000
```

> Serve un piccolo server locale (non basta aprire il file) perché la pagina usa i moduli ES.

### Limitazioni note
- La firma digitale del `.p7m` **non viene verificata**: viene solo estratto l'XML
- Il PDF non è una copia conforme a fini fiscali: l'originale resta l'XML inviato allo SDI

---

## 🇬🇧 English

### Why
Online FatturaPA converters are almost all Italian-only, ad-ridden, and require **uploading your invoice to their servers**. Invoices contain sensitive data (VAT numbers, IBANs, amounts) — they shouldn't travel anywhere just to become a PDF.

### How it works
Drop your `.xml` (or signed `.xml.p7m`) file, pick the PDF language, and the PDF is generated **entirely in your browser** and downloaded immediately. No server, no upload, no tracking.

### Run locally
```bash
git clone https://github.com/ebbbo/fatturapdf.git
cd fatturapdf
python3 -m http.server 8000   # then open http://localhost:8000
```

---

## ☕ Support
This tool is free and ad-free, forever. If it saved you some time:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-%E2%98%95-ffdd00?style=for-the-badge)](https://buymeacoffee.com/ebbbo)

## 📂 Project structure
```
index.html        # the page
style.css         # styling
js/app.js         # UI logic (drag&drop, language, donations)
js/parser.js      # FatturaPA XML parser + .p7m extraction
js/pdf.js         # PDF layout (jsPDF + autotable)
js/i18n.js        # IT/EN strings and FatturaPA code dictionaries
sample/esempio.xml  # sample invoice with fake data
```

## 📜 License
Licensed under [**AGPL-3.0**](LICENSE). You're free to use, study, and modify this software — but any modified version you distribute or run as a network service **must remain open source under the same license**. This tool is free, and is meant to stay free for everyone.
