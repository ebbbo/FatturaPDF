/* parser.js — FatturaPA v1.2 XML parser (namespace-agnostic) + .p7m extraction */

/** Return all direct/nested descendants matching a local tag name, ignoring namespaces. */
function byTag(node, name) {
  const out = [];
  const walk = (n) => {
    for (let i = 0; i < n.childNodes.length; i++) {
      const c = n.childNodes[i];
      if (c.nodeType !== 1) continue; // ELEMENT_NODE
      const local = c.localName || c.nodeName.split(":").pop();
      if (local === name) out.push(c);
      walk(c);
    }
  };
  walk(node);
  return out;
}

function first(node, name) {
  return byTag(node, name)[0] || null;
}

function text(node, name) {
  const el = name ? first(node, name) : node;
  if (!el) return "";
  return (el.textContent || "").trim();
}

function num(node, name) {
  const t = text(node, name).replace(",", ".");
  if (t === "") return null;
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : null;
}

/* ---------------- p7m handling ---------------- */

const B64_RE = /^[A-Za-z0-9+/=\s]+$/;

/** Extract the embedded FatturaPA XML from a CAdES (.p7m) signed file. */
export function extractXmlFromP7m(bytes) {
  let raw = bytes;
  // Some providers ship base64-encoded p7m files: detect and decode.
  const head = latin1(raw.subarray(0, Math.min(raw.length, 2048)));
  if (!head.includes("<?xml") && B64_RE.test(head)) {
    try {
      const decoded = base64ToBytes(latin1(raw).replace(/\s+/g, ""));
      if (decoded.length > 0) raw = decoded;
    } catch { /* keep raw */ }
  }
  const s = latin1(raw);
  const start = s.indexOf("<?xml");
  const startAlt = s.search(/<(\w+:)?FatturaElettronica[\s>]/);
  const from = start >= 0 ? start : startAlt;
  if (from < 0) return null;
  const endMatch = s.lastIndexOf("FatturaElettronica>");
  if (endMatch < 0) return null;
  const to = endMatch + "FatturaElettronica>".length;
  // Decode that slice as UTF-8 (invoices are UTF-8 encoded inside the DER wrapper).
  return utf8Decode(raw.subarray(from, to));
}

function latin1(bytes) {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return s;
}

function utf8Decode(bytes) {
  if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(bytes);
  return latin1(bytes); // fallback
}

