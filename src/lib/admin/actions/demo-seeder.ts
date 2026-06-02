"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/dal";

const SEED_TAG = "panda-demo";

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/** Toggle único: activa = sembrar, desactiva = borrar. */
export async function setDemoSeedAction(active: boolean): Promise<ActionResult<{ inserted?: number }>> {
  try {
    const { supabase } = await requireAdmin();
    if (active) {
      const inserted = await seed(supabase);
      await supabase
        .from("school_settings")
        .update({ demo_seed_active: true })
        .eq("id", true);
      revalidateAll();
      return { ok: true, data: { inserted } };
    } else {
      await wipe(supabase);
      await supabase
        .from("school_settings")
        .update({ demo_seed_active: false })
        .eq("id", true);
      revalidateAll();
      return { ok: true };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo falló" };
  }
}

function revalidateAll() {
  for (const p of [
    "/admin",
    "/admin/students",
    "/admin/groups",
    "/admin/planner",
    "/admin/payments",
    "/admin/leads",
    "/admin/registrations",
    "/admin/whatsapp",
    "/admin/whatsapp/chats",
    "/admin/campus",
    "/admin/settings",
  ]) {
    revalidatePath(p);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// WIPE
// ─────────────────────────────────────────────────────────────────────────

async function wipe(supabase: SupabaseClient) {
  // El orden importa por las FK aunque casi todo cascadea.
  // students -> guardians, payments, attendance, etc. (cascade)
  // registrations -> standalone (lead_id es set null)
  // leads -> standalone
  // whatsapp_messages -> standalone
  // whatsapp_conversations -> standalone
  // groups -> classes cascade; students.group_id se pone a null
  const tables = [
    "whatsapp_messages",
    "whatsapp_conversations",
    "registrations",
    "students",
    "groups",
    "leads",
  ];
  for (const t of tables) {
    await supabase.from(t).delete().eq("seed_tag", SEED_TAG);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SEED
// ─────────────────────────────────────────────────────────────────────────

type LevelKey = "Rojo" | "Naranja" | "Verde" | "Amarillo";

const GROUP_BLUEPRINTS: Array<{
  name: string;
  level: LevelKey;
  weekdays: string[];
  startTime: string;
  endTime: string;
  capacity: number;
  location: string;
}> = [
  { name: "Rojo · Iniciación L/X 16h", level: "Rojo", weekdays: ["L", "X"], startTime: "16:00", endTime: "17:00", capacity: 8, location: "Pista 1" },
  { name: "Rojo · Iniciación M/J 16h", level: "Rojo", weekdays: ["M", "J"], startTime: "16:00", endTime: "17:00", capacity: 8, location: "Pista 1" },
  { name: "Naranja L/X 17h", level: "Naranja", weekdays: ["L", "X"], startTime: "17:00", endTime: "18:00", capacity: 7, location: "Pista 2" },
  { name: "Naranja M/J 17h", level: "Naranja", weekdays: ["M", "J"], startTime: "17:00", endTime: "18:00", capacity: 7, location: "Pista 2" },
  { name: "Verde L/X 18h", level: "Verde", weekdays: ["L", "X"], startTime: "18:00", endTime: "19:00", capacity: 6, location: "Pista 2" },
  { name: "Verde V 17h", level: "Verde", weekdays: ["V"], startTime: "17:00", endTime: "18:30", capacity: 6, location: "Pista 1" },
  { name: "Amarillo M/J 19h", level: "Amarillo", weekdays: ["M", "J"], startTime: "19:00", endTime: "20:30", capacity: 5, location: "Pista 1" },
  { name: "Amarillo Sábado", level: "Amarillo", weekdays: ["S"], startTime: "10:00", endTime: "11:30", capacity: 5, location: "Pista 2" },
];

const FIRST_NAMES = [
  "Lucía", "Hugo", "Mateo", "Inés", "Daniela", "Bruno", "Carla", "Pablo",
  "Vega", "Yousef", "Sofía", "Nicolás", "Mara", "Adrián", "Lola", "Elena",
  "Diego", "Alma", "Iker", "Noa", "Marco", "Julia", "Sergio", "Aitana",
  "Leo", "Claudia", "Manu", "Greta", "Álex", "Paula",
];
const LAST_NAMES = [
  "García", "Pérez", "López", "Martín", "Sánchez", "Romero", "Ortega",
  "Castro", "Ruiz", "Domínguez", "Vidal", "Navarro", "Reyes", "Iglesias",
];
const GUARDIAN_NAMES = [
  "María", "Carlos", "Pilar", "Javier", "Andrea", "Roberto", "Carmen",
  "Luis", "Fátima", "Sergio", "Patricia", "Diego",
];
const TIME_BLOCKS = ["tarde-temprano", "tarde-media", "tarde-tardia", "sabado-manana"] as const;
const DAYS = ["L", "M", "X", "J", "V", "S"] as const;

function randPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randSubset<T>(arr: readonly T[], min: number, max: number): T[] {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function birthDateForAge(age: number): string {
  const today = new Date();
  const year = today.getFullYear() - age;
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 27);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function levelForAge(age: number): LevelKey {
  if (age <= 6) return "Rojo";
  if (age <= 9) return "Naranja";
  if (age <= 12) return "Verde";
  return "Amarillo";
}

function phone(seed: number): string {
  // 6XX XX XX XX, evitando colisiones con números reales razonables.
  const n = 600000000 + ((seed * 137) % 99999999);
  return String(n);
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function seed(supabase: SupabaseClient): Promise<number> {
  // Empezamos limpio por si quedaron restos.
  await wipe(supabase);

  let totalInserted = 0;

  // ── 1) Grupos ────────────────────────────────────────────────────────
  const { data: groups, error: gErr } = await supabase
    .from("groups")
    .insert(
      GROUP_BLUEPRINTS.map((g) => ({
        name: g.name,
        level: g.level,
        schedule: `${g.weekdays.join("·")} ${g.startTime}–${g.endTime}`,
        capacity: g.capacity,
        location: g.location,
        weekdays: g.weekdays,
        start_time: g.startTime,
        end_time: g.endTime,
        seed_tag: SEED_TAG,
      })),
    )
    .select("id, level, capacity");
  if (gErr) throw gErr;
  totalInserted += groups?.length ?? 0;

  // ── 2) Alumnos + tutores ─────────────────────────────────────────────
  type StudentSeed = {
    id?: string;
    first: string;
    last: string;
    age: number;
    level: LevelKey;
    groupId: string | null;
    days: string[];
    blocks: string[];
  };

  const students: StudentSeed[] = [];
  for (let age = 4; age <= 14; age++) {
    const perAge = 2 + Math.floor(Math.random() * 3); // 2–4 por edad
    for (let i = 0; i < perAge; i++) {
      const level = levelForAge(age);
      const candidates = (groups ?? []).filter((g) => (g.level as LevelKey) === level);
      // Reparte alumnos sin saturar el grupo
      const groupId =
        candidates.find((g) => {
          const taken = students.filter((s) => s.groupId === g.id).length;
          return taken < (g.capacity as number);
        })?.id ?? null;

      students.push({
        first: randPick(FIRST_NAMES),
        last: `${randPick(LAST_NAMES)} ${randPick(LAST_NAMES)}`,
        age,
        level,
        groupId: groupId as string | null,
        days: randSubset(DAYS, 2, 4),
        blocks: randSubset(TIME_BLOCKS, 1, 2),
      });
    }
  }

  // Dejamos a propósito ~6 sin grupo para que se vea el planificador en acción
  for (let i = 0; i < 6 && students.length > 0; i++) {
    students[students.length - 1 - i].groupId = null;
  }

  const { data: insertedStudents, error: sErr } = await supabase
    .from("students")
    .insert(
      students.map((s) => ({
        first_name: s.first,
        last_name: s.last,
        birth_date: birthDateForAge(s.age),
        level: s.level,
        dominant_hand: Math.random() < 0.85 ? "Derecha" : "Izquierda",
        group_id: s.groupId,
        active: true,
        image_consent: Math.random() < 0.8,
        preferred_days: s.days,
        preferred_time_blocks: s.blocks,
        seed_tag: SEED_TAG,
      })),
    )
    .select("id");
  if (sErr) throw sErr;
  totalInserted += insertedStudents?.length ?? 0;

  // ── 3) Tutores ───────────────────────────────────────────────────────
  const guardianRows = (insertedStudents ?? []).map((row, i) => ({
    student_id: row.id,
    full_name: `${randPick(GUARDIAN_NAMES)} ${randPick(LAST_NAMES)}`,
    phone: phone(i + 1),
    email: `demo-${i + 1}@panda-demo.test`,
    relationship: Math.random() < 0.5 ? "Madre" : "Padre",
  }));
  if (guardianRows.length > 0) {
    await supabase.from("guardians").insert(guardianRows);
  }

  // ── 4) Pagos (mezcla de estados) ─────────────────────────────────────
  const today = new Date();
  const paymentRows: Array<Record<string, unknown>> = [];
  for (const s of insertedStudents ?? []) {
    // 1-3 pagos por alumno, distintos estados
    const months = 1 + Math.floor(Math.random() * 3);
    for (let m = 0; m < months; m++) {
      const dueDate = new Date(today);
      dueDate.setMonth(dueDate.getMonth() - m);
      const dueIso = dueDate.toISOString().slice(0, 10);
      const rand = Math.random();
      let status: "pagado" | "pendiente" | "atrasado";
      let paidAt: string | null = null;
      if (rand < 0.6) {
        status = "pagado";
        paidAt = new Date(dueDate.getTime() - 86400000 * 2).toISOString();
      } else if (rand < 0.85) {
        status = "pendiente";
      } else {
        status = "atrasado";
      }
      paymentRows.push({
        student_id: s.id,
        concept: `Cuota ${dueDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`,
        amount: 45 + Math.floor(Math.random() * 30),
        due_date: dueIso,
        status,
        paid_at: paidAt,
        method: status === "pagado" ? (Math.random() < 0.6 ? "transferencia" : "bizum") : null,
      });
    }
  }
  if (paymentRows.length > 0) {
    await supabase.from("payments").insert(paymentRows);
  }

  // ── 5) Leads + inscripciones ─────────────────────────────────────────
  // Aseguramos una fuente "Web" para los leads del seeder
  const { data: source } = await supabase
    .from("lead_sources")
    .upsert({ name: "Web" }, { onConflict: "name" })
    .select("id")
    .single();

  const leadRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 8; i++) {
    leadRows.push({
      full_name: `${randPick(GUARDIAN_NAMES)} ${randPick(LAST_NAMES)}`,
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
  const { data: insertedLeads } = await supabase.from("leads").insert(leadRows).select("id, interest");
  totalInserted += insertedLeads?.length ?? 0;

  // Inscripciones (escuela y campus) – algunas pendientes
  const registrationRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 10; i++) {
    const isCampus = i % 3 === 0;
    const age = 4 + Math.floor(Math.random() * 10);
    registrationRows.push({
      type: isCampus ? "campus" : i % 5 === 0 ? "ambos" : "escuela",
      full_name: `${randPick(GUARDIAN_NAMES)} ${randPick(LAST_NAMES)}`,
      phone: phone(2000 + i),
      email: `inscripcion-demo-${i}@panda-demo.test`,
      child_name: `${randPick(FIRST_NAMES)} ${randPick(LAST_NAMES)}`,
      child_age: age,
      status: i < 6 ? "pendiente" : "confirmada",
      preferred_days: isCampus ? [] : randSubset(DAYS, 2, 4),
      preferred_time_blocks: isCampus ? [] : randSubset(TIME_BLOCKS, 1, 2),
      scheduling_notes: isCampus ? null : "Generado por seeder demo.",
      seed_tag: SEED_TAG,
    });
  }
  const { data: insertedRegs } = await supabase
    .from("registrations")
    .insert(registrationRows)
    .select("id");
  totalInserted += insertedRegs?.length ?? 0;

  // ── 6) WhatsApp: conversaciones + mensajes ───────────────────────────
  const convRows: Array<Record<string, unknown>> = [];
  const wabaMsgRows: Array<Record<string, unknown>> = [];
  const sampleFamilies = (guardianRows ?? []).slice(0, 6);

  for (const [i, g] of sampleFamilies.entries()) {
    const ph = g.phone as string;
    convRows.push({
      phone: ph,
      display_name: g.full_name,
      last_message_at: isoDaysAgo(i),
      last_inbound_at: isoDaysAgo(i),
      tags: i % 2 === 0 ? ["familia"] : [],
      seed_tag: SEED_TAG,
    });

    // Hilo: outbound de plantilla + inbound respuesta + outbound seguimiento
    wabaMsgRows.push(
      {
        direction: "outbound",
        recipient_name: g.full_name,
        recipient_phone: ph,
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
        recipient_phone: ph,
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

  if (convRows.length > 0) await supabase.from("whatsapp_conversations").insert(convRows);
  if (wabaMsgRows.length > 0) await supabase.from("whatsapp_messages").insert(wabaMsgRows);
  totalInserted += wabaMsgRows.length;

  return totalInserted;
}
