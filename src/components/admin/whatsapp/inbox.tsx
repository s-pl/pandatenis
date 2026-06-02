"use client";

import {
  AlertTriangle,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquareText,
  Pointer,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import type { Message } from "@/components/admin/whatsapp/whatsapp-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  bulkDeleteMessages,
  deleteWhatsappMessage,
  processWhatsappQueue,
  purgeWhatsappMessages,
  retryWhatsappMessage,
} from "@/lib/admin/actions/whatsapp";
import { formatPhoneEs, normalizeWhatsappNumber, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  Message["status"],
  { label: string; tone: "info" | "success" | "danger" | "neutral"; icon: typeof Clock }
> = {
  queued: { label: "En cola", tone: "info", icon: Clock },
  sent: { label: "Enviado", tone: "neutral", icon: CheckCheck },
  delivered: { label: "Entregado", tone: "success", icon: CheckCheck },
  read: { label: "Leído", tone: "success", icon: CheckCheck },
  failed: { label: "Fallido", tone: "danger", icon: XCircle },
};

const TYPE_LABEL: Record<Message["relatedType"], string> = {
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

// Estados en los que es seguro borrar en bulk sin pedir confirmación adicional.
// Borrar "sent" o "delivered" perdería histórico — el UI exige confirm explícito.
const SAFE_BULK_STATUSES: Message["status"][] = ["queued", "failed"];

export function WhatsappInbox({ messages }: { messages: Message[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Message["status"]>("all");
  const [related, setRelated] = useState<"all" | Message["relatedType"]>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((message) => {
      if (status !== "all" && message.status !== status) return false;
      if (related !== "all" && message.relatedType !== related) return false;
      if (!q) return true;
      return (
        message.recipientName.toLowerCase().includes(q) ||
        message.recipientPhone.includes(q) ||
        message.templateName.toLowerCase().includes(q)
      );
    });
  }, [messages, query, status, related]);

  const INBOX_PAGE_SIZE = 30;
  const totalPages = Math.max(1, Math.ceil(filtered.length / INBOX_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const grouped = useMemo(() => {
    const start = (currentPage - 1) * INBOX_PAGE_SIZE;
    const paged = filtered.slice(start, start + INBOX_PAGE_SIZE);
    const map = new Map<string, Message[]>();
    for (const message of paged) {
      const key = message.createdAt.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(message);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
  }, [filtered, currentPage]);

  const queuedCount = useMemo(() => messages.filter((m) => m.status === "queued").length, [messages]);
  const failedCount = useMemo(() => messages.filter((m) => m.status === "failed").length, [messages]);

  // De los seleccionados, cuántos serían borrados con la política "safe" (queued + failed)
  const selectedSafeCount = useMemo(() => {
    let count = 0;
    for (const message of messages) {
      if (selected.has(message.id) && SAFE_BULK_STATUSES.includes(message.status)) count++;
    }
    return count;
  }, [messages, selected]);

  const selectedTotal = selected.size;
  const visibleIds = useMemo(() => filtered.map((m) => m.id), [filtered]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleRetry(message: Message) {
    setPendingId(message.id);
    startTransition(async () => {
      const result = await retryWhatsappMessage(message.id);
      setPendingId(null);
      if (result.ok) {
        toast.success(result.data?.status === "sent" ? "Mensaje enviado" : "Mensaje en cola", {
          description:
            result.data?.status === "queued"
              ? "Cloud API lo reintentará automáticamente desde la cola."
              : undefined,
        });
      }
      else toast.error("No se ha podido reintentar", { description: result.error });
    });
  }

  function handleProcessQueue() {
    startTransition(async () => {
      const result = await processWhatsappQueue({ limit: 10 });
      if (result.ok) {
        const { sent = 0, queued = 0, failed = 0, skipped = 0 } = result.data ?? {};
        toast.success(`${sent} enviados desde la cola`, {
          description:
            queued + failed + skipped > 0
              ? `${queued} siguen en cola, ${failed} fallidos, ${skipped} esperan su turno.`
              : "La cola ha quedado limpia.",
        });
      } else {
        toast.error("No se ha podido procesar la cola", { description: result.error });
      }
    });
  }

  function handleDelete(message: Message) {
    if (!confirm(`Borrar el envío a ${message.recipientName}?`)) return;
    setPendingId(message.id);
    startTransition(async () => {
      const result = await deleteWhatsappMessage(message.id);
      setPendingId(null);
      if (result.ok) {
        toast.success("Mensaje eliminado");
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(message.id);
          return next;
        });
      } else {
        toast.error("No se ha podido eliminar", { description: result.error });
      }
    });
  }

  function handleBulkDelete(restrictSafe: boolean) {
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await bulkDeleteMessages({
        ids,
        restrictToStatus: restrictSafe ? SAFE_BULK_STATUSES : undefined,
      });
      if (result.ok) {
        toast.success(`${result.data?.deleted ?? 0} mensajes eliminados`);
        clearSelection();
        setBulkOpen(false);
      } else {
        toast.error("No se han podido eliminar", { description: result.error });
      }
    });
  }

  function handlePurge(target: "queued" | "failed") {
    startTransition(async () => {
      const result = await purgeWhatsappMessages({ status: target });
      if (result.ok) {
        toast.success(
          `${result.data?.deleted ?? 0} mensajes ${target === "queued" ? "en cola" : "fallidos"} eliminados`,
        );
        clearSelection();
        setPurgeOpen(false);
      } else {
        toast.error("No se ha podido vaciar", { description: result.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Bandeja"
        description="Histórico agrupado por día. Selecciona varios para borrarlos a la vez o purga la cola con un clic."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {queuedCount > 0 && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<RefreshCw className="h-4 w-4" />}
                  onClick={handleProcessQueue}
                  loading={pending}
                >
                  Procesar cola ({queuedCount})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<Trash2 className="h-4 w-4" />}
                  onClick={() => setPurgeOpen(true)}
                >
                  Vaciar cola
                </Button>
              </>
            )}
            {failedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (
                    !confirm(`Borrar los ${failedCount} mensajes fallidos del histórico?`)
                  )
                    return;
                  handlePurge("failed");
                }}
              >
                Limpiar fallidos ({failedCount})
              </Button>
            )}
          </div>
        }
      />
      <CardBody>
        <div className="mb-5 grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <Input
            placeholder="Buscar por familia, teléfono o plantilla"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">Todos los estados</option>
            <option value="queued">En cola</option>
            <option value="sent">Enviado</option>
            <option value="delivered">Entregado</option>
            <option value="read">Leído</option>
            <option value="failed">Fallido</option>
          </Select>
          <Select value={related} onChange={(e) => setRelated(e.target.value as typeof related)}>
            <option value="all">Toda la actividad</option>
            <option value="recibo">Recibos</option>
            <option value="promocion">Promociones</option>
            <option value="evento">Eventos</option>
            <option value="inscripcion">Inscripciones</option>
            <option value="galeria">Galería</option>
          </Select>
        </div>

        {filtered.length > 0 && (
          <div className="mb-4 hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm sm:flex">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              <span className="font-medium">
                {selectedTotal === 0
                  ? "Seleccionar todos los visibles"
                  : `${selectedTotal} seleccionados`}
              </span>
            </label>
            {selectedTotal > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearSelection}
                  disabled={pending}
                >
                  Limpiar
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  iconLeft={<Trash2 className="h-4 w-4" />}
                  onClick={() => setBulkOpen(true)}
                  disabled={pending}
                >
                  Borrar seleccionados
                </Button>
              </div>
            )}
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="h-5 w-5" />}
            title={messages.length === 0 ? "Aún no se ha enviado ningún mensaje" : "Sin resultados con esos filtros"}
            description={
              messages.length === 0
                ? "Crea un envío masivo o programa una notificación para empezar a registrar comunicaciones."
                : "Cambia los filtros para ver otros envíos."
            }
          />
        ) : (
          <>
          <div className="flex flex-col gap-6">
            {grouped.map(([day, items]) => (
              <section key={day}>
                <header className="mb-3 flex items-baseline justify-between">
                  <p className="text-sm font-semibold capitalize">{dayFormatter.format(new Date(day))}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {items.length} {items.length === 1 ? "mensaje" : "mensajes"}
                  </p>
                </header>
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((message) => {
                    const meta = STATUS_META[message.status];
                    const Icon = meta.icon;
                    const isPending = pendingId === message.id;
                    const isSelected = selected.has(message.id);
                    const isManual = (message.payload as { manual?: boolean })?.manual === true;
                    const conversationPhone = normalizeWhatsappNumber(message.recipientPhone);
                    return (
                      <motion.li
                        key={message.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex flex-col rounded-xl border bg-[var(--surface)] p-4 transition-shadow",
                          isSelected
                            ? "border-[var(--primary)] ring-2 ring-[var(--ring)]"
                            : message.status === "failed"
                              ? "border-[#f1c5c5]"
                              : "border-[var(--border)] hover:shadow-[var(--shadow-sm)]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <label className="flex flex-1 min-w-0 items-start gap-2 sm:cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleOne(message.id)}
                              className="mt-0.5 hidden h-4 w-4 accent-[var(--primary)] sm:block"
                              aria-label={`Seleccionar mensaje de ${message.recipientName}`}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{message.recipientName}</p>
                              <p className="truncate text-xs text-[var(--muted)]">
                                {formatPhoneEs(message.recipientPhone)}
                              </p>
                            </div>
                          </label>
                          <Badge tone={meta.tone} iconLeft={<Icon className="h-3 w-3" />}>
                            {meta.label}
                          </Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <Badge tone="neutral">{TYPE_LABEL[message.relatedType]}</Badge>
                          {isManual ? (
                            <Badge tone="accent" iconLeft={<Pointer className="h-3 w-3" />}>
                              Manual
                            </Badge>
                          ) : (
                            <span className="font-mono text-[var(--muted)]">{message.templateName}</span>
                          )}
                        </div>

                        {message.errorMessage && (
                          <p
                            className={cn(
                              "mt-3 rounded-2xl p-2 text-xs",
                              message.status === "queued"
                                ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                                : "bg-[var(--danger-soft)] text-[var(--danger)]",
                            )}
                          >
                            ⚠ {message.errorMessage}
                          </p>
                        )}

                        {(message.attemptCount || message.errorCode || message.fbtraceId || message.deadLetterAt) && (
                          <div className="mt-3 grid gap-1 rounded-2xl bg-[var(--surface-muted)] p-2 text-[11px] text-[var(--muted)]">
                            {message.attemptCount ? (
                              <span>
                                Intentos {message.attemptCount}/{message.maxAttempts ?? 7}
                              </span>
                            ) : null}
                            {message.nextAttemptAt && message.status === "queued" ? (
                              <span>Próximo intento: {relativeTime(message.nextAttemptAt)}</span>
                            ) : null}
                            {message.deadLetterAt ? <span>Dead letter: {relativeTime(message.deadLetterAt)}</span> : null}
                            {message.errorCode ? <span>Código Meta: {message.errorCode}</span> : null}
                            {message.fbtraceId ? <span>fbtrace: {message.fbtraceId}</span> : null}
                          </div>
                        )}

                        <footer className="mt-4 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
                          <span>{relativeTime(message.sentAt ?? message.createdAt)}</span>
                          <div className="flex items-center gap-1">
                            {conversationPhone && (
                              <Link
                                href={`/admin/whatsapp/chats/${conversationPhone}`}
                                className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]"
                                title="Abrir chat"
                              >
                                <MessageSquareText className="h-3.5 w-3.5" /> Chat
                              </Link>
                            )}
                            {(message.status === "failed" || message.status === "queued") && (
                              <Button
                                size="sm"
                                variant="outline"
                                loading={isPending}
                                onClick={() => handleRetry(message)}
                                iconLeft={<RefreshCw className="h-3.5 w-3.5" />}
                              >
                                {message.status === "queued" ? "Intentar ahora" : "Reintentar"}
                              </Button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(message)}
                              disabled={isPending}
                              className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                              aria-label="Borrar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </footer>
                      </motion.li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3 text-[12.5px]">
              <span className="text-[var(--muted)]">
                {filtered.length} {filtered.length === 1 ? "mensaje" : "mensajes"}
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
          </>
        )}
      </CardBody>

      {/* Modal de confirmación para bulk delete */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Borrar mensajes seleccionados"
        description={`Has seleccionado ${selectedTotal} ${selectedTotal === 1 ? "mensaje" : "mensajes"}.`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulkOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            {selectedSafeCount > 0 && (
              <Button
                variant="secondary"
                loading={pending}
                onClick={() => handleBulkDelete(true)}
              >
                Borrar sólo cola y fallidos ({selectedSafeCount})
              </Button>
            )}
            <Button
              variant="danger"
              loading={pending}
              iconLeft={<Trash2 className="h-4 w-4" />}
              onClick={() => {
                if (
                  selectedSafeCount < selectedTotal &&
                  !confirm(
                    `Vas a borrar también ${selectedTotal - selectedSafeCount} mensajes ya enviados o entregados — perderás ese histórico. ¿Confirmas?`,
                  )
                )
                  return;
                handleBulkDelete(false);
              }}
            >
              Borrar todos ({selectedTotal})
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          {selectedSafeCount < selectedTotal && (
            <div className="rounded-2xl border border-[#f1d9a8] bg-[var(--warning-soft)] p-3 text-xs text-[var(--warning)]">
              ⚠ {selectedTotal - selectedSafeCount} de tus selecciones son mensajes ya enviados o entregados.
              Si los borras, perderás trazabilidad. La opción <strong>“Borrar sólo cola y fallidos”</strong>{" "}
              respeta el histórico.
            </div>
          )}
          <p className="text-[var(--muted)]">
            Esta acción no se puede deshacer. Si quieres conservar el histórico, usa la opción de borrar sólo cola y fallidos.
          </p>
        </div>
      </Modal>

      {/* Modal de confirmación para vaciar la cola */}
      <Modal
        open={purgeOpen}
        onClose={() => setPurgeOpen(false)}
        title="Vaciar la cola"
        description={`Vas a borrar los ${queuedCount} ${queuedCount === 1 ? "mensaje" : "mensajes"} pendientes de envío.`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPurgeOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={pending}
              iconLeft={<Trash2 className="h-4 w-4" />}
              onClick={() => handlePurge("queued")}
            >
              Vaciar cola
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--muted)]">
          Sólo se borrarán mensajes que aún no se han enviado. El histórico de envíos completados queda intacto.
        </p>
      </Modal>
    </Card>
  );
}
