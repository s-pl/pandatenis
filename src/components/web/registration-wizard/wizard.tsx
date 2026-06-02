"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  checkRegistrationEmailAction,
  submitRegistrationAction,
  type RegistrationInput,
} from "@/lib/web/actions";
import {
  COURSES,
  getCourseBySlug,
  type Course,
  type CourseKind,
} from "@/lib/web/courses";
import { CONTACT } from "@/components/web/content";
import { SignaturePadModal } from "./signature-pad";

type Props = {
  initialCourseSlug?: string;
  initialCourse?: Course;
  availableCourses?: Course[];
  restrictKind?: CourseKind;
  inviteToken?: string;
  initialStudent?: {
    firstName?: string;
    lastName?: string;
    guardianName?: string;
    guardianPhone?: string;
  };
};

type Relation = {
  fullName: string;
  relationship: string;
  phone: string;
  email: string;
};

type StepId = "info" | "student" | "additional" | "terms";

const STEP_DEFS: Array<{ id: StepId; icon: typeof BookOpen }> = [
  { id: "info", icon: BookOpen },
  { id: "student", icon: User },
  { id: "additional", icon: ClipboardList },
  { id: "terms", icon: FileText },
];

function renderIntro(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-extrabold text-[var(--forest)]">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function RegistrationWizard({
  initialCourseSlug,
  initialCourse: initialCourseProp,
  availableCourses: availableCoursesProp,
  restrictKind,
  inviteToken,
  initialStudent,
}: Props) {
  const t = useTranslations("wizard");

  const availableCourses = useMemo(
    () =>
      availableCoursesProp ??
      COURSES.filter(
        (c) => c.active && (!restrictKind || c.kind === restrictKind),
      ),
    [availableCoursesProp, restrictKind],
  );

  const initialCourse =
    initialCourseProp ??
    (initialCourseSlug
      ? (availableCourses.find((c) => c.slug === initialCourseSlug) ??
        getCourseBySlug(initialCourseSlug))
      : availableCourses.length === 1
        ? availableCourses[0]
        : null);

  const [stepIdx, setStepIdx] = useState(0);
  const [course, setCourse] = useState<Course | null>(initialCourse);
  const courseLocked =
    !!initialCourseProp || !!initialCourseSlug || availableCourses.length === 1;

  const [emailInput, setEmailInput] = useState("");
  const [emailVerified, setEmailVerified] = useState<null | {
    email: string;
    exists: boolean;
  }>(null);
  const [verifying, startVerifying] = useTransition();
  const [emailError, setEmailError] = useState<string | null>(null);

  const [childFirstName, setChildFirstName] = useState(initialStudent?.firstName ?? "");
  const [childLastName, setChildLastName] = useState(initialStudent?.lastName ?? "");
  const [childPhone, setChildPhone] = useState("");
  const [childBirthDate, setChildBirthDate] = useState("");
  const [childGender, setChildGender] = useState<"" | "masculino" | "femenino" | "otro">("");
  const [relations, setRelations] = useState<Relation[]>([]);
  const [relationsOpen, setRelationsOpen] = useState(true);
  const [draftRelation, setDraftRelation] = useState<Relation>({
    fullName: initialStudent?.guardianName ?? "",
    relationship: "",
    phone: initialStudent?.guardianPhone ?? "",
    email: "",
  });

  const [allergies, setAllergies] = useState("");
  const [illnesses, setIllnesses] = useState("");
  const [injuries, setInjuries] = useState("");
  const [preferredDays, setPreferredDays] = useState<Array<"L" | "M" | "X" | "J" | "V" | "S" | "D">>([]);
  const [preferredTimeBlocks, setPreferredTimeBlocks] = useState<
    Array<"tarde-temprano" | "tarde-media" | "tarde-tardia" | "sabado-manana">
  >([]);
  const [schedulingNotes, setSchedulingNotes] = useState("");

  const [signerFirstName, setSignerFirstName] = useState("");
  const [signerLastName, setSignerLastName] = useState("");
  const [consentMultimedia, setConsentMultimedia] = useState(true);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [company, setCompany] = useState("");

  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const current: StepId = STEP_DEFS[stepIdx].id;

  const verifyEmail = () => {
    setEmailError(null);
    const trimmed = emailInput.trim();
    if (!trimmed) {
      setEmailError(t("email.errorEmpty"));
      return;
    }
    startVerifying(async () => {
      const result = await checkRegistrationEmailAction({ email: trimmed });
      if (!result.ok) {
        setEmailError(result.error);
        return;
      }
      setEmailVerified({ email: trimmed, exists: result.exists });
    });
  };

  const resetEmail = () => {
    setEmailVerified(null);
    setEmailInput("");
    setChildFirstName("");
    setChildLastName("");
    setChildPhone("");
    setChildBirthDate("");
    setChildGender("");
    setRelations([]);
  };

  const addRelation = () => {
    if (
      draftRelation.fullName.trim().length < 2 ||
      draftRelation.relationship.trim().length < 2 ||
      draftRelation.phone.trim().length < 6
    ) {
      return;
    }
    if (relations.length >= 3) return;
    setRelations((r) => [...r, draftRelation]);
    setDraftRelation({ fullName: "", relationship: "", phone: "", email: "" });
  };
  const removeRelation = (i: number) =>
    setRelations((r) => r.filter((_, idx) => idx !== i));

  const canAdvance = useMemo(() => {
    if (current === "info") return !!course;
    if (current === "student")
      return (
        !!emailVerified &&
        childFirstName.trim().length >= 2 &&
        childLastName.trim().length >= 2 &&
        childPhone.trim().length >= 6 &&
        !!childBirthDate &&
        !!childGender &&
        relations.length >= 1
      );
    if (current === "additional") return true;
    if (current === "terms")
      return (
        signerFirstName.trim().length >= 2 &&
        signerLastName.trim().length >= 2 &&
        !!signatureData
      );
    return false;
  }, [
    current,
    course,
    emailVerified,
    childFirstName,
    childLastName,
    childPhone,
    childBirthDate,
    childGender,
    relations,
    signerFirstName,
    signerLastName,
    signatureData,
  ]);

  const submit = () => {
    if (!course || !emailVerified || !signatureData) return;
    setSubmitError(null);
    const payload: RegistrationInput = {
      inviteToken: inviteToken ?? "",
      courseSlug: course.slug,
      courseLabel: course.label,
      interest: course.kind,
      email: emailVerified.email,
      childFirstName,
      childLastName,
      childPhone,
      childBirthDate,
      childGender: childGender as "masculino" | "femenino" | "otro",
      relations,
      allergies,
      illnesses,
      injuries,
      signerFirstName,
      signerLastName,
      signatureData,
      consentMultimedia,
      company,
      preferredDays,
      preferredTimeBlocks,
      schedulingNotes,
    };
    startSubmit(async () => {
      const result = await submitRegistrationAction(payload);
      if (result.ok) setDone(true);
      else setSubmitError(result.error);
    });
  };

  if (done) {
    return (
      <div className="rounded-3xl border border-[var(--rule)] bg-[var(--cream-soft)] p-10 text-center shadow-[var(--shadow-md)] sm:p-14">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-[var(--rule)] bg-[var(--grass-soft)] shadow-[var(--shadow-card)]">
          <CheckCircle2 className="h-10 w-10 text-[var(--grass-deep)]" strokeWidth={2.2} />
        </div>
        <h2 className="mt-6 headline text-[clamp(1.6rem,4vw,2.2rem)] text-[var(--forest)]">
          {t("success.title")}
        </h2>
        <p
          className="mx-auto mt-4 max-w-md text-[14.5px] leading-[1.7] text-[var(--forest-soft)]"
          dangerouslySetInnerHTML={{
            __html: t("success.description", { course: course?.label ?? "" }),
          }}
        />
        <Link href="/" className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--coral)] px-6 text-[13.5px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5">
          {t("success.backHome")}
          <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
        </Link>
      </div>
    );
  }

  const stepLabels: Record<StepId, string> = {
    info: t("steps.info"),
    student: t("steps.student"),
    additional: t("steps.additional"),
    terms: t("steps.terms"),
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--rule)] bg-[var(--cream-soft)] shadow-[var(--shadow-md)]">
      {/* Progress */}
      <div className="border-b-2 border-[var(--forest)] bg-[var(--paper-deep)] px-5 pt-5 pb-4 sm:px-8 sm:pt-6 lg:px-10">
        <div className="mb-3 flex items-center justify-between sm:hidden">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--forest-mute)]">
            {t("nav.progressMobile", { step: stepIdx + 1, total: STEP_DEFS.length })}
          </p>
          <p className="text-[12px] font-extrabold text-[var(--forest)]">
            {stepLabels[current]}
          </p>
        </div>
        <ol className="hidden grid-cols-4 gap-2 sm:grid">
          {STEP_DEFS.map((s, i) => {
            const active = i <= stepIdx;
            const Icon = s.icon;
            return (
              <li key={s.id} className="flex flex-col items-center text-center">
                <span
                  className={
                    "grid h-9 w-9 place-items-center rounded-full border-2 transition-colors " +
                    (active
                      ? "border-[var(--forest)] bg-[var(--grass)] text-white"
                      : "border-[var(--rule)] bg-[var(--cream-soft)] text-[var(--forest-mute)]")
                  }
                >
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <span
                  className={
                    "mt-2 text-[11px] font-extrabold uppercase tracking-wider " +
                    (active ? "text-[var(--forest)]" : "text-[var(--forest-mute)]")
                  }
                >
                  {stepLabels[s.id]}
                </span>
              </li>
            );
          })}
        </ol>
        <ol className="grid grid-cols-4 gap-2 sm:hidden">
          {STEP_DEFS.map((s, i) => {
            const active = i <= stepIdx;
            const Icon = s.icon;
            return (
              <li key={s.id} className="flex flex-col items-center">
                <span
                  className={
                    "grid h-9 w-9 place-items-center rounded-full border-2 " +
                    (active
                      ? "border-[var(--forest)] bg-[var(--grass)] text-white"
                      : "border-[var(--rule)] bg-[var(--cream-soft)] text-[var(--forest-mute)]")
                  }
                >
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full border border-[var(--rule)] bg-[var(--cream-soft)]">
          <div
            className="h-full rounded-full bg-[var(--sun)] transition-all"
            style={{ width: `${((stepIdx + 1) / STEP_DEFS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="px-5 py-6 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
        {/* Honeypot */}
        <input
          type="text"
          name="company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden="true"
        />

        {current === "info" && (
          <StepInfo
            course={course}
            setCourse={setCourse}
            availableCourses={availableCourses}
            locked={courseLocked}
          />
        )}

        {current === "student" && (
          <StepStudent
            emailInput={emailInput}
            setEmailInput={setEmailInput}
            emailVerified={emailVerified}
            verifying={verifying}
            verifyEmail={verifyEmail}
            resetEmail={resetEmail}
            emailError={emailError}
            childFirstName={childFirstName}
            setChildFirstName={setChildFirstName}
            childLastName={childLastName}
            setChildLastName={setChildLastName}
            childPhone={childPhone}
            setChildPhone={setChildPhone}
            childBirthDate={childBirthDate}
            setChildBirthDate={setChildBirthDate}
            childGender={childGender}
            setChildGender={setChildGender}
            relations={relations}
            relationsOpen={relationsOpen}
            setRelationsOpen={setRelationsOpen}
            draftRelation={draftRelation}
            setDraftRelation={setDraftRelation}
            addRelation={addRelation}
            removeRelation={removeRelation}
          />
        )}

        {current === "additional" && (
          <StepAdditional
            allergies={allergies}
            setAllergies={setAllergies}
            illnesses={illnesses}
            setIllnesses={setIllnesses}
            injuries={injuries}
            setInjuries={setInjuries}
            showSchedulingPrefs={course?.kind !== "campus"}
            preferredDays={preferredDays}
            setPreferredDays={setPreferredDays}
            preferredTimeBlocks={preferredTimeBlocks}
            setPreferredTimeBlocks={setPreferredTimeBlocks}
            schedulingNotes={schedulingNotes}
            setSchedulingNotes={setSchedulingNotes}
          />
        )}

        {current === "terms" && (
          <StepTerms
            signerFirstName={signerFirstName}
            setSignerFirstName={setSignerFirstName}
            signerLastName={signerLastName}
            setSignerLastName={setSignerLastName}
            consentMultimedia={consentMultimedia}
            setConsentMultimedia={setConsentMultimedia}
            signatureData={signatureData}
            openSignature={() => setSignatureOpen(true)}
            clearSignature={() => setSignatureData(null)}
          />
        )}

        {submitError && (
          <p className="mt-6 flex items-center gap-2 rounded-2xl border-2 border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-[13.5px] font-semibold text-[var(--coral-deep)]">
            <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.2} /> {submitError}
          </p>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-3 border-t-2 border-[var(--forest)] bg-[var(--paper-deep)] px-5 py-4 sm:px-8 lg:px-10">
        <button
          type="button"
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={stepIdx === 0}
          className="inline-flex items-center gap-2 text-[13.5px] font-extrabold text-[var(--forest)] disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          {t("nav.back")}
        </button>
        {stepIdx < STEP_DEFS.length - 1 ? (
          <button
            type="button"
            onClick={() => canAdvance && setStepIdx((i) => i + 1)}
            disabled={!canAdvance}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--grass)] px-6 text-[13.5px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-[var(--shadow-sm)]"
          >
            {t("nav.next")}
            <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canAdvance || submitting}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--coral)] px-6 text-[13.5px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-[var(--shadow-sm)]"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {t("nav.submitting")}
              </>
            ) : (
              <>
                {t("nav.submit")}
                <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
              </>
            )}
          </button>
        )}
      </div>

      <SignaturePadModal
        open={signatureOpen}
        onClose={() => setSignatureOpen(false)}
        onConfirm={(data) => {
          setSignatureData(data);
          setSignatureOpen(false);
        }}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* Step: info                                                    */
/* ──────────────────────────────────────────────────────────── */

function StepInfo({
  course,
  setCourse,
  availableCourses,
  locked,
}: {
  course: Course | null;
  setCourse: (c: Course | null) => void;
  availableCourses: Course[];
  locked: boolean;
}) {
  const t = useTranslations("wizard.info");
  return (
    <div>
      <div className="mb-5 flex items-center gap-3 sm:mb-6">
        <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-[var(--rule)] bg-[var(--sun)]">
          <Image src="/panda/logo.png" alt="Panda Tenis" width={40} height={40} className="h-9 w-9 object-contain p-0.5" />
        </span>
        <span className="font-display text-[18px] font-extrabold text-[var(--forest)] sm:text-[20px]">
          Panda<span className="text-[var(--coral)]">·</span>Tenis
        </span>
      </div>

      <h1 className="headline text-[clamp(1.8rem,4vw,2.6rem)] text-[var(--forest)]">
        {t("title")}
      </h1>

      <p className="mt-5 inline-flex items-center gap-2 text-[14.5px] font-bold text-[var(--forest)]">
        <span className="rounded-full border border-[var(--rule)] bg-[var(--sun)] px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-[var(--forest)]">
          {t("helloBadge")}
        </span>
        {t("hello")}
      </p>

      <p className="mt-4 text-[15px] leading-[1.7] text-[var(--forest)] sm:text-[16px]">
        {t("intro")}
      </p>

      {course ? (
        <>
          <p className="mt-4 text-[15px] leading-[1.7] text-[var(--forest)] sm:text-[16px]">
            {renderIntro(course.intro)}
          </p>
          <p className="mt-4 text-[15px] leading-[1.7] text-[var(--forest)] sm:text-[16px]">
            {t("alsoPlatform")}
          </p>
          {!locked && availableCourses.length > 1 && (
            <button
              type="button"
              onClick={() => setCourse(null)}
              className="mt-4 text-[12.5px] font-extrabold text-[var(--coral)] underline decoration-2 underline-offset-4 hover:text-[var(--coral-deep)]"
            >
              {t("changeCourse")}
            </button>
          )}
        </>
      ) : (
        <div className="mt-6">
          <p className="text-[15px] leading-[1.7] text-[var(--forest)] sm:text-[16px]">
            {t("pickCourse")}
          </p>
          <div className="mt-4 grid gap-3">
            {availableCourses.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setCourse(c)}
                className="lift flex items-start justify-between gap-3 rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)] p-4 text-left shadow-[var(--shadow-card)] hover:bg-[var(--sun-soft)]"
              >
                <div className="min-w-0">
                  <p className="font-display text-[16px] font-bold text-[var(--forest)] sm:text-[18px]">
                    {c.label}
                  </p>
                  <p className="mt-1 text-[12.5px] font-bold text-[var(--forest-mute)]">{c.dates}</p>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[var(--forest)]" strokeWidth={2.4} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 space-y-2 text-[14px] text-[var(--forest)]">
        <p className="flex items-start gap-2 break-words">
          <MapPin aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[var(--grass-deep)]" strokeWidth={2.2} />
          {CONTACT.addressLines.join(", ")}
        </p>
        <p className="flex items-center gap-2">
          <Phone aria-hidden className="h-4 w-4 shrink-0 text-[var(--grass-deep)]" strokeWidth={2.2} />{" "}
          <a href={CONTACT.phoneHref} className="font-extrabold underline decoration-[var(--sun)] decoration-2 underline-offset-4">
            +34 {CONTACT.phoneDisplay}
          </a>
        </p>
      </div>

      <p className="mt-6 font-script text-[26px] text-[var(--grass-deep)]">
        {t("seeYouOnCourt")}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* Local form primitives (kept inline so the wizard stays self-contained) */
/* ──────────────────────────────────────────────────────────── */

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[13px] font-extrabold text-[var(--forest)]">
        {label} {required && <span className="text-[var(--coral)]">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "h-12 rounded-2xl border border-[var(--rule)]/15 bg-[var(--cream-soft)] px-4 text-[15px] font-medium text-[var(--forest)] outline-none transition-colors placeholder:text-[var(--forest-mute)] placeholder:font-normal hover:border-[var(--forest)]/40 focus:border-[var(--forest)] focus:ring-4 focus:ring-[var(--sun-soft)]";

/* ──────────────────────────────────────────────────────────── */
/* Step: student                                                 */
/* ──────────────────────────────────────────────────────────── */

function StepStudent(props: {
  emailInput: string;
  setEmailInput: (v: string) => void;
  emailVerified: { email: string; exists: boolean } | null;
  verifying: boolean;
  verifyEmail: () => void;
  resetEmail: () => void;
  emailError: string | null;
  childFirstName: string;
  setChildFirstName: (v: string) => void;
  childLastName: string;
  setChildLastName: (v: string) => void;
  childPhone: string;
  setChildPhone: (v: string) => void;
  childBirthDate: string;
  setChildBirthDate: (v: string) => void;
  childGender: "" | "masculino" | "femenino" | "otro";
  setChildGender: (v: "" | "masculino" | "femenino" | "otro") => void;
  relations: Relation[];
  relationsOpen: boolean;
  setRelationsOpen: (v: boolean) => void;
  draftRelation: Relation;
  setDraftRelation: (v: Relation) => void;
  addRelation: () => void;
  removeRelation: (i: number) => void;
}) {
  const t = useTranslations("wizard");

  if (!props.emailVerified) {
    return (
      <div className="max-w-xl">
        <p className="flex items-center gap-2 font-display text-[18px] font-bold text-[var(--forest)]">
          <Mail className="h-5 w-5" strokeWidth={2.2} />
          {t("email.title")}
        </p>
        <input
          type="email"
          value={props.emailInput}
          onChange={(e) => props.setEmailInput(e.target.value)}
          placeholder={t("email.placeholder")}
          className={`mt-5 w-full ${inputCls}`}
        />
        <button
          type="button"
          onClick={props.verifyEmail}
          disabled={props.verifying}
          className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--grass)] text-[14px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:translate-y-0"
        >
          {props.verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : t("email.verifyBtn")}
        </button>
        {props.emailError && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--coral-deep)]">
            <AlertTriangle aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} /> {props.emailError}
          </p>
        )}
        <p className="mt-5 text-[13.5px] leading-[1.65] text-[var(--forest-mute)]">
          {t("email.hint1")}
        </p>
        <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--forest-mute)]">
          {t("email.hint2")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--rule)] bg-[var(--grass-soft)] p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--rule)] bg-[var(--grass)] text-white">
            <CheckCircle2 className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <div>
            <p className="font-display text-[14px] font-extrabold text-[var(--forest)]">{t("email.verified")}</p>
            <p className="flex items-center gap-2 text-[13.5px] text-[var(--forest)]">
              <Mail className="h-4 w-4" strokeWidth={2.2} /> {props.emailVerified.email}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--cream-soft)] border border-[var(--rule)] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[var(--grass-deep)]">
                {props.emailVerified.exists ? t("email.existingStudent") : t("email.newRecord")}
              </span>
              <span className="rounded-full bg-[var(--cream-deep)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--forest-mute)]">
                {t("email.personalEmail")}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={props.resetEmail}
          className="rounded-full border border-[var(--rule)] bg-[var(--cream-soft)] px-3.5 py-1.5 text-[11.5px] font-extrabold text-[var(--forest)] hover:bg-[var(--sun-soft)]"
        >
          {t("email.startOver")}
        </button>
      </div>

      <h3 className="mt-7 font-display text-[20px] font-bold text-[var(--forest)]">
        {t("student.title")}
      </h3>
      <p className="mt-1 text-[13.5px] leading-[1.6] text-[var(--forest-mute)]">
        {t("student.intro")}
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <FormField label={t("student.firstName")} required>
          <input
            className={inputCls}
            value={props.childFirstName}
            onChange={(e) => props.setChildFirstName(e.target.value)}
            placeholder={t("student.firstNamePlaceholder")}
          />
        </FormField>
        <FormField label={t("student.lastName")} required>
          <input
            className={inputCls}
            value={props.childLastName}
            onChange={(e) => props.setChildLastName(e.target.value)}
            placeholder={t("student.lastNamePlaceholder")}
          />
        </FormField>
        <FormField label={t("student.phone")} required>
          <input
            type="tel"
            className={inputCls}
            value={props.childPhone}
            onChange={(e) => props.setChildPhone(e.target.value)}
            placeholder={t("student.phonePlaceholder")}
          />
        </FormField>
        <FormField label={t("student.birthDate")} required>
          <input
            type="date"
            className={inputCls}
            value={props.childBirthDate}
            onChange={(e) => props.setChildBirthDate(e.target.value)}
          />
        </FormField>
        <FormField label={t("student.gender")} required>
          <select
            className={inputCls}
            value={props.childGender}
            onChange={(e) =>
              props.setChildGender(e.target.value as "" | "masculino" | "femenino" | "otro")
            }
          >
            <option value="">{t("student.genderSelect")}</option>
            <option value="masculino">{t("student.genderMale")}</option>
            <option value="femenino">{t("student.genderFemale")}</option>
            <option value="otro">{t("student.genderOther")}</option>
          </select>
        </FormField>
      </div>

      {/* Family relations */}
      <div className="mt-6 rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)]">
        <button
          type="button"
          onClick={() => props.setRelationsOpen(!props.relationsOpen)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <span className="font-display text-[15px] font-extrabold text-[var(--forest)]">
            {t("student.relations.title")}
            <span className="ml-2 inline-flex items-center rounded-full bg-[var(--sun)] border border-[var(--rule)] px-2 py-0.5 text-[11px] font-extrabold">
              {t("student.relations.counter", { count: props.relations.length })}
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 text-[var(--forest)] transition ${props.relationsOpen ? "rotate-180" : ""}`}
            strokeWidth={2.4}
          />
        </button>
        {props.relationsOpen && (
          <div className="border-t-2 border-[var(--forest)] p-4">
            {props.relations.map((r, i) => (
              <div
                key={i}
                className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-[var(--rule)]/15 bg-[var(--paper-deep)] p-3 text-[13.5px]"
              >
                <div>
                  <p className="font-extrabold text-[var(--forest)]">{r.fullName}</p>
                  <p className="text-[var(--forest-mute)]">
                    {r.relationship} · {r.phone}
                    {r.email ? ` · ${r.email}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => props.removeRelation(i)}
                  className="text-[var(--forest-mute)] hover:text-[var(--coral)]"
                  aria-label={t("student.relations.remove")}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>
            ))}

            {props.relations.length < 3 && (
              <div className="grid gap-3 rounded-xl border-2 border-dashed border-[var(--forest)]/30 p-3 sm:grid-cols-2">
                <FormField label={t("student.relations.fullName")}>
                  <input
                    className={inputCls}
                    value={props.draftRelation.fullName}
                    onChange={(e) =>
                      props.setDraftRelation({
                        ...props.draftRelation,
                        fullName: e.target.value,
                      })
                    }
                    placeholder={t("student.relations.fullNamePlaceholder")}
                  />
                </FormField>
                <FormField label={t("student.relations.relationship")}>
                  <input
                    className={inputCls}
                    value={props.draftRelation.relationship}
                    onChange={(e) =>
                      props.setDraftRelation({
                        ...props.draftRelation,
                        relationship: e.target.value,
                      })
                    }
                    placeholder={t("student.relations.relationshipPlaceholder")}
                  />
                </FormField>
                <FormField label={t("student.relations.phone")}>
                  <input
                    className={inputCls}
                    value={props.draftRelation.phone}
                    onChange={(e) =>
                      props.setDraftRelation({
                        ...props.draftRelation,
                        phone: e.target.value,
                      })
                    }
                    placeholder={t("student.relations.phonePlaceholder")}
                  />
                </FormField>
                <FormField label={t("student.relations.email")}>
                  <input
                    type="email"
                    className={inputCls}
                    value={props.draftRelation.email}
                    onChange={(e) =>
                      props.setDraftRelation({
                        ...props.draftRelation,
                        email: e.target.value,
                      })
                    }
                    placeholder={t("student.relations.emailPlaceholder")}
                  />
                </FormField>
                <button
                  type="button"
                  onClick={props.addRelation}
                  className="sm:col-span-2 inline-flex h-12 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--coral)] px-4 text-[13.5px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
                >
                  {t("student.relations.add")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* Step: additional                                              */
/* ──────────────────────────────────────────────────────────── */

type Weekday = "L" | "M" | "X" | "J" | "V" | "S" | "D";
type TimeBlock = "tarde-temprano" | "tarde-media" | "tarde-tardia" | "sabado-manana";

const WEEKDAY_VALUES: Weekday[] = ["L", "M", "X", "J", "V", "S"];
const TIMEBLOCK_VALUES: Array<{ value: TimeBlock; key: string; hint: string }> = [
  { value: "tarde-temprano", key: "tardeTemprano", hint: "16:00 – 17:30" },
  { value: "tarde-media", key: "tardeMedia", hint: "17:30 – 19:00" },
  { value: "tarde-tardia", key: "tardeTardia", hint: "19:00 – 20:30" },
  { value: "sabado-manana", key: "sabadoManana", hint: "10:00 – 13:00" },
];

function StepAdditional(props: {
  allergies: string;
  setAllergies: (v: string) => void;
  illnesses: string;
  setIllnesses: (v: string) => void;
  injuries: string;
  setInjuries: (v: string) => void;
  showSchedulingPrefs: boolean;
  preferredDays: Weekday[];
  setPreferredDays: (v: Weekday[]) => void;
  preferredTimeBlocks: TimeBlock[];
  setPreferredTimeBlocks: (v: TimeBlock[]) => void;
  schedulingNotes: string;
  setSchedulingNotes: (v: string) => void;
}) {
  const t = useTranslations("wizard.additional");

  const ta =
    "rounded-2xl border border-[var(--rule)]/15 bg-[var(--cream-soft)] px-4 py-3 text-[15px] font-medium text-[var(--forest)] placeholder:text-[var(--forest-mute)] placeholder:font-normal outline-none transition-colors focus:border-[var(--forest)] focus:ring-4 focus:ring-[var(--sun-soft)]";

  function toggleDay(day: Weekday) {
    props.setPreferredDays(
      props.preferredDays.includes(day)
        ? props.preferredDays.filter((d) => d !== day)
        : [...props.preferredDays, day],
    );
  }
  function toggleBlock(block: TimeBlock) {
    props.setPreferredTimeBlocks(
      props.preferredTimeBlocks.includes(block)
        ? props.preferredTimeBlocks.filter((b) => b !== block)
        : [...props.preferredTimeBlocks, block],
    );
  }

  return (
    <div>
      <h2 className="headline text-[clamp(1.6rem,3.6vw,2rem)] text-[var(--forest)]">
        {t("title")}
      </h2>
      <p className="mt-1 text-[13.5px] text-[var(--forest-mute)]">{t("hint")}</p>

      <div className="mt-6 grid gap-5">
        <FormField label={t("allergies")}>
          <textarea
            rows={3}
            className={`resize-none ${ta}`}
            value={props.allergies}
            onChange={(e) => props.setAllergies(e.target.value)}
          />
        </FormField>
        <FormField label={t("illnesses")}>
          <textarea
            rows={3}
            className={`resize-none ${ta}`}
            value={props.illnesses}
            onChange={(e) => props.setIllnesses(e.target.value)}
          />
        </FormField>
        <FormField label={t("injuries")}>
          <textarea
            rows={3}
            className={`resize-none ${ta}`}
            value={props.injuries}
            onChange={(e) => props.setInjuries(e.target.value)}
          />
        </FormField>
      </div>

      {props.showSchedulingPrefs && (
        <div className="mt-10 rounded-2xl border border-[var(--rule)] bg-[var(--sun-soft)] p-5 sm:p-6">
          <h3 className="font-display text-[18px] font-bold text-[var(--forest)]">
            {t("scheduling.title")}
          </h3>
          <p className="mt-1 text-[13px] text-[var(--forest-soft)]">
            {t("scheduling.hint")}
          </p>

          <div className="mt-5">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-[var(--forest-mute)]">
              {t("scheduling.daysLabel")}
            </p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_VALUES.map((value) => {
                const active = props.preferredDays.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleDay(value)}
                    className={`min-w-[46px] rounded-xl border-2 px-3 py-2 text-[14px] font-extrabold transition-colors ${
                      active
                        ? "border-[var(--forest)] bg-[var(--grass)] text-white"
                        : "border-[var(--forest)] bg-[var(--cream-soft)] text-[var(--forest)] hover:bg-[var(--paper-deep)]"
                    }`}
                    aria-pressed={active}
                    title={t(`days.${value}`)}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-[var(--forest-mute)]">
              {t("scheduling.timesLabel")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {TIMEBLOCK_VALUES.map((opt) => {
                const active = props.preferredTimeBlocks.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleBlock(opt.value)}
                    className={`flex items-center justify-between rounded-xl border-2 px-3 py-2.5 text-left text-[13.5px] font-extrabold transition-colors ${
                      active
                        ? "border-[var(--forest)] bg-[var(--coral)] text-white"
                        : "border-[var(--forest)] bg-[var(--cream-soft)] text-[var(--forest)] hover:bg-[var(--coral-soft)]"
                    }`}
                    aria-pressed={active}
                  >
                    <span>{t(`timeBlocks.${opt.key}`)}</span>
                    <span className={`text-[11px] ${active ? "text-white/80" : "text-[var(--forest-mute)]"}`}>
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <FormField label={t("scheduling.noteLabel")}>
              <textarea
                rows={2}
                placeholder={t("scheduling.notePlaceholder")}
                className={`resize-none ${ta}`}
                value={props.schedulingNotes}
                onChange={(e) => props.setSchedulingNotes(e.target.value)}
              />
            </FormField>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
/* Step: terms                                                   */
/* ──────────────────────────────────────────────────────────── */

function StepTerms(props: {
  signerFirstName: string;
  setSignerFirstName: (v: string) => void;
  signerLastName: string;
  setSignerLastName: (v: string) => void;
  consentMultimedia: boolean;
  setConsentMultimedia: (v: boolean) => void;
  signatureData: string | null;
  openSignature: () => void;
  clearSignature: () => void;
}) {
  const t = useTranslations("wizard.terms");

  return (
    <div>
      <h2 className="headline text-[clamp(1.6rem,3.6vw,2rem)] text-[var(--forest)]">
        {t("title")}
      </h2>
      <p className="mt-1 text-[13.5px] text-[var(--forest-mute)]">
        {t("intro")}
      </p>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-[16px] font-extrabold text-[var(--forest)]">
            {t("termsTitle")}
          </h3>
          <a
            href="/legal/terminos-y-condiciones.pdf"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--rule)] bg-[var(--sun)] px-3 py-1 text-[11px] font-extrabold text-[var(--forest)]"
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={2.2} /> PDF
          </a>
        </div>
        <div className="rounded-2xl border border-[var(--rule)]/15 bg-[var(--paper-deep)] p-5 text-[13.5px] leading-[1.7] text-[var(--forest)]">
          <p className="font-extrabold">{t("termsBody.heading")}</p>
          <p className="mt-3">{t("termsBody.p1")}</p>
          <p className="mt-3">{t("termsBody.p2")}</p>
          <p className="mt-3">{t("termsBody.p3")}</p>
          <p className="mt-3">{t("termsBody.p4")}</p>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-[16px] font-extrabold text-[var(--forest)]">
            {t("imagesTitle")}
          </h3>
          <a
            href="/legal/consentimiento-imagenes.pdf"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--rule)] bg-[var(--sun)] px-3 py-1 text-[11px] font-extrabold text-[var(--forest)]"
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={2.2} /> PDF
          </a>
        </div>
        <div className="rounded-2xl border border-[var(--rule)]/15 bg-[var(--paper-deep)] p-5 text-[13.5px] leading-[1.7] text-[var(--forest)]">
          <p className="font-extrabold">{t("imagesBody.heading")}</p>
          <p className="mt-3">{t("imagesBody.p1")}</p>
          <p className="mt-3">{t("imagesBody.p2")}</p>
          <p className="mt-3">{t("imagesBody.p3")}</p>
          <p className="mt-3 font-bold">{t("imagesBody.p4")}</p>
        </div>
        <label className="mt-3 flex items-center gap-2.5 rounded-xl border border-[var(--rule)] bg-[var(--cream-soft)] px-3 py-2.5 text-[13.5px] font-bold text-[var(--forest)]">
          <input
            type="checkbox"
            checked={props.consentMultimedia}
            onChange={(e) => props.setConsentMultimedia(e.target.checked)}
            className="h-4 w-4 accent-[var(--grass)]"
          />
          {t("consentLabel")}
        </label>
      </section>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <FormField label={t("signerFirst")} required>
          <input
            className={inputCls}
            value={props.signerFirstName}
            onChange={(e) => props.setSignerFirstName(e.target.value)}
          />
        </FormField>
        <FormField label={t("signerLast")} required>
          <input
            className={inputCls}
            value={props.signerLastName}
            onChange={(e) => props.setSignerLastName(e.target.value)}
          />
        </FormField>
      </div>

      <p
        className="mt-4 rounded-2xl border border-[var(--rule)]/15 bg-[var(--paper-deep)] px-4 py-3 text-[12.5px] text-[var(--forest-mute)]"
        dangerouslySetInnerHTML={{ __html: t.markup("autoAccept", { strong: (chunks) => `<strong class="text-[var(--forest)]">${chunks}</strong>` }) }}
      />

      <div className="mt-5">
        <p className="text-[13px] font-extrabold text-[var(--forest)]">{t("signLabel")}</p>
        {props.signatureData ? (
          <div className="mt-2 flex items-center justify-between gap-4 rounded-2xl border border-[var(--rule)] bg-[var(--cream-soft)] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={props.signatureData}
              alt={t("signLabel")}
              className="h-20 w-auto object-contain"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={props.openSignature}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--rule)] bg-[var(--cream-soft)] px-3 text-[12px] font-extrabold text-[var(--forest)] hover:bg-[var(--sun-soft)]"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} /> {t("signEdit")}
              </button>
              <button
                type="button"
                onClick={props.clearSignature}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border-2 border-[var(--coral)] bg-[var(--coral-soft)] px-3 text-[12px] font-extrabold text-[var(--coral-deep)] hover:bg-[var(--coral)] hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} /> {t("signClear")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={props.openSignature}
            className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--grass)] text-[14px] font-extrabold text-white shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {t("signOpen")}
          </button>
        )}
      </div>
    </div>
  );
}
