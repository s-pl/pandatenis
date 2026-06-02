"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Tema del panel de administración. Solo se monta dentro de `/admin`, así que
 * la web pública siempre queda en claro. El parpadeo inicial lo evita el script
 * inline de `src/app/[locale]/layout.tsx`, que fija `data-theme` antes de pintar
 * cuando la preferencia guardada es "dark" y la ruta es de admin.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "pt-theme";

function applyTheme(theme: Theme) {
  const el = document.documentElement;
  if (theme === "dark") el.setAttribute("data-theme", "dark");
  else el.removeAttribute("data-theme");
}

function readStored(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Al montar (entrar en admin) sincronizamos con la preferencia guardada
  // (sistema externo: localStorage + DOM que ya fijó el script anti-flash). Al
  // desmontar (salir a la web pública) restauramos claro para no “teñir” el sitio.
  useEffect(() => {
    const stored = readStored();
    applyTheme(stored);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync con preferencia persistida al montar
    setThemeState(stored);
    return () => applyTheme("light");
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(readStored() === "dark" ? "light" : "dark");
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}

/** Script anti-flash: se inyecta en el layout raíz para fijar el tema antes de pintar. */
export const themeNoFlashScript = `(function(){try{if(!/\\/admin(\\/|$)/.test(location.pathname))return;if(localStorage.getItem('${STORAGE_KEY}')==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;
