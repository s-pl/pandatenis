export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return Boolean(url && anonKey && isRealSupabaseUrl(url) && !isPlaceholder(anonKey));
}

export function getSupabaseBrowserEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || !isRealSupabaseUrl(url) || isPlaceholder(anonKey)) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return { url, anonKey };
}

function isRealSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co") && !isPlaceholder(value);
  } catch {
    return false;
  }
}

function isPlaceholder(value: string) {
  return value.includes("your-project") || value.includes("your-supabase") || value.includes("tu-proyecto");
}
