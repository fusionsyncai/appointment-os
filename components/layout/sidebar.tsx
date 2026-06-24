"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  Plug,
  Settings as SettingsIcon,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Appointments", href: "/appointments", icon: CalendarDays },
  { label: "Integrations", href: "/integrations", icon: Plug },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
];

export function Sidebar({
  agencyName,
  open,
  onClose,
}: {
  agencyName: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {open ? <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} /> : null}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar-background transition-transform duration-300 lg:sticky",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">A</span>
            </div>
            <div>
              <p className="text-sm leading-tight font-semibold text-foreground">{agencyName}</p>
              <p className="text-[11px] leading-tight text-muted-foreground">Workspace</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Menu
          </p>
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
