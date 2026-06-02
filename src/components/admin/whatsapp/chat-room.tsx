"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  FilePlus2,
  UserPlus,
  MessageSquareOff,
  MoreVertical,
  Paperclip,
  Pointer,
  Printer,
  Search,
  Send,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createLeadFromWhatsappConversation,
  createWhatsappDocumentUploadUrl,
  deleteWhatsappConversation,
  markConversationAsRead,
  processWhatsappQueue,
  sendDirectMessage,
  sendWhatsappDocumentMessage,
} from "@/lib/admin/actions/whatsapp";
import { createClient } from "@/lib/supabase/client";
import { MessageContent, type MessageMedia } from "@/components/admin/whatsapp/message-content";
import {
  TemplateComposer,
  type ApprovedTemplate,
} from "@/components/admin/whatsapp/template-composer";
import { formatPhoneEs, initials, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RegistrationInviteDialog } from "@/components/admin/registrations/registration-invite-dialog";

type ChatReaction = { emoji: string; fromMe: boolean; timestamp: number };

type ChatMessage = {
  id: string;
  providerMessageId: string | null;
  direction: "inbound" | "outbound";
  status: "queued" | "sent" | "failed" | "delivered" | "read";
  relatedType: "recibo" | "promocion" | "evento" | "inscripcion" | "galeria" | null;
  templateName: string;
  body: string;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  isManual: boolean;
  isDirect: boolean;
  mediaType: string;
  hasMedia: boolean;
  mediaMime: string | null;
  mediaFilename: string | null;
  mediaSize: number | null;
  location: { latitude: number; longitude: number; description: string | null } | null;
  reactions: ChatReaction[];
  isForwarded: boolean;
};

const TYPE_LABEL: Record<NonNullable<ChatMessage["relatedType"]>, string> = {
  recibo: "Recibo",
  promocion: "Promoción",
  evento: "Evento",
  inscripcion: "Inscripción",
  galeria: "Galería",
};

