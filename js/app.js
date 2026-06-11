/* app.js — UI wiring for FatturaPDF */
import { UI } from "./i18n.js";
import { parseInvoice, extractXmlFromP7m } from "./parser.js";
import { buildPdf } from "./pdf.js";

/* ====== CONFIG: change these two before publishing ====== */
const GITHUB_URL = "https://github.com/ebbbo/fatturapdf";
const BMC_URL = "https://buymeacoffee.com/ebbbo";
/* ======================================================== */

let uiLang = (navigator.language || "it").toLowerCase().startsWith("it") ? "it" : "en";
let pdfLang = uiLang;

const $ = (sel) => document.querySelector(sel);
const dropzone = $("#dropzone");
const fileInput = $("#fileInput");
const terminal = $("#terminal");
const terminalOut = $("#terminalOut");
const resultActions = $("#resultActions");

/* ---------- i18n ---------- */
function applyLang() {
  const t = UI[uiLang];
  document.documentElement.lang = uiLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (t[key]) el.textContent = t[key];
  });
  document.querySelectorAll("[data-ui-lang]").forEach((b) =>
    b.classList.toggle("active", b.dataset.uiLang === uiLang)
  );
  document.querySelectorAll("[data-pdf-lang]").forEach((b) =>
    b.classList.toggle("active", b.dataset.pdfLang === pdfLang)
  );
}

document.querySelectorAll("[data-ui-lang]").forEach((b) =>
  b.addEventListener("click", () => { uiLang = b.dataset.uiLang; applyLang(); })
);
document.querySelectorAll("[data-pdf-lang]").forEach((b) =>
  b.addEventListener("click", () => { pdfLang = b.dataset.pdfLang; applyLang(); })
);

["#ghTop", "#ghFoot"].forEach((s) => { const el = $(s); if (el) el.href = GITHUB_URL; });
document.querySelectorAll('a[href*="buymeacoffee"]').forEach((a) => (a.href = BMC_URL));

/* ---------- dropzone ---------- */
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener("change", () => handleFiles(fileInput.files));

["dragenter", "dragover"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); })
);
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); })
);
dropzone.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));

$("#anotherBtn").addEventListener("click", () => {
  terminal.hidden = true;
  resultActions.hidden = true;
  terminalOut.innerHTML = "";
  fileInput.value = "";
  dropzone.focus();
});

/* ---------- terminal output ---------- */
function termLine(html) {
  terminalOut.insertAdjacentHTML("beforeend", html + "\n");
}

/* ---------- conversion ---------- */
async function handleFiles(fileList) {
  const files = Array.from(fileList || []).filter((f) =>
    /\.(xml|p7m)$/i.test(f.name)
  );
  if (!files.length) return;

  const t = UI[uiLang];
  terminal.hidden = false;
  resultActions.hidden = true;
  terminalOut.innerHTML = "";
  termLine(`<span class="dim">$</span> fatturapdf --lang=${pdfLang} ${files.map((f) => f.name).join(" ")}`);

  if (!window.jspdf) {
    termLine(`<span class="err">✗ jsPDF not loaded — check your connection and reload.</span>`);
    return;
  }

  let okCount = 0;
  for (const file of files) {
    try {
      const xml = await readAsXml(file, t);
      const data = parseInvoice(xml);
      const doc = buildPdf(data, pdfLang, window.jspdf.jsPDF);
      const outName = file.name.replace(/\.(xml(\.p7m)?|p7m)$/i, "") + `_${pdfLang}.pdf`;
      doc.save(outName);
      termLine(`<span class="ok">✓</span> ${escapeHtml(file.name)} <span class="dim">→</span> ${escapeHtml(outName)}`);
      okCount++;
    } catch (err) {
      const msg =
        err.message === "NOT_FATTURA" ? t.errNotXml :
        err.message === "P7M_FAIL" ? t.errP7m : t.errParse;
      termLine(`<span class="err">✗ ${escapeHtml(file.name)} — ${escapeHtml(msg)}</span>`);
      console.error(err);
    }
  }

  if (okCount > 0) {
    const nerd = t.nerd[Math.floor(Math.random() * t.nerd.length)];
    termLine("");
    termLine(`<span class="ok">${escapeHtml(nerd)}</span>`);
    resultActions.hidden = false;
  }
}

async function readAsXml(file, t) {
  if (/\.p7m$/i.test(file.name)) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const xml = extractXmlFromP7m(buf);
    if (!xml) throw new Error("P7M_FAIL");
    return xml;
  }
  return await file.text();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

applyLang();
