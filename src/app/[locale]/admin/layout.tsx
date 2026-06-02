import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTopbar } from "@/components/admin/topbar";
import { MobileNav } from "@/components/admin/mobile-nav";
import { PageTransition } from "@/components/admin/page-transition";
import { WhatsappNotificationsProvider } from "@/components/admin/whatsapp/notifications-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { CommandPaletteProvider } from "@/components/admin/command-palette";
import { requireStaff } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireStaff();
  const shell = (
    <div className="min-h-screen bg-[var(--background)]">
      <AdminSidebar fullName={profile.fullName} email={profile.email} role={profile.role} />
      <AdminTopbar fullName={profile.fullName} email={profile.email} role={profile.role} />
      <main
        className="min-h-screen lg:pl-60"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* Content. Bottom padding accounts for the mobile nav bar. */}
        <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-14 sm:px-6 sm:pt-16 lg:px-8 lg:pb-16 lg:pt-[4.5rem]">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
      <MobileNav role={profile.role} />
    </div>
  );

  return (
    <ThemeProvider>
      <CommandPaletteProvider role={profile.role}>
        {profile.role !== "admin" ? (
          shell
        ) : (
          <WhatsappNotificationsProvider>{shell}</WhatsappNotificationsProvider>
        )}
      </CommandPaletteProvider>
    </ThemeProvider>
  );
}
