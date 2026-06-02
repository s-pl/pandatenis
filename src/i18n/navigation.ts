import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers for next/navigation.
// Import { Link, redirect, usePathname, useRouter, getPathname } from
// "@/i18n/navigation" instead of "next/link" / "next/navigation" so the
// active locale is preserved across navigations.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
