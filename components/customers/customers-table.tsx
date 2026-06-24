"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  CustomerFormDialog,
  type CustomerFormValues,
} from "@/components/customers/customer-form-dialog";
import { EmptyState } from "@/components/empty-state";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { formatDate, fullName } from "@/lib/utils";

type CustomerRow = CustomerFormValues & {
  lastActivityDate: string | null;
  createdAt: string;
  _count: { appointments: number };
};

const PAGE_SIZE = 10;

type CustomersTableProps = {
  customerCount: number;
};

export function CustomersTable({ customerCount }: CustomersTableProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/customers")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch customers");
        }
        return response.json() as Promise<CustomerRow[]>;
      })
      .then((data) => setCustomers(data))
      .catch(() => toast.error("Failed to load customers"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter((customer) => {
      const name = fullName(customer.firstName, customer.lastName).toLowerCase();
      return (
        name.includes(q) ||
        customer.email.toLowerCase().includes(q) ||
        customer.companyName?.toLowerCase().includes(q)
      );
    });
  }, [customers, search]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const getLastActivity = (customer: CustomerRow) =>
    customer.lastActivityDate || customer.createdAt;

  const refreshCustomers = () => {
    fetch("/api/customers")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch customers");
        }
        return response.json() as Promise<CustomerRow[]>;
      })
      .then((data) => setCustomers(data))
      .catch(() => toast.error("Failed to load customers"));
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const response = await fetch(`/api/customers/${deleteId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete");
      }
      setCustomers((prev) => prev.filter((c) => c.id !== deleteId));
      toast.success("Customer deleted");
    } catch {
      toast.error("Failed to delete customer");
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {customerCount} customer{customerCount === 1 ? "" : "s"} in your workspace
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or company..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="h-9 pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-4">
            <EmptyState
              icon={Users}
              title="No customers found"
              description={
                search
                  ? "Try adjusting your search."
                  : "Add your first customer to get started."
              }
            />
            {!search && (
              <div className="flex justify-center pb-8">
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Customer
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Name
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground md:table-cell">
                    Company
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground lg:table-cell">
                    Email
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground xl:table-cell">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Total Meetings
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">
                    Last Activity
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {paginated.map((customer) => {
                  const name = fullName(customer.firstName, customer.lastName);
                  return (
                    <tr
                      key={customer.id}
                      className="group cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                      onClick={() => router.push(`/customers/${customer.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {customer.firstName[0]}
                            {customer.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{name}</p>
                            <p className="text-xs text-muted-foreground md:hidden">
                              {customer.companyName || customer.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span className="text-sm text-foreground">
                          {customer.companyName || "—"}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className="text-sm text-muted-foreground">{customer.email}</span>
                      </td>
                      <td className="hidden px-4 py-3 xl:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {customer.phone || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex min-w-[28px] items-center justify-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {customer._count.appointments}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(getLastActivity(customer))}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/customers/${customer.id}`)}
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditing(customer);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(customer.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–
              {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount - 1}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editing}
        onSuccess={() => refreshCustomers()}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the customer and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
