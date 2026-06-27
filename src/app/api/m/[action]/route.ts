/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dal";
import {
  addCampusRosterEntriesAction,
  copyCampusRosterWeekAction,
  deleteCampusCollectionAction,
  deleteCampusRosterEntryAction,
  moveCampusRosterEntryAction,
  registerCampusCollectionAction,
  setCampusDayAttendanceAction,
  setCampusEntryAttendanceAction,
  setCampusEntryServicesAction,
  setCampusRosterDaysAction,
} from "@/lib/admin/actions/campus-roster";
import {
  createRegistrationInviteAction,
  convertRegistrationToStudentAction,
  deleteRegistrationAction,
  ensureCampusRosterFichaAction,
  markRegistrationInviteSentAction,
} from "@/lib/admin/actions/registrations";
import {
  addCampusStudentGalleryAction,
  addCampusStudentMedalAction,
  addCampusStudentNoteAction,
  deleteCampusStudentGalleryAction,
  deleteCampusStudentMedalAction,
  deleteCampusStudentNoteAction,
  deleteCampusStudentAction,
  mergeCampusStudentsAction,
  setCampusStudentArchivedAction,
} from "@/lib/admin/actions/campus-student-ficha";
import {
  createStudentAction,
  deleteStudentAction,
  toggleStudentActive,
  updateStudentAction,
} from "@/lib/admin/actions/students";
import {
  createPaymentAction,
  deletePaymentAction,
  markPaymentPaid,
} from "@/lib/admin/actions/payments";
import {
  createGroupAction,
  deleteGroupAction,
  updateGroupAction,
} from "@/lib/admin/actions/groups";
import {
  createLeadAction,
  deleteLeadAction,
  importConsentedLeadsAction,
  updateLeadPipelineAction,
  updateLeadStatusAction,
} from "@/lib/admin/actions/leads";
import {
  createPromotionAction,
  deletePromotionAction,
  savePromotionSmsMessageAction,
  sendPromotionSmsAction,
  togglePromotionActive,
  updatePromotionAction,
} from "@/lib/admin/actions/promotions";
import {
  createSmsTemplateAction,
  deleteSmsTemplateAction,
  saveSmsCampaignDraftAction,
  sendSmsCampaignAction,
  sendTestSmsAction,
  updateSmsSettingsAction,
  updateSmsTemplateAction,
} from "@/lib/admin/actions/sms";
import {
  createCampusCourseAction,
  deleteCampusCourseAction,
  toggleCampusCoursePublicAction,
  updateCampusCourseAction,
} from "@/lib/admin/actions/campus-courses";
import {
  addCampusExpenseAction,
  deleteCampusExpenseAction,
  updateCampusPricesAction,
} from "@/lib/admin/actions/campus-finance";
import {
  createLessonAction,
  deleteLessonAction,
  toggleLessonPaid,
} from "@/lib/admin/actions/private-lessons";
import {
  createCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/admin/actions/calendar";
import { upsertAttendance } from "@/lib/admin/actions/attendance";
import { awardMedalAction, removeMedalAction } from "@/lib/admin/actions/medals";
import { createTermReportAction, markReportSent } from "@/lib/admin/actions/reports";
import { saveProgressEvaluation } from "@/lib/admin/actions/progress";
import {
  applyBulkAssignmentsAction,
  assignStudentToGroupAction,
  suggestScheduleAction,
} from "@/lib/admin/actions/scheduler";
import {
  dismissActionCenterItem,
  logAdminActivity,
  snoozeActionCenterItem,
} from "@/lib/admin/actions/action-center";
import { updateSettingsAction, changeAdminPasswordAction } from "@/lib/admin/actions/settings";
import { sendTestPushAction } from "@/lib/admin/actions/push";
import { registerMediaAsset, deleteMediaAsset } from "@/lib/admin/actions/media";
import { getRecentActivity } from "@/lib/admin/actions/activity";
import { globalSearch } from "@/lib/admin/actions/search";
import { setDemoSeedAction } from "@/lib/admin/actions/demo-seeder";

export const dynamic = "force-dynamic";

/**
 * API REST para la app móvil. Reutiliza las mismas Server Actions del panel
 * (la auth por token Bearer la resuelve getSession en `lib/dal.ts`). Cada acción
 * valida su propia entrada con zod y comprueba permisos internamente.
 */
const HANDLERS: Record<string, (body: any) => Promise<unknown>> = {
  // Lecturas auxiliares basadas en Server Actions.
  "activity-recent": () => getRecentActivity(),
  "search": (b) => globalSearch(b.query ?? b.q ?? ""),

  // Alumnos.
  "student-create": (b) => createStudentAction(b.input ?? b),
  "student-update": (b) => updateStudentAction(b.id ?? b.studentId, b.guardianId ?? null, b.input ?? b),
  "student-active": (b) => toggleStudentActive(b.id ?? b.studentId, Boolean(b.active)),
  "student-delete-school": (b) => deleteStudentAction(b.id ?? b.studentId),

  // Pagos / recibos.
  "payment-create": (b) => createPaymentAction(b.input ?? b),
  "payment-paid": (b) => markPaymentPaid(b.id ?? b.paymentId, b.method ?? "efectivo"),
  "payment-delete": (b) => deletePaymentAction(b.id ?? b.paymentId),

  // Grupos y planner.
  "group-create": (b) => createGroupAction(b.input ?? b),
  "group-update": (b) => updateGroupAction(b.id ?? b.groupId, b.input ?? b),
  "group-delete": (b) => deleteGroupAction(b.id ?? b.groupId),
  "schedule-suggest": () => suggestScheduleAction(),
  "schedule-assign": (b) => assignStudentToGroupAction(b.input ?? b),
  "schedule-assign-bulk": (b) => applyBulkAssignmentsAction(b.input ?? b),

  // Leads.
  "lead-create": (b) => createLeadAction(b.input ?? b),
  "lead-status": (b) => updateLeadStatusAction(b.id ?? b.leadId, b.status),
  "lead-pipeline": (b) => updateLeadPipelineAction(b.input ?? b),
  "lead-import-consented": (b) => importConsentedLeadsAction(b.input ?? b),
  "lead-delete": (b) => deleteLeadAction(b.id ?? b.leadId),

  // Promociones y SMS de promoción.
  "promotion-create": (b) => createPromotionAction(b.input ?? b),
  "promotion-update": (b) => updatePromotionAction(b.id ?? b.promotionId, b.input ?? b),
  "promotion-toggle": (b) => togglePromotionActive(b.id ?? b.promotionId, Boolean(b.active)),
  "promotion-delete": (b) => deletePromotionAction(b.id ?? b.promotionId),
  "promotion-sms-save": (b) => savePromotionSmsMessageAction(b.input ?? b),
  "promotion-sms-send": (b) => sendPromotionSmsAction(b.input ?? b),

  // Centro SMS.
  "sms-campaign-send": (b) => sendSmsCampaignAction(b.input ?? b),
  "sms-campaign-draft": (b) => saveSmsCampaignDraftAction(b.input ?? b),
  "sms-settings-update": (b) => updateSmsSettingsAction(b.input ?? b),
  "sms-test": (b) => sendTestSmsAction(b.phone ?? b.to ?? ""),
  "sms-template-create": (b) => createSmsTemplateAction(b.input ?? b),
  "sms-template-update": (b) => updateSmsTemplateAction(b.id ?? b.templateId, b.input ?? b),
  "sms-template-delete": (b) => deleteSmsTemplateAction(b.id ?? b.templateId),

  // Campus: cursos, precios, gastos, cuadrante, cobros y ficha.
  "campus-course-create": (b) => createCampusCourseAction(b.input ?? b),
  "campus-course-update": (b) => updateCampusCourseAction(b.id ?? b.campusCourseId, b.input ?? b),
  "campus-course-delete": (b) => deleteCampusCourseAction(b.id ?? b.campusCourseId),
  "campus-course-toggle": (b) => toggleCampusCoursePublicAction(b.id ?? b.campusCourseId, Boolean(b.isPublic)),
  "campus-prices-update": (b) => updateCampusPricesAction(b.input ?? b),
  "campus-expense-add": (b) => addCampusExpenseAction(b.input ?? b),
  "campus-expense-delete": (b) => deleteCampusExpenseAction(b.id ?? b.expenseId),
  "campus-collection-delete": (b) => deleteCampusCollectionAction(b.id ?? b.collectionId),
  "campus-collection": (b) => registerCampusCollectionAction(b),
  "roster-add": (b) => addCampusRosterEntriesAction(b),
  "roster-copy-week": (b) => copyCampusRosterWeekAction(b),
  "roster-days": (b) => setCampusRosterDaysAction(b),
  "roster-attendance": (b) => setCampusEntryAttendanceAction(b),
  "roster-services": (b) => setCampusEntryServicesAction(b),
  "roster-move": (b) => moveCampusRosterEntryAction(b),
  "roster-delete": (b) => deleteCampusRosterEntryAction(b.id),
  "day-attendance": (b) => setCampusDayAttendanceAction(b),
  "registration-invite-create": (b) => createRegistrationInviteAction(b.input ?? b),
  "registration-invite-sent": (b) => markRegistrationInviteSentAction(b.id ?? b.registrationId),
  "registration-accept": (b) => convertRegistrationToStudentAction(b),
  "registration-delete": (b) => deleteRegistrationAction(b.id),
  "ficha-ensure": (b) => ensureCampusRosterFichaAction(b.id, b.locale),
  "campus-student-note-add": (b) => addCampusStudentNoteAction(b.input ?? b),
  "campus-student-note-delete": (b) => deleteCampusStudentNoteAction(b.id ?? b.noteId),
  "campus-student-medal-add": (b) => addCampusStudentMedalAction(b.input ?? b),
  "campus-student-medal-delete": (b) => deleteCampusStudentMedalAction(b.id ?? b.medalId),
  "campus-student-gallery-add": (b) => addCampusStudentGalleryAction(b.input ?? b),
  "campus-student-gallery-delete": (b) => deleteCampusStudentGalleryAction(b.id ?? b.photoId),
  "student-archive": (b) => setCampusStudentArchivedAction(b),
  "student-delete": (b) => deleteCampusStudentAction(b.id),
  "student-merge": (b) => mergeCampusStudentsAction(b),

  // Clases privadas, asistencia, progreso, informes, medallas y galería.
  "lesson-create": (b) => createLessonAction(b.input ?? b),
  "lesson-paid": (b) => toggleLessonPaid(b.id ?? b.lessonId, b.paymentStatus ?? b.status),
  "lesson-delete": (b) => deleteLessonAction(b.id ?? b.lessonId),
  "calendar-event-create": (b) => createCalendarEvent(b.input ?? b),
  "calendar-event-delete": (b) => deleteCalendarEvent(b.id ?? b.eventId),
  "attendance-upsert": (b) => upsertAttendance(b.input ?? b),
  "medal-award": (b) => awardMedalAction(b.input ?? b),
  "medal-remove": (b) => removeMedalAction(b.id ?? b.studentMedalId, b.studentId),
  "report-create": (b) => createTermReportAction(b.input ?? b),
  "report-sent": (b) => markReportSent(b.id ?? b.reportId),
  "progress-save": (b) => saveProgressEvaluation(b.input ?? b),
  "media-register": (b) => registerMediaAsset(b.input ?? b),
  "media-delete": (b) => deleteMediaAsset(b.id ?? b.assetId),

  // Ajustes y centro de acción.
  "settings-update": (b) => updateSettingsAction(b.input ?? b),
  "settings-password": (b) => changeAdminPasswordAction(b.input ?? b),
  "push-test": () => sendTestPushAction(),
  "action-snooze": (b) => snoozeActionCenterItem(b.input ?? b),
  "action-dismiss": (b) => dismissActionCenterItem(b.taskKey ?? b.id),
  "activity-log": (b) => logAdminActivity(b.input ?? b),
  "demo-seed": (b) => setDemoSeedAction(Boolean(b.active)),
};

// La app móvil consume esta API desde un origen distinto (app nativa / WebView /
// localhost). Permitimos cualquier origen: la seguridad la da el token Bearer de
// Supabase + el check de rol admin, no el origen. Por eso CORS abierto es seguro
// aquí. El header Authorization debe ir permitido explícitamente.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function corsJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, { status: init?.status, headers: CORS_HEADERS });
}

// Preflight CORS (navegadores / WebView). Las apps nativas no lo necesitan, pero
// no estorba y deja la API accesible desde cualquier cliente.
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const session = await getSession();
  if (!session) return corsJson({ ok: false, error: "No autorizado" }, { status: 401 });
  if (session.profile.role !== "admin") {
    return corsJson({ ok: false, error: "Sin permisos" }, { status: 403 });
  }

  const { action } = await params;
  const handler = HANDLERS[action];
  if (!handler) return corsJson({ ok: false, error: "Acción desconocida" }, { status: 404 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const result = await handler(body);
    return corsJson(result);
  } catch (error) {
    return corsJson(
      { ok: false, error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 },
    );
  }
}
