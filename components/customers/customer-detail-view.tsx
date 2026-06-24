"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarX,
  Clock,
  Loader2,
  Mail,
  Phone,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import {
  CustomerFormDialog,
  type CustomerFormValues,
} from "@/components/customers/customer-form-dialog";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatTime, fullName, getDuration } from "@/lib/utils";

type Appointment = {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  status: string;
  meetingLink: string | null;
};

type CustomerDetail = CustomerFormValues & {
  lastActivityDate: string | null;
  createdAt: string;
  appointments: Appointment[];
};

type AppointmentForm = {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  meetingLink: string;
};

function defaultAppointmentForm(): AppointmentForm {
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  const fmt = (date: Date) => {
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 16);
  };
  return {
    title: "",
    description: "",
    startTime: fmt(now),
    endTime: fmt(later),
    meetingLink: "",
  };
}

export function CustomerDetailView({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [aptOpen, setAptOpen] = useState(false);
  const [aptForm, setAptForm] = useState<AppointmentForm>(defaultAppointmentForm);
  const [savingApt, setSavingApt] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/customers/${customerId}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Not found");
        }
        return response.json() as Promise<CustomerDetail>;
      })
      .then((data) => setCustomer(data))
      .catch(() => {
        toast.error("Customer not found");
        router.push("/customers");
      })
      .finally(() => setLoading(false));
  }, [customerId, router]);

  const refreshCustomer = () => {
    fetch(`/api/customers/${customerId}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Not found");
        }
        return response.json() as Promise<CustomerDetail>;
      })
      .then((data) => setCustomer(data))
      .catch(() => toast.error("Failed to refresh customer"));
  };

  const openAppointmentDialog = () => {
    setAptForm(defaultAppointmentForm());
    setAptOpen(true);
  };

  const upcoming = useMemo(() => {
    if (!customer) return [];
    const now = new Date();
    return customer.appointments.filter(
      (a) =>
        new Date(a.startTime) >= now &&
        a.status !== "CANCELLED" &&
        a.status !== "COMPLETED",
    );
  }, [customer]);

  const past = useMemo(() => {
    if (!customer) return [];
    const now = new Date();
    return customer.appointments
      .filter((a) => new Date(a.startTime) < now || a.status === "COMPLETED")
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [customer]);

  const lastInteraction = useMemo(() => {
    if (!customer) return "";
    if (customer.appointments.length === 0) {
      return customer.lastActivityDate || customer.createdAt;
    }
    const latest = [...customer.appointments].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    )[0];
    return latest.startTime;
  }, [customer]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete");
      }
      toast.success("Customer deleted");
      router.push("/customers");
    } catch {
      toast.error("Failed to delete customer");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleCreateAppointment = async () => {
    if (!aptForm.title || !aptForm.startTime || !aptForm.endTime) {
      toast.error("Please fill in title and times");
      return;
    }

    setSavingApt(true);
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          title: aptForm.title,
          description: aptForm.description || undefined,
          startTime: new Date(aptForm.startTime).toISOString(),
          endTime: new Date(aptForm.endTime).toISOString(),
          meetingLink: aptForm.meetingLink || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create appointment");
      }

      toast.success("Appointment created");
      setAptOpen(false);
      refreshCustomer();
    } catch {
      toast.error("Failed to create appointment");
    } finally {
      setSavingApt(false);
    }
  };

  if (loading || !customer) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const name = fullName(customer.firstName, customer.lastName);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="h-9 w-9 rounded-lg"
        >
          <Link href="/customers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{name}</h1>
          <p className="text-sm text-muted-foreground">
            {customer.companyName || "No company"}
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button
          variant="outline"
          className="text-destructive hover:bg-destructive/5"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Contact Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Email</p>
                  <p className="text-sm text-foreground">{customer.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Phone</p>
                  <p className="text-sm text-foreground">{customer.phone || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Company</p>
                  <p className="text-sm text-foreground">{customer.companyName || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Last Interaction</p>
                  <p className="text-sm text-foreground">{formatDate(lastInteraction)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Notes</h3>
            </div>
            {customer.notes ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {customer.notes}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">No notes yet.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {customer.appointments.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Total Meetings</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{upcoming.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Upcoming</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Upcoming Meetings</h3>
              </div>
              <Button size="sm" onClick={openAppointmentDialog}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add
              </Button>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="No upcoming meetings"
                description="Schedule a new appointment with this customer."
              />
            ) : (
              <div className="space-y-2">
                {upcoming.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-3 rounded-xl bg-muted/30 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {appointment.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(appointment.startTime)} at{" "}
                        {formatTime(appointment.startTime)} ·{" "}
                        {getDuration(appointment.startTime, appointment.endTime)}
                      </p>
                    </div>
                    <StatusBadge status={appointment.status} />
                    {appointment.meetingLink && (
                      <a
                        href={appointment.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Video className="h-4 w-4 text-primary" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <CalendarX className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Appointment History</h3>
            </div>
            {past.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No past appointments"
                description="Past meetings will appear here."
              />
            ) : (
              <div className="space-y-2">
                {past.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {appointment.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(appointment.startTime)} ·{" "}
                        {getDuration(appointment.startTime, appointment.endTime)}
                      </p>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CustomerFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={customer}
        onSuccess={() => refreshCustomer()}
      />

      <Dialog open={aptOpen} onOpenChange={setAptOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>New Appointment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Customer</Label>
              <Input value={name} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input
                value={aptForm.title}
                onChange={(e) => setAptForm({ ...aptForm, title: e.target.value })}
                placeholder="Strategy call"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start *</Label>
                <Input
                  type="datetime-local"
                  value={aptForm.startTime}
                  onChange={(e) => setAptForm({ ...aptForm, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End *</Label>
                <Input
                  type="datetime-local"
                  value={aptForm.endTime}
                  onChange={(e) => setAptForm({ ...aptForm, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Meeting Link</Label>
              <Input
                value={aptForm.meetingLink}
                onChange={(e) => setAptForm({ ...aptForm, meetingLink: e.target.value })}
                placeholder="https://meet.google.com/..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={2}
                value={aptForm.description}
                onChange={(e) => setAptForm({ ...aptForm, description: e.target.value })}
                placeholder="Agenda or notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAptOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAppointment} disabled={savingApt}>
              {savingApt && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {name} and all associated data. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
