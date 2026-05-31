import { useState, useEffect } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  useGetIntegrations,
  useCreateIntegration,
  useUpdateIntegration,
  useDeleteIntegration,
  useValidateIntegration,
  getGetIntegrationsQueryKey,
  getGetPlannerItemsQueryKey,
} from "@workspace/api-client-react";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, RefreshCw, Plus, Shield, Eye, EyeOff,
  Loader2, Trash2, RotateCw, Link2, ArrowDownToLine, X, Users
} from "lucide-react";
import { format } from "date-fns";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

function getMonthRange(date: Date): { fromDate: string; toDate: string } {
  const from = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { fromDate: from.toISOString(), toDate: to.toISOString() };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  connected: { label: "Connected", color: "text-green-600", icon: CheckCircle2 },
  disconnected: { label: "Disconnected", color: "text-gray-500", icon: XCircle },
  token_invalid: { label: "Token Invalid", color: "text-red-600", icon: XCircle },
  missing_scope: { label: "Missing Scope", color: "text-orange-600", icon: AlertTriangle },
  sync_delayed: { label: "Sync Delayed", color: "text-amber-600", icon: Clock },
};

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "bg-blue-600",
  instagram: "bg-gradient-to-br from-purple-500 to-pink-500",
  instagram_story: "bg-gradient-to-br from-purple-500 to-pink-500",
  tiktok: "bg-black",
  youtube: "bg-red-600",
  youtube_shorts: "bg-red-600",
  linkedin: "bg-blue-700",
  twitter: "bg-sky-500",
  x: "bg-black",
  gmb: "bg-green-600",
  google_my_business: "bg-green-600",
  google: "bg-green-600",
  podcast: "bg-purple-600",
  community: "bg-orange-500",
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  instagram_story: "Instagram Stories",
  tiktok: "TikTok",
  youtube: "YouTube",
  youtube_shorts: "YouTube Shorts",
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  x: "Twitter / X",
  gmb: "Google My Business",
  google_my_business: "Google My Business",
  google: "Google My Business",
  podcast: "Podcast",
  community: "Community",
};

interface BlogSyncResult {
  success: boolean;
  blogsFound: number;
  postsCreated: number;
  postsUpdated: number;
  postsFailed: number;
  postsSynced: number;
  message: string;
  errors: string[];
}

interface EmailSyncResult {
  success: boolean;
  campaignsFound: number;
  campaignsCreated: number;
  campaignsUpdated: number;
  campaignsFailed: number;
  campaignsSynced: number;
  message: string;
  errors: string[];
}

interface SyncResult {
  success: boolean;
  accountsSynced: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsSynced: number;
  itemsFailed: number;
  platformBreakdown: Record<string, number>;
  accountBreakdown: Record<string, { name: string; platform: string; count: number }>;
  message: string;
  errors: string[];
}

interface SocialAccount {
  id: number;
  integrationId: number;
  accountId: string;
  platform: string;
  name: string;
  username: string | null;
  avatar: string | null;
  accountType: string | null;
  expireAt: string | null;
  isExpired: boolean;
  status: string;
  lastSyncedAt: string | null;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  page: "Page",
  profile: "Profile",
  location: "Business Location",
  group: "Group",
  business: "Business",
};

function PlatformInitial({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform] ?? "bg-gray-500";
  const label = PLATFORM_LABELS[platform] ?? platform;
  return (
    <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
      {label.slice(0, 2).toUpperCase()}
    </div>
  );
}

function ExpiryBadge({ expireAt, isExpired }: { expireAt: string | null; isExpired: boolean }) {
  if (!expireAt) return null;
  const expiry = new Date(expireAt);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (isExpired || daysUntilExpiry <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
        <AlertTriangle className="h-3 w-3" /> Expired
      </span>
    );
  }
  if (daysUntilExpiry <= 14) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
        <Clock className="h-3 w-3" /> Expires {format(expiry, "MMM d, yyyy")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" /> Expires {format(expiry, "MMM d, yyyy")}
    </span>
  );
}

