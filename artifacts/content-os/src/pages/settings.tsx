import { useState, useEffect } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  useGetWorkspace,
  useUpdateWorkspace,
  getGetWorkspaceQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Sydney",
  "UTC",
];

const INDUSTRIES = [
  "E-Commerce",
  "SaaS / Technology",
  "Consulting / Services",
  "Healthcare",
  "Real Estate",
  "Education",
  "Finance",
  "Marketing / Agency",
  "Retail",
  "Non-Profit",
  "Media / Entertainment",
  "Other",
];

export default function Settings() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    industry: "",
    timezone: "America/New_York",
  });

  const { data: workspace, isLoading } = useGetWorkspace(
    workspaceId,
    { query: { enabled: !!workspaceId, queryKey: getGetWorkspaceQueryKey(workspaceId) } }
  );

  const updateMutation = useUpdateWorkspace({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey(workspaceId) });
        toast({ title: "Settings saved", description: "Workspace settings have been updated." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save settings. Please try again.", variant: "destructive" });
      },
    },
  });

  useEffect(() => {
    if (workspace) {
      setFormData({
        name: workspace.name,
        description: workspace.description ?? "",
        industry: workspace.industry ?? "",
        timezone: workspace.timezone ?? "America/New_York",
      });
    }
  }, [workspace]);

  const handleSave = () => {
    updateMutation.mutate({
      id: workspaceId,
      data: {
        name: formData.name,
        description: formData.description || null,
        industry: formData.industry || null,
        timezone: formData.timezone,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your workspace configuration.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Workspace Settings</CardTitle>
          </div>
          <CardDescription>Basic information about your marketing workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="ws-name">Workspace Name *</Label>
            <Input
              id="ws-name"
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="ws-desc">Description</Label>
            <Textarea
              id="ws-desc"
              value={formData.description}
              onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
              className="mt-1"
              rows={2}
              placeholder="Brief description of this workspace..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Industry</Label>
              <Select value={formData.industry} onValueChange={(v) => setFormData(p => ({ ...p, industry: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timezone</Label>
              <Select value={formData.timezone} onValueChange={(v) => setFormData(p => ({ ...p, timezone: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {workspace && (
            <div className="text-xs text-muted-foreground pt-2 border-t">
              <p>Workspace ID: {workspace.id} • Slug: {workspace.slug}</p>
              <p>Created: {new Date(workspace.createdAt).toLocaleDateString()}</p>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={!formData.name || updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
