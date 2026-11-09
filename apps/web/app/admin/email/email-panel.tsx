"use client";

import {
  CheckCircle2Icon,
  ChevronLeft,
  ChevronRight,
  MailIcon,
  MegaphoneIcon,
  ScrollTextIcon,
  SendIcon,
  UsersIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const TestEmailTab = () => {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast.error("All fields are required.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/email/test", {
        body: JSON.stringify({ body, subject, to }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed");
      }
      toast.success(`Test email sent to ${to}.`);
      setTo("");
      setSubject("");
      setBody("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-border/50 bg-card/20 rounded-xl border backdrop-blur-sm">
      <div className="border-border/50 border-b px-5 py-4">
        <h3 className="text-sm font-semibold">Send test email</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Send a one-off email to verify your SMTP configuration is working.
        </p>
      </div>
      <div className="flex flex-col gap-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="test-to">Recipient</Label>
            <Input
              id="test-to"
              placeholder="user@example.com"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="test-subject">Subject</Label>
            <Input
              id="test-subject"
              placeholder="Test email from the panel"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="test-body">Body</Label>
          <Textarea
            id="test-body"
            placeholder="Email body…"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button disabled={sending} onClick={handleSend}>
            <SendIcon className="size-4" />
            {sending ? "Sending…" : "Send test email"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const BroadcastTab = () => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "admins">("all");
  const [sending, setSending] = useState(false);

  const handleBroadcast = async () => {
    if (!subject || !body) {
      toast.error("Subject and body are required.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/email/broadcast", {
        body: JSON.stringify({ audience, body, subject }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed");
      }
      toast.success(
        `Broadcast sent: ${json.sent} delivered, ${json.failed} failed out of ${json.total} recipients.`
      );
      setSubject("");
      setBody("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Broadcast failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-border/50 bg-card/20 rounded-xl border backdrop-blur-sm">
      <div className="border-border/50 border-b px-5 py-4">
        <h3 className="text-sm font-semibold">Broadcast email</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Send a message to all users or just admins. Requires super-admin
          access.
        </p>
      </div>
      <div className="flex flex-col gap-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bc-audience">
              <UsersIcon className="mr-1.5 inline-block size-3.5 align-middle" />
              Audience
            </Label>
            <Select
              value={audience}
              onValueChange={(v) => setAudience(v as "all" | "admins")}
            >
              <SelectTrigger id="bc-audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="admins">Admins only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bc-subject">Subject</Label>
            <Input
              id="bc-subject"
              placeholder="Important notice"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bc-body">Message</Label>
          <Textarea
            id="bc-body"
            placeholder="Compose your broadcast message…"
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            This will send an email to{" "}
            <span className="text-foreground font-medium">
              {audience === "admins" ? "all admins" : "all users"}
            </span>
            .
          </p>
          <Button disabled={sending} onClick={handleBroadcast}>
            <MegaphoneIcon className="size-4" />
            {sending ? "Sending…" : "Send broadcast"}
          </Button>
        </div>
      </div>
    </div>
  );
};

interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface PagedResponse {
  logs: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const EmailLogsTab = () => {
  const [data, setData] = useState<PagedResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: "admin.email",
        page: String(page),
        pageSize: "25",
      });
      const res = await fetch(`/api/admin/audit?${params}`);
      if (!res.ok) {
        throw new Error("Failed to fetch");
      }
      setData(await res.json());
    } catch {
      toast.error("Failed to load email logs.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="border-border/50 bg-card/20 rounded-xl border backdrop-blur-sm">
      <div className="border-border/50 border-b px-5 py-4">
        <h3 className="text-sm font-semibold">Email send history</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Audit trail of test emails and broadcasts sent from the admin panel.
        </p>
      </div>
      {(loading || !data) && (
        <div className="text-muted-foreground px-6 py-10 text-center text-sm">
          Loading…
        </div>
      )}
      {!loading && data && data.logs.length === 0 && (
        <div className="text-muted-foreground px-6 py-10 text-center text-sm">
          No email activity yet.
        </div>
      )}
      {!loading && data && data.logs.length > 0 && (
        <div className="divide-border/50 divide-y">
          {data.logs.map((log) => {
            const meta = log.metadata ?? {};
            const isBroadcast = log.action === "admin.email.broadcast_sent";
            return (
              <div
                key={log.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                      isBroadcast
                        ? "bg-sky-500/10 text-sky-500"
                        : "bg-emerald-500/10 text-emerald-500"
                    )}
                  >
                    {isBroadcast ? (
                      <MegaphoneIcon className="size-3.5" />
                    ) : (
                      <CheckCircle2Icon className="size-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={cn(
                          "text-xs",
                          isBroadcast
                            ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        )}
                        variant="outline"
                      >
                        {isBroadcast ? "broadcast" : "test"}
                      </Badge>
                      <span className="text-sm font-medium">
                        {String(meta.subject ?? "-")}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      by {log.actorEmail ?? "unknown"}
                      {isBroadcast && meta.sent !== undefined && (
                        <span className="ml-2">
                          · {String(meta.sent)}/{String(meta.recipientCount)}{" "}
                          delivered
                          {meta.audience ? ` · ${String(meta.audience)}` : ""}
                        </span>
                      )}
                      {!isBroadcast && Boolean(meta.to) && (
                        <span className="ml-2">· to {String(meta.to)}</span>
                      )}
                    </p>
                  </div>
                </div>
                <time className="text-muted-foreground/70 shrink-0 text-xs">
                  {new Date(log.createdAt).toLocaleString()}
                </time>
              </div>
            );
          })}
        </div>
      )}
      {data && data.totalPages > 1 && (
        <div className="border-border/50 text-muted-foreground flex items-center justify-between border-t px-5 py-3 text-sm">
          <span>
            {(data.page - 1) * data.pageSize + 1}–
            {Math.min(data.page * data.pageSize, data.total)} of {data.total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              className="size-8"
              disabled={page <= 1}
              size="icon"
              variant="ghost"
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2">
              {page} / {data.totalPages}
            </span>
            <Button
              className="size-8"
              disabled={page >= data.totalPages}
              size="icon"
              variant="ghost"
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const EmailPanel = () => (
  <Tabs defaultValue="test">
    <TabsList className="mb-4 h-auto gap-1 rounded-xl p-1">
      <TabsTrigger className="gap-1.5 rounded-lg" value="test">
        <MailIcon className="size-3.5" />
        Test send
      </TabsTrigger>
      <TabsTrigger className="gap-1.5 rounded-lg" value="broadcast">
        <MegaphoneIcon className="size-3.5" />
        Broadcast
      </TabsTrigger>
      <TabsTrigger className="gap-1.5 rounded-lg" value="logs">
        <ScrollTextIcon className="size-3.5" />
        History
      </TabsTrigger>
    </TabsList>
    <TabsContent value="test">
      <TestEmailTab />
    </TabsContent>
    <TabsContent value="broadcast">
      <BroadcastTab />
    </TabsContent>
    <TabsContent value="logs">
      <EmailLogsTab />
    </TabsContent>
  </Tabs>
);
