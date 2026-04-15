import { useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  useGetTemplates,
  useCreateTemplate,
  useDeleteTemplate,
  useApplyTemplate,
  getGetTemplatesQueryKey,
  getGetPlannerItemsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, LayoutTemplate, Loader2, Play, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Templates() {
  const { workspaceId, currentMonth } = useWorkspace();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showApply, setShowApply] = useState<number | null>(null);
  const [applyMonth, setApplyMonth] = useState(currentMonth);
  const [applyStartDate, setApplyStartDate] = useState(currentMonth + "-01");

  const { data: templates, isLoading } = useGetTemplates(
    workspaceId,
    { query: { enabled: !!workspaceId, queryKey: getGetTemplatesQueryKey(workspaceId) } }
  );

  const deleteMutation = useDeleteTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTemplatesQueryKey(workspaceId) });
        toast({ title: "Template deleted" });
      },
    },
  });

  const applyMutation = useApplyTemplate({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetPlannerItemsQueryKey(workspaceId, {}) });
        setShowApply(null);
        toast({ title: `Template applied — ${Array.isArray(data) ? data.length : 0} items created` });
      },
    },
  });

  const handleApply = () => {
    if (!showApply) return;
    applyMutation.mutate({
      workspaceId,
      id: showApply,
      data: { month: applyMonth, startDate: applyStartDate },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">Prebuilt monthly planning frameworks to get started fast.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !templates || templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LayoutTemplate className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No templates yet</p>
            <p className="text-sm text-muted-foreground mt-1">Templates are prebuilt starting points for your monthly plan.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.description && <CardDescription className="mt-1">{template.description}</CardDescription>}
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{template.category}</Badge>
                      <Badge variant="outline">
                        <Layers className="h-3 w-3 mr-1" />
                        {template.itemCount} items
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {template.items && template.items.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Includes:</p>
                    <div className="space-y-1">
                      {(template.items as Array<{ laneGroup: string; laneName: string; title: string }>).slice(0, 4).map((item, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-primary/40 rounded-full flex-shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </div>
                      ))}
                      {template.items.length > 4 && (
                        <p className="text-xs text-muted-foreground pl-3.5">+{template.items.length - 4} more items</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowApply(template.id);
                      setApplyMonth(currentMonth);
                      setApplyStartDate(currentMonth + "-01");
                    }}
                  >
                    <Play className="h-3 w-3 mr-1.5" />
                    Apply Template
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate({ workspaceId, id: template.id })}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showApply !== null} onOpenChange={() => setShowApply(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will create planner items from the template, starting from the date you specify. Existing items are not affected.
            </p>
            <div>
              <Label>Target Month (YYYY-MM)</Label>
              <Input
                type="month"
                value={applyMonth}
                onChange={(e) => setApplyMonth(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={applyStartDate}
                onChange={(e) => setApplyStartDate(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Template items are offset from this start date.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApply(null)}>Cancel</Button>
            <Button onClick={handleApply} disabled={applyMutation.isPending}>
              {applyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
