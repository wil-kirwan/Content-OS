import { useState } from "react";
import { useLocation } from "wouter";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  useGetCampaigns,
  useCreateCampaign,
  useDeleteCampaign,
  getGetCampaignsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Trash2, ExternalLink, Tag, Calendar } from "lucide-react";
import { format } from "date-fns";

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  promo: "Promotion",
  launch: "Product Launch",
  evergreen: "Evergreen",
  holiday: "Holiday",
  event: "Event",
  other: "Other",
};

const CAMPAIGN_TYPE_COLORS: Record<string, string> = {
  promo: "bg-orange-100 text-orange-800",
  launch: "bg-blue-100 text-blue-800",
  evergreen: "bg-green-100 text-green-800",
  holiday: "bg-purple-100 text-purple-800",
  event: "bg-pink-100 text-pink-800",
  other: "bg-gray-100 text-gray-800",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  archived: "bg-red-100 text-red-700",
};

export default function Campaigns() {
  const { workspaceId } = useWorkspace();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "launch" as const,
    status: "draft" as const,
    startDate: "",
    endDate: "",
    theme: "",
    objective: "",
    color: "#002b78",
  });

  const { data: campaigns, isLoading } = useGetCampaigns(
    workspaceId,
    {},
    { query: { enabled: !!workspaceId, queryKey: getGetCampaignsQueryKey(workspaceId, {}) } }
  );

  const createMutation = useCreateCampaign({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey(workspaceId, {}) });
        setShowCreate(false);
        setFormData({ name: "", type: "launch", status: "draft", startDate: "", endDate: "", theme: "", objective: "", color: "#002b78" });
      },
    },
  });

  const deleteMutation = useDeleteCampaign({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey(workspaceId, {}) });
      },
    },
  });

  const handleCreate = () => {
    if (!formData.name) return;
    createMutation.mutate({
      workspaceId,
      data: {
        name: formData.name,
        type: formData.type,
        status: formData.status,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        theme: formData.theme || null,
        objective: formData.objective || null,
        color: formData.color || null,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">Manage your marketing campaigns, promos, and launches.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Tag className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No campaigns yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first campaign to start organizing your marketing efforts.</p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card
              key={campaign.id}
              className="cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => navigate(`/campaigns/${campaign.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{campaign.name}</CardTitle>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAMPAIGN_TYPE_COLORS[campaign.type] || "bg-gray-100 text-gray-700"}`}>
                        {CAMPAIGN_TYPE_LABELS[campaign.type] || campaign.type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[campaign.status] || "bg-gray-100"}`}>
                        {campaign.status}
                      </span>
                    </div>
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate({ workspaceId, id: campaign.id });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {campaign.objective && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{campaign.objective}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {campaign.startDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{campaign.startDate}</span>
                      {campaign.endDate && <span>— {campaign.endDate}</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="font-medium text-foreground">{campaign.itemCount}</span>
                    <span>items</span>
                  </div>
                </div>
                <div className="flex items-center mt-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View campaign
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="camp-name">Campaign Name *</Label>
              <Input
                id="camp-name"
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Summer 2025 Launch"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData(p => ({ ...p, type: v as typeof formData.type }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CAMPAIGN_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v as typeof formData.status }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input id="start-date" type="date" value={formData.startDate} onChange={(e) => setFormData(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input id="end-date" type="date" value={formData.endDate} onChange={(e) => setFormData(p => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="theme">Theme</Label>
              <Input id="theme" value={formData.theme} onChange={(e) => setFormData(p => ({ ...p, theme: e.target.value }))} placeholder="Summer vibes, growth, re-engagement..." />
            </div>
            <div>
              <Label htmlFor="objective">Objective</Label>
              <Textarea id="objective" value={formData.objective} onChange={(e) => setFormData(p => ({ ...p, objective: e.target.value }))} placeholder="What does this campaign aim to achieve?" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!formData.name || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