const dayFormatter = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const dayFormatterWithYear = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatDayLabel(day: string): string {
  const date = new Date(day);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const diffDays = Math.round((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays > 1 && diffDays < 7) {
    return date
      .toLocaleDateString("es-ES", { weekday: "long" })
      .replace(/^./, (c) => c.toUpperCase());
  }
  return (sameYear ? dayFormatter : dayFormatterWithYear).format(date);
}

export function ChatRoom({
  contactName,
  phone,
  recipientName,
  studentName,
  studentId,
  groupName,
  relationship,
  isKnownContact,
  tags,
  internalNote,
  marketingOptOut,
  lastInboundAt,
  messages,
  windowOpen,
  approvedTemplates,
}: {
  contactName: string;
  phone: string;
  recipientName: string | null;
  studentName: string | null;
  studentId: string | null;
  groupName: string | null;
  relationship: string | null;
  isKnownContact: boolean;
  tags: string[];
  internalNote: string | null;
  marketingOptOut: boolean;
  lastInboundAt: string | null;
  messages: ChatMessage[];
  windowOpen: boolean;
  approvedTemplates: ApprovedTemplate[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentLimit = Math.max(
    Number(searchParams?.get("limit") ?? "80") || 80,
    20,
  );
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  // forcedClosed se activa cuando el servidor indica `requiresTemplate`
  // (Meta error 131047) — así el composer cambia al de plantilla sin esperar
  // al refresh. Comparamos contra el prop windowOpen anterior para resetear
  // automáticamente cuando el servidor confirma que la ventana se reabrió.
  const [forcedClosed, setForcedClosed] = useState(false);
  const [trackedWindowOpen, setTrackedWindowOpen] = useState(windowOpen);
  if (trackedWindowOpen !== windowOpen) {
    setTrackedWindowOpen(windowOpen);
    if (forcedClosed) setForcedClosed(false);
  }
  const windowOpenLocal = windowOpen && !forcedClosed;
  const [offline, setOffline] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [scrolledUp, setScrolledUp] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const queuePumpRef = useRef(false);
  const initialScrollDone = useRef(false);
  const lastMessageId = messages[messages.length - 1]?.id;
  const hasQueuedMessages = messages.some((message) => message.status === "queued");

  // Detección de conexión
  useEffect(() => {
    function onOnline() {
      setOffline(false);
    }
    function onOffline() {
      setOffline(true);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Scroll inicial al fondo, sin animación, y luego mantener pegado al fondo si el usuario está cerca
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!initialScrollDone.current) {
      el.scrollTop = el.scrollHeight;
      initialScrollDone.current = true;
      return;
    }
    // Sólo auto-scroll si el usuario está cerca del fondo (a menos de 200px)
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [lastMessageId]);

  function scrollToBottom(smooth = true) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  // Detectar si el usuario está scrolleado hacia arriba para mostrar el botón flotante
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setScrolledUp(distance > 240);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Marcar como leídos al entrar y cuando llegan nuevos inbound
  useEffect(() => {
    const hasUnread = messages.some((m) => m.direction === "inbound");
    if (!hasUnread) return;
    void markConversationAsRead({ phone }).catch(() => {
      /* errores silenciosos — se reintentará al refrescar */
    });
  }, [phone, lastMessageId, messages]);

  // Suscripción Realtime al hilo de este teléfono. Sustituye el polling
  // cada 3 s. Fallback de 60 s por si el WebSocket cae.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let debounce: number | null = null;

    function refresh() {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      if (debounce) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        try {
          router.refresh();
        } catch {
          /* ignore */
        }
      }, 250);
    }

    const channel = supabase
      .channel(`wa-chat-${phone}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `recipient_phone=eq.${phone}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "whatsapp_messages",
          filter: `recipient_phone=eq.${phone}`,
        },
        refresh,
      )
      .subscribe();

    const fallback = window.setInterval(refresh, 60_000);

    return () => {
      cancelled = true;
      if (debounce) window.clearTimeout(debounce);
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [phone, router]);

  // Drenado de cola si hay mensajes en queued
  useEffect(() => {
    if (!hasQueuedMessages) return;
    let cancelled = false;

    async function pumpQueue() {
      if (queuePumpRef.current) return;
      queuePumpRef.current = true;
      try {
        const result = await processWhatsappQueue({ phone, limit: 3 });
        if (cancelled || !result.ok) return;
        const changed = (result.data?.sent ?? 0) + (result.data?.failed ?? 0);
        if (changed > 0) router.refresh();
      } catch {
        /* silencioso */
      } finally {
        queuePumpRef.current = false;
      }
    }

    const first = window.setTimeout(() => void pumpQueue(), 1500);
    const interval = window.setInterval(() => void pumpQueue(), 10000);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [hasQueuedMessages, phone, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((message) => message.body.toLowerCase().includes(q));
  }, [messages, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ChatMessage[]>();
    for (const message of filtered) {
      const day = message.createdAt.slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(message);
      map.set(day, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
  }, [filtered]);

  const totalMessages = messages.length;
  const lastSeen = lastInboundAt ? relativeTime(lastInboundAt) : null;

  function handleSend(event?: FormEvent) {
    event?.preventDefault();
    const text = composer.trim();
    if (!text || pending) return;
    setComposer("");
    startTransition(async () => {
      try {
        const result = await sendDirectMessage({
          phone,
          body: text,
          recipientName: recipientName ?? contactName,
        });
        if (result.ok) {
          if (result.data?.status === "queued") {
            toast.info("Mensaje en cola", {
              description: result.data.notice ?? "Lo reintentaremos automáticamente.",
            });
          }
          router.refresh();
          requestAnimationFrame(() => scrollToBottom(true));
          textareaRef.current?.focus();
        } else {
          setComposer(text);
          if (result.requiresTemplate) {
            setForcedClosed(true);
            toast.error("Ventana de 24 h cerrada", {
              description: "Inicia la conversación con una plantilla aprobada.",
            });
          } else {
            toast.error("No se ha podido enviar", { description: result.error });
          }
        }
      } catch (error) {
        setComposer(text);
        toast.error("Error inesperado al enviar", {
          description: error instanceof Error ? error.message : "Inténtalo de nuevo",
        });
      }
    });
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite re-seleccionar el mismo archivo
    if (!file || uploading || pending) return;

    const mimeType = file.type || "application/octet-stream";
    setUploading(true);
    try {
      // 1) Pedir una signed upload URL (también valida la ventana de 24 h).
      const urlRes = await createWhatsappDocumentUploadUrl({
        phone,
        filename: file.name,
        mimeType,
      });
      if (!urlRes.ok) {
        if (urlRes.requiresTemplate) {
          setForcedClosed(true);
          toast.error("Ventana de 24 h cerrada", {
            description: "Inicia la conversación con una plantilla aprobada.",
          });
        } else {
          toast.error("No se pudo adjuntar", { description: urlRes.error });
        }
        return;
      }
      if (!urlRes.data) {
        toast.error("No se pudo preparar la subida del archivo.");
        return;
      }

      // 2) Subir el archivo directamente al Storage privado.
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("whatsapp-media")
        .uploadToSignedUrl(urlRes.data.storagePath, urlRes.data.token, file, {
          contentType: mimeType,
        });
      if (uploadError) {
        toast.error("No se pudo subir el archivo", { description: uploadError.message });
        return;
      }

      // 3) Registrar y enviar el mensaje con el archivo. El texto del composer
      //    (si lo hay) se manda como pie de foto/documento.
      const caption = composer.trim() || undefined;
      const sendRes = await sendWhatsappDocumentMessage({
        phone,
        storagePath: urlRes.data.storagePath,
        filename: file.name,
        mimeType,
        size: file.size,
        caption,
        recipientName: recipientName ?? contactName,
      });
      if (sendRes.ok) {
        setComposer("");
        if (sendRes.data?.status === "queued") {
          toast.info("Archivo en cola", {
            description: sendRes.data.notice ?? "Lo reintentaremos automáticamente.",
          });
        }
        router.refresh();
        requestAnimationFrame(() => scrollToBottom(true));
      } else if (sendRes.requiresTemplate) {
        setForcedClosed(true);
        toast.error("Ventana de 24 h cerrada", {
          description: "Inicia la conversación con una plantilla aprobada.",
        });
      } else {
        toast.error("No se pudo enviar el archivo", { description: sendRes.error });
      }
    } catch (error) {
      toast.error("Error al adjuntar", {
        description: error instanceof Error ? error.message : "Inténtalo de nuevo",
      });
    } finally {
      setUploading(false);
    }
  }

  function handleDeleteConversation() {
    if (
      !window.confirm(
        `Eliminar toda la conversación con ${contactName}?\n\nSe borrarán ${messages.length} ${
          messages.length === 1 ? "mensaje" : "mensajes"
        } del histórico de WhatsApp. Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }

    startDeleteTransition(async () => {
      try {
        const result = await deleteWhatsappConversation({ phone });
        if (result.ok) {
          toast.success("Conversación eliminada", {
            description: `${result.data?.deleted ?? 0} ${
              result.data?.deleted === 1 ? "mensaje borrado" : "mensajes borrados"
            }.`,
          });
          router.push("/admin/whatsapp/chats");
          router.refresh();
        } else {
          toast.error("No se ha podido eliminar", { description: result.error });
        }
      } catch (error) {
        toast.error("Error inesperado al eliminar", {
          description: error instanceof Error ? error.message : "Inténtalo de nuevo",
        });
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Banner offline */}
      <AnimatePresence>
        {offline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-[var(--warning-soft)] text-[var(--warning)]"
          >
            <div className="flex items-center gap-2 px-5 py-1.5 text-xs">
              <WifiOff className="h-3.5 w-3.5" /> Sin conexión a internet — los cambios no se sincronizan
              hasta que vuelvas a estar online.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header del chat */}
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[#075e54] px-2 py-2 text-white shadow-sm print:hidden sm:gap-3 sm:px-4 sm:py-3 lg:px-5">
        <Link
          href="/admin/whatsapp/chats"
          aria-label="Volver a conversaciones"
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <ContactAvatar name={contactName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{contactName}</p>
          <p className="truncate text-[11px] text-white/70">
            {formatPhoneEs(`+${phone}`)}
            {lastSeen && totalMessages > 0 ? ` · vista por última vez ${lastSeen}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Buscar en la conversación"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full text-white/90 transition-colors",
              searchOpen ? "bg-white/20" : "hover:bg-white/10",
            )}
          >
            <Search className="h-4 w-4" />
          </button>
          <ChatHeaderMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            phone={phone}
            studentId={studentId}
            studentName={studentName}
            contactName={contactName}
            isKnownContact={isKnownContact}
            onPrint={() => window.print()}
            onDeleteConversation={handleDeleteConversation}
            deletePending={deletePending}
          />
        </div>
      </header>

      {/* Sub-header con info del contacto */}
      {(studentName || groupName || relationship || !isKnownContact || tags.length > 0 || marketingOptOut || internalNote) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs print:hidden sm:px-5">
          {studentName && studentId && (
            <Link
              href={`/admin/students/${studentId}`}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 font-medium text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white"
            >
              Alumno · {studentName}
            </Link>
          )}
          {groupName && <Badge tone="neutral">Grupo {groupName}</Badge>}
          {relationship && <Badge tone="primary">{relationship}</Badge>}
          {!isKnownContact && <Badge tone="warning">Contacto nuevo</Badge>}
          {marketingOptOut && <Badge tone="danger">Sin promociones</Badge>}
          {tags.map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}
          {internalNote && (
            <span className="hidden truncate text-[var(--muted)] sm:inline">Nota: {internalNote}</span>
          )}
          <span className="ml-auto hidden text-[var(--muted)] sm:inline">
            {totalMessages} {totalMessages === 1 ? "mensaje" : "mensajes"}
          </span>
        </div>
      )}

      {/* Buscador */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-b border-[var(--border)] bg-[var(--surface-muted)] print:hidden"
          >
            <div className="flex items-center gap-2 px-5 py-2.5">
              <Search className="h-4 w-4 text-[var(--muted)]" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar en esta conversación"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
              />
              <span className="text-xs text-[var(--muted)]">
                {query
                  ? `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}`
                  : ""}
              </span>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSearchOpen(false);
                }}
                className="grid h-7 w-7 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--surface)]"
                aria-label="Cerrar buscador"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mensajes — único bloque con scroll propio */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto overscroll-contain bg-[#efeae2] print:overflow-visible print:bg-white"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><g fill='%23000' fill-opacity='0.04'><circle cx='12' cy='12' r='1.2'/><circle cx='84' cy='44' r='1.2'/><circle cx='38' cy='90' r='1.2'/><circle cx='120' cy='120' r='1.2'/><circle cx='150' cy='70' r='1.2'/></g></svg>\")",
        }}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-4 sm:px-5">
          {/* Botón paginación hacia atrás: aparece cuando el hilo cargado
              llega al límite, lo que sugiere que hay más histórico. */}
          {messages.length >= currentLimit && currentLimit < 800 && (
            <button
              type="button"
              onClick={() => {
                const next = Math.min(currentLimit + 200, 800);
                router.push(`/admin/whatsapp/chats/${phone}?limit=${next}`, {
                  scroll: false,
                });
              }}
              className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-1.5 text-[12px] font-semibold text-[#54656f] shadow-sm backdrop-blur transition hover:bg-white"
            >
              ↑ Ver mensajes anteriores
            </button>
          )}
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/80 text-[var(--muted)] shadow-sm">
                <MessageSquareOff className="h-5 w-5" />
              </span>
              <p className="max-w-sm text-sm text-[var(--muted)]">
                {query
                  ? `Sin resultados para "${query}"`
                  : windowOpenLocal
                    ? "Aún no hay mensajes con este contacto. Escribe el primero desde abajo."
                    : "Aún no hay histórico con este contacto. Usa una plantilla aprobada para iniciar la conversación."}
              </p>
            </div>
          ) : (
            grouped.map(([day, items]) => (
              <section key={day} className="flex flex-col gap-1.5">
                <div className="sticky top-1 z-10 mx-auto my-1 inline-flex w-fit items-center self-center rounded-full bg-white/90 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#54656f] shadow-sm backdrop-blur-sm print:bg-[var(--surface-muted)] print:shadow-none">
                  {formatDayLabel(day)}
                </div>
                <AnimatePresence initial={false}>
                  {items.map((message, idx) => {
                    const prev = items[idx - 1];
                    const groupedWithPrev =
                      prev &&
                      prev.direction === message.direction &&
                      new Date(message.createdAt).getTime() -
                        new Date(prev.createdAt).getTime() <
                        2 * 60 * 1000;
                    return (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        query={query}
                        groupedWithPrev={Boolean(groupedWithPrev)}
                      />
                    );
                  })}
                </AnimatePresence>
              </section>
            ))
          )}
        </div>

        {/* Botón flotante "ir al final" */}
        <AnimatePresence>
          {scrolledUp && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={() => scrollToBottom(true)}
              aria-label="Ir al último mensaje"
              className="absolute bottom-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-white text-[var(--primary)] shadow-[var(--shadow-md)] hover:bg-[var(--primary-soft)] print:hidden"
            >
              <ArrowDown className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Composer */}
      {windowOpenLocal ? (
        <form
          onSubmit={handleSend}
          className="flex flex-shrink-0 items-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 sm:px-4 print:hidden"
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
            onChange={handleFileSelected}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || pending}
            aria-label="Adjuntar documento"
            title="Adjuntar documento (PDF, Word, Excel, PowerPoint, imágenes…)"
            className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                aria-hidden
              />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
          </button>
          <Composer
            ref={textareaRef}
            value={composer}
            onChange={setComposer}
            onKeyDown={handleKeyDown}
            disabled={pending || uploading}
          />
          <Button
            type="submit"
            loading={pending}
            disabled={!composer.trim() || uploading}
            iconLeft={pending ? null : <Send className="h-4 w-4" />}
            size="md"
            className="h-11"
          >
            <span className="hidden sm:inline">{pending ? "Enviando…" : "Enviar"}</span>
          </Button>
        </form>
      ) : (
        <TemplateComposer
          phone={phone}
          recipientName={recipientName ?? contactName}
          templates={approvedTemplates}
        />
      )}
    </div>
  );
}

