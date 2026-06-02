"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type Conversation = {
  phone: string;
  contactName: string;
  count: number;
  lastBody: string;
  lastAt: string;
};

type Snapshot = {
  total: number;
  conversations: Conversation[];
};

type Permission = NotificationPermission | "unsupported";

type Ctx = {
  unreadTotal: number;
  unreadByPhone: Map<string, number>;
  notificationPermission: Permission;
  requestPermission: () => Promise<void>;
};

const NotificationsContext = createContext<Ctx>({
  unreadTotal: 0,
  unreadByPhone: new Map(),
  notificationPermission: "unsupported",
  requestPermission: async () => {},
});

export function useWhatsappNotifications() {
  return useContext(NotificationsContext);
}

const LAST_SEEN_STORAGE_KEY = "pt:whatsapp:lastSeen";
const MAX_TITLE_BADGE = 99;
// Fallback de seguridad: si la suscripción Realtime se cae o se desincroniza,
// recargamos el resumen completo cada 60 s. NO es el camino principal.
const FALLBACK_REFETCH_MS = 60_000;

type InboundRow = {
  recipient_phone: string;
  recipient_name: string | null;
  body_text: string | null;
  template_name: string | null;
  created_at: string;
  read_at: string | null;
  direction: "inbound" | "outbound";
  payload: Record<string, unknown> | null;
};

export function WhatsappNotificationsProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ total: 0, conversations: [] });
  const [permission, setPermission] = useState<Permission>(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  });
  const pathname = usePathname();
  const lastSeenRef = useRef<Map<string, string>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
    } catch {
      /* ignore */
    }
  }, []);

  // Hidrata lastSeen desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_SEEN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        lastSeenRef.current = new Map(Object.entries(parsed));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistLastSeen = useCallback(() => {
    try {
      const obj: Record<string, string> = {};
      for (const [k, v] of lastSeenRef.current.entries()) obj[k] = v;
      localStorage.setItem(LAST_SEEN_STORAGE_KEY, JSON.stringify(obj));
    } catch {
      /* ignore */
    }
  }, []);

  const playBeep = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        audioCtxRef.current = new Ctor();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      /* ignore */
    }
  }, []);

  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const permissionRef = useRef(permission);
  useEffect(() => {
    permissionRef.current = permission;
  }, [permission]);

  const notifyArrival = useCallback(
    (conv: Conversation) => {
      const isTabHidden = typeof document !== "undefined" && document.visibilityState !== "visible";
      const onThatChat =
        pathnameRef.current?.includes(`/admin/whatsapp/chats/${conv.phone}`) &&
        typeof document !== "undefined" &&
        document.visibilityState === "visible";
      if (onThatChat) return;

      playBeep();
      toast(`${conv.contactName} te ha escrito`, {
        description: conv.lastBody.slice(0, 120),
        action: {
          label: "Abrir",
          onClick: () => {
            window.location.assign(`/admin/whatsapp/chats/${conv.phone}`);
          },
        },
      });
      if (isTabHidden && permissionRef.current === "granted") {
        try {
          const notif = new Notification(`Panda Tenis · ${conv.contactName}`, {
            body: conv.lastBody.slice(0, 140),
            tag: `wa-${conv.phone}`,
            icon: "/favicon.ico",
          });
          notif.onclick = () => {
            window.focus();
            window.location.assign(`/admin/whatsapp/chats/${conv.phone}`);
          };
        } catch {
          /* ignore */
        }
      }
    },
    [playBeep],
  );

  const applySnapshot = useCallback(
    (data: Snapshot, fromRealtime: boolean) => {
      if (fromRealtime) {
        for (const conv of data.conversations) {
          const previousLastAt = lastSeenRef.current.get(conv.phone);
          const isNew =
            !previousLastAt ||
            new Date(conv.lastAt).getTime() > new Date(previousLastAt).getTime();
          if (isNew) notifyArrival(conv);
        }
      }
      for (const conv of data.conversations) {
        lastSeenRef.current.set(conv.phone, conv.lastAt);
      }
      persistLastSeen();
      setSnapshot(data);
    },
    [notifyArrival, persistLastSeen],
  );

  // ── 1) Carga inicial + fallback periódico cada 60 s ─────────────────────
  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    let isFirst = true;

    async function fetchSummary() {
      try {
        const response = await fetch("/api/whatsapp/unread-summary", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as Snapshot;
        if (cancelled) return;
        // Solo dispara notificaciones en refetches posteriores (no en la carga
        // inicial al montar). Realtime cubre el resto en tiempo real.
        applySnapshot(data, !isFirst);
        isFirst = false;
      } catch {
        /* silencioso */
      }
    }

    fetchSummary();
    timer = window.setInterval(fetchSummary, FALLBACK_REFETCH_MS);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [applySnapshot]);

  // ── 2) Suscripción Realtime a INSERT/UPDATE de whatsapp_messages ───────
  // Cuando llega un mensaje nuevo o se marca como leído, refrescamos el
  // resumen (es una sola query barata) y actualizamos el estado local.
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let debounceTimer: number | null = null;

    function refresh() {
      if (cancelled) return;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      // Debounce mínimo para colapsar ráfagas de eventos del webhook
      debounceTimer = window.setTimeout(async () => {
        try {
          const response = await fetch("/api/whatsapp/unread-summary", {
            cache: "no-store",
          });
          if (!response.ok) return;
          const data = (await response.json()) as Snapshot;
          if (cancelled) return;
          applySnapshot(data, true);
        } catch {
          /* ignore */
        }
      }, 250);
    }

    channel = supabase
      .channel("wa-inbox-summary")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: "direction=eq.inbound",
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "whatsapp_messages",
          filter: "direction=eq.inbound",
        },
        refresh,
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (debounceTimer) window.clearTimeout(debounceTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [applySnapshot]);

  // Título de pestaña con (N)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const stripped = document.title.replace(/^\(\d+\+?\)\s+/, "");
    if (snapshot.total > 0) {
      const label = snapshot.total > MAX_TITLE_BADGE ? `${MAX_TITLE_BADGE}+` : snapshot.total;
      document.title = `(${label}) ${stripped}`;
    } else {
      document.title = stripped;
    }
  }, [snapshot.total]);

  const unreadByPhone = useMemo(() => {
    const map = new Map<string, number>();
    for (const conv of snapshot.conversations) map.set(conv.phone, conv.count);
    return map;
  }, [snapshot.conversations]);

  const value: Ctx = useMemo(
    () => ({
      unreadTotal: snapshot.total,
      unreadByPhone,
      notificationPermission: permission,
      requestPermission,
    }),
    [snapshot.total, unreadByPhone, permission, requestPermission],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

// Tipos disponibles para usos futuros si se necesitan.
export type { InboundRow };