function base64ToBytes(b64) {
  if (typeof atob !== "undefined") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // node fallback
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/* ---------------- main parsing ---------------- */

function parseParty(node) {
  if (!node) return null;
  const ana = first(node, "DatiAnagrafici");
  const sede = first(node, "Sede");
  const contatti = first(node, "Contatti");
  const rea = first(node, "IscrizioneREA");
  const idFiscale = ana ? first(ana, "IdFiscaleIVA") : null;

  const denominazione = ana ? text(ana, "Denominazione") : "";
  const nome = ana ? text(ana, "Nome") : "";
  const cognome = ana ? text(ana, "Cognome") : "";

  return {
    name: denominazione || [nome, cognome].filter(Boolean).join(" "),
    vat: idFiscale ? `${text(idFiscale, "IdPaese")}${text(idFiscale, "IdCodice")}` : "",
    fiscalCode: ana ? text(ana, "CodiceFiscale") : "",
    taxRegime: ana ? text(ana, "RegimeFiscale") : "",
    address: sede
      ? {
          street: [text(sede, "Indirizzo"), text(sede, "NumeroCivico")].filter(Boolean).join(", "),
          zip: text(sede, "CAP"),
          city: text(sede, "Comune"),
          province: text(sede, "Provincia"),
          country: text(sede, "Nazione"),
        }
      : null,
    phone: contatti ? text(contatti, "Telefono") : "",
    email: contatti ? text(contatti, "Email") : "",
    rea: rea ? [text(rea, "Ufficio"), text(rea, "NumeroREA")].filter(Boolean).join(" ") : "",
  };
}

function parseLine(node) {
  const sconti = byTag(node, "ScontoMaggiorazione").map((sm) => ({
    type: text(sm, "Tipo"), // SC / MG
    percent: num(sm, "Percentuale"),
    amount: num(sm, "Importo"),
  }));
  return {
    n: text(node, "NumeroLinea"),
    description: text(node, "Descrizione"),
    qty: num(node, "Quantita"),
    unit: text(node, "UnitaMisura"),
    unitPrice: num(node, "PrezzoUnitario"),
    total: num(node, "PrezzoTotale"),
    vatRate: num(node, "AliquotaIVA"),
    nature: text(node, "Natura"),
    discounts: sconti,
  };
}

function parseSummary(node) {
  return {
    vatRate: num(node, "AliquotaIVA"),
    nature: text(node, "Natura"),
    taxable: num(node, "ImponibileImporto"),
    tax: num(node, "Imposta"),
    chargeability: text(node, "EsigibilitaIVA"),
    legalRef: text(node, "RiferimentoNormativo"),
  };
}

function parseBody(body) {
  const dg = first(body, "DatiGeneraliDocumento");
  const payments = byTag(body, "DatiPagamento").map((dp) => ({
    conditions: text(dp, "CondizioniPagamento"),
    details: byTag(dp, "DettaglioPagamento").map((d) => ({
      method: text(d, "ModalitaPagamento"),
      dueDate: text(d, "DataScadenzaPagamento"),
      amount: num(d, "ImportoPagamento"),
      iban: text(d, "IBAN"),
      bank: text(d, "IstitutoFinanziario"),
    })),
  }));
  const orders = byTag(body, "DatiOrdineAcquisto")
    .map((o) => text(o, "IdDocumento"))
    .filter(Boolean);

  const bolloNode = dg ? first(dg, "DatiBollo") : null;

  return {
    type: dg ? text(dg, "TipoDocumento") : "",
    currency: dg ? text(dg, "Divisa") : "EUR",
    date: dg ? text(dg, "Data") : "",
    number: dg ? text(dg, "Numero") : "",
    total: dg ? num(dg, "ImportoTotaleDocumento") : null,
    causale: dg ? byTag(dg, "Causale").map((c) => text(c)).filter(Boolean) : [],
    stampDuty: bolloNode ? num(bolloNode, "ImportoBollo") : null,
    lines: byTag(body, "DettaglioLinee").map(parseLine),
    summary: byTag(body, "DatiRiepilogo").map(parseSummary),
    payments,
    orders,
  };
}

/**
 * Parse a FatturaPA XML string into a plain data object.
 * @param {string} xmlString
 * @returns {{transmission: object, supplier: object, customer: object, invoices: object[]}}
 */
export function parseInvoice(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, "text/xml");
  const root = doc.documentElement;
  if (!root) throw new Error("EMPTY_XML");
  const rootName = root.localName || root.nodeName.split(":").pop();
  if (rootName !== "FatturaElettronica") throw new Error("NOT_FATTURA");

  const header = first(root, "FatturaElettronicaHeader");
  if (!header) throw new Error("NOT_FATTURA");

  const trasm = first(header, "DatiTrasmissione");
  const transmission = trasm
    ? {
        format: text(trasm, "FormatoTrasmissione"),
        progressive: text(trasm, "ProgressivoInvio"),
        recipientCode: text(trasm, "CodiceDestinatario"),
        recipientPec: text(trasm, "PECDestinatario"),
      }
    : {};

  const supplier = parseParty(first(header, "CedentePrestatore"));
  const customer = parseParty(first(header, "CessionarioCommittente"));
  const invoices = byTag(root, "FatturaElettronicaBody").map(parseBody);
  if (invoices.length === 0) throw new Error("NOT_FATTURA");

  return { transmission, supplier, customer, invoices };
}
