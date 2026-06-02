import assert from "node:assert/strict";

function normalizeWhatsappNumber(phone, defaultCountry = "34") {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith(defaultCountry) && digits.length > 10) return digits;
  if (digits.length === 9) return `${defaultCountry}${digits}`;
  return digits;
}

function boolish(value) {
  return ["si", "sí", "true", "1", "yes", "y", "x"].includes(
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase(),
  );
}

function importRows(rows, existingPhones = new Set()) {
  const seen = new Set();
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
    invalidPhones: [],
    missingConsent: [],
    duplicates: [],
  };

  for (const row of rows) {
    const phone = normalizeWhatsappNumber(row.telefono ?? row.phone ?? row.whatsapp);
    const name = String(row.nombre ?? row.name ?? "").trim();
    const whatsappConsent = boolish(row.whatsapp_consent ?? row.consentimiento_whatsapp ?? row.consentimiento);
    const marketingConsent = boolish(row.marketing_consent ?? row.consentimiento_marketing);

    if (!/^\d{8,15}$/.test(phone)) {
      result.skipped += 1;
      result.invalidPhones.push(name || "Sin nombre");
      continue;
    }
    if (!whatsappConsent && !marketingConsent) {
      result.skipped += 1;
      result.missingConsent.push(name || phone);
      continue;
    }
    if (seen.has(phone)) {
      result.skipped += 1;
      result.duplicates.push(name || phone);
      continue;
    }

    seen.add(phone);
    if (existingPhones.has(phone)) result.updated += 1;
    else result.created += 1;
  }

  return result;
}

function canSendTemplate({ templateStatus, category, marketingOptOut }) {
  if (templateStatus !== "approved") return false;
  if (category === "promocion" && marketingOptOut) return false;
  return true;
}

function actionCenter(fixtures, now = "2026-05-22T12:00:00.000Z") {
  const nowMs = Date.parse(now);
  const actions = [];
  for (const payment of fixtures.payments) {
    if (payment.status === "atrasado") actions.push({ type: "payment_overdue", priority: "high", id: payment.id });
  }
  for (const lead of fixtures.leads) {
    if (lead.nextActionAt && Date.parse(lead.nextActionAt) <= nowMs && !["convertido", "perdido"].includes(lead.status)) {
      actions.push({ type: "lead_followup", priority: "medium", id: lead.id });
    }
  }
  for (const klass of fixtures.classes) {
    if (Date.parse(klass.date) < nowMs && !klass.hasAttendance) {
      actions.push({ type: "class_attendance", priority: "medium", id: klass.id });
    }
  }
  for (const template of fixtures.templates) {
    if (template.metaStatus === "rejected") actions.push({ type: "template_review", priority: "high", id: template.id });
    if (template.metaStatus === "pending") actions.push({ type: "template_review", priority: "low", id: template.id });
  }
  return actions.sort((a, b) => {
    const score = { high: 0, medium: 1, low: 2 };
    return score[a.priority] - score[b.priority];
  });
}

async function cleanupPartialRegistration(db, input) {
  const calls = [];
  if (input.signatureStoragePath) {
    calls.push(`signature:${input.signatureStoragePath}`);
    await db.removeSignature(input.signatureStoragePath);
  }
  if (input.leadId) {
    calls.push(`lead:${input.leadId}`);
    await db.deleteLead(input.leadId);
  }
  return calls;
}

function canSetRegistrationStatus(current, nextStatus) {
  if (nextStatus === "convertida" && !current.studentId) return false;
  if (current.studentId && nextStatus !== "convertida") return false;
  return true;
}

