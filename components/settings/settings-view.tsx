"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Crown,
  Loader2,
  Shield,
  Trash2,
  User as UserIcon,
  UserPlus,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
};

type Agency = {
  name: string;
  timezone: string;
  logoUrl?: string | null;
};

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function SettingsView() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const currentUserId = session?.user?.id;

  const [agencyName, setAgencyName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [logoUrl, setLogoUrl] = useState("");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");

  const loadTeam = () =>
    fetch("/api/settings/team")
      .then((res) => res.json())
      .then(setTeam);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/agency").then((res) => res.json()),
      fetch("/api/settings/team").then((res) => res.json()),
    ])
      .then(([agency, teamData]: [Agency, TeamMember[]]) => {
        setAgencyName(agency.name || "");
        setTimezone(agency.timezone || "UTC");
        setLogoUrl(agency.logoUrl || "");
        setTeam(teamData);
      })
      .finally(() => setLoading(false));
  }, []);

  const saveAgency = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/agency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agencyName,
          timezone,
          logoUrl: logoUrl || "",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
      toast.success("Agency settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const inviteUser = async () => {
    if (!isAdmin) return;
    if (!inviteEmail || !inviteName || !invitePassword) {
      toast.error("Name, email, and password are required");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/settings/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
          password: invitePassword,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to invite");
      }
      toast.success(`Team member ${inviteEmail} added`);
      setInviteName("");
      setInviteEmail("");
      setInvitePassword("");
      await loadTeam();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const updateRole = async (userId: string, role: "ADMIN" | "MEMBER") => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/settings/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update role");
      }
      toast.success("Role updated");
      await loadTeam();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const removeUser = async () => {
    if (!removeId) return;
    try {
      const res = await fetch(`/api/settings/team?userId=${removeId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove user");
      }
      toast.success("User removed");
      await loadTeam();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove user");
    } finally {
      setRemoveId(null);
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your agency and team
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Agency Settings</h3>
            <p className="text-xs text-muted-foreground">Configure your agency details</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Agency Name</Label>
              <Input
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="My Agency"
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Timezone</Label>
              <Select
                value={timezone}
                onValueChange={setTimezone}
                disabled={!isAdmin}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Logo URL</Label>
            <Input
              placeholder="https://example.com/logo.png"
              className="bg-muted/30"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              disabled={!isAdmin}
            />
            <p className="text-[11px] text-muted-foreground">
              URL to your agency logo image
            </p>
          </div>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">
              Only admins can update agency settings.
            </p>
          )}
          {isAdmin && (
            <Button onClick={saveAgency} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Team Members</h3>
              <p className="text-xs text-muted-foreground">
                {team.length} members in your workspace
              </p>
            </div>
          </div>
        </div>

        {!isAdmin ? (
          <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-4">
            <Shield className="h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Only admins can invite, manage roles, or remove team members.
            </p>
          </div>
        ) : (
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl bg-muted/30 p-3">
            <Input
              placeholder="Full name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="h-9 min-w-[120px] flex-1"
            />
            <Input
              type="email"
              placeholder="colleague@agency.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="h-9 min-w-[160px] flex-1"
            />
            <Input
              type="password"
              placeholder="Temp password"
              value={invitePassword}
              onChange={(e) => setInvitePassword(e.target.value)}
              className="h-9 min-w-[120px] flex-1"
            />
            <Select
              value={inviteRole}
              onValueChange={(v) => setInviteRole(v as "ADMIN" | "MEMBER")}
            >
              <SelectTrigger className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="MEMBER">Member</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={inviteUser} disabled={inviting}>
              {inviting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Invite
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {team.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted/30"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {member.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {member.name || "Unknown"}
                  </p>
                  {member.id === currentUserId && (
                    <span className="text-[10px] text-muted-foreground">(You)</span>
                  )}
                  {member.role === "ADMIN" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-400">
                      <Crown className="h-2.5 w-2.5" /> Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <UserIcon className="h-2.5 w-2.5" /> Member
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              </div>
              {isAdmin && member.id !== currentUserId && (
                <>
                  <Select
                    value={member.role}
                    onValueChange={(r) =>
                      updateRole(member.id, r as "ADMIN" | "MEMBER")
                    }
                  >
                    <SelectTrigger className="h-8 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="MEMBER">Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/5"
                    onClick={() => setRemoveId(member.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {team.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No team members yet. Invite your first team member above.
            </p>
          )}
        </div>
      </div>

      <AlertDialog open={!!removeId} onOpenChange={(open) => !open && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke their access to the workspace. They can be re-invited
              later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeUser}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
