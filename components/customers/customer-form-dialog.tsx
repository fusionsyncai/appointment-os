"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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

export type CustomerFormValues = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  companyName?: string | null;
  notes?: string | null;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  notes: string;
};

const emptyForm: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  companyName: "",
  notes: "",
};

type CustomerFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: CustomerFormValues | null;
  onSuccess?: (customer: CustomerFormValues) => void;
};

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSuccess,
}: CustomerFormDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      if (customer) {
        setForm({
          firstName: customer.firstName || "",
          lastName: customer.lastName || "",
          email: customer.email || "",
          phone: customer.phone || "",
          companyName: customer.companyName || "",
          notes: customer.notes || "",
        });
      } else {
        setForm(emptyForm);
      }
    }
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        companyName: form.companyName || undefined,
        notes: form.notes || undefined,
      };

      const response = customer
        ? await fetch(`/api/customers/${customer.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/customers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!response.ok) {
        throw new Error("Failed to save customer");
      }

      const saved = (await response.json()) as CustomerFormValues;
      toast.success(customer ? "Customer updated successfully" : "Customer created successfully");
      onSuccess?.(saved);
      onOpenChange(false);
    } catch {
      toast.error("Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit Customer" : "New Customer"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">First Name *</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="John"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last Name *</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Doe"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="john@company.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 555 0000"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Company</Label>
              <Input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="Acme Inc."
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Additional notes..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {customer ? "Save Changes" : "Create Customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
