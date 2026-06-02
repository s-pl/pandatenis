// Ejecuta el seeder de datos demo contra Supabase remoto.
// Replica la lógica de src/lib/admin/actions/demo-seeder.ts pero usando el
// service-role key para poder correrlo desde CLI.
//
// Uso:
//   node scripts/seed-demo.mjs           # siembra
//   node scripts/seed-demo.mjs --wipe    # solo borra

import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = { ...loadEnvFile(".env.local"), ...process.env };
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");

const SEED_TAG = "panda-demo";
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const WIPE_ONLY = process.argv.includes("--wipe");

const GROUP_BLUEPRINTS = [
  { name: "Rojo · Iniciación L/X 16h", level: "Rojo", weekdays: ["L", "X"], startTime: "16:00", endTime: "17:00", capacity: 8, location: "Pista 1" },
  { name: "Rojo · Iniciación M/J 16h", level: "Rojo", weekdays: ["M", "J"], startTime: "16:00", endTime: "17:00", capacity: 8, location: "Pista 1" },
  { name: "Naranja L/X 17h", level: "Naranja", weekdays: ["L", "X"], startTime: "17:00", endTime: "18:00", capacity: 7, location: "Pista 2" },
  { name: "Naranja M/J 17h", level: "Naranja", weekdays: ["M", "J"], startTime: "17:00", endTime: "18:00", capacity: 7, location: "Pista 2" },
  { name: "Verde L/X 18h", level: "Verde", weekdays: ["L", "X"], startTime: "18:00", endTime: "19:00", capacity: 6, location: "Pista 2" },
  { name: "Verde V 17h", level: "Verde", weekdays: ["V"], startTime: "17:00", endTime: "18:30", capacity: 6, location: "Pista 1" },
  { name: "Amarillo M/J 19h", level: "Amarillo", weekdays: ["M", "J"], startTime: "19:00", endTime: "20:30", capacity: 5, location: "Pista 1" },
  { name: "Amarillo Sábado", level: "Amarillo", weekdays: ["S"], startTime: "10:00", endTime: "11:30", capacity: 5, location: "Pista 2" },
];