function canAccessAdminPath(role, pathname) {
  if (role === "admin") return true;
  const path = pathname.split("?")[0].replace(/\/$/, "") || "/admin";
  if (path === "/admin") return true;
  return ["/admin/attendance", "/admin/registrations"].some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function withInviteStaffNote(notes, staffId) {
  const current = String(notes ?? "").trim();
  const marker = `Creado por staff: ${staffId}`;
  return current ? `${marker}\n${current}` : marker;
}

function canProfessorTouchInvite(notes, staffId) {
  return String(notes ?? "").includes(`Creado por staff: ${staffId}`);
}

function normalizePublicPhone(phone) {
  const normalized = normalizeWhatsappNumber(phone);
  if (!/^\d{8,15}$/.test(normalized)) return null;
  return normalized;
}

const importResult = importRows(
  [
    { nombre: "Ana", telefono: "612 345 678", consentimiento_whatsapp: "si" },
    { nombre: "Ana duplicada", telefono: "+34 612 345 678", consentimiento_whatsapp: "si" },
    { nombre: "Telefono malo", telefono: "123", consentimiento_whatsapp: "si" },
    { nombre: "Sin consentimiento", telefono: "698 111 222", consentimiento_whatsapp: "no" },
    { nombre: "Existente", telefono: "699 222 333", consentimiento_marketing: "x" },
  ],
  new Set(["34699222333"]),
);

assert.equal(importResult.created, 1, "valid consent row creates a lead");
assert.equal(importResult.updated, 1, "existing phone updates a lead");
assert.equal(importResult.skipped, 3, "invalid, duplicate and missing consent rows are skipped");
assert.deepEqual(importResult.invalidPhones, ["Telefono malo"], "invalid phones are reported");
assert.deepEqual(importResult.missingConsent, ["Sin consentimiento"], "missing consent is reported");
assert.deepEqual(importResult.duplicates, ["Ana duplicada"], "duplicates are reported");

assert.equal(canSendTemplate({ templateStatus: "pending", category: "inscripcion", marketingOptOut: false }), false);
assert.equal(canSendTemplate({ templateStatus: "approved", category: "inscripcion", marketingOptOut: false }), true);
assert.equal(canSendTemplate({ templateStatus: "approved", category: "promocion", marketingOptOut: true }), false);
assert.equal(canSendTemplate({ templateStatus: "approved", category: "recibo", marketingOptOut: true }), true);

const actions = actionCenter({
  payments: [{ id: "pay_1", status: "atrasado" }],
  leads: [
    { id: "lead_due", status: "contactado", nextActionAt: "2026-05-22T08:00:00.000Z" },
    { id: "lead_lost", status: "perdido", nextActionAt: "2026-05-22T08:00:00.000Z" },
  ],
  classes: [{ id: "class_1", date: "2026-05-21T18:00:00.000Z", hasAttendance: false }],
  templates: [
    { id: "template_rejected", metaStatus: "rejected" },
    { id: "template_pending", metaStatus: "pending" },
  ],
});

assert.deepEqual(
  actions.map((item) => item.type),
  ["payment_overdue", "template_review", "lead_followup", "class_attendance", "template_review"],
  "action center derives and prioritizes operational work",
);

const cleanupCalls = await cleanupPartialRegistration(
  {
    removeSignature: async () => {},
    deleteLead: async () => {},
  },
  { leadId: "lead_1", signatureStoragePath: "signatures/sig.png" },
);

assert.deepEqual(
  cleanupCalls,
  ["signature:signatures/sig.png", "lead:lead_1"],
  "partial registration cleanup removes private signature before deleting orphan lead",
);

assert.equal(
  canSetRegistrationStatus({ studentId: null }, "convertida"),
  false,
  "registration cannot be manually marked as converted without a student",
);
assert.equal(
  canSetRegistrationStatus({ studentId: "student_1" }, "pendiente"),
  false,
  "converted registration cannot be downgraded from the status selector",
);
assert.equal(
  canSetRegistrationStatus({ studentId: null }, "confirmada"),
  true,
  "unconverted registration can still be confirmed",
);

assert.equal(canAccessAdminPath("profesor", "/admin/attendance"), true);
assert.equal(canAccessAdminPath("profesor", "/admin/registrations?type=campus"), true);
assert.equal(canAccessAdminPath("profesor", "/admin/students"), false);
assert.equal(canAccessAdminPath("profesor", "/admin/payments"), false);
assert.equal(canAccessAdminPath("profesor", "/admin/whatsapp/chats"), false);
assert.equal(canAccessAdminPath("admin", "/admin/whatsapp/chats"), true);

const ownedInviteNotes = withInviteStaffNote("Idioma enlace: es", "11111111-1111-4111-8111-111111111111");
assert.equal(
  canProfessorTouchInvite(ownedInviteNotes, "11111111-1111-4111-8111-111111111111"),
  true,
  "professor can operate on invites they created",
);
assert.equal(
  canProfessorTouchInvite(ownedInviteNotes, "22222222-2222-4222-8222-222222222222"),
  false,
  "professor cannot operate on another staff member's invite",
);

assert.equal(normalizePublicPhone("612 345 678"), "34612345678", "Spanish public phone is normalized for WhatsApp");
assert.equal(normalizePublicPhone("telefono"), null, "invalid public phone is rejected before creating a lead");

console.log("Panel operations tests passed");
