import type { ReactNode } from "react";

// El chat ocupa todo el viewport (descontando el sidebar fijo en desktop).
// Lo sacamos del flujo del AdminLayout para evitar su padding/max-width.
// El sidebar de admin sigue siendo accesible porque tiene posición fija + z-30.
// En móvil dejamos hueco abajo para que el composer no quede tapado por la
// barra de navegación inferior (MobileNav).
export default function ChatPhoneLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 top-0 bottom-16 z-10 flex flex-col bg-[var(--background)] lg:bottom-0 lg:left-60">
      {children}
    </div>
  );
}