type ComposerProps = {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
};

const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { value, onChange, onKeyDown, disabled },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement, []);

  // Autosize del textarea
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  return (
    <textarea
      ref={innerRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder="Escribe un mensaje… (Enter para enviar, Shift+Enter nueva línea)"
      rows={1}
      disabled={disabled}
      className="min-h-[44px] max-h-[200px] flex-1 resize-none rounded-3xl border border-transparent bg-[var(--surface-muted)] px-4 py-3 text-sm leading-snug outline-none placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-[var(--ring)] disabled:opacity-60"
    />
  );
});

function MessageBubble({
  message,
  query,
  groupedWithPrev,
}: {
  message: ChatMessage;
  query: string;
  groupedWithPrev: boolean;
}) {
  const isOutbound = message.direction === "outbound";
  const media: MessageMedia = {
    messageId: message.id,
    providerMessageId: message.providerMessageId,
    mediaType: message.mediaType,
    hasMedia: message.hasMedia,
    mediaMime: message.mediaMime,
    mediaFilename: message.mediaFilename,
    mediaSize: message.mediaSize,
    location: message.location,
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14 }}
      className={cn(
        "flex print:justify-start",
        isOutbound ? "justify-end" : "justify-start",
        groupedWithPrev ? "mt-0.5" : "mt-1.5",
      )}
    >
      <article
        className={cn(
          "relative max-w-[78%] rounded-lg px-2.5 py-1.5 text-[14px] leading-snug shadow-[0_1px_0.5px_rgba(0,0,0,0.08)] print:break-inside-avoid print:max-w-full print:rounded-md print:border print:border-[var(--border)] print:bg-white print:shadow-none",
          isOutbound
            ? cn("bg-[#d9fdd3] text-[#111b21]", !groupedWithPrev && "rounded-tr-sm")
            : cn("bg-white text-[#111b21]", !groupedWithPrev && "rounded-tl-sm"),
          "md:max-w-[65%]",
        )}
      >
        {(message.relatedType || message.isManual || message.isDirect || message.isForwarded) && (
          <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[#54656f]">
            {message.isForwarded && (
              <span className="inline-flex items-center gap-1 italic text-[#54656f]">
                ↩ Reenviado
              </span>
            )}
            {message.relatedType && <Badge tone="neutral">{TYPE_LABEL[message.relatedType]}</Badge>}
            {message.isDirect ? null : message.isManual ? (
              <Badge tone="accent" iconLeft={<Pointer className="h-3 w-3" />}>
                Manual
              </Badge>
            ) : isOutbound &&
              message.templateName !== "incoming" &&
              message.templateName !== "chat_directo" &&
              message.templateName !== "history_outbound" ? (
              <span className="font-mono text-[#54656f]">{message.templateName}</span>
            ) : null}
          </div>
        )}
        <MessageContent
          body={message.body}
          media={media}
          highlight={query ? renderBodyWithHighlight(message.body, query) : undefined}
        />
        {message.errorMessage && (
          <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-[var(--danger-soft)] px-2 py-0.5 text-[11px] text-[var(--danger)]">
            <AlertTriangle className="h-3 w-3" /> {message.errorMessage}
          </p>
        )}
        {message.reactions.length > 0 && (
          <div
            className={cn(
              "mt-1 flex flex-wrap gap-1",
              isOutbound ? "justify-end" : "justify-start",
            )}
          >
            {message.reactions.map((reaction, idx) => (
              <span
                key={`${reaction.emoji}-${idx}`}
                title={reaction.fromMe ? "Tu reacción" : "Reacción del contacto"}
                className={cn(
                  "inline-flex items-center rounded-full border bg-white px-1.5 text-xs leading-5 shadow-sm",
                  reaction.fromMe ? "border-[var(--primary)]/40" : "border-[var(--border)]",
                )}
              >
                <span aria-hidden>{reaction.emoji}</span>
              </span>
            ))}
          </div>
        )}
        <div
          className={cn(
            "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
            isOutbound ? "text-[#667781]" : "text-[#667781]",
          )}
        >
          <span>{timeFormatter.format(new Date(message.sentAt ?? message.createdAt))}</span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
        {!groupedWithPrev && (
          <span
            className={cn(
              "absolute top-0 h-3 w-3 print:hidden",
              isOutbound ? "right-[-6px] bg-[#d9fdd3]" : "left-[-6px] bg-white",
            )}
            style={{
              clipPath: isOutbound
                ? "polygon(0 0, 100% 0, 0 100%)"
                : "polygon(0 0, 100% 0, 100% 100%)",
            }}
            aria-hidden
          />
        )}
      </article>
    </motion.div>
  );
}

