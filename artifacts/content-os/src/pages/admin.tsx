import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Webhook, ShieldAlert, LogIn, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Copy, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

const ADMIN_EMAIL = "wil.kirwan@gmail.com";

interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WebhookEvent {
  id: number;
  webhookId: string | null;
  eventType: string;
  locationId: string | null;
  signatureVerified: boolean;
  processed: boolean;
  processingError: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface WebhookEventsResponse {
  events: WebhookEvent[];
  total: number;
  page: number;
  pages: number;
}

function useAdminUsers(enabled: boolean) {
  return useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled,
  });
}

function useWebhookEvents(page: number, enabled: boolean) {
  return useQuery<WebhookEventsResponse>({
    queryKey: ["admin-webhook-events", page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/webhook-events?page=${page}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch webhook events");
      return res.json();
    },
    enabled,
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="ml-1.5 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function Admin() {
  const { user, isLoading, login, logout } = useAuth();
  const [webhookPage, setWebhookPage] = useState(1);
  const isAdmin = user?.email === ADMIN_EMAIL;

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useAdminUsers(isAdmin);
  const { data: webhookData, isLoading: webhooksLoading, refetch: refetchWebhooks } = useWebhookEvents(webhookPage, isAdmin);

  const webhookUrl = `${window.location.protocol}//${window.location.host}/api/webhooks`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Authentication Required</p>
        <p className="text-sm text-muted-foreground">You must be logged in to access the admin panel.</p>
        <Button onClick={login} className="gap-2">
          <LogIn className="h-4 w-4" /> Log In
        </Button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm text-muted-foreground">
          Logged in as <strong>{user.email}</strong>. Admin access is restricted.
        </p>
        <Button variant="outline" onClick={logout}>Log Out</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Logged in as {user.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={logout}>Log Out</Button>
      </div>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            HighLevel Webhook Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Webhook URL</p>
            <div className="flex items-center gap-1">
              <code className="text-sm font-mono break-all">{webhookUrl}</code>
              <CopyButton text={webhookUrl} />
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-2">
            <p className="font-semibold">HighLevel Setup Instructions</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Log into your HighLevel agency dashboard</li>
              <li>Navigate to <strong>Settings → Webhooks</strong> (or your OAuth app's advanced settings)</li>
              <li>Paste the webhook URL above into the endpoint field</li>
              <li>Select the events you want to receive (e.g. ContactCreate, ContactUpdate, LocationCreate)</li>
              <li>Save the configuration — HighLevel will send a test ping to verify</li>
            </ol>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <p className="font-semibold mb-1">Test with curl</p>
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs">{`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "ContactCreate",
    "timestamp": "${new Date().toISOString()}",
    "webhookId": "test-${Date.now()}",
    "locationId": "jhrQpnaQmlvhbwAvaIs7",
    "data": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    }
  }'`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Users */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Registered Users
              {users && <Badge variant="secondary">{users.length}</Badge>}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetchUsers()} disabled={usersLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${usersLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !users || users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No users yet. Users appear here after logging in.</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  {u.profileImageUrl ? (
                    <img src={u.profileImageUrl} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {(u.firstName?.[0] ?? u.email?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    Joined {format(new Date(u.createdAt), "MMM d, yyyy")}
                  </div>
                  {u.email === ADMIN_EMAIL && (
                    <Badge className="text-xs bg-primary">Admin</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Events */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Webhook Event Log
              {webhookData && <Badge variant="secondary">{webhookData.total} total</Badge>}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetchWebhooks()} disabled={webhooksLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${webhooksLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {webhooksLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !webhookData || webhookData.events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No webhook events received yet.</p>
          ) : (
            <>
              <div className="space-y-2">
                {webhookData.events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg text-sm">
                    <div className="flex-shrink-0 mt-0.5">
                      {event.signatureVerified
                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                        : <XCircle className="h-4 w-4 text-orange-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{event.eventType}</span>
                        <Badge variant={event.processed ? "outline" : "secondary"} className="text-xs">
                          {event.processed ? "processed" : "pending"}
                        </Badge>
                        {!event.signatureVerified && (
                          <Badge variant="destructive" className="text-xs">unverified sig</Badge>
                        )}
                        {event.locationId && (
                          <span className="text-xs text-muted-foreground">loc: {event.locationId}</span>
                        )}
                      </div>
                      {event.webhookId && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">id: {event.webhookId}</p>
                      )}
                      {event.processingError && (
                        <p className="text-xs text-destructive mt-0.5">{event.processingError}</p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(event.createdAt), "MMM d, h:mm a")}
                    </div>
                  </div>
                ))}
              </div>

              {webhookData.pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <Button variant="outline" size="sm" onClick={() => setWebhookPage(p => Math.max(1, p - 1))} disabled={webhookPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">Page {webhookData.page} of {webhookData.pages}</span>
                  <Button variant="outline" size="sm" onClick={() => setWebhookPage(p => Math.min(webhookData.pages, p + 1))} disabled={webhookPage === webhookData.pages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
