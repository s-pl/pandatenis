import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = { ...loadEnvFile(".env.local"), ...process.env };

const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = env.ADMIN_EMAIL || "admin@pandatenis.com";
const adminPassword = env.ADMIN_PASSWORD || generatePassword();
const adminName = env.ADMIN_FULL_NAME || "Panda Tenis Admin";

if (!supabaseUrl || !serviceRoleKey || isPlaceholder(supabaseUrl) || isPlaceholder(serviceRoleKey)) {
  fail(
    "Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY reales en .env.local antes de crear el admin.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

await assertSchemaReady();

let userId = await findProfileUserId(adminEmail);

if (!userId) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      full_name: adminName,
      role: "admin",
    },
  });

  if (error && !isAlreadyRegistered(error.message)) {
    fail(error.message);
  }

  userId = data.user?.id || (await findAuthUserId(adminEmail));
}

if (!userId) {
  fail(`No se pudo localizar el usuario ${adminEmail} en Supabase Auth.`);
}

const { error: updateUserError } = await supabase.auth.admin.updateUserById(userId, {
  email: adminEmail,
  password: adminPassword,
  email_confirm: true,
  user_metadata: {
    full_name: adminName,
    role: "admin",
  },
});

if (updateUserError) fail(updateUserError.message);

const { error: profileError } = await supabase.from("profiles").upsert(
  {
    id: userId,
    full_name: adminName,
    role: "admin",
    email: adminEmail,
  },
  { onConflict: "id" },
);

if (profileError) fail(profileError.message);

console.log("");
console.log("Admin listo:");
console.log(`Email: ${adminEmail}`);
console.log(`Password: ${adminPassword}`);
console.log("");
console.log("Guarda esta contrasena y cambiala despues desde Supabase Auth si lo necesitas.");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index);
        const value = line.slice(index + 1).replace(/^['"]|['"]$/g, "");
        return [key, value];
      }),
  );
}

async function assertSchemaReady() {
  const { error } = await supabase.from("school_settings").select("id").limit(1);

  if (!error) return;

  fail(
    [
      "La base no tiene las migraciones aplicadas o la URL/service role no apuntan al proyecto correcto.",
      "Ejecuta primero la migracion SQL de supabase/migrations/20260518180000_initial_private_area.sql.",
      `Detalle: ${error.message}`,
    ].join("\n"),
  );
}

async function findProfileUserId(email) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error) return null;
  return data?.id ?? null;
}

async function findAuthUserId(email) {
  const normalizedEmail = email.toLowerCase();
  let page = 1;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(error.message);

    const user = data.users.find((item) => item.email?.toLowerCase() === normalizedEmail);
    if (user) return user.id;
    if (data.users.length < 1000) return null;

    page += 1;
  }

  return null;
}

function generatePassword() {
  return `Panda-${randomBytes(12).toString("base64url")}-2026`;
}

function isAlreadyRegistered(message) {
  return /already|registered|exists/i.test(message);
}

function isPlaceholder(value) {
  return (
    value.includes("your-project") ||
    value.includes("your-supabase") ||
    value.includes("your-service") ||
    value.includes("tu-proyecto")
  );
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