function AccountCard({ acct, syncInfo }: {
  acct: SocialAccount;
  syncInfo?: { name: string; platform: string; count: number };
}) {
  const platformLabel = PLATFORM_LABELS[acct.platform] ?? acct.platform;
  const platformColor = PLATFORM_COLORS[acct.platform] ?? "bg-gray-500";
  const typeLabel = acct.accountType ? (ACCOUNT_TYPE_LABELS[acct.accountType] ?? acct.accountType) : null;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow">
      {/* Header: avatar + platform badge */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 relative">
          {acct.avatar ? (
            <img
              src={acct.avatar}
              alt={acct.name}
              className="w-12 h-12 rounded-full object-cover border"
              onError={(e) => {
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  (e.target as HTMLImageElement).style.display = "none";
                  const fallback = parent.querySelector(".avatar-fallback") as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }
              }}
            />
          ) : null}
          <div
            className={`avatar-fallback w-12 h-12 rounded-full ${platformColor} flex items-center justify-center text-white text-sm font-bold border ${acct.avatar ? "hidden" : ""}`}
          >
            {platformLabel.slice(0, 2).toUpperCase()}
          </div>
          {/* Small platform indicator dot */}
          <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ${platformColor} border-2 border-background`} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm leading-tight truncate">{acct.name}</p>
          {acct.username && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">@{acct.username}</p>
          )}
        </div>
      </div>

      {/* Platform + type */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center text-xs font-medium text-white px-2 py-0.5 rounded-full ${platformColor}`}>
          {platformLabel}
        </span>
        {typeLabel && (
          <span className="text-xs text-muted-foreground border rounded-full px-2 py-0.5">
            {typeLabel}
          </span>
        )}
        {syncInfo && (
          <span className="text-xs text-primary font-medium">
            {syncInfo.count} {syncInfo.count === 1 ? "post" : "posts"} synced
          </span>
        )}
      </div>

      {/* Expiry */}
      <ExpiryBadge expireAt={acct.expireAt} isExpired={acct.isExpired} />
    </div>
  );
}

