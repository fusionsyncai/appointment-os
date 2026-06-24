"use client";

import { useState } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function DashboardShell({
  agencyName,
  user,
  children,
}: {
  agencyName: string;
  user: { name?: string | null; email?: string | null; role?: string };
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar agencyName={agencyName} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setSidebarOpen(true)} user={user} />
        <main className="flex-1 p-4 lg:p-6 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
