export type AdminRole = "admin" | "profesor";

export const PROFESSOR_ADMIN_PATH_PREFIXES = [
  "/admin/attendance",
  "/admin/registrations",
] as const;

export function isAdminRole(value: unknown): value is AdminRole {
  return value === "admin" || value === "profesor";
}

function cleanAdminPath(pathname: string) {
  const [path] = pathname.split("?");
  if (!path || path === "/") return "/admin";
  return path.length > 1 ? path.replace(/\/$/, "") : path;
}

export function canAccessAdminPath(role: AdminRole, pathname: string) {
  if (role === "admin") return true;
  const path = cleanAdminPath(pathname);
  if (path === "/admin") return true;
  return PROFESSOR_ADMIN_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function canProfessorAccessAdminPath(pathname: string) {
  return canAccessAdminPath("profesor", pathname);
}
