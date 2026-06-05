export type UserRole = "admin" | "profesor";

export type TennisLevel = "Rojo" | "Naranja" | "Verde" | "Amarillo";

export type AttendanceStatus = "asistio" | "no_asistio" | "aviso_ausencia";

export type PaymentStatus = "pagado" | "pendiente" | "atrasado";

export type PaymentMethod = "efectivo" | "transferencia" | "bizum";

export type EventType = "campamento" | "torneo" | "clase_especial" | "reunion" | "otro";

export type LeadInterest = "escuela" | "campus" | "ambos";
export type LeadPipelineStage =
  | "nuevo"
  | "contactado"
  | "interesado"
  | "prueba_agendada"
  | "convertido"
  | "perdido";

export type ActionCenterPriority = "high" | "medium" | "low";

export type ActionCenterItem = {
  key: string;
  type:
    | "payment_overdue"
    | "lead_followup"
    | "registration_pending"
    | "class_attendance";
  title: string;
  detail: string;
  priority: ActionCenterPriority;
  dueAt: string | null;
  href: string;
  relatedType: string;
  relatedId: string | null;
};

export type ConsentImportResult = {
  created: number;
  updated: number;
  skipped: number;
  invalid: Array<{ row: number; reason: string }>;
};

export type AdminActivityEvent = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
  actorName: string | null;
};

export type ProgressKey = "drive" | "reves" | "saque" | "actitud" | "asistencia";

export interface Profile {
  id: string;
  fullName: string;
  role: UserRole;
  phone: string;
  email: string;
  avatarUrl?: string;
}

export interface Guardian {
  id: string;
  studentId: string;
  fullName: string;
  phone: string;
  email: string;
  relationship: string;
}

export interface Group {
  id: string;
  name: string;
  level: TennisLevel;
  professorId: string;
  schedule: string;
  capacity: number;
  location: string;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  address: string;
  level: TennisLevel;
  dominantHand: "Derecha" | "Izquierda" | "Ambidiestro";
  groupId: string;
  professorId: string;
  startDate: string;
  medicalInfo: string;
  imageConsent: boolean;
  coachNotes: string;
  active: boolean;
  progress: Record<ProgressKey, number>;
}

export interface ClassSession {
  id: string;
  groupId: string;
  date: string;
  startTime: string;
  endTime: string;
  professorId: string;
  title: string;
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  studentId: string;
  status: AttendanceStatus;
  note?: string;
}

export interface TimelineEvent {
  id: string;
  studentId: string;
  date: string;
  title: string;
  detail: string;
  type: "grupo" | "evaluacion" | "medalla" | "foto" | "torneo" | "pago";
}

export interface Payment {
  id: string;
  studentId: string;
  concept: string;
  amount: number;
  dueDate: string;
  paidAt?: string;
  status: PaymentStatus;
  method?: PaymentMethod;
  receiptId?: string;
}

export interface Receipt {
  id: string;
  paymentId: string;
  receiptNumber: string;
  generatedAt: string;
}

export interface PrivateLesson {
  id: string;
  studentId: string;
  date: string;
  price: number;
  paymentStatus: PaymentStatus;
  professorId: string;
}

export interface Medal {
  id: string;
  name: "Verde" | "Azul" | "Roja" | "Amarilla" | "Naranja";
  color: string;
  criteria: string;
  order: number;
}

export interface StudentMedal {
  id: string;
  studentId: string;
  medalId: string;
  awardedAt: string;
}

export interface TermReport {
  id: string;
  studentId: string;
  term: string;
  createdAt: string;
  coachComment: string;
  sentAt?: string;
  printableUrl?: string;
}

export interface MediaAsset {
  id: string;
  studentId: string;
  type: "foto" | "video";
  url: string;
  title: string;
  uploadedAt: string;
  consentChecked: boolean;
}

export interface LeadSource {
  id: string;
  name: string;
}

export interface Lead {
  id: string;
  fullName: string;
  phone: string;
  childAge: number;
  interest: LeadInterest;
  sourceId: string;
  observations: string;
  createdAt: string;
  status: "nuevo" | "contactado" | "convertido";
}

export interface Registration {
  id: string;
  type: "escuela" | "campus";
  fullName: string;
  phone: string;
  childName: string;
  childAge: number;
  submittedAt: string;
  status: "pendiente" | "confirmada" | "convertida";
  leadId?: string;
  studentId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  description: string;
  color: string;
  reminderOffsets: number[];
}

export interface SchoolSettings {
  studentGoal: number;
  absenceAlertThreshold: number;
  schoolName: string;
  receiptPrefix: string;
  fiscalName: string;
  fiscalAddress: string;
  fiscalNif: string;
  fiscalEmail: string;
  fiscalPhone: string;
  invoiceFooter: string;
}

export interface SchoolData {
  profiles: Profile[];
  students: Student[];
  guardians: Guardian[];
  groups: Group[];
  classes: ClassSession[];
  attendanceRecords: AttendanceRecord[];
  timelineEvents: TimelineEvent[];
  payments: Payment[];
  receipts: Receipt[];
  privateLessons: PrivateLesson[];
  medals: Medal[];
  studentMedals: StudentMedal[];
  termReports: TermReport[];
  mediaAssets: MediaAsset[];
  leads: Lead[];
  leadSources: LeadSource[];
  registrations: Registration[];
  calendarEvents: CalendarEvent[];
  settings: SchoolSettings;
}