function ContactAvatar({ name }: { name: string }) {
  const initialsText = initials(name) || name.slice(0, 1).toUpperCase();
  return (
    <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-white/15 text-sm font-semibold ring-1 ring-white/20">
      {initialsText}
    </div>
  );
}

function ChatHeaderMenu({
  open,
  onOpenChange,
  phone,
  studentId,
  studentName,
  contactName,
  isKnownContact,
  onPrint,
  onDeleteConversation,
  deletePending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  phone: string;
  studentId: string | null;
  studentName: string | null;
  contactName: string;
  isKnownContact: boolean;
  onPrint: () => void;
  onDeleteConversation: () => void;
  deletePending: boolean;
}) {
  const router = useRouter();
  const [leadPending, startLeadTransition] = useTransition();

  function handleCreateLead() {
    startLeadTransition(async () => {
      const result = await createLeadFromWhatsappConversation({
        phone,
        fullName: contactName,
      });
      if (result.ok) {
        toast.success("Lead creado desde WhatsApp");
        router.refresh();
      } else {
        toast.error("No se ha podido crear el lead", { description: result.error });
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label="Más opciones"
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full text-white/90 transition-colors",
          open ? "bg-white/20" : "hover:bg-white/10",
        )}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Cerrar menú"
              className="fixed inset-0 z-20 cursor-default"
              onClick={() => onOpenChange(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-foreground shadow-[var(--shadow-lg)]"
            >
              {studentId && studentName && (
                <Link
                  href={`/admin/students/${studentId}`}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-[var(--surface-muted)]"
                  onClick={() => onOpenChange(false)}
                >
                  Ficha de {studentName}
                </Link>
              )}
              {!isKnownContact && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    handleCreateLead();
                  }}
                  disabled={leadPending}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {leadPending ? (
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                      aria-hidden
                    />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Crear lead
                </button>
              )}
              <RegistrationInviteDialog
                defaultGuardianName={contactName}
                defaultPhone={phone}
                renderTrigger={(openInvite) => (
                  <button
                    type="button"
                    onClick={() => {
                      openInvite();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-[var(--surface-muted)]"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    Crear ficha
                  </button>
                )}
              />
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onPrint();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-[var(--surface-muted)]"
              >
                <Printer className="h-4 w-4" /> Imprimir / PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onDeleteConversation();
                }}
                disabled={deletePending}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-[var(--danger)] hover:bg-[var(--danger-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletePending ? (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                    aria-hidden
                  />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Eliminar conversación
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function renderBodyWithHighlight(body: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return body;
  const lowerBody = body.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    const idx = lowerBody.indexOf(lowerQuery, cursor);
    if (idx === -1) {
      parts.push(body.slice(cursor));
      break;
    }
    if (idx > cursor) parts.push(body.slice(cursor, idx));
    parts.push(
      <mark
        key={`m-${idx}`}
        className="rounded-sm bg-[var(--accent)] px-0.5 text-[var(--accent-foreground)]"
      >
        {body.slice(idx, idx + q.length)}
      </mark>,
    );
    cursor = idx + q.length;
  }
  return parts;
}

function StatusIcon({ status }: { status: ChatMessage["status"] }): ReactNode {
  if (status === "queued") return <Clock className="h-3 w-3" />;
  if (status === "sent") return <Check className="h-3 w-3" />;
  if (status === "delivered" || status === "read") return <CheckCheck className="h-3 w-3 text-[#53bdeb]" />;
  return <AlertTriangle className="h-3 w-3 text-[var(--danger)]" />;
}
