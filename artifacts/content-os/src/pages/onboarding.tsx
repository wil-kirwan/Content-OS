import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateWorkspace, useCreateIntegration, useGetTemplates, useApplyTemplate, getGetTemplatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Eye, EyeOff, ArrowRight, ArrowLeft } from "lucide-react";
import logoSrc from "@assets/x20_round_logo_180_1776220680564.png";

const STEPS = [
  "Welcome",
  "Create Workspace",
  "Connect HighLevel",
  "Select Channels",
  "Choose Template",
  "Complete",
];

const CHANNELS = [
  { key: "blog", label: "Blog / Site Content" },
  { key: "social", label: "Social Media" },
  { key: "email", label: "Email & SMS" },
  { key: "paid", label: "Paid Digital Ads" },
  { key: "influencers", label: "Influencers & Affiliates" },
];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<number | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set(CHANNELS.map(c => c.key)));
  const [showToken, setShowToken] = useState(false);
  const [workspaceForm, setWorkspaceForm] = useState({ name: "", slug: "", industry: "", timezone: "America/New_York" });
  const [hlForm, setHlForm] = useState({ token: "", locationId: "" });
  const [skipHL, setSkipHL] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const createWorkspaceMutation = useCreateWorkspace({
    mutation: {
      onSuccess: (data) => {
        setCreatedWorkspaceId(data.id);
        setStep(2);
        setError("");
      },
      onError: () => setError("Failed to create workspace. Please try again."),
    },
  });

  const createIntegrationMutation = useCreateIntegration({
    mutation: {
      onSuccess: () => {
        setStep(3);
        setError("");
      },
      onError: () => setError("Failed to connect HighLevel. Check your token and location ID."),
    },
  });

  const applyTemplateMutation = useApplyTemplate({
    mutation: {
      onSuccess: () => {
        setStep(5);
      },
    },
  });

  const { data: templates } = useGetTemplates(
    createdWorkspaceId ?? 1,
    { query: { enabled: step === 4 && !!createdWorkspaceId, queryKey: getGetTemplatesQueryKey(createdWorkspaceId ?? 1) } }
  );

  const handleCreateWorkspace = () => {
    if (!workspaceForm.name || !workspaceForm.slug) {
      setError("Name and slug are required.");
      return;
    }
    setError("");
    createWorkspaceMutation.mutate({
      data: {
        name: workspaceForm.name,
        slug: workspaceForm.slug,
        industry: workspaceForm.industry || null,
        timezone: workspaceForm.timezone,
      },
    });
  };

  const handleConnectHL = () => {
    if (!hlForm.token || !hlForm.locationId) {
      setError("Token and Location ID are required.");
      return;
    }
    setError("");
    createIntegrationMutation.mutate({
      workspaceId: createdWorkspaceId!,
      data: { provider: "highlevel", authType: "private_token", token: hlForm.token, locationId: hlForm.locationId },
    });
  };

  const handleApplyTemplate = () => {
    if (!selectedTemplateId || !createdWorkspaceId) {
      setStep(5);
      return;
    }
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    applyTemplateMutation.mutate({
      workspaceId: createdWorkspaceId,
      id: selectedTemplateId,
      data: { month, startDate: `${month}-01` },
    });
  };

  const handleFinish = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#03284c] to-[#002b78] flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={logoSrc} alt="X20" className="h-12 w-12" />
          <div className="text-white">
            <p className="text-xl font-bold tracking-tight">X20 Content OS</p>
            <p className="text-sm text-white/60">Marketing Command Center</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-[#62a8da]" : "bg-white/20"}`} />
            </div>
          ))}
        </div>
        <p className="text-white/60 text-sm text-center mb-6">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-2xl p-8">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">Welcome to Content OS</h1>
              <p className="text-gray-600">Your all-in-one marketing command center for planning, scheduling, and executing cross-channel campaigns — connected to HighLevel.</p>
              <ul className="text-left space-y-3 text-sm text-gray-700 mt-6">
                {["Plan every channel in one place — social, email, blog, paid, and more", "Connect to HighLevel for two-way sync of posts and campaigns", "Manage campaigns, track approvals, and measure execution", "Start from proven monthly templates"].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#002b78] mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full mt-6 bg-[#002b78] hover:bg-[#08466e]" onClick={() => setStep(1)}>
                Get Started <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 1: Create Workspace */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Create Your Workspace</h2>
              <p className="text-sm text-gray-600">Your workspace is the central hub for your marketing planning.</p>
              {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>}
              <div>
                <Label htmlFor="ws-name">Workspace Name *</Label>
                <Input id="ws-name" className="mt-1" placeholder="Acme Marketing" value={workspaceForm.name} onChange={e => {
                  const name = e.target.value;
                  setWorkspaceForm(p => ({ ...p, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }));
                }} />
              </div>
              <div>
                <Label htmlFor="ws-slug">Workspace Slug *</Label>
                <Input id="ws-slug" className="mt-1 font-mono" placeholder="acme-marketing" value={workspaceForm.slug} onChange={e => setWorkspaceForm(p => ({ ...p, slug: e.target.value }))} />
                <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and hyphens only</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Industry</Label>
                  <Select value={workspaceForm.industry} onValueChange={v => setWorkspaceForm(p => ({ ...p, industry: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {["E-Commerce", "SaaS / Technology", "Consulting / Services", "Healthcare", "Real Estate", "Marketing / Agency", "Other"].map(i => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Select value={workspaceForm.timezone} onValueChange={v => setWorkspaceForm(p => ({ ...p, timezone: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "UTC"].map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
                <Button className="flex-1 bg-[#002b78] hover:bg-[#08466e]" onClick={handleCreateWorkspace} disabled={createWorkspaceMutation.isPending}>
                  {createWorkspaceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Connect HighLevel */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Connect HighLevel</h2>
              {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
                <p className="font-semibold">How to get your token:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Log in to HighLevel → Settings → Private Integrations</li>
                  <li>Click "Add Integration" and name it (e.g., "Content OS")</li>
                  <li>Select scopes: contacts, social planner, blogs, campaigns</li>
                  <li>Copy the token — it will not be shown again</li>
                </ol>
                <p className="font-semibold mt-2">To find your Location ID:</p>
                <p>Settings → Business Profile, or check the URL after /location/ in HighLevel.</p>
              </div>
              <div>
                <Label>Private Integration Token *</Label>
                <div className="relative mt-1">
                  <Input type={showToken ? "text" : "password"} placeholder="eyJ..." value={hlForm.token} onChange={e => setHlForm(p => ({ ...p, token: e.target.value }))} className="pr-10" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowToken(!showToken)}>
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>Location ID *</Label>
                <Input className="mt-1" placeholder="abc123xyz..." value={hlForm.locationId} onChange={e => setHlForm(p => ({ ...p, locationId: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
                <Button className="flex-1 bg-[#002b78] hover:bg-[#08466e]" onClick={handleConnectHL} disabled={createIntegrationMutation.isPending}>
                  {createIntegrationMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Connect
                </Button>
              </div>
              <button className="w-full text-sm text-gray-500 hover:text-gray-700 underline" onClick={() => setStep(3)}>Skip for now</button>
            </div>
          )}

          {/* Step 3: Select Channels */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Select Your Channels</h2>
              <p className="text-sm text-gray-600">Choose which marketing channels you plan to use. You can change these later.</p>
              <div className="space-y-2">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.key}
                    onClick={() => {
                      const next = new Set(selectedChannels);
                      if (next.has(ch.key)) next.delete(ch.key);
                      else next.add(ch.key);
                      setSelectedChannels(next);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${selectedChannels.has(ch.key) ? "border-[#002b78] bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <span className="text-sm font-medium">{ch.label}</span>
                    {selectedChannels.has(ch.key) && <CheckCircle2 className="h-4 w-4 text-[#002b78]" />}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
                <Button className="flex-1 bg-[#002b78] hover:bg-[#08466e]" onClick={() => setStep(4)}>
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Choose Template */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Choose a Starting Template</h2>
              <p className="text-sm text-gray-600">Start with a proven monthly framework. You can customize it after.</p>
              {templates && templates.length > 0 ? (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplateId(selectedTemplateId === t.id ? null : t.id)}
                      className={`w-full text-left p-4 rounded-lg border transition-colors ${selectedTemplateId === t.id ? "border-[#002b78] bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{t.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{t.description} • {t.itemCount} items</p>
                        </div>
                        {selectedTemplateId === t.id && <CheckCircle2 className="h-4 w-4 text-[#002b78]" />}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No templates available — you can create them later in the Templates section.</p>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
                <Button className="flex-1 bg-[#002b78] hover:bg-[#08466e]" onClick={handleApplyTemplate} disabled={applyTemplateMutation.isPending}>
                  {applyTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {selectedTemplateId ? "Apply & Continue" : "Skip"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 5 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">You're all set!</h2>
              <p className="text-gray-600">Your Content OS workspace is ready. Head to your dashboard to start planning your first month.</p>
              <div className="text-left space-y-2 mt-4">
                {[
                  "Your workspace is configured",
                  skipHL ? "HighLevel can be connected anytime in Integrations" : "HighLevel integration connected",
                  "Monthly channels selected",
                  selectedTemplateId ? "Template applied to current month" : "Ready to create your first plan",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
              <Button className="w-full mt-6 bg-[#002b78] hover:bg-[#08466e]" onClick={handleFinish}>
                Go to Dashboard <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
