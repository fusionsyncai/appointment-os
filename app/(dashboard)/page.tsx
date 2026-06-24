import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Plug,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";

import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { getAgencyDashboardData } from "@/lib/data";
import { getSessionUser } from "@/lib/session";
import { formatDate, formatTime } from "@/lib/utils";

const activityIcons = {
  CUSTOMER_CREATED: { icon: UserPlus, color: "text-blue-500 bg-blue-500/10" },
  MEETING_BOOKED: { icon: CalendarCheck, color: "text-emerald-500 bg-emerald-500/10" },
  MEETING_CANCELLED: { icon: XCircle, color: "text-red-500 bg-red-500/10" },
  INTEGRATION_CONNECTED: { icon: Plug, color: "text-violet-500 bg-violet-500/10" },
  INTEGRATION_DISCONNECTED: { icon: Plug, color: "text-orange-500 bg-orange-500/10" },
} as const;

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { customers, appointments, activities } = await getAgencyDashboardData(user.agencyId);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const upcoming = appointments.filter(
    (item) => new Date(item.startTime) >= now && item.status === "SCHEDULED",
  );
  const thisWeek = appointments.filter((item) => {
    const date = new Date(item.startTime);
    return date >= weekStart && date < weekEnd && item.status !== "CANCELLED";
  });
  const today = appointments.filter((item) => {
    const date = new Date(item.startTime);
    return date.toDateString() === now.toDateString() && item.status !== "CANCELLED";
  });

  const monthlyAppointments = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const next = new Date(now.getFullYear(), now.getMonth() - (4 - index), 1);
    const count = appointments.filter((item) => {
      const date = new Date(item.startTime);
      return date >= month && date < next;
    }).length;
    return { month: month.toLocaleString("default", { month: "short" }), appointments: count };
  });

  const monthlyCustomers = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const next = new Date(now.getFullYear(), now.getMonth() - (4 - index), 1);
    const count = customers.filter((item) => {
      const date = new Date(item.createdAt);
      return date >= month && date < next;
    }).length;
    return { month: month.toLocaleString("default", { month: "short" }), customers: count };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back — here&apos;s what&apos;s happening at your agency.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Users} label="Total Customers" value={customers.length} accent="primary" />
        <KpiCard icon={CalendarDays} label="Total Appointments" value={appointments.length} accent="violet" />
        <KpiCard icon={CalendarCheck} label="Upcoming" value={upcoming.length} trendLabel="Scheduled meetings" accent="emerald" />
        <KpiCard icon={CalendarRange} label="This Week" value={thisWeek.length} trendLabel={`${today.length} today`} accent="orange" />
      </div>

      <DashboardCharts monthlyAppointments={monthlyAppointments} monthlyCustomers={monthlyCustomers} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Upcoming Meetings</h3>
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No upcoming meetings" description="Your scheduled appointments will appear here." />
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 5).map((appointment) => (
                <Link
                  key={appointment.id}
                  href={`/customers/${appointment.customerId}`}
                  className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <CalendarCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{appointment.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {appointment.customer.firstName} {appointment.customer.lastName}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium text-foreground">{formatDate(appointment.startTime, { month: "short", day: "numeric" })}</p>
                    <p className="text-[11px] text-muted-foreground">{formatTime(appointment.startTime)}</p>
                  </div>
                  <StatusBadge status={appointment.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Recent Activity</h3>
          {activities.length === 0 ? (
            <EmptyState icon={Users} title="No activity yet" description="Actions will appear here as they happen." />
          ) : (
            <div className="space-y-3">
              {activities.slice(0, 8).map((activity) => {
                const config = activityIcons[activity.type];
                const Icon = config.icon;
                return (
                  <div key={activity.id} className="flex gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-snug text-foreground">{activity.description}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatDate(activity.createdAt, { month: "short", day: "numeric" })} · {formatTime(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
