import { useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  useGetIntegrations,
  useCreateIntegration,
  useUpdateIntegration,
  useDeleteIntegration,
  useValidateIntegration,
  useSyncIntegration,
  getGetIntegrationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, RefreshCw, Plus, Shield, Eye, EyeOff,
  Loader2, Trash2, RotateCw, Link2
} from "lucide-react";
import { format } from "date-fns";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  connected: { label: "Connected", color: "text-green-600", icon: CheckCircle2 },
  disconnected: { label: "Disconnected", color: "text-gray-500", icon: XCircle },
  token_invalid: { label: "Token Invalid", color: "text-red-600", icon: XCircle },
  missing_scope: { label: "Missing Scope", color: "text-orange-600", icon: AlertTriangle },
  sync_delayed: { label: "Sync Delayed", color: "text-amber-600", icon: Clock },
};

export default function Integrations() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [showConnect, setShowConnect] = useState(false);
  const [showRotate, setShowRotate] = useState<number | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState("");
  const [locationId, setLocationId] = useState("");
  const [newToken, setNewToken] = useState("");

  const { data: integrations, isLoading } = useGetIntegrations(
    workspaceId,
    { query: { enabled: !!workspaceId, queryKey: getGetIntegrationsQueryKey(workspaceId) } }
  );

  const createMutation = useCreateIntegration({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIntegrationsQueryKey(workspaceId) });
        setShowConnect(false);
        setToken("");
        setLocationId("");
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
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIntegrationsQueryKey(workspaceId) });
      },
    },
  });

  const syncMutation = useSyncIntegration({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIntegrationsQueryKey(workspaceId) });
      },
    },
  });

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
                      variant="outline"
                      onClick={() => syncMutation.mutate({ workspaceId, id: integration.id })}
                      disabled={syncMutation.isPending || integration.status !== "connected"}
                    >
                      {syncMutation.isPending ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1.5" />}
                      Sync Now
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