export default function Integrations() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [showConnect, setShowConnect] = useState(false);
  const [showRotate, setShowRotate] = useState<number | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState("");
  const [locationId, setLocationId] = useState("");
  const [newToken, setNewToken] = useState("");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [blogSyncResult, setBlogSyncResult] = useState<BlogSyncResult | null>(null);
  const [blogSyncingId, setBlogSyncingId] = useState<number | null>(null);
  const [emailSyncResult, setEmailSyncResult] = useState<EmailSyncResult | null>(null);
  const [emailSyncingId, setEmailSyncingId] = useState<number | null>(null);

  const { data: integrations, isLoading } = useGetIntegrations(
    workspaceId,
    { query: { enabled: !!workspaceId, queryKey: getGetIntegrationsQueryKey(workspaceId) } }
  );

  const firstIntegration = integrations?.[0];

  // Load social accounts stored for the first (only) integration
  const {
    data: socialAccounts,
    refetch: refetchAccounts,
    isLoading: isAccountsLoading,
    isError: isAccountsError,
  } = useQuery<SocialAccount[]>({
    queryKey: ["social-accounts", workspaceId, firstIntegration?.id],
    enabled: !!firstIntegration?.id,
    staleTime: 0,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/integrations/${firstIntegration!.id}/accounts`);
      if (!res.ok) throw new Error("Failed to load accounts");
      return res.json();
    },
  });

  // refreshAccountsMutation defined first so validate/create can call it
  const refreshAccountsMutation = useMutation({
    mutationFn: async (integrationId: number) => {
      const res = await fetch(
        `${API_BASE}/api/workspaces/${workspaceId}/integrations/${integrationId}/refresh-accounts`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to refresh accounts");
      return res.json() as Promise<{ success: boolean; accounts: SocialAccount[] }>;
    },
    onSuccess: (data, integrationId) => {
      // Use integrationId from mutation variables — avoids stale closure
      queryClient.setQueryData(
        ["social-accounts", workspaceId, integrationId],
        data.accounts
      );
    },
  });

  const createMutation = useCreateIntegration({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIntegrationsQueryKey(workspaceId) });
        setShowConnect(false);
        setToken("");
        setLocationId("");
        // accounts will auto-fetch via the useEffect once firstIntegration is set
      },
    },
  });

  const updateMutation = useUpdateIntegration({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIntegrationsQueryKey(workspaceId) });
        setShowRotate(null);
        setNewToken("");
      },
    },
  });

  const deleteMutation = useDeleteIntegration({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIntegrationsQueryKey(workspaceId) });
      },
    },
  });

  const validateMutation = useValidateIntegration({
    mutation: {
      onSuccess: async (_, vars) => {
        queryClient.invalidateQueries({ queryKey: getGetIntegrationsQueryKey(workspaceId) });
        // Use fetch directly — calling refreshAccountsMutation.mutate() inside onSuccess
        // is unreliable due to stale closure in TanStack Query v5.
        try {
          const res = await fetch(
            `${API_BASE}/api/workspaces/${workspaceId}/integrations/${vars.id}/refresh-accounts`,
            { method: "POST" }
          );
          if (res.ok) {
            const data = await res.json() as { success: boolean; accounts: SocialAccount[] };
            queryClient.setQueryData(["social-accounts", workspaceId, vars.id], data.accounts);
          }
        } catch {
          // Accounts remain from cache; user can hit Refresh manually
        }
      },
    },
  });

  const syncMutation = useMutation({
    mutationFn: async ({ integrationId, fromDate, toDate }: { integrationId: number; fromDate: string; toDate: string }) => {
      const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/integrations/${integrationId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate, toDate }),
      });
      return res.json() as Promise<SyncResult>;
    },
    onSuccess: (data, { integrationId }) => {
      queryClient.invalidateQueries({ queryKey: getGetIntegrationsQueryKey(workspaceId) });
      queryClient.invalidateQueries({ queryKey: getGetPlannerItemsQueryKey(workspaceId) });
      // Invalidate accounts cache — sync endpoint already updates accounts in DB
      queryClient.invalidateQueries({ queryKey: ["social-accounts", workspaceId, integrationId] });
      setSyncResult(data);
      setSyncingId(null);
    },
    onError: () => {
      setSyncingId(null);
    },
  });

  const syncBlogsMutation = useMutation({
    mutationFn: async (integrationId: number) => {
      const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/integrations/${integrationId}/sync-blogs`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Blog sync failed" }));
        throw new Error((err as { error?: string }).error ?? "Blog sync failed");
      }
      return res.json() as Promise<BlogSyncResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getGetPlannerItemsQueryKey(workspaceId) });
      setBlogSyncResult(data);
      setBlogSyncingId(null);
    },
    onError: (err) => {
      setBlogSyncResult({
        success: false,
        blogsFound: 0,
        postsCreated: 0,
        postsUpdated: 0,
        postsFailed: 0,
        postsSynced: 0,
        message: err instanceof Error ? err.message : "Blog sync failed",
        errors: [],
      });
      setBlogSyncingId(null);
    },
  });

  const handleSyncBlogs = (integrationId: number) => {
    setBlogSyncingId(integrationId);
    setBlogSyncResult(null);
    syncBlogsMutation.mutate(integrationId);
  };

  const syncEmailsMutation = useMutation({
    mutationFn: async (integrationId: number) => {
      const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/integrations/${integrationId}/sync-emails`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Email sync failed" }));
        throw new Error((err as { error?: string }).error ?? "Email sync failed");
      }
      return res.json() as Promise<EmailSyncResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getGetPlannerItemsQueryKey(workspaceId) });
      setEmailSyncResult(data);
      setEmailSyncingId(null);
    },
    onError: (err) => {
      setEmailSyncResult({
        success: false,
        campaignsFound: 0,
        campaignsCreated: 0,
        campaignsUpdated: 0,
        campaignsFailed: 0,
        campaignsSynced: 0,
        message: err instanceof Error ? err.message : "Email sync failed",
        errors: [],
      });
      setEmailSyncingId(null);
    },
  });

  const handleSyncEmails = (integrationId: number) => {
    setEmailSyncingId(integrationId);
    setEmailSyncResult(null);
    syncEmailsMutation.mutate(integrationId);
  };

  // Auto-fetch accounts from HL when integration is connected but no accounts are stored yet.
  useEffect(() => {
    if (
      firstIntegration?.id &&
      firstIntegration.status === "connected" &&
      !isAccountsLoading &&
      !isAccountsError &&
      socialAccounts !== undefined &&
      socialAccounts.length === 0 &&
      !refreshAccountsMutation.isPending &&
      !refreshAccountsMutation.isError
    ) {
      refreshAccountsMutation.mutate(firstIntegration.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstIntegration?.id, firstIntegration?.status, isAccountsLoading, isAccountsError, socialAccounts?.length, refreshAccountsMutation.isError]);

  const handleConnect = () => {
    if (!token || !locationId) return;
    createMutation.mutate({
      workspaceId,
      data: { provider: "highlevel", authType: "private_token", token, locationId },
    });
  };

  const handleRotate = (id: number) => {
    if (!newToken) return;
    updateMutation.mutate({ workspaceId, id, data: { token: newToken } });
  };

  const handleSync = (integrationId: number) => {
    setSyncingId(integrationId);
    setSyncResult(null);
    const { fromDate, toDate } = getMonthRange(new Date());
    syncMutation.mutate({ integrationId, fromDate, toDate });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">Manage your HighLevel connection and sync settings.</p>
        </div>
        {(!integrations || integrations.length === 0) && (
          <Button onClick={() => setShowConnect(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Connect HighLevel
          </Button>
        )}
      </div>

      {/* Sync Result Banner */}
      {syncResult && (
        <div className={`rounded-lg border p-4 ${syncResult.success ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {syncResult.success
                ? <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                : <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
              }
              <div>
                <p className={`font-semibold text-sm ${syncResult.success ? "text-green-800" : "text-orange-800"}`}>
                  {syncResult.message}
                </p>
                {syncResult.itemsSynced > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(syncResult.accountBreakdown ?? {}).map(([key, acct]) => (
                      <Badge key={key} variant="outline" className="text-xs bg-white gap-1">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${PLATFORM_COLORS[acct.platform] ?? "bg-gray-500"}`} />
                        {acct.name}: {acct.count} {acct.count === 1 ? "post" : "posts"}
                      </Badge>
                    ))}
                  </div>
                )}
                {syncResult.accountsSynced > 0 && syncResult.itemsSynced === 0 && (
                  <p className="mt-1 text-xs text-green-700">
                    {syncResult.accountsSynced} accounts are connected — use a wider date range to sync older posts.
                  </p>
                )}
                {syncResult.errors.length > 0 && (
                  <p className="mt-1 text-xs text-orange-700">{syncResult.errors[0]}</p>
                )}
              </div>
            </div>
            <button onClick={() => setSyncResult(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {emailSyncResult && (
        <div className={`rounded-lg border p-4 ${emailSyncResult.success ? "bg-emerald-50 border-emerald-200" : "bg-orange-50 border-orange-200"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {emailSyncResult.success
                ? <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                : <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
              }
              <div>
                <p className={`font-semibold text-sm ${emailSyncResult.success ? "text-emerald-800" : "text-orange-800"}`}>
                  {emailSyncResult.message}
                </p>
                {emailSyncResult.campaignsSynced > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs bg-white gap-1">
                      {emailSyncResult.campaignsCreated} new campaigns
                    </Badge>
                    {emailSyncResult.campaignsUpdated > 0 && (
                      <Badge variant="outline" className="text-xs bg-white gap-1">
                        {emailSyncResult.campaignsUpdated} updated
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs bg-white gap-1">
                      {emailSyncResult.campaignsFound} total found
                    </Badge>
                  </div>
                )}
                {emailSyncResult.errors.length > 0 && (
                  <p className="mt-1 text-xs text-orange-700">{emailSyncResult.errors[0]}</p>
                )}
              </div>
            </div>
            <button onClick={() => setEmailSyncResult(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {blogSyncResult && (
        <div className={`rounded-lg border p-4 ${blogSyncResult.success ? "bg-indigo-50 border-indigo-200" : "bg-orange-50 border-orange-200"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {blogSyncResult.success
                ? <CheckCircle2 className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                : <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
              }
              <div>
                <p className={`font-semibold text-sm ${blogSyncResult.success ? "text-indigo-800" : "text-orange-800"}`}>
                  {blogSyncResult.message}
                </p>
                {blogSyncResult.postsSynced > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs bg-white gap-1">
                      {blogSyncResult.postsCreated} new posts
                    </Badge>
                    {blogSyncResult.postsUpdated > 0 && (
                      <Badge variant="outline" className="text-xs bg-white gap-1">
                        {blogSyncResult.postsUpdated} updated
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs bg-white gap-1">
                      {blogSyncResult.blogsFound} {blogSyncResult.blogsFound === 1 ? "blog" : "blogs"} scanned
                    </Badge>
                  </div>
                )}
                {blogSyncResult.errors.length > 0 && (
                  <p className="mt-1 text-xs text-orange-700">{blogSyncResult.errors[0]}</p>
                )}
              </div>
            </div>
            <button onClick={() => setBlogSyncResult(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !integrations || integrations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Link2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No integrations connected</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Connect your HighLevel account to enable two-way sync of social posts, blogs, and campaigns.</p>
            <Button onClick={() => setShowConnect(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Connect HighLevel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration) => {
            const statusConfig = STATUS_CONFIG[integration.status] || STATUS_CONFIG.disconnected;
            const StatusIcon = statusConfig.icon;
            const isRotationDue = integration.tokenRotationDueAt && new Date(integration.tokenRotationDueAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const isSyncing = syncingId === integration.id;
            return (
              <Card key={integration.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">HighLevel</CardTitle>
                        <CardDescription>Private Integration Token • Location: {integration.locationId || "Not set"}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 text-sm font-medium ${statusConfig.color}`}>
                        <StatusIcon className="h-4 w-4" />
                        {statusConfig.label}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Token (last 4)</p>
                      <p className="font-mono font-medium">****{integration.tokenLastFour || "----"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Last Validated</p>
                      <p className="font-medium">{integration.lastValidatedAt ? format(new Date(integration.lastValidatedAt), "MMM d, yyyy") : "Never"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Last Synced</p>
                      <p className="font-medium">{integration.lastSyncedAt ? format(new Date(integration.lastSyncedAt), "MMM d, h:mm a") : "Never"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Token Rotation Due</p>
                      <p className={`font-medium ${isRotationDue ? "text-orange-600" : ""}`}>
                        {integration.tokenRotationDueAt ? format(new Date(integration.tokenRotationDueAt), "MMM d, yyyy") : "Not set"}
                        {isRotationDue && <span className="text-xs ml-1">(due soon)</span>}
                      </p>
                    </div>
                  </div>

                  {/* What gets synced */}
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-1.5">
                    <p className="font-semibold flex items-center gap-1.5">
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                      What syncs from HighLevel
                    </p>
                    <p><span className="font-medium">Social Posts:</span> Scheduled and published posts from Facebook, Instagram, Instagram Stories, TikTok, LinkedIn, Twitter/X, YouTube Shorts, Google My Business, and Podcasts → Social section.</p>
                    <p><span className="font-medium">Blog Posts:</span> Published and scheduled blog posts from all blogs in your location → Blog Post lane.</p>
                    <p><span className="font-medium">Email Campaigns:</span> All email (and SMS) campaigns → Email section of your Master Planner.</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => validateMutation.mutate({ workspaceId, id: integration.id })}
                      disabled={validateMutation.isPending}
                    >
                      {validateMutation.isPending ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1.5" />}
                      Validate Connection
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSync(integration.id)}
                      disabled={isSyncing || integration.status !== "connected"}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isSyncing ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <ArrowDownToLine className="h-3 w-3 mr-1.5" />}
                      Sync Social Posts
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSyncBlogs(integration.id)}
                      disabled={blogSyncingId === integration.id || integration.status !== "connected"}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      {blogSyncingId === integration.id ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <ArrowDownToLine className="h-3 w-3 mr-1.5" />}
                      Sync Blog Posts
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSyncEmails(integration.id)}
                      disabled={emailSyncingId === integration.id || integration.status !== "connected"}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {emailSyncingId === integration.id ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <ArrowDownToLine className="h-3 w-3 mr-1.5" />}
                      Sync Email Campaigns
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowRotate(integration.id)}
                    >
                      <RotateCw className="h-3 w-3 mr-1.5" />
                      Replace Token
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ workspaceId, id: integration.id })}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3 mr-1.5" />
                      Disconnect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Connected Social Accounts — always visible when integration exists */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Connected Social Accounts
                  {socialAccounts && socialAccounts.length > 0 && (
                    <span className="ml-1.5 font-normal">({socialAccounts.length})</span>
                  )}
                </h2>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => firstIntegration && refreshAccountsMutation.mutate(firstIntegration.id)}
                disabled={refreshAccountsMutation.isPending}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${refreshAccountsMutation.isPending ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {/* Loading — initial accounts load OR refresh in progress with no data yet */}
            {(isAccountsLoading || (refreshAccountsMutation.isPending && !socialAccounts?.length)) && (
              <div className="flex items-center justify-center py-10 rounded-lg border">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">Fetching connected accounts from HighLevel…</span>
              </div>
            )}

            {/* Account cards — shown whenever data is present, even while a background refresh runs */}
            {!isAccountsLoading && socialAccounts && socialAccounts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {socialAccounts.map((acct) => (
                  <AccountCard
                    key={acct.id}
                    acct={acct}
                    syncInfo={syncResult?.accountBreakdown?.[acct.accountId]}
                  />
                ))}
              </div>
            )}

            {/* Empty state — query resolved but no accounts found */}
            {!isAccountsLoading && !refreshAccountsMutation.isPending && !isAccountsError &&
              (socialAccounts === undefined || socialAccounts.length === 0) && (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">No connected accounts found</p>
                <p className="text-xs text-muted-foreground mt-1 mb-3 max-w-sm mx-auto">
                  Make sure your HighLevel token has the <strong>socialplanner/account.readonly</strong> scope, then click Refresh.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => firstIntegration && refreshAccountsMutation.mutate(firstIntegration.id)}
                >
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Refresh from HighLevel
                </Button>
              </div>
            )}

            {/* Error state — accounts query failed */}
            {isAccountsError && !refreshAccountsMutation.isPending && (
              <div className="rounded-lg border border-dashed border-destructive/40 p-8 text-center">
                <XCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
                <p className="text-sm font-medium">Could not load accounts</p>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  There was an error fetching your connected accounts.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => firstIntegration && refreshAccountsMutation.mutate(firstIntegration.id)}
                >
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Retry
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connect Dialog */}
      <Dialog open={showConnect} onOpenChange={setShowConnect}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect HighLevel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-semibold mb-2">How to get your Private Integration Token:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Log into HighLevel and go to Settings</li>
                <li>Find "Private Integrations" in the left menu</li>
                <li>Click "Add Integration", give it a name</li>
                <li>Select required scopes (contacts, opportunities, social planner, blogs)</li>
                <li>Copy the token immediately — it won't be shown again</li>
              </ol>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">How to find your Location ID:</p>
              <p>Go to Settings → Business Profile, or check the URL after /location/ in HighLevel.</p>
            </div>
            <div>
              <Label htmlFor="hl-token">Private Integration Token *</Label>
              <div className="relative mt-1">
                <Input
                  id="hl-token"
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="eyJ..."
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Your token is encrypted and only the last 4 characters are stored visibly.</p>
            </div>
            <div>
              <Label htmlFor="hl-location">Location ID *</Label>
              <Input
                id="hl-location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                placeholder="abc123..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnect(false)}>Cancel</Button>
            <Button onClick={handleConnect} disabled={!token || !locationId || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotate Token Dialog */}
      <Dialog open={showRotate !== null} onOpenChange={() => setShowRotate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Replace Token</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
              HighLevel recommends rotating tokens every 90 days. Generate a new token in HighLevel settings, then paste it here.
            </div>
            <div>
              <Label>New Token</Label>
              <div className="relative mt-1">
                <Input
                  type={showToken ? "text" : "password"}
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  placeholder="eyJ..."
                  className="pr-10"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowToken(!showToken)}>
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRotate(null)}>Cancel</Button>
            <Button onClick={() => showRotate && handleRotate(showRotate)} disabled={!newToken || updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
