"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";

const SettingsSchema = z.object({
  studentGoal: z.coerce.number().min(0),
  absenceAlertThreshold: z.coerce.number().min(0).max(100),
  schoolName: z.string().trim().min(1),
  receiptPrefix: z.string().trim().min(1).max(6),
  fiscalName: z.string().trim().optional().default(""),
  fiscalAddress: z.string().trim().optional().default(""),
  fiscalNif: z.string().trim().optional().default(""),
  fiscalEmail: z.union([z.literal(""), z.string().trim().email()]).optional().default(""),
  fiscalPhone: z.string().trim().optional().default(""),
  invoiceFooter: z.string().trim().optional().default(""),
  whatsappBookingNumber: z.string().trim().optional().default(""),
  whatsappBookingMsgEs: z.string().trim().max(400).optional().default(""),
  whatsappBookingMsgEn: z.string().trim().max(400).optional().default(""),
  smsWelcomeEnabled: z.boolean().optional().default(false),
  smsWelcomeMsgEs: z.string().trim().max(600).optional().default(""),
  smsWelcomeMsgEn: z.string().trim().max(600).optional().default(""),
});

const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Introduce la contraseña actual."),
    newPassword: z
      .string()
      .min(10, "La nueva contraseña debe tener al menos 10 caracteres.")
      .max(72, "La nueva contraseña no puede superar los 72 caracteres."),
    confirmPassword: z.string().min(1, "Confirma la nueva contraseña."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas nuevas no coinciden.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "La nueva contraseña debe ser distinta de la actual.",
    path: ["newPassword"],
  });

export type SettingsInput = z.output<typeof SettingsSchema>;
export type PasswordInput = z.output<typeof PasswordSchema>;
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateSettingsAction(input: SettingsInput): Promise<ActionResult> {
  try {
    const data = SettingsSchema.parse(input);
    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("school_settings")
      .update({
        student_goal: data.studentGoal,
        absence_alert_threshold: data.absenceAlertThreshold,
        school_name: data.schoolName,
        receipt_prefix: data.receiptPrefix,
        fiscal_name: data.fiscalName,
        fiscal_address: data.fiscalAddress,
        fiscal_nif: data.fiscalNif,
        fiscal_email: data.fiscalEmail,
        fiscal_phone: data.fiscalPhone,
        invoice_footer: data.invoiceFooter,
        whatsapp_booking_number: data.whatsappBookingNumber,
        whatsapp_booking_msg_es: data.whatsappBookingMsgEs,
        whatsapp_booking_msg_en: data.whatsappBookingMsgEn,
        sms_welcome_enabled: data.smsWelcomeEnabled,
        sms_welcome_msg_es: data.smsWelcomeMsgEs,
        sms_welcome_msg_en: data.smsWelcomeMsgEn,
      })
      .eq("id", true);
    if (error) throw error;
    revalidatePath("/admin/settings");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Algo ha fallado" };
  }
}

export async function changeAdminPasswordAction(input: PasswordInput): Promise<ActionResult> {
  try {
    const data = PasswordSchema.parse(input);
    const { supabase, user, profile } = await requireAdmin();
    const email = user.email ?? profile.email;

    if (!email) {
      return { ok: false, error: "No se ha podido localizar el email de la cuenta actual." };
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: data.currentPassword,
    });

    if (signInError) {
      return { ok: false, error: "La contraseña actual no es correcta." };
    }

    if (signInData.user?.id !== user.id) {
      return { ok: false, error: "La sesión no coincide con la cuenta administradora actual." };
    }

    const { error } = await supabase.auth.updateUser({ password: data.newPassword });
    if (error) throw error;

    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Datos de contraseña no válidos." };
    }
    return { ok: false, error: error instanceof Error ? error.message : "No se ha podido cambiar la contraseña." };
  }
}
