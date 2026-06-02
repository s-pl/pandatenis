"use client";

import {
  Bell,
  Calendar,
  Check,
  Copy,
  Image as ImageIcon,
  LibraryBig,
  Megaphone,
  Plus,
  Receipt,
  Search,
  Sun,
  Trophy,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ChatPreviewFrame, MessageBubble } from "@/components/admin/whatsapp/message-bubble";
import { cloneCatalogTemplateAction } from "@/lib/admin/actions/whatsapp";
import {
  TEMPLATE_CATALOG,
  type CatalogGroup,
  type CatalogTemplate,
} from "@/lib/admin/template-catalog";
import { cn } from "@/lib/utils";

const ICONS: Record<CatalogGroup["icon"], LucideIcon> = {
  receipt: Receipt,
  megaphone: Megaphone,
  calendar: Calendar,
  userplus: UserPlus,
  image: ImageIcon,
  trophy: Trophy,
  sun: Sun,
  bell: Bell,
};

const CATEGORY_LABEL: Record<CatalogTemplate["category"], string> = {
  recibo: "Recibo",
  promocion: "Promoción",
  evento: "Evento",
  inscripcion: "Inscripción",
  galeria: "Galería",
};

const CATEGORY_TONE: Record<
  CatalogTemplate["category"],
  "primary" | "info" | "warning" | "success" | "neutral"
> = {
  recibo: "success",
  promocion: "warning",
  evento: "info",
  inscripcion: "primary",
  galeria: "neutral",
};

export function TemplateLibraryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        iconLeft={<LibraryBig className="h-4 w-4" />}
        onClick={() => setOpen(true)}
      >
        Biblioteca
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Biblioteca de plantillas"
        description="Catálogo curado de mensajes habituales en una escuela de tenis. Añade las que quieras a tu lista; se guardarán como borradores, no se mandan a Meta automáticamente."
        size="xl"
      >
        <TemplateLibraryBrowser />
      </Modal>
    </>
  );
}

function TemplateLibraryBrowser() {
  const [groupId, setGroupId] = useState<string>(TEMPLATE_CATALOG[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<CatalogTemplate | null>(null);
  const [cloning, setCloning] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const groups = TEMPLATE_CATALOG;
  const activeGroup = groups.find((g) => g.id === groupId) ?? groups[0];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = q ? groups.flatMap((g) => g.templates) : activeGroup?.templates ?? [];
    if (!q) return source;
    return source.filter((t) =>
      [t.name, t.description, t.body, ...t.tags].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [groups, activeGroup, query]);

  function clone(template: CatalogTemplate) {
    if (cloning.has(template.slug) || done.has(template.slug)) return;
    setCloning((prev) => new Set(prev).add(template.slug));
    startTransition(async () => {
      const result = await cloneCatalogTemplateAction({ slug: template.slug });
      setCloning((prev) => {
        const next = new Set(prev);
        next.delete(template.slug);
        return next;
      });
      if (result.ok) {
        setDone((prev) => new Set(prev).add(template.slug));
        toast.success("Plantilla añadida", {
          description: `"${result.data?.name ?? template.name}" está como borrador. Edítala y, cuando quieras, pulsa “Enviar a Meta”.`,
        });
      } else {
        toast.error("No se pudo añadir", { description: result.error });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar plantilla, etiqueta o palabra clave…"
          iconLeft={<Search className="h-4 w-4" />}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="self-start text-xs font-medium text-[var(--muted)] hover:text-foreground sm:self-auto"
          >
            Limpiar búsqueda
          </button>
        )}
      </div>

      {!query && (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {groups.map((g) => {
            const Icon = ICONS[g.icon];
            const active = activeGroup?.id === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupId(g.id)}
                className={cn(
                  "flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)]",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {g.title}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    active ? "bg-white/70 text-[var(--primary)]" : "bg-[var(--surface-muted)] text-[var(--muted)]",
                  )}
                >
                  {g.templates.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!query && activeGroup && (
        <p className="text-xs text-[var(--muted)]">{activeGroup.description}</p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5" />}
          title="Sin resultados"
          description={`No hay plantillas que coincidan con "${query}".`}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {visible.map((template) => {
            const isCloning = cloning.has(template.slug);
            const isDone = done.has(template.slug);
            return (
              <li key={template.slug}>
                <article className="flex h-full flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-shadow hover:shadow-[var(--shadow-sm)]">
                  <header className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{template.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{template.description}</p>
                    </div>
                    <Badge tone={CATEGORY_TONE[template.category]}>
                      {CATEGORY_LABEL[template.category]}
                    </Badge>
                  </header>

                  <p className="line-clamp-4 rounded-xl bg-[var(--surface-muted)] p-3 text-[12.5px] leading-relaxed text-foreground/85">
                    {template.body}
                  </p>

                  {template.tags.length > 0 && (
                    <ul className="flex flex-wrap gap-1">
                      {template.tags.slice(0, 4).map((tag) => (
                        <li
                          key={tag}
                          className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]"
                        >
                          #{tag}
                        </li>
                      ))}
                    </ul>
                  )}

                  <footer className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPreview(template)}
                      className="text-xs font-semibold text-[var(--primary)] hover:underline"
                    >
                      Vista previa
                    </button>
                    <Button
                      size="sm"
                      variant={isDone ? "secondary" : "primary"}
                      onClick={() => clone(template)}
                      loading={isCloning}
                      disabled={isDone}
                      iconLeft={isDone ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    >
                      {isDone ? "Añadida" : "Añadir a mis plantillas"}
                    </Button>
                  </footer>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.name ?? ""}
        description={preview?.description}
        size="md"
      >
        {preview && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={CATEGORY_TONE[preview.category]}>
                {CATEGORY_LABEL[preview.category]}
              </Badge>
              {preview.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <ChatPreviewFrame contactName="Vista previa">
              <MessageBubble
                text={preview.body}
                highlightVariables
                status="delivered"
                timestamp="ahora"
              />
            </ChatPreviewFrame>
            <p className="rounded-2xl bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted)]">
              Las variables <code className="font-mono">{"{{1}}"}, {"{{2}}"}…</code> se reemplazan en el momento
              del envío (manual o masivo) con los datos de cada destinatario.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" iconLeft={<X className="h-4 w-4" />} onClick={() => setPreview(null)}>
                Cerrar
              </Button>
              <Button
                iconLeft={<Copy className="h-4 w-4" />}
                onClick={() => {
                  clone(preview);
                  setPreview(null);
                }}
                disabled={done.has(preview.slug)}
              >
                {done.has(preview.slug) ? "Ya añadida" : "Añadir a mis plantillas"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
