import { useState, useMemo } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  useGetPlannerItems,
  useCreatePlannerItem,
  useUpdatePlannerItem,
  useDeletePlannerItem,
  useGetCampaigns,
  getGetPlannerItemsQueryKey,
  getGetCampaignsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Plus, ChevronLeft, ChevronRight, Loader2, Trash2, Calendar as CalendarIcon,
  Layout, List, X, ExternalLink, RefreshCw, AlertCircle, CheckCircle2
} from "lucide-react";
import { format, parse, addMonths, subMonths, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { LANE_GROUPS, STATUS_BADGE_COLORS, APPROVAL_BADGE_COLORS, SYNC_STATUS_COLORS, PRIORITY_COLORS } from "@/lib/planner-constants";
import type { PlannerItem } from "@workspace/api-client-react";

const BLANK_FORM = {
  title: "",
  laneGroup: "social" as const,
  laneName: "",
  description: "",
  plannedDate: "",
  dueDate: "",
  ownerName: "",
  status: "planned" as const,
  approvalStatus: "pending" as const,
  priority: "medium" as const,
  notes: "",
  campaignId: null as number | null,
};

export default function Planner() {
  const { workspaceId, currentMonth, setCurrentMonth } = useWorkspace();
  const queryClient = useQueryClient();
  const [view, setView] = useState("board");
  const [selectedItem, setSelectedItem] = useState<PlannerItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [filterLane, setFilterLane] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const parsedMonth = parse(currentMonth + "-01", "yyyy-MM-dd", new Date());

  const { data: items, isLoading } = useGetPlannerItems(
    workspaceId,
    { month: currentMonth },
    { query: { enabled: !!workspaceId, queryKey: getGetPlannerItemsQueryKey(workspaceId, { month: currentMonth }) } }
  );

  const { data: campaigns } = useGetCampaigns(
    workspaceId,
    {},
    { query: { enabled: !!workspaceId, queryKey: getGetCampaignsQueryKey(workspaceId, {}) } }
  );

  const createMutation = useCreatePlannerItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPlannerItemsQueryKey(workspaceId, { month: currentMonth }) });
        setCreating(false);
        setForm({ ...BLANK_FORM });
      },
    },
  });

  const updateMutation = useUpdatePlannerItem({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetPlannerItemsQueryKey(workspaceId, { month: currentMonth }) });
        setSelectedItem(data);
      },
    },
  });

  const deleteMutation = useDeletePlannerItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPlannerItemsQueryKey(workspaceId, { month: currentMonth }) });
        setSelectedItem(null);
      },
    },
  });

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      if (filterLane && item.laneGroup !== filterLane) return false;
      if (searchTerm && !item.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [items, filterLane, searchTerm]);

  const laneItems = (laneGroupKey: string, laneName: string) =>
    filteredItems.filter((i) => i.laneGroup === laneGroupKey && i.laneName === laneName);

  const handleCreate = () => {
    if (!form.title || !form.laneGroup || !form.laneName) return;
    createMutation.mutate({
      workspaceId,
      data: {
        title: form.title,
        laneGroup: form.laneGroup,
        laneName: form.laneName,
        description: form.description || null,
        plannedDate: form.plannedDate || null,
        dueDate: form.dueDate || null,
        ownerName: form.ownerName || null,
        status: form.status,
        approvalStatus: form.approvalStatus,
        priority: form.priority,
        notes: form.notes || null,
        campaignId: form.campaignId || null,
      },
    });
  };

  const handleUpdateField = (field: string, value: string | number | null) => {
    if (!selectedItem) return;
    updateMutation.mutate({
      workspaceId,
      id: selectedItem.id,
      data: { [field]: value },
    });
    setSelectedItem((prev) => prev ? { ...prev, [field]: value } : null);
  };

  const openCreate = (laneGroupKey?: string, laneName?: string) => {
    setForm({
      ...BLANK_FORM,
      laneGroup: (laneGroupKey as typeof BLANK_FORM.laneGroup) || "social",
      laneName: laneName || "",
      plannedDate: currentMonth + "-01",
    });
    setCreating(true);
  };

  const navMonth = (dir: "prev" | "next") => {
    const parsed = parse(currentMonth + "-01", "yyyy-MM-dd", new Date());
    const next = dir === "next" ? addMonths(parsed, 1) : subMonths(parsed, 1);
    setCurrentMonth(format(next, "yyyy-MM"));
  };

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(parsedMonth);
    const firstDayOfWeek = getDay(startOfMonth(parsedMonth));
    const days: (null | number)[] = Array(firstDayOfWeek).fill(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [parsedMonth]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, PlannerItem[]> = {};
    filteredItems.forEach((item) => {
      if (item.plannedDate) {
        const day = item.plannedDate.split("T")[0];
        if (!map[day]) map[day] = [];
        map[day].push(item);
      }
    });
    return map;
  }, [filteredItems]);

  const laneGroup = LANE_GROUPS.find(g => g.key === form.laneGroup);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Master Planner</h1>
          <p className="text-muted-foreground text-sm">{filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""} in {format(parsedMonth, "MMMM yyyy")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month Nav */}
          <div className="flex items-center gap-1 border rounded-md">
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navMonth("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2 min-w-[110px] text-center">{format(parsedMonth, "MMMM yyyy")}</span>
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navMonth("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Input
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 w-[140px] text-sm"
          />
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Item
          </Button>
        </div>
      </div>

      {/* Lane filter chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterLane(null)}
          className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${!filterLane ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
        >
          All Lanes
        </button>
        {LANE_GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => setFilterLane(filterLane === g.key ? null : g.key)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${filterLane === g.key ? `${g.color} text-white border-transparent` : "border-border hover:border-primary/50"}`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Views */}
      <Tabs value={view} onValueChange={setView} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-fit">
          <TabsTrigger value="board" className="gap-1.5 text-xs">
            <Layout className="h-3.5 w-3.5" />
            Board
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5 text-xs">
            <CalendarIcon className="h-3.5 w-3.5" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-1.5 text-xs">
            <List className="h-3.5 w-3.5" />
            List
          </TabsTrigger>
        </TabsList>

        {/* Board View — 7 Lane Groups */}
        <TabsContent value="board" className="flex-1 mt-4 overflow-x-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6 pb-6">
              {LANE_GROUPS.filter(g => !filterLane || g.key === filterLane).map((group) => (
                <div key={group.key}>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md ${group.lightColor} border-b-2 ${group.color.replace("bg-", "border-")}`}>
                    <div className={`w-3 h-3 rounded-full ${group.color}`} />
                    <h3 className={`text-sm font-semibold ${group.textColor}`}>{group.label}</h3>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {filteredItems.filter(i => i.laneGroup === group.key).length} items
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="flex gap-4 p-3 min-w-max">
                      {group.laneNames.map((laneName) => {
                        const laneItemsList = laneItems(group.key, laneName);
                        return (
                          <div key={laneName} className="w-56 flex-shrink-0">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-medium text-muted-foreground truncate">{laneName}</p>
                              <button
                                className="text-muted-foreground hover:text-primary transition-colors"
                                onClick={() => openCreate(group.key, laneName)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="space-y-2 min-h-[60px]">
                              {laneItemsList.map((item) => (
                                <PlannerCard
                                  key={item.id}
                                  item={item}
                                  onClick={() => setSelectedItem(item)}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Calendar View */}
        <TabsContent value="calendar" className="flex-1 mt-4 overflow-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 bg-muted/50">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                  <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0">{d}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  const dateStr = day ? `${currentMonth}-${String(day).padStart(2, "0")}` : null;
                  const dayItems = dateStr ? (itemsByDate[dateStr] || []) : [];
                  return (
                    <div
                      key={idx}
                      className="min-h-[100px] border-r border-b last:border-r-0 p-1.5 relative"
                    >
                      {day && (
                        <>
                          <span className="text-xs font-medium text-muted-foreground block mb-1">{day}</span>
                          <div className="space-y-1">
                            {dayItems.slice(0, 3).map((item) => {
                              const lane = LANE_GROUPS.find(g => g.key === item.laneGroup);
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => setSelectedItem(item)}
                                  className={`w-full text-left text-xs px-1.5 py-0.5 rounded truncate ${lane?.color || "bg-gray-500"} text-white`}
                                >
                                  {item.title}
                                </button>
                              );
                            })}
                            {dayItems.length > 3 && (
                              <p className="text-xs text-muted-foreground pl-1">+{dayItems.length - 3} more</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* List View */}
        <TabsContent value="list" className="flex-1 mt-4 overflow-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarIcon className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p>No items for this month{filterLane ? " in this lane" : ""}.</p>
              <Button size="sm" className="mt-3" onClick={() => openCreate()}>
                <Plus className="h-4 w-4 mr-1.5" />
                Create First Item
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Title</th>
                    <th className="text-left px-3 py-2 font-medium">Lane</th>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Approval</th>
                    <th className="text-left px-3 py-2 font-medium">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const lane = LANE_GROUPS.find(g => g.key === item.laneGroup);
                    return (
                      <tr
                        key={item.id}
                        className="border-t hover:bg-muted/30 cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                      >
                        <td className="px-4 py-2 font-medium max-w-[200px] truncate">{item.title}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${lane?.color || "bg-gray-400"}`} />
                            <span className="text-xs text-muted-foreground truncate">{item.laneName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{item.plannedDate || "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_COLORS[item.status] || "bg-gray-100"}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${APPROVAL_BADGE_COLORS[item.approvalStatus] || "bg-gray-100"}`}>
                            {item.approvalStatus.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{item.ownerName || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Item Detail Drawer */}
      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedItem && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-2">
                  <SheetTitle className="text-base leading-tight">{selectedItem.title}</SheetTitle>
                  <button
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-1"
                    onClick={() => {
                      if (confirm("Delete this item?")) {
                        deleteMutation.mutate({ workspaceId, id: selectedItem.id });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(() => {
                    const lane = LANE_GROUPS.find(g => g.key === selectedItem.laneGroup);
                    return (
                      <span className={`text-xs px-2 py-0.5 rounded-full text-white font-medium ${lane?.color || "bg-gray-500"}`}>
                        {lane?.label || selectedItem.laneGroup}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-muted-foreground">{selectedItem.laneName}</span>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {/* Status row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={selectedItem.status}
                      onValueChange={(v) => handleUpdateField("status", v)}
                    >
                      <SelectTrigger className="mt-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["draft", "planned", "scheduled", "synced", "published", "failed", "archived"].map(s => (
                          <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Approval</Label>
                    <Select
                      value={selectedItem.approvalStatus}
                      onValueChange={(v) => handleUpdateField("approvalStatus", v)}
                    >
                      <SelectTrigger className="mt-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["pending", "approved", "needs_changes", "approved_to_publish"].map(s => (
                          <SelectItem key={s} value={s} className="text-xs">{s.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Priority, Owner */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Priority</Label>
                    <Select
                      value={selectedItem.priority}
                      onValueChange={(v) => handleUpdateField("priority", v)}
                    >
                      <SelectTrigger className="mt-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low" className="text-xs">Low</SelectItem>
                        <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                        <SelectItem value="high" className="text-xs">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Owner</Label>
                    <Input
                      className="mt-1 h-8 text-xs"
                      defaultValue={selectedItem.ownerName || ""}
                      onBlur={(e) => handleUpdateField("ownerName", e.target.value || null)}
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Planned Date</Label>
                    <Input
                      type="date"
                      className="mt-1 h-8 text-xs"
                      defaultValue={selectedItem.plannedDate?.split("T")[0] || ""}
                      onBlur={(e) => handleUpdateField("plannedDate", e.target.value || null)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Due Date</Label>
                    <Input
                      type="date"
                      className="mt-1 h-8 text-xs"
                      defaultValue={selectedItem.dueDate?.split("T")[0] || ""}
                      onBlur={(e) => handleUpdateField("dueDate", e.target.value || null)}
                    />
                  </div>
                </div>

                {/* Campaign */}
                <div>
                  <Label className="text-xs">Campaign</Label>
                  <Select
                    value={selectedItem.campaignId?.toString() || "none"}
                    onValueChange={(v) => handleUpdateField("campaignId", v === "none" ? null : parseInt(v, 10))}
                  >
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">No Campaign</SelectItem>
                      {campaigns?.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()} className="text-xs">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Description */}
                <div>
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    className="mt-1 text-xs"
                    rows={2}
                    defaultValue={selectedItem.description || ""}
                    onBlur={(e) => handleUpdateField("description", e.target.value || null)}
                    placeholder="What is this piece of content about?"
                  />
                </div>

                {/* Notes */}
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    className="mt-1 text-xs"
                    rows={2}
                    defaultValue={selectedItem.notes || ""}
                    onBlur={(e) => handleUpdateField("notes", e.target.value || null)}
                    placeholder="Internal notes, links, instructions..."
                  />
                </div>

                <Separator />

                {/* HighLevel Sync status */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">HighLevel Sync</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${SYNC_STATUS_COLORS[selectedItem.syncStatus] || "bg-gray-100"}`}>
                      {selectedItem.syncStatus.replace("_", " ")}
                    </span>
                    {selectedItem.externalObjectId && (
                      <span className="text-xs text-muted-foreground font-mono">ID: {selectedItem.externalObjectId}</span>
                    )}
                    {selectedItem.lastSyncAt && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        Synced {format(new Date(selectedItem.lastSyncAt), "MMM d, h:mm a")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Meta */}
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <p>Created: {format(new Date(selectedItem.createdAt), "MMM d, yyyy h:mm a")}</p>
                  <p>Updated: {format(new Date(selectedItem.updatedAt), "MMM d, yyyy h:mm a")}</p>
                  {selectedItem.publishedAt && (
                    <p>Published: {format(new Date(selectedItem.publishedAt), "MMM d, yyyy h:mm a")}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Item Drawer */}
      <Sheet open={creating} onOpenChange={(open) => !open && setCreating(false)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create Planner Item</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                className="mt-1"
                placeholder="What is this piece of content?"
                value={form.title}
                onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Lane Group *</Label>
                <Select
                  value={form.laneGroup}
                  onValueChange={(v) => {
                    const group = LANE_GROUPS.find(g => g.key === v);
                    setForm(p => ({ ...p, laneGroup: v as typeof BLANK_FORM.laneGroup, laneName: group?.laneNames[0] || "" }));
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANE_GROUPS.map(g => (
                      <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lane *</Label>
                <Select
                  value={form.laneName}
                  onValueChange={(v) => setForm(p => ({ ...p, laneName: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select lane" />
                  </SelectTrigger>
                  <SelectContent>
                    {laneGroup?.laneNames.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: v as typeof form.status }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["draft", "planned", "scheduled", "published"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm(p => ({ ...p, priority: v as typeof form.priority }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Planned Date</Label>
                <Input type="date" className="mt-1" value={form.plannedDate} onChange={(e) => setForm(p => ({ ...p, plannedDate: e.target.value }))} />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" className="mt-1" value={form.dueDate} onChange={(e) => setForm(p => ({ ...p, dueDate: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Owner</Label>
                <Input className="mt-1" placeholder="Name or email" value={form.ownerName} onChange={(e) => setForm(p => ({ ...p, ownerName: e.target.value }))} />
              </div>
              <div>
                <Label>Campaign</Label>
                <Select
                  value={form.campaignId?.toString() || "none"}
                  onValueChange={(v) => setForm(p => ({ ...p, campaignId: v === "none" ? null : parseInt(v, 10) }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Campaign</SelectItem>
                    {campaigns?.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea className="mt-1" rows={2} placeholder="Brief description..." value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea className="mt-1" rows={2} placeholder="Internal notes, asset links..." value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!form.title || !form.laneGroup || !form.laneName || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Item
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PlannerCard({ item, onClick }: { item: PlannerItem; onClick: () => void }) {
  const statusColor = STATUS_BADGE_COLORS[item.status] || "bg-gray-100 text-gray-700";
  const priorityColor = PRIORITY_COLORS[item.priority] || "text-gray-500";

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border rounded-md p-2.5 hover:shadow-sm transition-shadow text-xs group"
    >
      <p className="font-medium text-foreground line-clamp-2 mb-1.5 leading-tight">{item.title}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`px-1.5 py-0.5 rounded-sm font-medium text-[10px] ${statusColor}`}>{item.status}</span>
        {item.plannedDate && (
          <span className="text-muted-foreground text-[10px]">{item.plannedDate.split("T")[0]}</span>
        )}
      </div>
      {item.ownerName && (
        <p className="text-[10px] text-muted-foreground mt-1 truncate">{item.ownerName}</p>
      )}
    </button>
  );
}
