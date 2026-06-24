"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  Check,
  MessageSquare,
  Plug,
  Radio,
  RefreshCw,
  Shield,
  X,
  Zap,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SlackChannelOption = {
  id: string;
  name: string;
  isPrivate?: boolean;
};

type Integration = {
  id: string;
  provider: "GOOGLE_CALENDAR" | "SLACK";
  status: "CONNECTED" | "DISCONNECTED";
  calendarId?: string | null;
  workspaceName?: string | null;
  selectedChannel?: string | null;
  lastSyncAt?: string | null;
  totalSynced: number;
  metadata?: {
    channels?: SlackChannelOption[] | string[];
    defaultChannelName?: string;
    watchChannelId?: string;
    watchExpiration?: string;
    calendarEmail?: string;
  } | null;
};

async function postIntegration(body: Record<string, unknown>) {
  const res = await fetch("/api/integrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Request failed");
  }
  return res.json();
}

function isWatchActive(metadata: Integration["metadata"]) {
  if (!metadata?.watchExpiration || !metadata?.watchChannelId) {
    return false;
  }

  return new Date(metadata.watchExpiration).getTime() > Date.now();
}

function getSlackChannels(integration: Integration | undefined): SlackChannelOption[] {
  const channels = integration?.metadata?.channels;
  if (!channels?.length) {
    return [];
  }

  if (typeof channels[0] === "string") {
    return (channels as string[]).map((name) => ({ id: name, name }));
  }

  return channels as SlackChannelOption[];
}

function getSlackChannelLabel(integration: Integration | undefined) {
  if (integration?.metadata?.defaultChannelName) {
    return `#${integration.metadata.defaultChannelName}`;
  }

  const channel = getSlackChannels(integration).find(
    (item) => item.id === integration?.selectedChannel,
  );

  return channel ? `#${channel.name}` : integration?.selectedChannel ?? "—";
}

