"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckSquare, ChevronLeft, ChevronRight, Filter, MessageSquareText, Search, Square, Trash2, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  bulkDeleteWhatsappConversations,
  deleteWhatsappConversation,
} from "@/lib/admin/actions/whatsapp";
import { createClient } from "@/lib/supabase/client";
import { formatPhoneEs, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Conversation = {
  phone: string;
  contactName: string;
  lastMessage: string;
  lastMessageAt: string;
  lastDirection: "inbound" | "outbound";
  lastStatus: string;
  unread: number;
  total: number;
  needsReply: boolean;
  isKnownContact: boolean;
  tags: string[];
  internalNote: string | null;
  marketingOptOut: boolean;
};

export function ChatsList({ conversations }: { conversations: Conversation[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "needsReply" | "new" | "optOut">("all");
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [page, setPage] = useState(1);
  const router = useRouter();
  const PAGE_SIZE = 20;

  // Realtime: cuando llega un INSERT en whatsapp_messages, refrescamos la
  // lista. Reemplaza el polling cada 5s que costaba Function Invocations.
  // Fallback de 90s por si el WebSocket se cae.
  useEffect(() => {
    const supabase = createClient();
    let debounce: number | null = null;
    function bumpRefresh() {
      if (debounce) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => router.refresh(), 400);
    }
    const channel = supabase
      .channel("wa-chats-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        bumpRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_messages" },
        bumpRefresh,
      )
      .subscribe();

    const fallback = window.setInterval(() => router.refresh(), 90_000);
    return () => {
      if (debounce) window.clearTimeout(debounce);
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && c.unread === 0) return false;
      if (filter === "needsReply" && !c.needsReply) return false;
      if (filter === "new" && c.isKnownContact) return false;
      if (filter === "optOut" && !c.marketingOptOut) return false;
      if (!q) return true;
      return (
        c.contactName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        c.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [conversations, query, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const visiblePhones = useMemo(() => filtered.map((conv) => conv.phone), [filtered]);
  const selectedCount = selectedPhones.size;
  const allVisibleSelected =
    visiblePhones.length > 0 && visiblePhones.every((phone) => selectedPhones.has(phone));
  const selectedConversations = useMemo(
    () => conversations.filter((conv) => selectedPhones.has(conv.phone)),
    [conversations, selectedPhones],
  );
  const selectedMessageCount = selectedConversations.reduce((total, conv) => total + conv.total, 0);

  function toggleConversation(phone: string) {
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  }

  function toggleVisible() {
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const phone of visiblePhones) next.delete(phone);
      } else {
        for (const phone of visiblePhones) next.add(phone);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedPhones(new Set());
  }

  function handleDeleteConversation(conv: Conversation) {
    if (
      !window.confirm(
        `Eliminar la conversación con ${conv.contactName}?\n\nSe borrarán ${conv.total} ${
          conv.total === 1 ? "mensaje" : "mensajes"
        } del histórico de WhatsApp. Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }

    setPendingPhone(conv.phone);
    startTransition(async () => {
      try {
        const result = await deleteWhatsappConversation({ phone: conv.phone });
        if (result.ok) {
          toast.success("Conversación eliminada", {
            description: `${result.data?.deleted ?? 0} ${
              result.data?.deleted === 1 ? "mensaje borrado" : "mensajes borrados"
            }.`,
          });
          setSelectedPhones((prev) => {
            const next = new Set(prev);
            next.delete(conv.phone);
            return next;
          });
          router.refresh();
        } else {
          toast.error("No se ha podido eliminar", { description: result.error });
        }
      } catch (error) {
        toast.error("Error inesperado al eliminar", {
          description: error instanceof Error ? error.message : "Inténtalo de nuevo",
        });
      } finally {
        setPendingPhone(null);
      }
    });
  }

  function handleBulkDelete() {
    const phones = Array.from(selectedPhones);
    if (phones.length === 0) return;
    const messageHint =
      selectedMessageCount > 0
        ? ` Se borrarán ${selectedMessageCount} ${
            selectedMessageCount === 1 ? "mensaje" : "mensajes"
          } del histórico.`
        : "";
    if (
      !window.confirm(
        `Eliminar ${phones.length} ${
          phones.length === 1 ? "conversación seleccionada" : "conversaciones seleccionadas"
        }?${messageHint}\n\nEsta acción no se puede deshacer.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkDeleteWhatsappConversations({ phones });
        if (result.ok) {
          toast.success(`${result.data?.conversations ?? phones.length} conversaciones eliminadas`, {
            description: `${result.data?.deleted ?? 0} mensajes borrados.`,
          });
          clearSelection();
          router.refresh();
        } else {
          toast.error("No se han podido eliminar", { description: result.error });
        }
      } catch (error) {
        toast.error("Error inesperado al eliminar", {
          description: error instanceof Error ? error.message : "Inténtalo de nuevo",
        });
      }
    });
  }

  return (
    <Card>
      <header className="border-b border-[var(--border)] p-3 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar familia, teléfono o palabra clave…"
              iconLeft={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <Filter className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
            {[
              ["all", "Todos"],
              ["needsReply", "Sin responder"],
              ["unread", "No leídos"],
              ["new", "Nuevos"],
              ["optOut", "Sin promos"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id as typeof filter)}
                className={cn(
                  "flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === id
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--surface-muted)] text-[var(--muted)] hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {filtered.length > 0 && (
            <div className="hidden flex-wrap items-center gap-2 sm:flex">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={toggleVisible}
                disabled={pending}
                iconLeft={
                  allVisibleSelected ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )
                }
              >
                {allVisibleSelected ? "Quitar visibles" : "Seleccionar visibles"}
              </Button>
              <AnimatePresence initial={false}>
                {selectedCount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
                      {selectedCount} {selectedCount === 1 ? "seleccionada" : "seleccionadas"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      disabled={pending}
                      iconLeft={<X className="h-4 w-4" />}
                    >
                      Limpiar
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={handleBulkDelete}
                      loading={pending && pendingPhone === null}
                      iconLeft={<Trash2 className="h-4 w-4" />}
                    >
                      Eliminar
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </header>

      {filtered.length === 0 ? (
        <CardBody>
          <EmptyState
            icon={<MessageSquareText className="h-5 w-5" />}
            title={conversations.length === 0 ? "Aún no hay conversaciones" : "Sin resultados"}
            description={
              conversations.length === 0
                ? "Cuando mandes o recibas el primer mensaje desde WhatsApp, aparecerá aquí ordenado por actividad reciente."
                : "Cambia los términos de búsqueda."
            }
          />
        </CardBody>
      ) : (
        <div>
        <ul className="divide-y divide-[var(--border)]">
          <AnimatePresence initial={false}>
            {paged.map((conv) => {
              const isSelected = selectedPhones.has(conv.phone);
              const isDeleting = pendingPhone === conv.phone;
              return (
                <motion.li
                  key={conv.phone}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className={cn(
                    "flex items-center gap-2 px-2 py-3 transition-colors sm:gap-3 sm:px-4",
                    isSelected ? "bg-[var(--danger-soft)]/50" : "hover:bg-[var(--surface-muted)]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleConversation(conv.phone)}
                    disabled={pending}
                    className={cn(
                      "hidden h-9 w-9 flex-shrink-0 place-items-center rounded-full transition-colors sm:grid",
                      isSelected
                        ? "text-[var(--danger)] hover:bg-white/70"
                        : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]",
                    )}
                    aria-label={
                      isSelected
                        ? `Quitar ${conv.contactName} de la selección`
                        : `Seleccionar ${conv.contactName}`
                    }
                  >
                    {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                  <Link
                    href={`/admin/whatsapp/chats/${conv.phone}`}
                    className="flex min-w-0 flex-1 items-center gap-4 rounded-xl px-1 py-1 transition-colors hover:bg-white/50"
                  >
                    <Avatar name={conv.contactName} hasUnread={conv.unread > 0} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className={cn(
                            "truncate text-sm",
                            conv.unread > 0 ? "font-semibold" : "font-medium",
                          )}
                        >
                          {conv.contactName}
                        </p>
                        <span className="flex-shrink-0 text-[11px] text-[var(--muted)]">
                          {relativeTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <p
                          className={cn(
                            "truncate text-xs",
                            conv.unread > 0 ? "text-foreground" : "text-[var(--muted)]",
                          )}
                        >
                          {conv.lastDirection === "outbound" && (
                            <span className="text-[var(--muted)]">Tú: </span>
                          )}
                          {conv.lastMessage}
                        </p>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {conv.unread > 0 && <Badge tone="danger">{conv.unread}</Badge>}
                        </div>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {formatPhoneEs(`+${conv.phone}`)} · {conv.total} mensajes
                      </p>
                      {(conv.tags.length > 0 || conv.needsReply || conv.marketingOptOut || !conv.isKnownContact) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {conv.needsReply && <Badge tone="warning">Sin responder</Badge>}
                          {!conv.isKnownContact && <Badge tone="primary">Nuevo</Badge>}
                          {conv.marketingOptOut && <Badge tone="danger">Sin promos</Badge>}
                          {conv.tags.map((tag) => (
                            <Badge key={tag} tone="neutral">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDeleteConversation(conv)}
                    disabled={pending}
                    className="hidden h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50 sm:grid"
                    aria-label={`Eliminar conversación con ${conv.contactName}`}
                    title="Eliminar conversación"
                  >
                    {isDeleting ? (
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                        aria-hidden
                      />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-2.5 text-[12.5px] sm:px-5">
            <span className="text-[var(--muted)]">
              {filtered.length} {filtered.length === 1 ? "conversación" : "conversaciones"}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[var(--muted)]">
                <span className="font-semibold text-foreground">{currentPage}</span>
                <span className="mx-1">/</span>
                <span className="font-semibold text-foreground">{totalPages}</span>
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Anterior"
                className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Siguiente"
                className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        </div>
      )}
    </Card>
  );
}

function Avatar({ name, hasUnread }: { name: string; hasUnread: boolean }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .padEnd(1, "·")
    .slice(0, 2);
  return (
    <div
      className={cn(
        "relative grid h-12 w-12 flex-shrink-0 place-items-center rounded-full text-sm font-semibold",
        hasUnread
          ? "bg-[var(--primary)] text-white"
          : "bg-[var(--primary-soft)] text-[var(--primary)]",
      )}
    >
      {initials || "·"}
      {hasUnread && (
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[var(--surface)] bg-[var(--danger)]" />
      )}
    </div>
  );
}
