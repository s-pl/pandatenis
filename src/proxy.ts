import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Panda Tenis proxy (Next 16 middleware).
 *
 * Responsabilidades:
 *  1. Internacionalización (next-intl): añade prefijo /es o /en a la URL,
 *     detecta el idioma por cookie / Accept-Language y sincroniza la cookie
 *     NEXT_LOCALE.
 *  2. Autenticación Supabase para rutas /admin y /login (sólo cuando hace
 *     falta, para no encarecer las visitas anónimas a la web pública).
 */

const intlMiddleware = createIntlMiddleware(routing);

// Devuelve la ruta sin prefijo de locale para poder hacer matching estable
// independientemente del idioma. Ej.: "/es/admin/leads" -> "/admin/leads".
function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Las API routes no llevan prefijo de locale ni necesitan auth aquí.
  if (pathname.startsWith("/api")) {
    return NextResponse.next({ request });
  }

  // Primero deja que next-intl resuelva el locale (puede emitir una
  // redirección 308 hacia /es/... o /en/... si la URL viene sin prefijo).
  const intlResponse = intlMiddleware(request);

  if (intlResponse.headers.get("location")) {
    return intlResponse;
  }

  const bare = stripLocale(pathname);
  const needsAuthCheck = bare.startsWith("/admin") || bare === "/login";
  if (!needsAuthCheck) {
    return intlResponse;
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return intlResponse;
  }

  let response = intlResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = intlMiddleware(request);
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const isAuthenticated = !!session?.user;

  const locale =
    routing.locales.find(
      (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
    ) ?? routing.defaultLocale;

  const isAdminRoute = bare.startsWith("/admin");

  if (!isAuthenticated && isAdminRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}/login`;
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthenticated && bare === "/login") {
    const redirectUrl = request.nextUrl.clone();
    const nextParam = request.nextUrl.searchParams.get("next");
    redirectUrl.pathname =
      nextParam && stripLocale(nextParam).startsWith("/admin")
        ? nextParam
        : `/${locale}/admin`;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff2?)$).*)",
  ],
};
