import type { ReactNode } from "react";
import { WebNavbar } from "@/components/web/navbar";
import { WebFooter } from "@/components/web/footer";
import { WebMotionLayer } from "@/components/web/site-motion";

export default function WebLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <WebNavbar />
      <WebMotionLayer />
      <main>{children}</main>
      <WebFooter />
    </>
  );
}
