import { useState, useRef, useCallback } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  useGetTemplates,
  useCreateTemplate,
  useDeleteTemplate,
  useApplyTemplate,
  useImportTemplates,
  getGetTemplatesQueryKey,
  getGetPlannerItemsQueryKey,
} from "@workspace/api-client-react";
import type { TemplateItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, LayoutTemplate, Loader2, Play, Layers, Upload, FileJson, FileText, X, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LANE_GROUPS } from "@/lib/planner-constants";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftItem extends TemplateItem {
  _key: string;
}

interface ParsedTemplate {
  name: string;
  description: string;
  category: string;
  items: TemplateItem[];
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim().replace(/^"|"$/g, ""); });
    return row;
  }).filter((r) => Object.values(r).some((v) => v));
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function csvRowToTemplateItem(row: Record<string, string>): TemplateItem | null {
  const laneGroup = row["laneGroup"] || row["lane_group"] || row["group"] || "";
  const laneName = row["laneName"] || row["lane_name"] || row["lane"] || "";
  const title = row["title"] || row["name"] || "";
  if (!laneGroup || !laneName || !title) return null;
  return {
    laneGroup,
    laneName,
    title,
    description: row["description"] || undefined,
    dayOffset: parseInt(row["dayOffset"] || row["day_offset"] || "0", 10) || 0,
    channelType: row["channelType"] || row["channel_type"] || undefined,
    contentFormat: row["contentFormat"] || row["content_format"] || undefined,
    priority: row["priority"] || "medium",
  };
}

// ─── JSON Parser ──────────────────────────────────────────────────────────────

function parseJsonFile(text: string): ParsedTemplate[] | null {
  try {
    const data = JSON.parse(text);
    const toTemplate = (obj: Record<string, unknown>): ParsedTemplate => ({
      name: (obj["name"] as string) || "Imported Template",
      description: (obj["description"] as string) || "",
      category: (obj["category"] as string) || "general",
      items: ((obj["items"] as unknown[]) || []).map((item) => {
        const i = item as Record<string, unknown>;
        return {
          laneGroup: (i["laneGroup"] as string) || "",
          laneName: (i["laneName"] as string) || "",
          title: (i["title"] as string) || "",
          description: (i["description"] as string) || undefined,
          dayOffset: parseInt(String(i["dayOffset"] ?? "0"), 10) || 0,
          channelType: (i["channelType"] as string) || undefined,
          contentFormat: (i["contentFormat"] as string) || undefined,
          priority: (i["priority"] as string) || "medium",
        } as TemplateItem;
      }),
    });
    if (Array.isArray(data)) return data.map(toTemplate);
    if (typeof data === "object" && data !== null) return [toTemplate(data as Record<string, unknown>)];
    return null;
  } catch {
    return null;
  }
}

// ─── Create Template Dialog ───────────────────────────────────────────────────

