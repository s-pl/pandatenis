"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Megaphone,
  Pencil,
  Send,
  Trash2,
  ExternalLink,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { promoSms } from "@/lib/sms/templates";
import {
  createPromotionAction,
  updatePromotionAction,
  deletePromotionAction,
  togglePromotionActive,
  sendPromotionSmsAction,
  type PromotionInput,
} from "@/lib/admin/actions/promotions";

type Promotion = {
  id: string;
  slug: string;
  titleEs: string;
  titleEn: string;
  posterUrl: string | null;
  whatsappMsgEs: string;
  whatsappMsgEn: string;
  active: boolean;
  createdAt: string;
};

type StudentLite = {
  id: string;
  fullName: string;
  commLocale: "es" | "en";
  phone: string | null;
};

type Props = {
  promotions: Promotion[];
  students: StudentLite[];
};

const EMPTY_FORM = {
  titleEs: "",
  titleEn: "",
  whatsappMsgEs: "",
  whatsappMsgEn: "",
  active: true,
};

async function uploadPoster(file: File): Promise<{ path: string; url: string }> {
  const supabase = createClient();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}-${safe}`;
  const { error } = await supabase.storage
    .from("promotions")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("promotions").getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export function PromotionsManager({ promotions, students }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [sendFor, setSendFor] = useState<Promotion | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(promo: Promotion) {
    setEditing(promo);
    setFormOpen(true);
  }

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <Button onClick={openCreate} variant="primary">
          <Megaphone className="h-4 w-4" /> Nueva promoción
        </Button>
      </div>

      {promotions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-10 text-center text-sm text-[var(--muted)]">
          Aún no hay promociones. Crea la primera para empezar a difundir por SMS.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {promotions.map((promo) => (
            <PromotionCard
              key={promo.id}
              promo={promo}
              onEdit={() => openEdit(promo)}
              onSend={() => setSendFor(promo)}
              onChanged={() => router.refresh()}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <PromotionFormModal
          key={editing?.id ?? "new"}
          promo={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            router.refresh();
          }}
        />
      )}

      <SendModal
        promo={sendFor}
        students={students}
        onClose={() => setSendFor(null)}
      />
    </div>
  );
}

function PromotionCard({
  promo,
  onEdit,
  onSend,
  onChanged,
}: {
  promo: Promotion;
  onEdit: () => void;
  onSend: () => void;
  onChanged: () => void;
}) {
  const [pending, start] = useTransition();

  const publicPath = `/es/p/${promo.slug}`;

  function copyLink() {
    const url = `${window.location.origin}${publicPath}`;
    navigator.clipboard.writeText(url);
    toast.success("Enlace copiado");
  }

  function toggle() {
    start(async () => {
      const res = await togglePromotionActive(promo.id, !promo.active);
      if (res.ok) onChanged();
      else toast.error("No se ha podido actualizar", { description: res.error });
    });
  }

  function remove() {
    if (!confirm("¿Eliminar esta promoción?")) return;
    start(async () => {
      const res = await deletePromotionAction(promo.id);
      if (res.ok) {
        toast.success("Promoción eliminada");
        onChanged();
      } else toast.error("No se ha podido eliminar", { description: res.error });
    });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="aspect-[4/3] w-full bg-[var(--surface-muted)]">
        {promo.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promo.posterUrl} alt={promo.titleEs} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-xs text-[var(--muted)]">Sin cartel</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold leading-tight">{promo.titleEs}</p>
            <p className="text-xs text-[var(--muted)]">{promo.titleEn}</p>
          </div>
          <Badge tone={promo.active ? "success" : "neutral"}>
            {promo.active ? "Activa" : "Oculta"}
          </Badge>
        </div>

        <div className="mt-auto flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={onSend}>
            <Send className="h-3.5 w-3.5" /> Enviar SMS
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={copyLink}>
            <Copy className="h-3.5 w-3.5" /> Enlace
          </Button>
          <a
            href={publicPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--fg)]"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Ver
          </a>
        </div>

        <div className="flex gap-3 border-t border-[var(--border)] pt-2 text-xs">
          <button onClick={toggle} disabled={pending} className="text-[var(--muted)] hover:text-[var(--fg)]">
            {promo.active ? "Ocultar" : "Activar"}
          </button>
          <button onClick={remove} disabled={pending} className="flex items-center gap-1 text-[var(--danger)] hover:underline">
            <Trash2 className="h-3 w-3" /> Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

function PromotionFormModal({
  promo,
  onClose,
  onSaved,
}: {
  promo: Promotion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Se monta con `key` por promo, así el estado inicial se deriva de props sin
  // necesidad de un efecto de sincronización.
  const [values, setValues] = useState(
    promo
      ? {
          titleEs: promo.titleEs,
          titleEn: promo.titleEn,
          whatsappMsgEs: promo.whatsappMsgEs,
          whatsappMsgEn: promo.whatsappMsgEn,
          active: promo.active,
        }
      : EMPTY_FORM,
  );
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, start] = useTransition();

  function set<K extends keyof typeof values>(k: K, v: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    start(async () => {
      let posterPath: string | null = null;
      let posterUrl: string | null = null;
      try {
        if (file) {
          const uploaded = await uploadPoster(file);
          posterPath = uploaded.path;
          posterUrl = uploaded.url;
        } else if (!promo) {
          toast.error("Sube un cartel para la promoción");
          return;
        }
      } catch (err) {
        toast.error("No se ha podido subir el cartel", {
          description: err instanceof Error ? err.message : "Error",
        });
        return;
      }

      const payload: PromotionInput = {
        titleEs: values.titleEs,
        titleEn: values.titleEn,
        whatsappMsgEs: values.whatsappMsgEs,
        whatsappMsgEn: values.whatsappMsgEn,
        active: values.active,
        posterPath,
        posterUrl,
      };

      const res = promo
        ? await updatePromotionAction(promo.id, payload)
        : await createPromotionAction(payload);

      if (res.ok) {
        toast.success(promo ? "Promoción actualizada" : "Promoción creada");
        onSaved();
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error("No se ha podido guardar", { description: res.error });
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={promo ? "Editar promoción" : "Nueva promoción"}
      tone="primary"
      size="lg"
    >
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título (español)" required error={errors.titleEs?.[0]} hint="Ej.: Campus Panda Tenis.">
            <Input value={values.titleEs} onChange={(e) => set("titleEs", e.target.value)} />
          </Field>
          <Field label="Título (inglés)" required error={errors.titleEn?.[0]} hint="Ej.: Panda Tennis Camp.">
            <Input value={values.titleEn} onChange={(e) => set("titleEn", e.target.value)} />
          </Field>
        </div>

        <Field
          label="Cartel / imagen"
          required={!promo}
          hint={promo ? "Sube uno nuevo solo si quieres reemplazar el actual." : "Imagen del cartel (JPG/PNG)."}
        >
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
        </Field>

        <details className="rounded-xl border border-[var(--border)] p-3 text-sm">
          <summary className="cursor-pointer font-medium">Mensaje de WhatsApp (opcional)</summary>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Texto que se autorrellena al pulsar “Reserva tu plaza”. Si lo dejas vacío se usa uno por defecto.
          </p>
          <div className="mt-3 grid gap-3">
            <Textarea
              rows={2}
              placeholder="Hola, me interesa el campus…"
              value={values.whatsappMsgEs}
              onChange={(e) => set("whatsappMsgEs", e.target.value)}
            />
            <Textarea
              rows={2}
              placeholder="Hi, I'm interested in the camp…"
              value={values.whatsappMsgEn}
              onChange={(e) => set("whatsappMsgEn", e.target.value)}
            />
          </div>
        </details>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          Visible públicamente
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            {promo ? "Guardar" : "Crear"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SendModal({
  promo,
  students,
  onClose,
}: {
  promo: Promotion | null;
  students: StudentLite[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [manualText, setManualText] = useState("");
  const [manualLocale, setManualLocale] = useState<"es" | "en">("es");
  const [audience, setAudience] = useState<"none" | "students" | "leads" | "both">("none");
  const [bulkLocale, setBulkLocale] = useState<"all" | "es" | "en">("all");
  const [customize, setCustomize] = useState(false);
  const [customEs, setCustomEs] = useState("");
  const [customEn, setCustomEn] = useState("");
  const [pending, start] = useTransition();

  // Mensaje por defecto (título de la promo + enlace al cartel), para previsualizar
  // y para prerrellenar el modo personalizado.
  const defaultMessages = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (!promo) return { es: "", en: "" };
    return {
      es: promoSms(promo.titleEs, `${origin}/es/p/${promo.slug}`, "es"),
      en: promoSms(promo.titleEn, `${origin}/en/p/${promo.slug}`, "en"),
    };
  }, [promo]);

  function enableCustomize() {
    setCustomize(true);
    if (!customEs && !customEn) {
      setCustomEs(defaultMessages.es);
      setCustomEn(defaultMessages.en);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.fullName.toLowerCase().includes(q));
  }, [students, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((s) => s.id)));
  }

  const manualPhones = manualText
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6);

  const total = selected.size + manualPhones.length;

  function send() {
    if (!promo) return;
    if (total === 0 && audience === "none") {
      toast.error("Selecciona destinatarios o una campaña masiva");
      return;
    }
    start(async () => {
      const res = await sendPromotionSmsAction({
        promotionId: promo.id,
        studentIds: Array.from(selected),
        manualRecipients: manualPhones.map((phone) => ({ phone, locale: manualLocale })),
        audience,
        localeFilter: bulkLocale,
        customBodyEs: customize ? customEs : "",
        customBodyEn: customize ? customEn : "",
      });
      if (res.ok) {
        const d = res.data!;
        toast.success(`SMS enviados: ${d.sent}`, {
          description: `${d.skipped} omitidos · ${d.failed} fallidos`,
        });
        onClose();
        setSelected(new Set());
        setManualText("");
        setAudience("none");
        setBulkLocale("all");
        setCustomize(false);
        setCustomEs("");
        setCustomEn("");
      } else {
        toast.error("No se ha podido enviar", { description: res.error });
      }
    });
  }

  return (
    <Modal
      open={!!promo}
      onClose={onClose}
      title="Enviar promoción por SMS"
      description={promo?.titleEs}
      tone="primary"
      size="lg"
    >
      <div className="grid gap-5">
        {/* Mensaje: predeterminado o personalizado */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
          <p className="mb-2 text-sm font-medium">Mensaje</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCustomize(false)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                !customize
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              Predeterminado
            </button>
            <button
              type="button"
              onClick={enableCustomize}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                customize
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              Personalizado
            </button>
          </div>

          {customize ? (
            <div className="mt-3 grid gap-3">
              <Field label="Mensaje (español)" hint={`${customEs.length} caracteres`}>
                <Textarea value={customEs} onChange={(e) => setCustomEs(e.target.value)} rows={3} maxLength={600} />
              </Field>
              <Field
                label="Mensaje (inglés)"
                hint="Opcional. Si lo dejas vacío, a los contactos en inglés se les envía el texto en español."
              >
                <Textarea value={customEn} onChange={(e) => setCustomEn(e.target.value)} rows={3} maxLength={600} />
              </Field>
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 text-[12.5px] leading-snug text-[var(--muted)]">
              {defaultMessages.es || "Se enviará el mensaje automático con el título de la promoción y el enlace al cartel."}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
          <p className="mb-2 text-sm font-medium">Campaña masiva</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["none", "Selección manual"],
                ["leads", "Todos los leads"],
                ["students", "Todos los alumnos"],
                ["both", "Leads + alumnos"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setAudience(value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  audience === value
                    ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {audience !== "none" && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-[var(--muted)]">Filtrar por idioma:</span>
              <Select
                value={bulkLocale}
                onChange={(e) => setBulkLocale(e.target.value as "all" | "es" | "en")}
                className="w-40"
              >
                <option value="all">Todos</option>
                <option value="es">Español</option>
                <option value="en">English</option>
              </Select>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Alumnos ({selected.size})</p>
            <button onClick={selectAll} className="text-xs text-[var(--primary)] hover:underline">
              Seleccionar todos
            </button>
          </div>
          <Input
            placeholder="Buscar alumno…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-[var(--border)]">
            {filtered.length === 0 ? (
              <p className="p-3 text-xs text-[var(--muted)]">Sin alumnos con teléfono.</p>
            ) : (
              filtered.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-sm last:border-0 hover:bg-[var(--surface-muted)]"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <span className="flex-1">{s.fullName}</span>
                  <Badge tone="neutral">{s.commLocale.toUpperCase()}</Badge>
                </label>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Contactos manuales</p>
          <Textarea
            rows={3}
            placeholder="Un teléfono por línea (ej. 600123456). Para contactos que aún no son alumnos."
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">Idioma de estos contactos:</span>
            <Select
              value={manualLocale}
              onChange={(e) => setManualLocale(e.target.value === "en" ? "en" : "es")}
              className="w-40"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
          <p className="text-sm text-[var(--muted)]">
            {audience === "none"
              ? `${total} destinatarios`
              : `Campaña masiva${total > 0 ? ` + ${total} seleccionados` : ""}`}
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={send} loading={pending}>
              <Send className="h-4 w-4" /> Enviar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