export function IntegrationsView() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const isAdmin = session?.user?.role === "ADMIN";

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [googleSetup, setGoogleSetup] = useState<{
    redirectUri: string;
    clientId: string | null;
  } | null>(null);
  const [slackDialogOpen, setSlackDialogOpen] = useState(false);
  const [slackToken, setSlackToken] = useState("");
  const [slackTeam, setSlackTeam] = useState<string | null>(null);
  const [slackChannels, setSlackChannels] = useState<SlackChannelOption[]>([]);
  const [slackDefaultChannel, setSlackDefaultChannel] = useState("");
  const [slackValidating, setSlackValidating] = useState(false);
  const [slackConnecting, setSlackConnecting] = useState(false);

  const refresh = useCallback(() => {
    return fetch("/api/integrations")
      .then((res) => res.json())
      .then(setIntegrations);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!isAdmin) return;

    fetch("/api/integrations/google-calendar/setup")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.redirectUri) {
          setGoogleSetup({
            redirectUri: data.redirectUri,
            clientId: data.clientId,
          });
        }
      })
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (searchParams.get("connected") === "google") {
      toast.success("Google Calendar connected and synced");
      window.history.replaceState({}, "", "/integrations");
    }

    const error = searchParams.get("error");
    if (error) {
      toast.error(decodeURIComponent(error));
      window.history.replaceState({}, "", "/integrations");
    }
  }, [searchParams]);

  const getIntegration = (provider: Integration["provider"]) =>
    integrations.find((i) => i.provider === provider);

  const connectGoogle = () => {
    if (!isAdmin) return;
    window.location.href = "/api/integrations/google-calendar/connect";
  };

  const connectSlack = () => {
    if (!isAdmin) return;
    setSlackToken("");
    setSlackTeam(null);
    setSlackChannels([]);
    setSlackDefaultChannel("");
    setSlackDialogOpen(true);
  };

  const validateSlackToken = async () => {
    if (!slackToken.trim()) {
      toast.error("Enter a Slack bot token");
      return;
    }

    setSlackValidating(true);
    try {
      const validateRes = await fetch("/api/integrations/slack/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: slackToken.trim() }),
      });
      const validateData = await validateRes.json();
      if (!validateRes.ok) {
        throw new Error(validateData.error || "Invalid Slack token");
      }

      const channelsRes = await fetch(
        `/api/integrations/slack/channels?accessToken=${encodeURIComponent(slackToken.trim())}`,
      );
      const channelsData = await channelsRes.json();
      if (!channelsRes.ok) {
        throw new Error(channelsData.error || "Failed to load channels");
      }

      setSlackTeam(validateData.team ?? "Slack Workspace");
      setSlackChannels(channelsData.channels ?? []);
      setSlackDefaultChannel(channelsData.channels?.[0]?.id ?? "");
      toast.success("Slack token validated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setSlackValidating(false);
    }
  };

  const saveSlackConnection = async () => {
    if (!slackToken.trim() || !slackDefaultChannel) {
      toast.error("Validate your token and choose a default channel");
      return;
    }

    setSlackConnecting(true);
    try {
      await postIntegration({
        action: "connect",
        provider: "SLACK",
        accessToken: slackToken.trim(),
        defaultChannel: slackDefaultChannel,
      });
      toast.success("Slack connected");
      setSlackDialogOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setSlackConnecting(false);
    }
  };

  const disconnect = async (provider: Integration["provider"]) => {
    if (!isAdmin) return;
    setActionLoading(`disconnect-${provider}`);
    try {
      await postIntegration({ action: "disconnect", provider });
      toast.success("Disconnected");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setActionLoading(null);
    }
  };

  const syncGoogle = async () => {
    if (!isAdmin) return;
    setSyncing(true);
    try {
      const result = await postIntegration({
        action: "sync",
        provider: "GOOGLE_CALENDAR",
      });
      toast.success(
        `Synced ${result.created ?? 0} new and ${result.updated ?? 0} updated events`,
      );
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const updateChannel = async (channelId: string) => {
    if (!isAdmin) return;
    const channelName = getSlackChannels(getIntegration("SLACK")).find(
      (item) => item.id === channelId,
    )?.name;
    try {
      await postIntegration({
        action: "updateChannel",
        provider: "SLACK",
        channel: channelId,
      });
      toast.success(`Default channel set to #${channelName ?? channelId}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update channel");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const gcal = getIntegration("GOOGLE_CALENDAR");
  const slack = getIntegration("SLACK");
  const connectedSlackChannels = getSlackChannels(slack);
  const watchActive = isWatchActive(gcal?.metadata);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Integrations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your tools to sync data and automate workflows
        </p>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-4">
          <Shield className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Only admins can connect, disconnect, or sync integrations. Contact your
            workspace admin for changes.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">
                    Google Calendar
                  </h3>
                  {gcal?.status === "CONNECTED" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <Check className="h-3 w-3" /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <X className="h-3 w-3" /> Not Connected
                    </span>
                  )}
                  {watchActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
                      <Radio className="h-3 w-3" /> Listening
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  OAuth connection to sync events, auto-create customers, and receive
                  live calendar updates via webhook.
                </p>
                {isAdmin && gcal?.status !== "CONNECTED" && googleSetup ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                    <p className="font-medium">Google Cloud Console setup</p>
                    <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
                      Open the <strong>Web application</strong> OAuth client whose Client ID
                      matches your <code className="text-[11px]">GOOGLE_CLIENT_ID</code> in{" "}
                      <code className="text-[11px]">.env</code>, then add this under{" "}
                      <strong>Authorized redirect URIs</strong> (not JavaScript origins):
                    </p>
                    {googleSetup.clientId ? (
                      <p className="mt-2 break-all font-mono text-[11px]">
                        Client ID: {googleSetup.clientId}
                      </p>
                    ) : null}
                    <p className="mt-1 break-all font-mono text-[11px]">
                      {googleSetup.redirectUri}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="shrink-0">
                {isAdmin &&
                  (gcal?.status === "CONNECTED" ? (
                    <Button
                      variant="outline"
                      className="text-destructive hover:bg-destructive/5"
                      disabled={actionLoading === "disconnect-GOOGLE_CALENDAR"}
                      onClick={() => disconnect("GOOGLE_CALENDAR")}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button disabled={actionLoading === "connect-GOOGLE_CALENDAR"} onClick={connectGoogle}>
                      <Plug className="mr-2 h-4 w-4" /> Connect
                    </Button>
                  ))}
              </div>
            </div>

            {gcal?.status === "CONNECTED" && (
              <div className="mt-5 space-y-4 border-t border-border pt-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Calendar
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                      {gcal.metadata?.calendarEmail || gcal.calendarId || "primary"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Last Sync
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {gcal.lastSyncAt
                        ? new Date(gcal.lastSyncAt).toLocaleString("en", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "Never"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Synced Events
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {gcal.totalSynced || 0}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Webhook
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {watchActive
                        ? `Active until ${new Date(gcal.metadata!.watchExpiration!).toLocaleDateString("en", { month: "short", day: "numeric" })}`
                        : "Not active"}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <Button variant="outline" onClick={syncGoogle} disabled={syncing}>
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`}
                    />
                    {syncing ? "Syncing..." : "Sync Events Now"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">Slack</h3>
                  {slack?.status === "CONNECTED" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <Check className="h-3 w-3" /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <X className="h-3 w-3" /> Not Connected
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Send notifications to your default channel when appointments are booked.
                </p>
              </div>
              <div className="shrink-0">
                {isAdmin &&
                  (slack?.status === "CONNECTED" ? (
                    <Button
                      variant="outline"
                      className="text-destructive hover:bg-destructive/5"
                      disabled={actionLoading === "disconnect-SLACK"}
                      onClick={() => disconnect("SLACK")}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      disabled={actionLoading === "connect-SLACK"}
                      onClick={connectSlack}
                    >
                      <Plug className="mr-2 h-4 w-4" /> Connect
                    </Button>
                  ))}
              </div>
            </div>

            {slack?.status === "CONNECTED" && (
              <div className="mt-5 space-y-4 border-t border-border pt-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Workspace
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                      {slack.workspaceName}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Default Channel
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {getSlackChannelLabel(slack)}
                    </p>
                  </div>
                </div>
                {isAdmin && connectedSlackChannels.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="whitespace-nowrap text-sm text-muted-foreground">
                      Default channel:
                    </span>
                    <Select
                      value={slack.selectedChannel || connectedSlackChannels[0]?.id}
                      onValueChange={updateChannel}
                    >
                      <SelectTrigger className="h-9 w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {connectedSlackChannels.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id}>
                            #{ch.name}
                            {ch.isPrivate ? " (private)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="rounded-xl bg-muted/20 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-foreground">
                      Active notifications
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-emerald-500" /> New appointment booked
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={slackDialogOpen} onOpenChange={setSlackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Slack</DialogTitle>
            <DialogDescription>
              Paste a Slack bot token with <code className="text-xs">chat:write</code> and{" "}
              <code className="text-xs">channels:read</code> scopes, then pick the default
              notification channel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="slack-token">Bot access token</Label>
              <Input
                id="slack-token"
                type="password"
                placeholder="xoxb-..."
                value={slackToken}
                onChange={(event) => setSlackToken(event.target.value)}
              />
            </div>

            {slackTeam ? (
              <p className="text-sm text-muted-foreground">
                Workspace: <span className="font-medium text-foreground">{slackTeam}</span>
              </p>
            ) : null}

            {slackChannels.length > 0 ? (
              <div className="space-y-2">
                <Label>Default channel</Label>
                <Select value={slackDefaultChannel} onValueChange={setSlackDefaultChannel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {slackChannels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        #{channel.name}
                        {channel.isPrivate ? " (private)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={validateSlackToken}
              disabled={slackValidating || slackConnecting}
            >
              {slackValidating ? "Validating..." : "Validate token"}
            </Button>
            <Button
              onClick={saveSlackConnection}
              disabled={!slackTeam || !slackDefaultChannel || slackConnecting}
            >
              {slackConnecting ? "Connecting..." : "Connect Slack"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
