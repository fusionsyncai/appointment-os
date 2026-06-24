"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings as SettingsIcon,
  User as UserIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Topbar({
  onMenuClick,
  user,
}: {
  onMenuClick: () => void;
  user: { name?: string | null; email?: string | null; role?: string };
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:px-6">
      <button type="button" onClick={onMenuClick} className="text-muted-foreground hover:text-foreground lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative max-w-md flex-1">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search customers, appointments..."
          className="h-9 border-transparent bg-muted/50 pl-9 focus-visible:bg-background"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary" />
        </Button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-1.5 transition-colors hover:bg-muted/50"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {user.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs leading-tight font-semibold text-foreground">{user.name || "User"}</p>
              <p className="text-[10px] leading-tight text-muted-foreground capitalize">{user.role?.toLowerCase() || "admin"}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-full mt-2 w-52 origin-top-right rounded-xl border border-border bg-popover py-1.5 shadow-lg">
              <div className="mb-1 border-b border-border px-3 py-2">
                <p className="truncate text-sm font-semibold text-foreground">{user.email || ""}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{user.role?.toLowerCase() || "admin"}</p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted/50"
              >
                <SettingsIcon className="h-4 w-4 text-muted-foreground" /> Settings
              </button>
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted/50"
              >
                <UserIcon className="h-4 w-4 text-muted-foreground" /> Profile
              </button>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/5"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
