"use client";

import {
  Download,
  FileSpreadsheet,
  KanbanSquare,
  List,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  TemplateComposer,
  type ApprovedTemplate,
} from "@/components/admin/whatsapp/template-composer";
import {
  createLeadAction,
  deleteLeadAction,
  importConsentedLeadsAction,
  updateLeadPipelineAction,
  updateLeadStatusAction,
  type LeadInput,
} from "@/lib/admin/actions/leads";
import { formatPhoneEs, normalizeWhatsappNumber, relativeTime } from "@/lib/format";
import type { LeadPipelineStage } from "@/lib/types";

type Lead = {
  id: string;
  fullName: string;
  phone: string;
  childAge: number;
  interest: "escuela" | "campus" | "ambos";
  sourceId: string | null;
  sourceName: string;
  observations: string;
  status: LeadPipelineStage;
  nextActionAt: string | null;
  assignedTo: string | null;
  lostReason: string | null;
  whatsappConsent: boolean;
  marketingConsent: boolean;
  consentSource: string | null;
  consentText: string | null;
  consentAt: string | null;
  createdAt: string;
};

const statusMeta: Record<
  Lead["status"],
  { tone: "warning" | "info" | "success" | "danger" | "primary"; label: string }
> = {
  nuevo: { tone: "warning", label: "Sin contactar" },
  contactado: { tone: "info", label: "Contactado" },
  interesado: { tone: "primary", label: "Interesado" },
  prueba_agendada: { tone: "info", label: "Prueba agendada" },
  convertido: { tone: "success", label: "Convertido" },
  perdido: { tone: "danger", label: "Perdido" },
};

const pipelineOrder: LeadPipelineStage[] = [
  "nuevo",
  "contactado",
  "interesado",
  "prueba_agendada",
  "convertido",
  "perdido",
];

const interestLabel: Record<Lead["interest"], string> = {
  escuela: "Escuela",
  campus: "Campus",
  ambos: "Escuela + Campus",
};

