import assert from "node:assert/strict";
import crypto from "node:crypto";

function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice(7);
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normalizeWhatsappNumber(phone, defaultCountry = "34") {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith(defaultCountry) && digits.length > 10) return digits;
  if (digits.length === 9) return `${defaultCountry}${digits}`;
  return digits;
}

function normalizeValidWhatsappPhone(phone) {
  const normalized = normalizeWhatsappNumber(phone);
  return /^\d{8,15}$/.test(normalized) ? normalized : "";
}

function statusCanAdvance(current, incoming) {
  const order = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 99 };
  if (incoming === "failed") return true;
  return (order[incoming] ?? -1) >= (order[current] ?? -1);
}

function optState(body) {
  const normalized = body
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
  const first = normalized.split(/\s+/)[0] ?? "";
  if (["baja", "stop", "cancelar", "unsubscribe"].includes(first)) return "out";
  if (["alta", "start"].includes(first)) return "in";
  return "none";
}

function nextOptInTags(existing, optOut) {
  const tags = Array.isArray(existing)
    ? existing.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)
    : [];
  const next = new Set(tags);
  if (optOut) next.add("sin-promos");
  else next.delete("sin-promos");
  return [...next];
}

function withConversationTag(tags, tag) {
  const next = new Set(
    Array.isArray(tags)
      ? tags.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
      : [],
  );
  const normalizedTag = tag.trim().toLowerCase();
  if (normalizedTag) next.add(normalizedTag);
  return [...next];
}

function shouldDeadLetter(attemptCount, maxAttempts, retryable) {
  return retryable && attemptCount >= maxAttempts;
}

function templateStatus(event) {
  const normalized = String(event ?? "").toUpperCase();
  if (normalized === "APPROVED") return "approved";
  if (["REJECTED", "PAUSED", "DISABLED"].includes(normalized)) return "rejected";
  return "pending";
}

function metaMediaHeaderType(raw) {
  if (!Array.isArray(raw)) return null;
  for (const component of raw) {
    const type = String(component?.type ?? "").toUpperCase();
    const format = String(component?.format ?? "").toUpperCase();
    if (type === "HEADER" && ["DOCUMENT", "IMAGE", "VIDEO"].includes(format)) {
      return format;
    }
  }
  return null;
}

function templateMediaIssue(template) {
  const metaHeader = metaMediaHeaderType(template.componentsSchema?.raw);
  const localHeader = template.componentsSchema?.header ?? null;
  if (metaHeader && !localHeader) return "missing-local";
  if (metaHeader && localHeader && metaHeader !== localHeader.type) return "mismatch";
  if (localHeader && !metaHeader) return "pending-meta";
  return null;
}

const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
const secret = "test-secret";
const signature = `sha256=${crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;

assert.equal(verifySignature(body, signature, secret), true, "valid webhook signature");
assert.equal(verifySignature(body, signature, "wrong-secret"), false, "invalid webhook signature");

assert.equal(normalizeValidWhatsappPhone("612 345 678"), "34612345678", "bulk sender normalizes Spanish mobiles");
assert.equal(normalizeValidWhatsappPhone("123"), "", "bulk sender rejects short numbers before sending");

assert.equal(statusCanAdvance("sent", "delivered"), true, "sent -> delivered advances");
assert.equal(statusCanAdvance("read", "delivered"), false, "read cannot regress to delivered");
assert.equal(statusCanAdvance("read", "failed"), true, "failed status wins");

assert.equal(optState("BAJA"), "out", "BAJA opts out");
assert.equal(optState("alta por favor"), "in", "ALTA opts in");
assert.equal(optState("hola"), "none", "normal message does not change opt state");
assert.deepEqual(
  nextOptInTags(["familia", "lead"], true),
  ["familia", "lead", "sin-promos"],
  "opt-out adds the no-promo tag without deleting existing tags",
);
assert.deepEqual(
  nextOptInTags(["familia", "sin-promos"], false),
  ["familia"],
  "opt-in removes only the no-promo tag",
);
assert.deepEqual(
  withConversationTag(["familia", "sin-promos"], "lead"),
  ["familia", "sin-promos", "lead"],
  "creating a lead from WhatsApp preserves existing conversation tags",
);

assert.equal(shouldDeadLetter(7, 7, true), true, "retryable message dead-letters at max attempts");
assert.equal(shouldDeadLetter(2, 7, true), false, "retryable message stays queued before max attempts");
assert.equal(shouldDeadLetter(7, 7, false), false, "non-retryable message fails directly");

assert.equal(templateStatus("APPROVED"), "approved", "approved template maps correctly");
assert.equal(templateStatus("REJECTED"), "rejected", "rejected template maps correctly");
assert.equal(templateStatus("IN_REVIEW"), "pending", "review template maps to pending");

const rawImageHeader = [
  { type: "HEADER", format: "IMAGE" },
  { type: "BODY", text: "Hola {{1}}" },
];
assert.equal(metaMediaHeaderType(rawImageHeader), "IMAGE", "Meta media header is detected");
assert.equal(
  templateMediaIssue({ componentsSchema: { raw: rawImageHeader } }),
  "missing-local",
  "approved media template without local file is blocked",
);
assert.equal(
  templateMediaIssue({ componentsSchema: { raw: rawImageHeader, header: { type: "VIDEO" } } }),
  "mismatch",
  "media template with wrong local type is blocked",
);
assert.equal(
  templateMediaIssue({ componentsSchema: { raw: rawImageHeader, header: { type: "IMAGE" } } }),
  null,
  "media template with matching local file is sendable",
);

console.log("WhatsApp pipeline tests passed");
