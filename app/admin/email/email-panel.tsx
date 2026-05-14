"use client";

import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Megaphone,
  ScrollText,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

// ---------------------------------------------------------------------------
// Test email tab
// ---------------------------------------------------------------------------

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Send test email</CardTitle>
        <CardDescription>
          Send a one-off email to verify your SMTP configuration is working.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Recipient</Label>
          <Input
            type="email"
            placeholder="user@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Subject</Label>
          <Input
            placeholder="Test email from NodeByte Panel"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Body</Label>
          <Textarea
            placeholder="Email body…"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button disabled={sending} onClick={handleSend}>
            <Send className="size-4" />
            {sending ? "Sending…" : "Send test"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Broadcast tab
// ---------------------------------------------------------------------------

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Broadcast email</CardTitle>
        <CardDescription>
          Send a message to all users or just admins. Requires super-admin
          access.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Audience</Label>
          <Select
            value={audience}
            onValueChange={(v) => setAudience(v as "all" | "admins")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              <SelectItem value="admins">Admins only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Subject</Label>
          <Input
            placeholder="Important notice from NodeByte"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Body</Label>
          <Textarea
            placeholder="Compose your broadcast message…"
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button disabled={sending} onClick={handleBroadcast}>
            <Megaphone className="size-4" />
            {sending ? "Sending…" : "Send broadcast"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Logs tab (email events from audit log)
// ---------------------------------------------------------------------------

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
    void fetchLogs();
  }, [fetchLogs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Email send history</CardTitle>
        <CardDescription>
          Audit trail of test emails and broadcasts sent from the admin panel.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {(loading || !data) && (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}
        {!loading && data && data.logs.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No email activity yet.
          </div>
        )}
        {!loading && data && data.logs.length > 0 && (
          <div className="divide-y">
            {data.logs.map((log) => {
              const meta = log.metadata ?? {};
              return (
                <div
                  key={log.id}
                  className="flex flex-col gap-0.5 px-6 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {log.action === "admin.email.broadcast_sent"
                          ? "broadcast"
                          : "test"}
                      </Badge>
                      <span className="text-sm">
                        {String(meta.subject ?? "—")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      by {log.actorEmail ?? "unknown"}
                      {log.action === "admin.email.broadcast_sent" &&
                        meta.sent !== undefined && (
                          <span className="ml-2">
                            {String(meta.sent)}/{String(meta.recipientCount)}{" "}
                            sent
                            {meta.audience ? ` · ${String(meta.audience)}` : ""}
                          </span>
                        )}
                      {log.action === "admin.email.test_sent" &&
                        Boolean(meta.to) && (
                          <span className="ml-2">→ {String(meta.to)}</span>
                        )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 text-sm text-muted-foreground border-t">
            <span>
              {(data.page - 1) * data.pageSize + 1}–
              {Math.min(data.page * data.pageSize, data.total)} of {data.total}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-2">
                {page} / {data.totalPages}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export const EmailPanel = () => (
  <Tabs defaultValue="test">
    <TabsList className="mb-4">
      <TabsTrigger value="test">
        <Mail className="size-4" />
        Test send
      </TabsTrigger>
      <TabsTrigger value="broadcast">
        <Megaphone className="size-4" />
        Broadcast
      </TabsTrigger>
      <TabsTrigger value="logs">
        <ScrollText className="size-4" />
        Logs
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