export function LeadsManager({
  leads,
  sources,
  profiles,
  approvedTemplates,
  referenceNow,
}: {
  leads: Lead[];
  sources: Array<{ id: string; name: string }>;
  profiles: Array<{ id: string; fullName: string }>;
  approvedTemplates: ApprovedTemplate[];
  referenceNow: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | LeadPipelineStage>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | string>("all");
  const [focusFilter, setFocusFilter] = useState<"all" | "due" | "consent" | "noConsent">("all");
  const [view, setView] = useState<"list" | "kanban">("list");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const [pending, startTransition] = useTransition();
  const whatsappDefaultVariables = useMemo(
    () => (whatsappLead ? leadTemplateDefaults(whatsappLead) : undefined),
    [whatsappLead],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.parse(referenceNow);
    return leads.filter((lead) => {
      if (status !== "all" && lead.status !== status) return false;
      if (sourceFilter !== "all" && lead.sourceId !== sourceFilter) return false;
      if (focusFilter === "due" && (!lead.nextActionAt || new Date(lead.nextActionAt).getTime() > now)) return false;
      if (focusFilter === "consent" && !lead.whatsappConsent) return false;
      if (focusFilter === "noConsent" && lead.whatsappConsent) return false;
      if (!q) return true;
      return (
        lead.fullName.toLowerCase().includes(q) ||
        lead.phone.includes(q) ||
        lead.sourceName.toLowerCase().includes(q) ||
        lead.observations.toLowerCase().includes(q)
      );
    });
  }, [leads, status, query, sourceFilter, focusFilter, referenceNow]);

  function setStatusFor(lead: Lead, next: Lead["status"]) {
    startTransition(async () => {
      const result = await updateLeadStatusAction(lead.id, next);
      if (result.ok) toast.success("Estado actualizado");
      else toast.error("No se ha podido actualizar", { description: result.error });
    });
  }

  function setNextAction(lead: Lead, value: string) {
    const nextActionAt = value ? new Date(`${value}T10:00:00`).toISOString() : null;
    startTransition(async () => {
      const result = await updateLeadPipelineAction({
        leadId: lead.id,
        status: lead.status,
        nextActionAt,
        assignedTo: lead.assignedTo,
        lostReason: lead.lostReason,
      });
      if (result.ok) toast.success("Próxima acción actualizada");
      else toast.error("No se ha podido actualizar", { description: result.error });
    });
  }

  function handleDelete(lead: Lead) {
    setDeleting(lead);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    startTransition(async () => {
      const result = await deleteLeadAction(target.id);
      if (result.ok) toast.success("Contacto eliminado");
      else toast.error("No se ha podido eliminar", { description: result.error });
    });
  }

  function openWhatsappApi(lead: Lead) {
    if (!normalizeWhatsappNumber(lead.phone)) {
      toast.error("Teléfono no válido para WhatsApp", {
        description: "Revisa el número antes de enviar por Cloud API.",
      });
      return;
    }
    setWhatsappLead(lead);
  }

  async function handleWhatsappSent(lead: Lead) {
    if (lead.status === "nuevo") {
      const result = await updateLeadStatusAction(lead.id, "contactado");
      if (!result.ok) {
        toast.warning("Mensaje enviado, pero no se pudo marcar como contactado", {
          description: result.error,
        });
      }
    }
    setWhatsappLead(null);
  }

  function exportCsv() {
    const rows = [
      [
        "Nombre",
        "Teléfono",
        "Edad",
        "Interés",
        "Origen",
        "Estado",
        "Próxima acción",
        "Consentimiento WhatsApp",
        "Consentimiento marketing",
        "Observaciones",
        "Fecha",
      ],
      ...filtered.map((l) => [
        l.fullName,
        l.phone,
        String(l.childAge),
        interestLabel[l.interest],
        l.sourceName,
        statusMeta[l.status].label,
        l.nextActionAt ?? "",
        l.whatsappConsent ? "Sí" : "No",
        l.marketingConsent ? "Sí" : "No",
        l.observations,
        l.createdAt,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contactos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: Column<Lead>[] = [
    {
      key: "name",
      label: "Contacto",
      width: "minmax(200px, 2fr)",
      sortAccessor: (l) => l.fullName,
      render: (l) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{l.fullName}</p>
          <p className="truncate text-[11.5px] text-[var(--muted)]">
            {formatPhoneEs(l.phone)} · {l.childAge}a · {relativeTime(l.createdAt)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {l.whatsappConsent && <Badge tone="success" className="px-2 py-0.5 text-[10px]">Opt-in WA</Badge>}
            {l.marketingConsent && <Badge tone="info" className="px-2 py-0.5 text-[10px]">Marketing</Badge>}
          </div>
        </div>
      ),
    },
    {
      key: "interest",
      label: "Interés",
      width: "140px",
      hideOnMobile: true,
      sortAccessor: (l) => l.interest,
      render: (l) => <Badge tone="neutral">{interestLabel[l.interest]}</Badge>,
    },
    {
      key: "source",
      label: "Origen",
      width: "130px",
      hideOnMobile: true,
      sortAccessor: (l) => l.sourceName,
      render: (l) => <Badge tone="info">{l.sourceName}</Badge>,
    },
    {
      key: "status",
      label: "Estado",
      width: "170px",
      sortAccessor: (l) => l.status,
      render: (l) => {
        const meta = statusMeta[l.status];
        return (
          <Select
            value={l.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setStatusFor(l, e.target.value as Lead["status"])}
            disabled={pending}
            className={`h-7 max-w-[140px] text-[11.5px] font-semibold ${
              meta.tone === "success"
                ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
                : meta.tone === "info"
                  ? "border-[var(--info)] bg-[var(--info-soft)] text-[var(--info)]"
                  : "border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]"
            }`}
          >
            {pipelineOrder.map((stage) => (
              <option key={stage} value={stage}>
                {statusMeta[stage].label}
              </option>
            ))}
          </Select>
        );
      },
    },
    {
      key: "next",
      label: "Próxima acción",
      width: "150px",
      hideOnMobile: true,
      sortAccessor: (l) => l.nextActionAt ?? "",
      render: (l) => (
        <Input
          type="date"
          value={l.nextActionAt?.slice(0, 10) ?? ""}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setNextAction(l, e.target.value)}
          className="h-8 px-2 text-[11.5px]"
        />
      ),
    },
    {
      key: "actions",
      label: "",
      width: "auto",
      align: "right",
      render: (l) => (
        <div className="flex items-center justify-end gap-1.5">
          <a
            href={`tel:${l.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="grid h-7 w-7 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
            title="Llamar"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openWhatsappApi(l);
            }}
            className="grid h-7 w-7 place-items-center rounded-full text-[var(--whatsapp)] transition-colors hover:bg-[var(--primary-soft)]"
            title="WhatsApp API"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(l);
            }}
            disabled={pending}
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
            aria-label="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Filter row — mobile-first */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              className="h-10"
              placeholder="Buscar nombre, teléfono u origen…"
              iconLeft={<Search className="h-3.5 w-3.5" />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button
            variant="accent"
            size="sm"
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={() => setCreating(true)}
            className="h-10"
          >
            <span className="hidden sm:inline">Nuevo contacto</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<UploadCloud className="h-4 w-4" />}
            onClick={() => setImporting(true)}
            className="h-10"
          >
            <span className="hidden sm:inline">Importar</span>
          </Button>
        </div>
        <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1">
          <FilterChip
            label="Estado"
            value={status === "all" ? undefined : statusMeta[status].label}
            onClick={() => {
              const order = ["all", ...pipelineOrder] as const;
              const idx = order.indexOf(status);
              setStatus(order[(idx + 1) % order.length] as typeof status);
            }}
            onClear={() => setStatus("all")}
          />
          <FilterChip
            label="Origen"
            value={sourceFilter === "all" ? undefined : sources.find((source) => source.id === sourceFilter)?.name}
            onClick={() => {
              const order = ["all", ...sources.map((source) => source.id)];
              const idx = order.indexOf(sourceFilter);
              setSourceFilter(order[(idx + 1) % order.length] ?? "all");
            }}
            onClear={() => setSourceFilter("all")}
          />
          <FilterChip
            label="Foco"
            value={
              focusFilter === "all"
                ? undefined
                : focusFilter === "due"
                  ? "Próxima acción"
                  : focusFilter === "consent"
                    ? "Con opt-in"
                    : "Sin opt-in"
            }
            onClick={() => {
              const order = ["all", "due", "consent", "noConsent"] as const;
              const idx = order.indexOf(focusFilter);
              setFocusFilter(order[(idx + 1) % order.length]);
            }}
            onClear={() => setFocusFilter("all")}
          />
          <div className="flex-1" />
          <div className="hidden items-center gap-1 rounded-lg bg-[var(--surface-muted)] p-1 sm:flex">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`grid h-8 w-8 place-items-center rounded-md ${view === "list" ? "bg-white shadow-[var(--shadow-sm)]" : "text-[var(--muted)]"}`}
              aria-label="Vista lista"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`grid h-8 w-8 place-items-center rounded-md ${view === "kanban" ? "bg-white shadow-[var(--shadow-sm)]" : "text-[var(--muted)]"}`}
              aria-label="Vista kanban"
            >
              <KanbanSquare className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Download className="h-3.5 w-3.5" />}
            onClick={exportCsv}
            className="hidden sm:inline-flex"
          >
            Exportar
          </Button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="grid gap-3 xl:grid-cols-6">
          {pipelineOrder.map((stage) => {
            const stageLeads = filtered.filter((lead) => lead.status === stage);
            return (
              <section key={stage} className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge tone={statusMeta[stage].tone}>{statusMeta[stage].label}</Badge>
                  <span className="text-xs font-semibold text-[var(--muted)]">{stageLeads.length}</span>
                </div>
                <ul className="grid gap-2">
                  {stageLeads.slice(0, 12).map((lead) => (
                    <li key={lead.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/45 p-3">
                      <p className="truncate text-sm font-semibold">{lead.fullName}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{formatPhoneEs(lead.phone)}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge tone="neutral" className="px-2 py-0.5 text-[10px]">{interestLabel[lead.interest]}</Badge>
                        {lead.nextActionAt && (
                          <Badge tone={new Date(lead.nextActionAt).getTime() <= Date.now() ? "warning" : "info"} className="px-2 py-0.5 text-[10px]">
                            {relativeTime(lead.nextActionAt)}
                          </Badge>
                        )}
                        {lead.whatsappConsent && <Badge tone="success" className="px-2 py-0.5 text-[10px]">Opt-in</Badge>}
                      </div>
                      <div className="mt-3 flex items-center gap-1">
                        <Button size="sm" variant="secondary" onClick={() => openWhatsappApi(lead)} iconLeft={<MessageCircle className="h-3.5 w-3.5" />}>
                          WhatsApp
                        </Button>
                        <Select
                          value={lead.status}
                          onChange={(e) => setStatusFor(lead, e.target.value as Lead["status"])}
                          className="h-9 text-xs"
                        >
                          {pipelineOrder.map((nextStage) => (
                            <option key={nextStage} value={nextStage}>
                              {statusMeta[nextStage].label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(l) => l.id}
          defaultSort={{ key: "name", direction: "asc" }}
          defaultPageSize={25}
          isActiveRow={(l) => l.status === "nuevo"}
          mobileCard={(l) => {
          const meta = statusMeta[l.status];
          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{l.fullName}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-[var(--muted)]">
                    {formatPhoneEs(l.phone)} · {l.childAge} años · {relativeTime(l.createdAt)}
                  </p>
                </div>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                <Badge tone="neutral">{interestLabel[l.interest]}</Badge>
                <Badge tone="info">{l.sourceName}</Badge>
                {l.nextActionAt && <Badge tone="warning">Acción {relativeTime(l.nextActionAt)}</Badge>}
                {l.whatsappConsent && <Badge tone="success">Opt-in WhatsApp</Badge>}
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <a
                  href={`tel:${l.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="grid h-9 w-9 place-items-center rounded-md bg-[var(--surface-muted)] text-[var(--primary)] active:bg-[var(--primary-soft)]"
                  aria-label="Llamar"
                >
                  <Phone className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWhatsappApi(l);
                  }}
                  className="grid h-9 w-9 place-items-center rounded-md bg-[var(--whatsapp)] text-white active:opacity-80"
                  aria-label="WhatsApp API"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </button>
                <div className="flex-1" />
                <Select
                  value={l.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setStatusFor(l, e.target.value as Lead["status"])}
                  disabled={pending}
                  className="h-9 max-w-[150px] text-[12px] font-semibold"
                >
                  {pipelineOrder.map((stage) => (
                    <option key={stage} value={stage}>
                      {statusMeta[stage].label}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(l);
                  }}
                  className="grid h-9 w-9 place-items-center rounded-md text-[var(--muted)] active:bg-[var(--danger-soft)]"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
          }}
          emptyState={
          <EmptyState
            icon={<Phone className="h-5 w-5" />}
            title={leads.length === 0 ? "Sin contactos por ahora" : "Sin resultados"}
            description={
              leads.length === 0
                ? "Cuando te lleguen consultas, regístralas aquí para no perderlas."
                : "Ajusta la búsqueda o el estado para ver otros contactos."
            }
            action={
              leads.length === 0 && (
                <Button
                  variant="accent"
                  iconLeft={<Plus className="h-4 w-4" />}
                  onClick={() => setCreating(true)}
                >
                  Crear contacto
                </Button>
              )
            }
          />
          }
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="¿Borrar contacto?"
        description={
          deleting
            ? `Vas a borrar el contacto de ${deleting.fullName}. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Sí, borrar"
      />

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Registrar nuevo contacto"
        size="md"
      >
        <LeadForm
          sources={sources}
          profiles={profiles}
          onCancel={() => setCreating(false)}
          onSaved={() => setCreating(false)}
        />
      </Modal>

      <Modal
        open={importing}
        onClose={() => setImporting(false)}
        title="Importar contactos con consentimiento"
        description="Sube un CSV/TSV con nombre, teléfono y consentimiento. Se deduplica por WhatsApp normalizado."
        size="xl"
      >
        <ConsentImporter onDone={() => setImporting(false)} />
      </Modal>

      <Modal
        open={Boolean(whatsappLead)}
        onClose={() => setWhatsappLead(null)}
        title="Hablar por WhatsApp API"
        description="Inicia la conversación desde el número conectado a Meta Cloud API usando una plantilla aprobada."
        size="xl"
      >
        {whatsappLead && (
          <div className="grid gap-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="text-sm font-semibold">{whatsappLead.fullName}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {formatPhoneEs(whatsappLead.phone)} · {interestLabel[whatsappLead.interest]} ·{" "}
                {whatsappLead.childAge} años
              </p>
            </div>
            <TemplateComposer
              phone={normalizeWhatsappNumber(whatsappLead.phone)}
              recipientName={whatsappLead.fullName}
              templates={suggestTemplates(approvedTemplates, whatsappLead)}
              defaultVariables={whatsappDefaultVariables}
              onSent={() => handleWhatsappSent(whatsappLead)}
            />
          </div>
        )}
      </Modal>
    </>
  );
}

function leadTemplateDefaults(lead: Lead): Record<string, string> {
  const firstName = lead.fullName.split(" ").filter(Boolean)[0] ?? lead.fullName;
  const interest = interestLabel[lead.interest];
  return {
    "1": firstName,
    "2": interest,
    "3": String(lead.childAge),
    nombre: lead.fullName,
    first_name: firstName,
    interes: interest,
    edad: String(lead.childAge),
    origen: lead.sourceName,
  };
}

function suggestTemplates(templates: ApprovedTemplate[], lead: Lead): ApprovedTemplate[] {
  const needle = lead.sourceName.toLowerCase().includes("web") || lead.status === "nuevo"
    ? "bienvenida"
    : "seguimiento";
  return [...templates].sort((a, b) => {
    const aScore = a.name.toLowerCase().includes(needle) ? -1 : 0;
    const bScore = b.name.toLowerCase().includes(needle) ? -1 : 0;
    return aScore - bScore || a.name.localeCompare(b.name);
  });
}

function ConsentImporter({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [sourceName, setSourceName] = useState("CSV consentimiento");
  const [consentText, setConsentText] = useState("Acepta recibir comunicaciones de Panda Tenis por WhatsApp.");
  const [pending, startTransition] = useTransition();

  async function loadFile(file: File) {
    setText(await file.text());
  }

  function importRows() {
    const rows = parseDelimited(text);
    if (rows.length === 0) {
      toast.error("No hay filas válidas para importar");
      return;
    }
    startTransition(async () => {
      const result = await importConsentedLeadsAction({
        rows,
        defaultSourceName: sourceName,
        defaultConsentText: consentText,
        defaultInterest: "escuela",
      });
      if (result.ok) {
        const data = result.data;
        toast.success("Importación completada", {
          description: `${data?.created ?? 0} creados, ${data?.updated ?? 0} actualizados, ${data?.skipped ?? 0} omitidos.`,
        });
        onDone();
      } else {
        toast.error("No se ha podido importar", { description: result.error });
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-[var(--success)]" />
          Columnas recomendadas
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          nombre, telefono, consentimiento_whatsapp, consentimiento_marketing, fecha_consentimiento, origen, texto_consentimiento
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Origen por defecto">
          <Input value={sourceName} onChange={(e) => setSourceName(e.target.value)} />
        </Field>
        <Field label="Archivo CSV/TSV">
          <Input
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void loadFile(file);
            }}
          />
        </Field>
      </div>
      <Field label="Texto de consentimiento por defecto">
        <Textarea rows={2} value={consentText} onChange={(e) => setConsentText(e.target.value)} />
      </Field>
      <Field label="Contenido CSV/TSV">
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"nombre,telefono,consentimiento_whatsapp\nLaura Pérez,600123456,si"}
        />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <FileSpreadsheet className="h-4 w-4" />
          {parseDelimited(text).length} filas detectadas
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" loading={pending} iconLeft={<UploadCloud className="h-4 w-4" />} onClick={importRows}>
            Importar contactos
          </Button>
        </div>
      </div>
    </div>
  );
}

function parseDelimited(text: string): Array<Record<string, string>> {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitDelimitedLine(lines[0], delimiter).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? "";
    });
    return row;
  });
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function LeadForm({
  sources,
  profiles,
  onCancel,
  onSaved,
}: {
  sources: Array<{ id: string; name: string }>;
  profiles: Array<{ id: string; fullName: string }>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<LeadInput>({
    fullName: "",
    phone: "",
    childAge: 8,
    interest: "escuela",
    sourceId: sources[0]?.id ?? null,
    observations: "",
    status: "nuevo",
    nextActionAt: null,
    assignedTo: null,
    lostReason: null,
    whatsappConsent: false,
    marketingConsent: false,
    consentSource: null,
    consentText: null,
    consentAt: null,
  });
  const [pending, startTransition] = useTransition();

  function set<K extends keyof LeadInput>(key: K, value: LeadInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createLeadAction(values);
      if (result.ok) {
        toast.success("Contacto registrado");
        onSaved();
      } else {
        toast.error("No se ha podido guardar", { description: result.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Nombre del responsable" required>
        <Input value={values.fullName} onChange={(e) => set("fullName", e.target.value)} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Teléfono" required>
          <Input
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="600 123 456"
          />
        </Field>
        <Field label="Edad del niño" required>
          <Input
            type="number"
            min="1"
            max="18"
            value={values.childAge}
            onChange={(e) => set("childAge", Number(e.target.value))}
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Interés" required>
          <Select
            value={values.interest}
            onChange={(e) => set("interest", e.target.value as LeadInput["interest"])}
          >
            <option value="escuela">Escuela</option>
            <option value="campus">Campus</option>
            <option value="ambos">Escuela + campus</option>
          </Select>
        </Field>
        <Field label="¿Cómo nos ha conocido?">
          <Select
            value={values.sourceId ?? ""}
            onChange={(e) => set("sourceId", e.target.value || null)}
          >
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field
        label="Observaciones"
        hint="Anota detalles de la conversación o necesidades específicas"
      >
        <Textarea
          value={values.observations}
          onChange={(e) => set("observations", e.target.value)}
          rows={3}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Estado">
          <Select value={values.status} onChange={(e) => set("status", e.target.value as LeadInput["status"])}>
            {pipelineOrder.map((stage) => (
              <option key={stage} value={stage}>
                {statusMeta[stage].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Responsable">
          <Select
            value={values.assignedTo ?? ""}
            onChange={(e) => set("assignedTo", e.target.value || null)}
          >
            <option value="">Sin asignar</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.fullName}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Próxima acción">
          <Input
            type="datetime-local"
            value={values.nextActionAt ? values.nextActionAt.slice(0, 16) : ""}
            onChange={(e) =>
              set("nextActionAt", e.target.value ? new Date(e.target.value).toISOString() : null)
            }
          />
        </Field>
        {values.status === "perdido" && (
          <Field label="Motivo de pérdida">
            <Input value={values.lostReason ?? ""} onChange={(e) => set("lostReason", e.target.value || null)} />
          </Field>
        )}
      </div>
      <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.whatsappConsent}
            onChange={(e) => set("whatsappConsent", e.target.checked)}
          />
          Puede recibir WhatsApp sobre su solicitud
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={values.marketingConsent}
            onChange={(e) => set("marketingConsent", e.target.checked)}
          />
          Acepta comunicaciones promocionales
        </label>
        {(values.whatsappConsent || values.marketingConsent) && (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Origen del consentimiento">
              <Input
                value={values.consentSource ?? ""}
                onChange={(e) => set("consentSource", e.target.value || null)}
                placeholder="web, CSV, formulario..."
              />
            </Field>
            <Field label="Fecha">
              <Input
                type="datetime-local"
                value={values.consentAt ? values.consentAt.slice(0, 16) : ""}
                onChange={(e) => set("consentAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
              />
            </Field>
            <Field label="Texto aceptado" className="md:col-span-2">
              <Textarea
                rows={2}
                value={values.consentText ?? ""}
                onChange={(e) => set("consentText", e.target.value || null)}
              />
            </Field>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending} iconLeft={<Pencil className="h-4 w-4" />}>
          Registrar contacto
        </Button>
      </div>
    </form>
  );
}
