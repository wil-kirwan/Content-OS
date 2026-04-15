import { useState } from "react";
import { useLocation } from "wouter";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  useGetCampaign,
  useUpdateCampaign,
  useGetPlannerItems,
  getGetCampaignQueryKey,
  getGetPlannerItemsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Edit, Loader2, Calendar, Tag, Target, Layers } from "lucide-react";
import { LANE_GROUPS, STATUS_BADGE_COLORS, APPROVAL_BADGE_COLORS } from "@/lib/planner-constants";

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  promo: "Promotion", launch: "Product Launch", evergreen: "Evergreen",
  holiday: "Holiday", event: "Event", other: "Other",
};

export default function CampaignDetail({ params }: { params?: { id?: string } }) {
  const [, navigate] = useLocation();
  const campaignId = parseInt(params?.id ?? "0", 10);
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const { data: campaign, isLoading: loadingCampaign } = useGetCampaign(
    workspaceId,
    campaignId,
    { query: { enabled: !!workspaceId && !!campaignId, queryKey: getGetCampaignQueryKey(workspaceId, campaignId) } }
  );

  const { data: items, isLoading: loadingItems } = useGetPlannerItems(
    workspaceId,
    { campaignId },
    { query: { enabled: !!workspaceId, queryKey: getGetPlannerItemsQueryKey(workspaceId, { campaignId }) } }
  );

  const updateMutation = useUpdateCampaign({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(workspaceId, campaignId) });
        setShowEdit(false);
      },
    },
  });

  const openEdit = () => {
    if (!campaign) return;
    setFormData({
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      startDate: campaign.startDate ?? "",
      endDate: campaign.endDate ?? "",
      theme: campaign.theme ?? "",
      objective: campaign.objective ?? "",
    });
    setShowEdit(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      workspaceId,
      id: campaignId,
      data: {
        name: formData.name,
        type: formData.type as "promo" | "launch" | "evergreen" | "holiday" | "event" | "other",
        status: formData.status as "draft" | "active" | "completed" | "archived",
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        theme: formData.theme || null,
        objective: formData.objective || null,
      },
    });
  };

  if (loadingCampaign) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Campaign not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/campaigns")}>Back to Campaigns</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate("/campaigns")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Campaigns
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
          <div className="flex gap-2 mt-1">
            <Badge variant="outline">{CAMPAIGN_TYPE_LABELS[campaign.type] || campaign.type}</Badge>
            <Badge variant="outline">{campaign.status}</Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={openEdit}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {campaign.startDate && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                <span>Dates</span>
              </div>
              <p className="font-medium text-sm">{campaign.startDate} — {campaign.endDate || "ongoing"}</p>
            </CardContent>
          </Card>
        )}
        {campaign.theme && (
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Tag className="h-4 w-4" />
                <span>Theme</span>
              </div>
              <p className="font-medium text-sm">{campaign.theme}</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Layers className="h-4 w-4" />
              <span>Items</span>
            </div>
            <p className="font-medium text-sm">{campaign.itemCount} planned items</p>
          </CardContent>
        </Card>
      </div>

      {campaign.objective && (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Target className="h-4 w-4" />
              <span>Objective</span>
            </div>
            <p className="text-sm">{campaign.objective}</p>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Planner Items ({items?.length ?? 0})</h2>
        {loadingItems ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : !items || items.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground text-sm">No items in this campaign yet. Add items from the Planner and assign them to this campaign.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const laneInfo = LANE_GROUPS.find(g => g.key === item.laneGroup);
              return (
                <Card key={item.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${laneInfo?.dotColor || "bg-gray-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.laneName} • {item.plannedDate || "No date"}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_COLORS[item.status] || "bg-gray-100"}`}>
                          {item.status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${APPROVAL_BADGE_COLORS[item.approvalStatus] || "bg-gray-100"}`}>
                          {item.approvalStatus.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Campaign Name</Label>
              <Input value={formData.name || ""} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CAMPAIGN_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Label>Start Date</Label>
                <Input type="date" value={formData.startDate || ""} onChange={(e) => setFormData(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={formData.endDate || ""} onChange={(e) => setFormData(p => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Theme</Label>
              <Input value={formData.theme || ""} onChange={(e) => setFormData(p => ({ ...p, theme: e.target.value }))} />
            </div>
            <div>
              <Label>Objective</Label>
              <Textarea rows={2} value={formData.objective || ""} onChange={(e) => setFormData(p => ({ ...p, objective: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
