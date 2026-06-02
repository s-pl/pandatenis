import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Images } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/admin/page-shell";
import { GalleryManager } from "@/components/admin/gallery/gallery-manager";
import { requireAdmin } from "@/lib/dal";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.breadcrumbs");
  return { title: t("gallery") };
}
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const { supabase } = await requireAdmin();
  const tPage = await getTranslations("admin.pages.gallery");

  const [assetsRes, studentsRes] = await Promise.all([
    supabase
      .from("media_assets")
      .select("id, type, storage_path, title, uploaded_at, consent_checked, student_id, students(first_name, last_name)")
      .order("uploaded_at", { ascending: false })
      .limit(60),
    supabase
      .from("students")
      .select("id, first_name, last_name, image_consent, active")
      .eq("active", true)
      .order("first_name"),
  ]);

  const assets = await Promise.all(
    (assetsRes.data ?? []).map(async (row) => {
      const student = Array.isArray(row.students) ? row.students[0] : row.students;
      let url = row.storage_path;
      if (!row.storage_path.startsWith("http")) {
        const { data: signed } = await supabase.storage
          .from("student-media")
          .createSignedUrl(row.storage_path, 3600);
        if (signed?.signedUrl) url = signed.signedUrl;
      }
      return {
        id: row.id,
        studentId: row.student_id,
        type: row.type as "foto" | "video",
        title: row.title,
        url,
        storagePath: row.storage_path,
        uploadedAt: row.uploaded_at,
        consentChecked: row.consent_checked,
        studentName: student ? `${student.first_name} ${student.last_name}` : "—",
      };
    }),
  );

  const students = (studentsRes.data ?? []).map((row) => ({
    id: row.id,
    fullName: `${row.first_name} ${row.last_name}`,
    imageConsent: row.image_consent,
  }));

  return (
    <PageShell
      variant="tinted"
      title={tPage("title")}
      description={tPage("description")}
      meta={<Badge tone="primary" iconLeft={<Images className="h-3 w-3" />}>{assets.length} archivos</Badge>}
    >
      <GalleryManager assets={assets} students={students} />
    </PageShell>
  );
}
