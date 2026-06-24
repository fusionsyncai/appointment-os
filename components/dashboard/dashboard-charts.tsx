"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function DashboardCharts({
  monthlyAppointments,
  monthlyCustomers,
}: {
  monthlyAppointments: { month: string; appointments: number }[];
  monthlyCustomers: { month: string; customers: number }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">Appointments by Month</h3>
          <p className="text-xs text-muted-foreground">Last 6 months</p>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyAppointments}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="appointments" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">New Customers by Month</h3>
          <p className="text-xs text-muted-foreground">Last 6 months</p>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={monthlyCustomers}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey="customers" stroke="hsl(var(--chart-2))" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
