const baseUrl = process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";

const checks = [
  { path: "/", expect: 307 },
  { path: "/es", expect: 200 },
  { path: "/es/inscripcion", expect: 200 },
  { path: "/es/login", expect: 200 },
  { path: "/es/admin", expect: 307 },
  { path: "/home", expect: 308 },
  { path: "/hello-world", expect: 308 },
];

let failed = false;

for (const check of checks) {
  const url = new URL(check.path, baseUrl).toString();
  const response = await fetch(url, { redirect: "manual" });
  if (response.status !== check.expect) {
    failed = true;
    console.error(`${check.path}: expected ${check.expect}, got ${response.status}`);
  } else {
    console.log(`${check.path}: ${response.status}`);
  }
}

if (failed) process.exit(1);
