import { useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { 
  useGetDashboardSummary, 
  useGetChannelBreakdown, 
  useGetRecentActivity, 
  useGetOverdueItems,
  getGetDashboardSummaryQueryKey,
  getGetChannelBreakdownQueryKey,
  getGetRecentActivityQueryKey,
  getGetOverdueItemsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { CheckCircle2, Clock, AlertCircle, RefreshCw, Calendar as CalendarIcon, Activity } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { workspaceId, currentMonth } = useWorkspace();

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary(
    workspaceId,
    { month: currentMonth },
    { query: { enabled: !!workspaceId, queryKey: getGetDashboardSummaryQueryKey(workspaceId, { month: currentMonth }) } }
  );

  const { data: breakdown, isLoading: isLoadingBreakdown } = useGetChannelBreakdown(
    workspaceId,
    { month: currentMonth },
    { query: { enabled: !!workspaceId, queryKey: getGetChannelBreakdownQueryKey(workspaceId, { month: currentMonth }) } }
  );

  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity(
    workspaceId,
    { limit: 10 },
    { query: { enabled: !!workspaceId, queryKey: getGetRecentActivityQueryKey(workspaceId, { limit: 10 }) } }
  );

  const { data: overdue, isLoading: isLoadingOverdue } = useGetOverdueItems(
    workspaceId,
    {},
    { query: { enabled: !!workspaceId, queryKey: getGetOverdueItemsQueryKey(workspaceId, {}) } }
  );

  if (isLoadingSummary || isLoadingBreakdown || isLoadingActivity || isLoadingOverdue) {
    return <div className="p-8 flex justify-center items-center h-full"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const chartData = breakdown?.map(item => ({
    name: item.laneName,
    Planned: item.planned,
    Published: item.published,
    Draft: item.draft,
    Failed: item.failed
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your marketing operations for {format(new Date(currentMonth + "-01"), "MMMM yyyy")}.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Planned</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalPlanned || 0}</div>
            <p className="text-xs text-muted-foreground">Items scheduled this month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalPublished || 0}</div>
            <p className="text-xs text-muted-foreground">{summary?.completionRate || 0}% completion rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Items</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summary?.totalOverdue || 0}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeCampaigns || 0}</div>
            <p className="text-xs text-muted-foreground">Running currently</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Channel Breakdown</CardTitle>
            <CardDescription>Item status by marketing channel for the current month.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => String(value)} />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend />
                  <Bar dataKey="Planned" stackId="a" fill="#62a8da" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="Draft" stackId="a" fill="#b5cde7" />
                  <Bar dataKey="Published" stackId="a" fill="#08466e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions in your workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {activity?.map((log) => (
                <div key={log.id} className="flex items-center">
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {log.action} {log.entityType}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {log.entityTitle} • {format(new Date(log.createdAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
              {(!activity || activity.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