const FIRST_NAMES = ["Lucía","Hugo","Mateo","Inés","Daniela","Bruno","Carla","Pablo","Vega","Yousef","Sofía","Nicolás","Mara","Adrián","Lola","Elena","Diego","Alma","Iker","Noa","Marco","Julia","Sergio","Aitana","Leo","Claudia","Manu","Greta","Álex","Paula"];
const LAST_NAMES = ["García","Pérez","López","Martín","Sánchez","Romero","Ortega","Castro","Ruiz","Domínguez","Vidal","Navarro","Reyes","Iglesias"];
const GUARDIAN_NAMES = ["María","Carlos","Pilar","Javier","Andrea","Roberto","Carmen","Luis","Fátima","Sergio","Patricia","Diego"];
const TIME_BLOCKS = ["tarde-temprano","tarde-media","tarde-tardia","sabado-manana"];
const DAYS = ["L","M","X","J","V","S"];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const subset = (a, min, max) => {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  return [...a].sort(() => Math.random() - 0.5).slice(0, n);
};
const birthForAge = (age) => {
  const y = new Date().getFullYear() - age;
  const m = 1 + Math.floor(Math.random() * 12);
  const d = 1 + Math.floor(Math.random() * 27);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
const levelForAge = (a) => (a <= 6 ? "Rojo" : a <= 9 ? "Naranja" : a <= 12 ? "Verde" : "Amarillo");
const phone = (seed) => String(600000000 + ((seed * 137) % 99999999));
const isoDaysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

async function wipe() {
  const tables = ["whatsapp_messages","whatsapp_conversations","registrations","students","groups","leads"];
  for (const t of tables) {
    const { error } = await supabase.from(t).delete().eq("seed_tag", SEED_TAG);
    if (error) console.warn(`  [wipe] ${t}: ${error.message}`);
  }
}

async function seed() {
  await wipe();
  let total = 0;

  // 1) Grupos
  const { data: groups, error: gErr } = await supabase
    .from("groups")
    .insert(GROUP_BLUEPRINTS.map((g) => ({
      name: g.name,
      level: g.level,
      schedule: `${g.weekdays.join("·")} ${g.startTime}–${g.endTime}`,
      capacity: g.capacity,
      location: g.location,
      weekdays: g.weekdays,
      start_time: g.startTime,
      end_time: g.endTime,
      seed_tag: SEED_TAG,
    })))
    .select("id, level, capacity");
  if (gErr) throw gErr;
  total += groups.length;
  console.log(`✓ ${groups.length} grupos`);

  // 2) Alumnos
  const students = [];
  for (let age = 4; age <= 14; age++) {
    const perAge = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < perAge; i++) {
      const level = levelForAge(age);
      const candidates = groups.filter((g) => g.level === level);
      const groupId = candidates.find((g) => students.filter((s) => s.groupId === g.id).length < g.capacity)?.id ?? null;
      students.push({
        first: pick(FIRST_NAMES),
        last: `${pick(LAST_NAMES)} ${pick(LAST_NAMES)}`,
        age, level, groupId,
        days: subset(DAYS, 2, 4),
        blocks: subset(TIME_BLOCKS, 1, 2),
      });
    }
  }
  // Dejar 6 sin grupo
  for (let i = 0; i < 6 && i < students.length; i++) students[students.length - 1 - i].groupId = null;

  const { data: insertedStudents, error: sErr } = await supabase
    .from("students")
    .insert(students.map((s) => ({
      first_name: s.first,
      last_name: s.last,
      birth_date: birthForAge(s.age),
      level: s.level,
      dominant_hand: Math.random() < 0.85 ? "Derecha" : "Izquierda",
      group_id: s.groupId,
      active: true,
      image_consent: Math.random() < 0.8,
      preferred_days: s.days,
      preferred_time_blocks: s.blocks,
      seed_tag: SEED_TAG,
    })))
    .select("id");
  if (sErr) throw sErr;
  total += insertedStudents.length;
  console.log(`✓ ${insertedStudents.length} alumnos`);

  // 3) Tutores
  const guardianRows = insertedStudents.map((row, i) => ({
    student_id: row.id,
    full_name: `${pick(GUARDIAN_NAMES)} ${pick(LAST_NAMES)}`,
    phone: phone(i + 1),
    email: `demo-${i + 1}@panda-demo.test`,
    relationship: Math.random() < 0.5 ? "Madre" : "Padre",
  }));
  const { error: gdErr } = await supabase.from("guardians").insert(guardianRows);
  if (gdErr) throw gdErr;
  console.log(`✓ ${guardianRows.length} tutores`);

  // 4) Pagos
  const today = new Date();
  const paymentRows = [];
  for (const s of insertedStudents) {
    const months = 1 + Math.floor(Math.random() * 3);
    for (let m = 0; m < months; m++) {
      const due = new Date(today);
      due.setMonth(due.getMonth() - m);
      const rand = Math.random();
      let status, paidAt = null;
      if (rand < 0.6) { status = "pagado"; paidAt = new Date(due.getTime() - 86400000 * 2).toISOString(); }
      else if (rand < 0.85) status = "pendiente";
      else status = "atrasado";
      paymentRows.push({
        student_id: s.id,
        concept: `Cuota ${due.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`,
        amount: 45 + Math.floor(Math.random() * 30),
        due_date: due.toISOString().slice(0, 10),
        status, paid_at: paidAt,
        method: status === "pagado" ? (Math.random() < 0.6 ? "transferencia" : "bizum") : null,
      });
    }
  }
  const { error: pErr } = await supabase.from("payments").insert(paymentRows);
  if (pErr) throw pErr;
  console.log(`✓ ${paymentRows.length} pagos`);

  // 5) Leads + inscripciones
  const { data: source } = await supabase.from("lead_sources").upsert({ name: "Web" }, { onConflict: "name" }).select("id").single();
  const leadRows = [];
  for (let i = 0; i < 8; i++) {
    leadRows.push({
      full_name: `${pick(GUARDIAN_NAMES)} ${pick(LAST_NAMES)}`,
      phone: phone(1000 + i),
      email: `lead-demo-${i}@panda-demo.test`,
      child_age: 4 + Math.floor(Math.random() * 10),
      interest: i % 3 === 0 ? "campus" : i % 4 === 0 ? "ambos" : "escuela",
      source_id: source?.id ?? null,
      observations: "Lead generado por seeder demo.",
      status: i % 3 === 0 ? "nuevo" : "contactado",
      seed_tag: SEED_TAG,
    });
  }
  const { data: insertedLeads, error: lErr } = await supabase.from("leads").insert(leadRows).select("id");
  if (lErr) throw lErr;
  total += insertedLeads.length;
  console.log(`✓ ${insertedLeads.length} leads`);

  const regRows = [];
  for (let i = 0; i < 10; i++) {
    const isCampus = i % 3 === 0;
    regRows.push({
      type: isCampus ? "campus" : i % 5 === 0 ? "ambos" : "escuela",
      full_name: `${pick(GUARDIAN_NAMES)} ${pick(LAST_NAMES)}`,
      phone: phone(2000 + i),
      email: `inscripcion-demo-${i}@panda-demo.test`,
      child_name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      child_age: 4 + Math.floor(Math.random() * 10),
      status: i < 6 ? "pendiente" : "confirmada",
      preferred_days: isCampus ? [] : subset(DAYS, 2, 4),
      preferred_time_blocks: isCampus ? [] : subset(TIME_BLOCKS, 1, 2),
      scheduling_notes: isCampus ? null : "Generado por seeder demo.",
      seed_tag: SEED_TAG,
    });
  }
  const { data: insertedRegs, error: rErr } = await supabase.from("registrations").insert(regRows).select("id");
  if (rErr) throw rErr;
  total += insertedRegs.length;
  console.log(`✓ ${insertedRegs.length} inscripciones`);

  // 6) WhatsApp
  const convRows = [], msgRows = [];
  const fams = guardianRows.slice(0, 6);
  for (const [i, g] of fams.entries()) {
    convRows.push({
      phone: g.phone,
      display_name: g.full_name,
      last_message_at: isoDaysAgo(i),
      last_inbound_at: isoDaysAgo(i),
      tags: i % 2 === 0 ? ["familia"] : [],
      seed_tag: SEED_TAG,
    });
    msgRows.push(
      {
        direction: "outbound",
        recipient_name: g.full_name,
        recipient_phone: g.phone,
        template_name: "recordatorio_clase",
        status: "delivered",
        related_type: "evento",
        body_text: `Hola ${g.full_name}, te recordamos la clase de mañana a las 17:00.`,
        payload: { body: `Hola ${g.full_name}, te recordamos la clase de mañana a las 17:00.` },
        created_at: isoDaysAgo(i + 1),
        sent_at: isoDaysAgo(i + 1),
        delivered_at: isoDaysAgo(i + 1),
        seed_tag: SEED_TAG,
      },
      {
        direction: "inbound",
        recipient_name: g.full_name,
        recipient_phone: g.phone,
        template_name: "",
        status: "delivered",
        related_type: "evento",
        body_text: i % 2 === 0 ? "Perfecto, allí estaremos. ¡Gracias!" : "Hoy no podemos ir, lo siento.",
        payload: { body: i % 2 === 0 ? "Perfecto, allí estaremos." : "Hoy no podemos ir." },
        created_at: isoDaysAgo(i),
        seed_tag: SEED_TAG,
      },
    );
  }
  const { error: cErr } = await supabase.from("whatsapp_conversations").insert(convRows);
  if (cErr) console.warn(`  conversaciones: ${cErr.message}`);
  const { error: mErr } = await supabase.from("whatsapp_messages").insert(msgRows);
  if (mErr) throw mErr;
  total += msgRows.length;
  console.log(`✓ ${convRows.length} conversaciones, ${msgRows.length} mensajes WhatsApp`);

  // Marcar el flag en school_settings
  await supabase.from("school_settings").update({ demo_seed_active: true }).eq("id", true);

  return total;
}

try {
  if (WIPE_ONLY) {
    console.log("→ Borrando datos demo…");
    await wipe();
    await supabase.from("school_settings").update({ demo_seed_active: false }).eq("id", true);
    console.log("✓ Datos demo borrados");
  } else {
    console.log("→ Sembrando datos demo en", url);
    const n = await seed();
    console.log(`\n✓ Total: ${n} filas insertadas. Toggle activo en /admin/settings.`);
  }
} catch (err) {
  console.error("✗ Error:", err.message || err);
  process.exit(1);
}

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}
function fail(msg) { console.error("✗", msg); process.exit(1); }
