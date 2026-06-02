import { redirect } from "next/navigation";

type Params = { locale: string; slug: string };

export default async function CampusInscripcionRedirect({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, slug } = await params;
  redirect(`/${locale}/inscripcion?tipo=campus&campus=${encodeURIComponent(slug)}`);
}
