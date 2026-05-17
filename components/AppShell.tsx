"use client";

import { usePathname } from "next/navigation";
import BrowserHost from "@/components/BrowserHost";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBrowserPage = pathname === "/browser";

  return (
    <div className="h-[100dvh] min-h-0 w-full overflow-hidden relative bg-background">
      <div
        className={[
          "absolute inset-0 min-h-0",
          isBrowserPage
            ? "opacity-100 pointer-events-auto z-10"
            : "opacity-0 pointer-events-none z-0",
        ].join(" ")}
      >
        <BrowserHost />
      </div>

      <div
        className={[
          "absolute inset-0 min-h-0",
          isBrowserPage
            ? "opacity-0 pointer-events-none z-0"
            : "opacity-100 pointer-events-auto z-10",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
