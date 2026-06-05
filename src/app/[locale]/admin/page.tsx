import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  ArrowUpRight,
  BellRing,
  Bird,
  CalendarClock,
  CreditCard,
  GraduationCap,
  Image as ImageIcon,
  Medal,
  PhoneCall,
  Plus,
  Sparkles,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/admin/page-shell";
import { RealtimeRefresh } from "@/components/admin/realtime-refresh";
import { KpiCard } from "@/components/admin/kpi-card";
import { ActionCenter } from "@/components/admin/action-center";
import { ActionRow, ExpandableSection } from "@/components/admin/expandable-section";
import { AttendanceBarChart } from "@/components/charts/attendance-bar-chart";
import { LevelDonutChart } from "@/components/charts/level-donut-chart";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import {
  formatLongDate,
  formatMoney,
  formatShortDate,
} from "@/lib/format";
import { requireStaff } from "@/lib/dal";
import {
  fetchAttendanceSeries,
  fetchActionCenter,
  fetchDashboardSummary,
  fetchLeadSources,
  fetchLevelDistribution,
  fetchRevenueSeries,
} from "@/lib/admin/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("dashboard") };
}

export default async function DashboardPage() {
  const { supabase, profile } = await requireStaff();
  if (profile.role !== "admin") redirect("/admin/attendance");
  const t = await getTranslations("admin.pages.dashboard");
  const locale = await getLocale();

  const [summary, revenue, levels, attendance, actions] = await Promise.all([
    fetchDashboardSummary(supabase),
    fetchRevenueSeries(supabase),
    fetchLevelDistribution(supabase),
    fetchAttendanceSeries(supabase),
    fetchActionCenter(supabase),
    fetchLeadSources(supabase),
  ]);

  const revenueDelta =
    summary.prevMonthRevenue === 0
      ? null
      : Math.round(
          ((summary.monthRevenue - summary.prevMonthRevenue) / summary.prevMonthRevenue) * 100,
        );

  const goalProgress =
    summary.studentGoal === 0
      ? 0
      : Math.min(100, Math.round((summary.activeStudents / summary.studentGoal) * 100));

  const firstName = profile.fullName.split(" ")[0] ?? profile.fullName;
  const intlLocale = locale === "en" ? "en-US" : "es-ES";
  const monthLabel = new Date()
    .toLocaleDateString(intlLocale, { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase());
  void monthLabel;

  const collected = summary.monthRevenue - summary.pendingPaymentsAmount;

  return (
    <PageShell
      title={t("greeting", { name: firstName })}
      description={t("subtitle")}
    >
      <RealtimeRefresh tables={["payments", "students", "attendance_records"]} />
      <ActionCenter items={actions} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label={t("kpiCollected")}
          value={formatMoney(collected, true)}
          hint={t("kpiInvoiced", { amount: formatMoney(summary.monthRevenue, true) })}
          icon={<CreditCard className="h-4 w-4" />}
          tone="success"
          index={0}
          delta={
            revenueDelta !== null
              ? { value: `${Math.abs(revenueDelta)}%`, positive: revenueDelta >= 0 }
              : undefined
          }
        />
        <KpiCard
          label={t("kpiStudents")}
          value={String(summary.activeStudents)}
          hint={t("kpiStudentsHint", { count: summary.newStudentsThisMonth, progress: goalProgress })}
          icon={<Bird className="h-4 w-4" />}
          tone="primary"
          index={1}
        />
        <KpiCard
          label={t("kpiAttendance")}
          value={`${summary.attendanceRate}%`}
          hint={t("kpiAttendanceHint")}
          icon={<GraduationCap className="h-4 w-4" />}
          tone={summary.attendanceRate >= 75 ? "success" : summary.attendanceRate >= 50 ? "accent" : "warning"}
          index={2}
        />
        <KpiCard
          label={t("kpiLeads")}
          value={String(summary.newLeadsThisWeek)}
          hint={t("kpiLeadsHint")}
          icon={<PhoneCall className="h-4 w-4" />}
          tone="info"
          index={3}
        />
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-3 sm:gap-4">
          <ExpandableSection
            title={t("secStudents")}
            icon={<Bird className="h-4 w-4" />}
            defaultExpanded
            stats={[
              { label: t("statThisMonth"), value: summary.newStudentsThisMonth, tone: "primary" },
              { label: t("statTotal"), value: summary.activeStudents },
            ]}
            rightAccessory={
              <Link
                href="/admin/students"
                className="grid h-7 w-7 place-items-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white"
                aria-label={t("createStudentAria")}
              >
                <Plus className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <div className="grid items-center gap-4 sm:grid-cols-[1fr_160px]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  {t("newThisMonth")}
                </p>
                <p className="mt-1 text-[2.25rem] font-bold leading-none">
                  {summary.newStudentsThisMonth}
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all"
                    style={{ width: `${goalProgress}%` }}
                  />
                </div>
                <p
                  className="mt-2 text-[12px] text-[var(--muted)]"
                  dangerouslySetInnerHTML={{
                    __html: t("goalProgress", { progress: goalProgress, total: summary.activeStudents }),
                  }}
                />
              </div>
              {levels.length > 0 && (
                <div className="mx-auto w-full max-w-[160px]">
                  <LevelDonutChart data={levels} size={150} />
                </div>
              )}
            </div>
          </ExpandableSection>

          <ExpandableSection
            title={t("secAttendance")}
            icon={<GraduationCap className="h-4 w-4" />}
            stats={[
              { label: t("statLast30"), value: `${summary.attendanceRate}%`, tone: "success" },
            ]}
            rightAccessory={
              <Link
                href="/admin/attendance"
                className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-foreground"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            }
          >
            {attendance.every((p) => p.asistencia === 0) ? (
              <EmptyState
                icon={<Sparkles className="h-5 w-5" />}
                title={t("noAttendance")}
                description={t("noAttendanceDesc")}
              />
            ) : (
              <AttendanceBarChart data={attendance} />
            )}
          </ExpandableSection>

          <ExpandableSection
            title={t("secLeads")}
            icon={<PhoneCall className="h-4 w-4" />}
            stats={[
              { label: t("statThisWeek"), value: summary.newLeadsThisWeek, tone: "primary" },
            ]}
            rightAccessory={
              <Link
                href="/admin/leads"
                className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-foreground"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            }
          />

          <ExpandableSection
            title={t("secPrivate")}
            icon={<Sparkles className="h-4 w-4" />}
            stats={[
              { label: t("statThisMonth"), value: summary.privateLessonsThisMonth, tone: "info" },
              { label: t("statGenerated"), value: formatMoney(summary.privateLessonsRevenue), tone: "success" },
            ]}
            rightAccessory={
              <Link
                href="/admin/private-lessons"
                className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-foreground"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            }
          />
        </div>

        <div className="flex flex-col gap-3 sm:gap-4">
          <ExpandableSection
            title={t("secPayments")}
            icon={<CreditCard className="h-4 w-4" />}
            defaultExpanded
            stats={[
              { label: t("statPending"), value: formatMoney(summary.pendingPaymentsAmount), tone: "warning" },
              { label: t("statReceipts"), value: summary.pendingPaymentsCount },
              ...(revenueDelta !== null
                ? [{
                    label: t("statVsPrev"),
                    value: `${revenueDelta >= 0 ? "+" : ""}${revenueDelta}%`,
                    tone: (revenueDelta >= 0 ? "success" : "danger") as "success" | "danger",
                  }]
                : []),
            ]}
            rightAccessory={
              <Link
                href="/admin/payments"
                className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-foreground"
                aria-label={t("viewPaymentsAria")}
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            }
          >
            {summary.duePayments.length === 0 ? (
              <EmptyState
                icon={<CreditCard className="h-5 w-5" />}
                title={t("noPayments")}
                description={t("noPaymentsDesc")}
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {summary.duePayments.slice(0, 5).map((p) => (
                  <li
                    key={p.id}
                    className={`flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0${
                      p.status === "atrasado"
                        ? " -mx-2 rounded-lg bg-[var(--danger-soft)]/50 px-2"
                        : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold">{p.studentName}</p>
                      <p className="truncate text-[11.5px] text-[var(--muted)]">
                        {p.concept} · {t("concept", { date: formatShortDate(p.dueDate) })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold">{formatMoney(p.amount, true)}</span>
                      <Badge tone={p.status === "atrasado" ? "danger" : "warning"}>
                        {p.status === "atrasado" ? t("dueOverdue") : t("duePending")}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ExpandableSection>

          <ExpandableSection
            title={t("secRevenue")}
            icon={<TrendingUp className="h-4 w-4" />}
            stats={[
              { label: t("statThisMonth"), value: formatMoney(summary.monthRevenue), tone: "primary" },
            ]}
            rightAccessory={
              <Link
                href="/admin/payments"
                className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-foreground"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            }
          >
            {revenue.every((p) => p.ingresos === 0 && p.particulares === 0) ? (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title={t("noRevenue")}
                description={t("noRevenueDesc")}
              />
            ) : (
              <RevenueAreaChart data={revenue} />
            )}
          </ExpandableSection>

          <ExpandableSection
            title={t("secCalendar")}
            icon={<CalendarClock className="h-4 w-4" />}
            defaultExpanded
            stats={[
              { label: t("statUpcoming14d"), value: summary.upcomingClassesCount },
            ]}
            rightAccessory={
              <Link
                href="/admin/calendar"
                className="grid h-7 w-7 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-foreground"
                aria-label={t("viewCalendarAria")}
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            }
          >
            {summary.upcomingClasses.length === 0 ? (
              <EmptyState
                icon={<CalendarClock className="h-5 w-5" />}
                title={t("noClasses")}
                description={t("noClassesDesc")}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {summary.upcomingClasses.slice(0, 5).map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold">{session.title}</p>
                      <p className="truncate text-[11.5px] text-[var(--muted)]">
                        {session.groupName || t("noGroup")} · {formatLongDate(session.date)}
                      </p>
                    </div>
                    <Badge tone="primary">
                      {session.startTime} – {session.endTime}
                    </Badge>
                  </li>
                ))}
                <li>
                  <Link
                    href="/admin/calendar"
                    className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--primary)] hover:underline"
                  >
                    {t("viewCalendar")}
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </li>
              </ul>
            )}
          </ExpandableSection>
        </div>
      </div>

      <Card>
        <CardHeader title={t("quickActions")} />
        <CardBody className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <ActionRow icon={<UserPlus className="h-4 w-4" />} label={t("act.createStudent")} href="/admin/students" highlight />
          <ActionRow icon={<UserCheck className="h-4 w-4" />} label={t("act.reviewRegistrations")} href="/admin/registrations" />
          <ActionRow icon={<Medal className="h-4 w-4" />} label={t("act.awardMedal")} href="/admin/medals" />
          <ActionRow icon={<BellRing className="h-4 w-4" />} label={t("act.paymentReminder")} href="/admin/payments" />
          <ActionRow icon={<ImageIcon className="h-4 w-4" />} label={t("act.uploadPhotos")} href="/admin/gallery" />
          <ActionRow icon={<Trophy className="h-4 w-4" />} label={t("act.scheduleCamp")} href="/admin/campus" />
          <ActionRow icon={<Users className="h-4 w-4" />} label={t("act.takeAttendance")} href="/admin/attendance" />
        </CardBody>
      </Card>
    </PageShell>
  );
}
