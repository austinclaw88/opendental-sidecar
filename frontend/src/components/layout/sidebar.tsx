"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Stethoscope, Calendar, Syringe, FileText, Search } from "lucide-react";

const navItems = [
  { href: "/", label: "Patient Search", icon: Search },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/procedures", label: "Procedures", icon: Syringe },
  { href: "/claims", label: "Claims", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r bg-card">
      <div className="flex items-center gap-3 border-b px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Stethoscope className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold leading-tight">Sidecar</h1>
          <p className="text-xs text-muted-foreground">OpenDental Viewer</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-6 py-4">
        <p className="text-[11px] text-muted-foreground">
          Phase 1 · Read-Only
        </p>
      </div>
    </aside>
  );
}
