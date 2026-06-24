"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatTime, fullName, getDuration } from "@/lib/utils";

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
};

type Appointment = {
  id: string;
  customerId: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  customer: Customer;
};

export function AppointmentsView() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [sortBy, setSortBy] = useState("upcoming");

  useEffect(() => {
    Promise.all([fetch("/api/appointments"), fetch("/api/customers")])
      .then(async ([appointmentsRes, customersRes]) => {
        const [appointmentsData, customersData] = await Promise.all([
          appointmentsRes.json(),
          customersRes.json(),
        ]);
        setAppointments(appointmentsData);
        setCustomers(customersData);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      today: appointments.filter(
        (a) =>
          new Date(a.startTime).toDateString() === now.toDateString() &&
          a.status !== "CANCELLED",
      ).length,
      thisWeek: appointments.filter((a) => {
        const d = new Date(a.startTime);
        return d >= weekStart && d < weekEnd && a.status !== "CANCELLED";
      }).length,
      thisMonth: appointments.filter((a) => {
        const d = new Date(a.startTime);
        return d >= monthStart && a.status !== "CANCELLED";
      }).length,
      totalCustomers: customers.length,
      avgPerCustomer:
        customers.length > 0
          ? (appointments.length / customers.length).toFixed(1)
          : "0",
    };
  }, [appointments, customers]);

  const filtered = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    let result = [...appointments];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) => {
        const customerName = fullName(a.customer.firstName, a.customer.lastName);
        return (
          a.title.toLowerCase().includes(q) ||
          customerName.toLowerCase().includes(q)
        );
      });
    }

    if (customerFilter !== "all") {
      result = result.filter((a) => a.customerId === customerFilter);
    }

    if (dateFilter === "upcoming") {
      result = result.filter((a) => new Date(a.startTime) >= now);
    } else if (dateFilter === "past") {
      result = result.filter((a) => new Date(a.startTime) < now);
    } else if (dateFilter === "today") {
      result = result.filter(
        (a) => new Date(a.startTime).toDateString() === now.toDateString(),
      );
    } else if (dateFilter === "this_week") {
      result = result.filter((a) => {
        const d = new Date(a.startTime);
        return d >= weekStart && d < weekEnd;
      });
    }

    if (sortBy === "upcoming") {
      result.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
    } else if (sortBy === "recent") {
      result.sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      );
    } else if (sortBy === "customer") {
      result.sort((a, b) =>
        fullName(a.customer.firstName, a.customer.lastName).localeCompare(
          fullName(b.customer.firstName, b.customer.lastName),
        ),
      );
    }

    return result;
  }, [appointments, customerFilter, dateFilter, search, sortBy]);

  const upcoming10 = useMemo(() => {
    const now = new Date();
    return appointments
      .filter(
        (a) => new Date(a.startTime) >= now && a.status === "SCHEDULED",
      )
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      )
      .slice(0, 10);
  }, [appointments]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Appointments
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage and track all your scheduled meetings
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                </SelectContent>
              </Select>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.slice(0, 50).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {fullName(c.firstName, c.lastName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Sort: Upcoming</SelectItem>
                  <SelectItem value="recent">Sort: Recent</SelectItem>
                  <SelectItem value="customer">Sort: Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {filtered.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No appointments found"
                description="Try adjusting your filters or sync your calendar."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Meeting Title
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">
                        Date
                      </th>
                      <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell">
                        Duration
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => {
                      const customerName = fullName(
                        a.customer.firstName,
                        a.customer.lastName,
                      );
                      return (
                        <tr
                          key={a.id}
                          className="border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                                {customerName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)}
                              </div>
                              <span className="text-sm font-medium text-foreground">
                                {customerName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-foreground">{a.title}</span>
                          </td>
                          <td className="hidden px-4 py-3 sm:table-cell">
                            <div>
                              <p className="text-sm text-foreground">
                                {formatDate(a.startTime, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatTime(a.startTime)}
                              </p>
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 md:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {getDuration(a.startTime, a.endTime)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={a.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Upcoming Meetings
              </h3>
            </div>
            {upcoming10.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No upcoming meetings
              </p>
            ) : (
              <div className="space-y-2">
                {upcoming10.map((a) => {
                  const customerName = fullName(
                    a.customer.firstName,
                    a.customer.lastName,
                  );
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex h-[44px] min-w-[44px] flex-col items-center justify-center rounded-lg border border-primary/15 bg-primary/8">
                        <span className="text-[10px] font-medium uppercase text-primary">
                          {formatDate(a.startTime, { month: "short" })}
                        </span>
                        <span className="text-sm font-bold leading-none text-primary">
                          {new Date(a.startTime).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">
                          {a.title}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {customerName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatTime(a.startTime)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Analytics</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                    <CalendarDays className="h-4 w-4 text-blue-500" />
                  </div>
                  <span className="text-sm text-foreground">Today</span>
                </div>
                <span className="text-lg font-bold text-foreground">{stats.today}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                    <CalendarRange className="h-4 w-4 text-violet-500" />
                  </div>
                  <span className="text-sm text-foreground">This Week</span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {stats.thisWeek}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                    <CalendarCheck className="h-4 w-4 text-emerald-500" />
                  </div>
                  <span className="text-sm text-foreground">This Month</span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {stats.thisMonth}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                    <Users className="h-4 w-4 text-orange-500" />
                  </div>
                  <span className="text-sm text-foreground">Total Customers</span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {stats.totalCustomers}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">Avg / Customer</span>
                </div>
                <span className="text-lg font-bold text-foreground">
                  {stats.avgPerCustomer}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
