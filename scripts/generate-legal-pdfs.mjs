#!/usr/bin/env node
// Generates the legal PDFs for the registration flow.
// Run: node scripts/generate-legal-pdfs.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "public", "legal");
mkdirSync(OUT_DIR, { recursive: true });

const PAGE_WIDTH = 595; // A4 pt
const PAGE_HEIGHT = 842;
const MARGIN_X = 60;
const MARGIN_TOP = 80;
const MAX_LINE_CHARS = 92;
const LINE_HEIGHT = 16;
const TITLE_GAP = 24;

function wrap(text, maxChars = MAX_LINE_CHARS) {
  const out = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      out.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      if ((line + " " + word).trim().length > maxChars) {
        out.push(line);
        line = word;
      } else {
        line = line ? line + " " + word : word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function escapePdf(str) {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildPdf({ title, paragraphs }) {
  // Pre-compute leading using TL operator inside BT
  const finalContent =
    `q\n` +
    `BT\n` +
    `${LINE_HEIGHT} TL\n` +
    `/F2 18 Tf\n` +
    `${MARGIN_X} ${PAGE_HEIGHT - MARGIN_TOP} Td\n` +
    `(${escapePdf(title)}) Tj\n` +
    `0 -${TITLE_GAP} Td\n` +
    `/F1 11 Tf\n` +
    paragraphsToOps(paragraphs) +
    `ET\nQ\n`;

  const objects = [];
  // 1: catalog
  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  // 2: pages
  objects.push(`<< /Type /Pages /Count 1 /Kids [3 0 R] >>`);
  // 3: page
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
  );
  // 4: F1 Helvetica
  objects.push(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
  );
  // 5: F2 Helvetica-Bold
  objects.push(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
  );
  // 6: content stream
  const contentBuf = Buffer.from(finalContent, "latin1");
  objects.push(
    `<< /Length ${contentBuf.length} >>\nstream\n${finalContent}endstream`,
  );

  // Assemble file
  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n`;
  out += `0000000000 65535 f \n`;
  for (const off of offsets) {
    out += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

function paragraphsToOps(paragraphs) {
  const lines = [];
  let first = true;
  for (const para of paragraphs) {
    const wrapped = wrap(para);
    for (const ln of wrapped) {
      if (first) {
        lines.push(`(${escapePdf(ln)}) Tj`);
        first = false;
      } else {
        lines.push(`T*`);
        lines.push(`(${escapePdf(ln)}) Tj`);
      }
    }
    lines.push("T*");
    lines.push(`() Tj`);
  }
  return lines.join("\n") + "\n";
}

function asciiSafe(s) {
  // Replace common Spanish chars with WinAnsi-safe equivalents (or use proper mapping).
  // We embed Helvetica/WinAnsi, which DOES support áéíóúñü etc. directly via 8-bit bytes.
  return s;
}

const terminos = {
  title: "Asociacion Panda Tenis - Terminos y condiciones",
  paragraphs: [
    "Al inscribirse, los padres o tutores legales aceptan que el alumno no padece enfermedades, alergias u otras limitaciones que puedan interferir con su participacion en las actividades programadas.",
    "En caso de alguna condicion medica relevante, se requiere una notificacion precisa a la administracion de la Asociacion Panda Tenis.",
    "Es responsabilidad exclusiva de los padres o tutores legales asegurarse de la entrega y recogida del alumno en las instalaciones donde se llevara a cabo el Campus, tanto al inicio como al final del mismo.",
    "La inscripcion implica la aceptacion de todos los terminos y condiciones establecidos anteriormente. Es responsabilidad de los padres o tutores legales leer y comprender estos terminos antes de inscribir al alumno en el Campus.",
  ].map(asciiSafe),
};

const consentimiento = {
  title: "Asociacion Panda Tenis - Consentimiento Imagenes",
  paragraphs: [
    "Queremos informarles que durante las actividades deportivas de sus hijos, tomaremos fotos y videos con el proposito de documentar su progreso y celebrar sus logros.",
    "Estas imagenes seran utilizadas exclusivamente para uso interno de la Asociacion Panda Tenis, asi como material promocional en redes sociales y en nuestros sitios web.",
    "Nos comprometemos a utilizar estas imagenes de manera respetuosa y a proteger la privacidad de todos los ninos.",
    "En caso de no autorizar el uso de imagenes del menor, rogamos lo comuniquen previamente a la Asociacion Panda Tenis.",
  ].map(asciiSafe),
};

writeFileSync(resolve(OUT_DIR, "terminos-y-condiciones.pdf"), buildPdf(terminos));
writeFileSync(
  resolve(OUT_DIR, "consentimiento-imagenes.pdf"),
  buildPdf(consentimiento),
);

console.log("Generated PDFs in", OUT_DIR);
