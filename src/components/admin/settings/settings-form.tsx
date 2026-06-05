"use client";

import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  changeAdminPasswordAction,
  updateSettingsAction,
  type PasswordInput,
  type SettingsInput,
} from "@/lib/admin/actions/settings";
import { setDemoSeedAction } from "@/lib/admin/actions/demo-seeder";
import { AlertTriangle, Database, Sparkles } from "lucide-react";

const emptyPasswordValues: PasswordInput = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function SettingsForm({
  initial,
  demoSeedActive,
}: {
  initial: SettingsInput;
  demoSeedActive: boolean;
}) {
  const [values, setValues] = useState<SettingsInput>(initial);
  const [passwordValues, setPasswordValues] = useState<PasswordInput>(emptyPasswordValues);
  const [settingsPending, startSettingsTransition] = useTransition();
  const [passwordPending, startPasswordTransition] = useTransition();
  const [demoActive, setDemoActive] = useState(demoSeedActive);
  const [demoPending, startDemoTransition] = useTransition();

  function toggleDemo() {
    const next = !demoActive;
    if (!next && !window.confirm("Esto borrará todos los datos demo creados por el seeder. ¿Continuar?")) {
      return;
    }
    startDemoTransition(async () => {
      const result = await setDemoSeedAction(next);
      if (result.ok) {
        setDemoActive(next);
        toast.success(
          next
            ? `Datos demo cargados${result.data?.inserted ? ` (${result.data.inserted} filas)` : ""}`
            : "Datos demo borrados",
        );
      } else {
        toast.error("No se ha podido " + (next ? "cargar" : "borrar"), {
          description: result.error,
        });
      }
    });
  }

  function set<K extends keyof SettingsInput>(key: K, value: SettingsInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setPassword<K extends keyof PasswordInput>(key: K, value: PasswordInput[K]) {
    setPasswordValues((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSettingsTransition(async () => {
      const result = await updateSettingsAction(values);
      if (result.ok) toast.success("Ajustes guardados");
      else toast.error("No se ha podido guardar", { description: result.error });
    });
  }

  function onPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startPasswordTransition(async () => {
      const result = await changeAdminPasswordAction(passwordValues);
      if (result.ok) {
        toast.success("Contraseña actualizada");
        setPasswordValues(emptyPasswordValues);
      } else {
        toast.error("No se ha podido cambiar la contraseña", { description: result.error });
      }
    });
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={onSubmit} className="grid gap-6">
        <Card>
          <CardHeader title="Datos generales" description="Aparecen en cabeceras, recibos y mensajes oficiales." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre de la escuela" required>
              <Input value={values.schoolName} onChange={(e) => set("schoolName", e.target.value)} />
            </Field>
            <Field label="Prefijo de recibos" required hint="Hasta 6 caracteres. Ej.: PT, PANDA">
              <Input
                value={values.receiptPrefix}
                onChange={(e) => set("receiptPrefix", e.target.value.toUpperCase())}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Datos fiscales (facturación)"
            description="Estos datos identifican al emisor en cada factura. El NIF es obligatorio para que la factura sea válida en España."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Razón social fiscal" hint="Nombre legal de la entidad. Ej.: Asociación Panda Tenis">
              <Input value={values.fiscalName} onChange={(e) => set("fiscalName", e.target.value)} />
            </Field>
            <Field label="NIF / CIF" hint="Obligatorio en factura">
              <Input value={values.fiscalNif} onChange={(e) => set("fiscalNif", e.target.value.toUpperCase())} />
            </Field>
            <Field label="Email de contacto">
              <Input type="email" value={values.fiscalEmail} onChange={(e) => set("fiscalEmail", e.target.value)} />
            </Field>
            <Field label="Teléfono">
              <Input value={values.fiscalPhone} onChange={(e) => set("fiscalPhone", e.target.value)} />
            </Field>
            <Field label="Dirección fiscal" className="sm:col-span-2">
              <Textarea value={values.fiscalAddress} onChange={(e) => set("fiscalAddress", e.target.value)} rows={2} />
            </Field>
            <Field
              label="Pie de factura"
              className="sm:col-span-2"
              hint="Nota libre al final de cada factura (condiciones de pago, agradecimiento…)."
            >
              <Textarea value={values.invoiceFooter} onChange={(e) => set("invoiceFooter", e.target.value)} rows={2} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Reservas por WhatsApp"
            description="Número y mensaje que se usan en el botón “Reserva tu plaza” de los carteles de promoción."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Número de WhatsApp"
              hint="Formato internacional con prefijo de país. Ej.: 34600123456"
            >
              <Input
                value={values.whatsappBookingNumber}
                onChange={(e) => set("whatsappBookingNumber", e.target.value)}
                placeholder="34600123456"
              />
            </Field>
            <div className="hidden sm:block" />
            <Field label="Mensaje prerrellenado (español)" hint="Texto con el que el cliente abre el chat.">
              <Textarea
                value={values.whatsappBookingMsgEs}
                onChange={(e) => set("whatsappBookingMsgEs", e.target.value)}
                rows={2}
                placeholder="¡Hola! Me interesa la actividad…"
              />
            </Field>
            <Field label="Mensaje prerrellenado (inglés)" hint="Para clientes en inglés.">
              <Textarea
                value={values.whatsappBookingMsgEn}
                onChange={(e) => set("whatsappBookingMsgEn", e.target.value)}
                rows={2}
                placeholder="Hi! I'm interested in the activity…"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="SMS de bienvenida"
            description="Si está activo, al convertir una inscripción en alumno se envía un SMS de bienvenida al tutor (en su idioma)."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={values.smsWelcomeEnabled}
                onChange={(e) => set("smsWelcomeEnabled", e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-[13.5px] font-semibold text-foreground">
                Enviar SMS de bienvenida al crear el alumno
              </span>
            </label>
            <Field
              label="Mensaje de bienvenida (español)"
              hint="Opcional. Si lo dejas vacío se usa un texto por defecto. Puedes usar {nombre}."
            >
              <Textarea
                value={values.smsWelcomeMsgEs}
                onChange={(e) => set("smsWelcomeMsgEs", e.target.value)}
                rows={2}
                placeholder="¡Bienvenid@ a Panda Tenis, {nombre}! ¡Nos vemos en pista!"
              />
            </Field>
            <Field
              label="Mensaje de bienvenida (inglés)"
              hint="Opcional. Para tutores en inglés. Puedes usar {name}."
            >
              <Textarea
                value={values.smsWelcomeMsgEn}
                onChange={(e) => set("smsWelcomeMsgEn", e.target.value)}
                rows={2}
                placeholder="Welcome to Panda Tennis, {name}! See you on court!"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Objetivos del trimestre" description="Estos números alimentan la barra de progreso del panel." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Objetivo de alumnos activos" required>
              <Input
                type="number"
                min="0"
                value={values.studentGoal}
                onChange={(e) => set("studentGoal", Number(e.target.value))}
              />
            </Field>
            <Field
              label="Umbral de alerta por ausencias"
              required
              hint="Avisa cuando la asistencia individual cae por debajo de este porcentaje"
            >
              <Input
                type="number"
                min="0"
                max="100"
                value={values.absenceAlertThreshold}
                onChange={(e) => set("absenceAlertThreshold", Number(e.target.value))}
              />
            </Field>
          </CardBody>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="accent" loading={settingsPending}>
            Guardar cambios
          </Button>
        </div>
      </form>

      <form onSubmit={onPasswordSubmit}>
        <Card>
          <CardHeader
            title="Contraseña de administrador"
            description="Cambia la contraseña de la cuenta admin directamente desde producción."
          />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Contraseña actual" required>
              <Input
                type="password"
                autoComplete="current-password"
                value={passwordValues.currentPassword}
                onChange={(e) => setPassword("currentPassword", e.target.value)}
              />
            </Field>
            <Field label="Nueva contraseña" required hint="Mínimo 10 caracteres.">
              <Input
                type="password"
                autoComplete="new-password"
                value={passwordValues.newPassword}
                onChange={(e) => setPassword("newPassword", e.target.value)}
              />
            </Field>
            <Field label="Confirmar nueva contraseña" required>
              <Input
                type="password"
                autoComplete="new-password"
                value={passwordValues.confirmPassword}
                onChange={(e) => setPassword("confirmPassword", e.target.value)}
              />
            </Field>
            <div className="flex justify-end sm:col-span-3">
              <Button type="submit" variant="accent" loading={passwordPending}>
                Cambiar contraseña
              </Button>
            </div>
          </CardBody>
        </Card>
      </form>

      {/* ───── Datos demo ───── */}
      <Card>
        <CardHeader
          title="Datos de demostración"
          description="Rellena la base de datos con grupos, alumnos, pagos, inscripciones y conversaciones de prueba. Útil para enseñar el panel sin tocar datos reales."
        />
        <CardBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span
                className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl ${
                  demoActive
                    ? "bg-[var(--accent-soft)] text-[var(--accent-foreground)]"
                    : "bg-[var(--surface-muted)] text-[var(--muted)]"
                }`}
              >
                <Database className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold">
                  {demoActive ? "Datos demo activos" : "Datos demo desactivados"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {demoActive
                    ? "El panel está mostrando datos generados por el seeder. Desactiva para borrarlos."
                    : "Activa para rellenar el panel con datos de ejemplo (grupos, alumnos, pagos, inscripciones)."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleDemo}
              disabled={demoPending}
              aria-pressed={demoActive}
              className={`relative inline-flex h-9 w-16 flex-shrink-0 items-center rounded-full transition-colors ${
                demoActive ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"
              } ${demoPending ? "cursor-wait opacity-70" : "cursor-pointer"}`}
              title={demoActive ? "Desactivar datos demo" : "Activar datos demo"}
            >
              <span
                className={`inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform ${
                  demoActive ? "translate-x-8" : "translate-x-1"
                }`}
              />
              <span className="sr-only">
                {demoActive ? "Desactivar datos demo" : "Activar datos demo"}
              </span>
            </button>
          </div>

          {demoActive && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent-foreground)]">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              Cada fila demo se etiqueta internamente con <code className="font-mono">seed_tag = panda-demo</code>.
              Tus datos reales no se tocan.
            </p>
          )}

          {!demoActive && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              Si activas el seeder en un panel con datos reales, el demo convivirá con ellos. Al desactivarlo se borra solo el demo.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