function CreateTemplateDialog({ workspaceId, onClose }: { workspaceId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [items, setItems] = useState<DraftItem[]>([]);

  const createMutation = useCreateTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTemplatesQueryKey(workspaceId) });
        toast({ title: "Template created" });
        onClose();
      },
      onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
    },
  });

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        _key: crypto.randomUUID(),
        laneGroup: "social",
        laneName: "Instagram Post",
        title: "",
        dayOffset: 0,
        priority: "medium",
      },
    ]);
  };

  const updateItem = (key: string, field: keyof DraftItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item._key !== key) return item;
        const updated = { ...item, [field]: value };
        if (field === "laneGroup") {
          const group = LANE_GROUPS.find((g) => g.key === value);
          updated.laneName = group?.laneNames[0] ?? "";
        }
        return updated;
      })
    );
  };

  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i._key !== key));

  const handleSubmit = () => {
    if (!name.trim()) return;
    const cleanItems: TemplateItem[] = items.map(({ _key: _, ...rest }) => rest);
    createMutation.mutate({ workspaceId, data: { name: name.trim(), description: description || undefined, category, items: cleanItems } });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Template Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly Social Launch Pack" className="mt-1" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  {LANE_GROUPS.map((g) => (
                    <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional summary" className="mt-1" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Items ({items.length})</Label>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add Item
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="border rounded-md p-6 text-center text-sm text-muted-foreground">
                No items yet. Click "Add Item" to build your template.
              </div>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 w-32">Lane Group</th>
                      <th className="text-left px-3 py-2 w-36">Lane</th>
                      <th className="text-left px-3 py-2">Title *</th>
                      <th className="text-left px-3 py-2 w-20">Day</th>
                      <th className="text-left px-3 py-2 w-24">Priority</th>
                      <th className="px-2 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item) => {
                      const group = LANE_GROUPS.find((g) => g.key === item.laneGroup);
                      return (
                        <tr key={item._key} className="hover:bg-muted/20">
                          <td className="px-2 py-1.5">
                            <Select value={item.laneGroup} onValueChange={(v) => updateItem(item._key, "laneGroup", v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {LANE_GROUPS.map((g) => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Select value={item.laneName} onValueChange={(v) => updateItem(item._key, "laneName", v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(group?.laneNames ?? []).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              value={item.title}
                              onChange={(e) => updateItem(item._key, "title", e.target.value)}
                              placeholder="Item title"
                              className="h-7 text-xs"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              max={365}
                              value={item.dayOffset}
                              onChange={(e) => updateItem(item._key, "dayOffset", parseInt(e.target.value, 10) || 0)}
                              className="h-7 text-xs"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Select value={item.priority} onValueChange={(v) => updateItem(item._key, "priority", v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-2 py-1.5">
                            <button onClick={() => removeItem(item._key)} className="text-muted-foreground hover:text-destructive p-1 rounded">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Import Dialog ────────────────────────────────────────────────────────────

function ImportDialog({ workspaceId, onClose }: { workspaceId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState<ParsedTemplate[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"csv" | "json" | null>(null);

  const [csvMeta, setCsvMeta] = useState({ name: "Imported Template", description: "", category: "general" });

  const importMutation = useImportTemplates({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetTemplatesQueryKey(workspaceId) });
        toast({ title: `${data.length} template${data.length !== 1 ? "s" : ""} imported successfully` });
        onClose();
      },
      onError: () => toast({ title: "Import failed", variant: "destructive" }),
    },
  });

  const processFile = useCallback((file: File) => {
    setParseError(null);
    setParsed(null);

    const ext = file.name.split(".").pop()?.toLowerCase();
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? "";
      if (ext === "json") {
        setFileType("json");
        const result = parseJsonFile(text);
        if (!result || result.length === 0) {
          setParseError("Could not parse JSON. Expected an object with a 'name' and 'items' array, or an array of such objects.");
          return;
        }
        setParsed(result);
      } else if (ext === "csv") {
        setFileType("csv");
        const rows = parseCsv(text);
        if (rows.length === 0) {
          setParseError("No valid rows found. Make sure the CSV has a header row with at least: laneGroup, laneName, title.");
          return;
        }
        const items = rows.map(csvRowToTemplateItem).filter(Boolean) as TemplateItem[];
        if (items.length === 0) {
          setParseError("No items could be parsed. Check that laneGroup, laneName, and title columns are present and non-empty.");
          return;
        }
        setParsed([{ name: csvMeta.name, description: csvMeta.description, category: csvMeta.category, items }]);
      } else {
        setParseError("Unsupported file type. Please upload a .csv or .json file.");
      }
    };
    reader.readAsText(file);
  }, [csvMeta]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = () => {
    if (!parsed) return;
    const templates = fileType === "csv"
      ? [{ ...csvMeta, items: parsed[0].items }]
      : parsed;
    importMutation.mutate({ workspaceId, data: { templates } });
  };

  const totalItems = parsed?.reduce((sum, t) => sum + t.items.length, 0) ?? 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Templates</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!parsed && (
            <>
              <p className="text-sm text-muted-foreground">
                Upload a <strong>.json</strong> or <strong>.csv</strong> file to bulk-import templates.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-md p-3 bg-muted/20 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-medium mb-1">
                    <FileJson className="h-4 w-4 text-blue-500" />JSON format
                  </div>
                  <p className="text-muted-foreground">Single template or array of templates:</p>
                  <pre className="bg-background rounded p-2 overflow-x-auto text-[10px] leading-relaxed">{`[{\n  "name": "My Template",\n  "category": "social",\n  "items": [{\n    "laneGroup": "social",\n    "laneName": "Instagram Post",\n    "title": "Weekly Reel",\n    "dayOffset": 0,\n    "priority": "medium"\n  }]\n}]`}</pre>
                </div>
                <div className="border rounded-md p-3 bg-muted/20 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-medium mb-1">
                    <FileText className="h-4 w-4 text-green-500" />CSV format
                  </div>
                  <p className="text-muted-foreground">One row per item (you'll name the template below):</p>
                  <pre className="bg-background rounded p-2 overflow-x-auto text-[10px] leading-relaxed">{`laneGroup,laneName,title,\n  dayOffset,priority\nsocial,Instagram Post,\n  Weekly Reel,0,medium\nemail,Main Email Campaign,\n  Newsletter,7,high`}</pre>
                </div>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium text-sm">Drop file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Supports .json and .csv</p>
                <input ref={fileRef} type="file" accept=".json,.csv" className="hidden" onChange={handleFileChange} />
              </div>

              {parseError && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </>
          )}

          {parsed && fileType === "csv" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Parsed {parsed[0].items.length} items from CSV</p>
                <Button size="sm" variant="ghost" onClick={() => { setParsed(null); setParseError(null); }}>
                  <X className="h-3.5 w-3.5 mr-1" />Change file
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Template Name *</Label>
                  <Input value={csvMeta.name} onChange={(e) => setCsvMeta((m) => ({ ...m, name: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={csvMeta.category} onValueChange={(v) => setCsvMeta((m) => ({ ...m, category: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      {LANE_GROUPS.map((g) => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={csvMeta.description} onChange={(e) => setCsvMeta((m) => ({ ...m, description: e.target.value }))} placeholder="Optional" className="mt-1" />
                </div>
              </div>
              <PreviewTable items={parsed[0].items} />
            </div>
          )}

          {parsed && fileType === "json" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Ready to import {parsed.length} template{parsed.length !== 1 ? "s" : ""} ({totalItems} items total)
                </p>
                <Button size="sm" variant="ghost" onClick={() => { setParsed(null); setParseError(null); }}>
                  <X className="h-3.5 w-3.5 mr-1" />Change file
                </Button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {parsed.map((t, i) => (
                  <div key={i} className="border rounded-md p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">{t.name}</span>
                      <Badge variant="outline" className="text-xs">{t.category}</Badge>
                      <Badge variant="outline" className="text-xs">{t.items.length} items</Badge>
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground mb-2">{t.description}</p>}
                    <PreviewTable items={t.items.slice(0, 5)} />
                    {t.items.length > 5 && (
                      <p className="text-xs text-muted-foreground mt-1 pl-1">+{t.items.length - 5} more items</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {parsed && (
            <Button onClick={handleImport} disabled={importMutation.isPending || (fileType === "csv" && !csvMeta.name.trim())}>
              {importMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import {fileType === "json" && parsed.length > 1 ? `${parsed.length} Templates` : "Template"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewTable({ items }: { items: TemplateItem[] }) {
  return (
    <div className="border rounded overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="text-left px-2 py-1.5">Lane Group</th>
            <th className="text-left px-2 py-1.5">Lane</th>
            <th className="text-left px-2 py-1.5">Title</th>
            <th className="text-left px-2 py-1.5 w-14">Day</th>
            <th className="text-left px-2 py-1.5 w-16">Priority</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item, i) => (
            <tr key={i} className="hover:bg-muted/20">
              <td className="px-2 py-1 text-muted-foreground">{item.laneGroup}</td>
              <td className="px-2 py-1 text-muted-foreground">{item.laneName}</td>
              <td className="px-2 py-1 font-medium truncate max-w-[180px]">{item.title}</td>
              <td className="px-2 py-1 text-muted-foreground">{item.dayOffset}</td>
              <td className="px-2 py-1 text-muted-foreground">{item.priority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Apply Dialog ─────────────────────────────────────────────────────────────

function ApplyDialog({
  templateId,
  currentMonth,
  workspaceId,
  onClose,
}: {
  templateId: number;
  currentMonth: string;
  workspaceId: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [applyMonth, setApplyMonth] = useState(currentMonth);
  const [applyStartDate, setApplyStartDate] = useState(currentMonth + "-01");

  const applyMutation = useApplyTemplate({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetPlannerItemsQueryKey(workspaceId, {}) });
        onClose();
        toast({ title: `Template applied — ${Array.isArray(data) ? data.length : 0} items created` });
      },
      onError: () => toast({ title: "Failed to apply template", variant: "destructive" }),
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apply Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Creates planner items from the template starting from the date you choose. Existing items are not affected.
          </p>
          <div>
            <Label>Target Month</Label>
            <Input type="month" value={applyMonth} onChange={(e) => setApplyMonth(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Start Date</Label>
            <Input type="date" value={applyStartDate} onChange={(e) => setApplyStartDate(e.target.value)} className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">Items are offset from this start date using each item's day offset.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => applyMutation.mutate({ workspaceId, id: templateId, data: { month: applyMonth, startDate: applyStartDate } })}
            disabled={applyMutation.isPending}
          >
            {applyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Templates() {
  const { workspaceId, currentMonth } = useWorkspace();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showApply, setShowApply] = useState<number | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">Prebuilt monthly planning frameworks to get started fast.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !templates || templates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <LayoutTemplate className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No templates yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Create a template manually or import from a CSV / JSON file.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setShowImport(true)}>
                <Upload className="h-4 w-4 mr-2" />Import
              </Button>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-2" />Create Template
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{template.name}</CardTitle>
                    {template.description && (
                      <CardDescription className="mt-0.5 line-clamp-2">{template.description}</CardDescription>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant="outline" className="text-xs">{template.category}</Badge>
                      <Badge variant="outline" className="text-xs">
                        <Layers className="h-3 w-3 mr-1" />
                        {template.itemCount} item{template.itemCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex-1 flex flex-col">
                {template.items && template.items.length > 0 && (
                  <div className="mb-3 flex-1">
                    <p className="text-xs text-muted-foreground font-medium mb-1.5">Includes:</p>
                    <div className="space-y-1">
                      {(template.items as Array<{ laneGroup: string; laneName: string; title: string }>).slice(0, 4).map((item, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-primary/40 rounded-full flex-shrink-0" />
                          <span className="truncate">{item.title}</span>
                          <span className="text-xs opacity-60 flex-shrink-0">{item.laneName}</span>
                        </div>
                      ))}
                      {template.items.length > 4 && (
                        <p className="text-xs text-muted-foreground pl-3.5">+{template.items.length - 4} more</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 mt-auto">
                  <Button size="sm" className="flex-1" onClick={() => setShowApply(template.id)}>
                    <Play className="h-3 w-3 mr-1.5" />
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteMutation.mutate({ workspaceId, id: template.id })}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && <CreateTemplateDialog workspaceId={workspaceId} onClose={() => setShowCreate(false)} />}
      {showImport && <ImportDialog workspaceId={workspaceId} onClose={() => setShowImport(false)} />}
      {showApply !== null && (
        <ApplyDialog
          templateId={showApply}
          currentMonth={currentMonth}
          workspaceId={workspaceId}
          onClose={() => setShowApply(null)}
        />
      )}
    </div>
  );
}
