import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { getCurrentUserWorkspace } from "@workspace/api-client-react";

interface WorkspaceContextType {
  workspaceId: number;
  setWorkspaceId: (id: number) => void;
  currentMonth: string;
  setCurrentMonth: (month: string) => void;
  isReady: boolean;
  noWorkspaceAccess: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<number>(1);
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data, isSuccess } = useQuery({
    queryKey: ["user-workspace"],
    queryFn: () => getCurrentUserWorkspace(),
    enabled: isAuthenticated,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (isSuccess && data?.workspaceId != null) {
      setWorkspaceId(data.workspaceId);
    }
  }, [isSuccess, data]);

  const noWorkspaceAccess = isAuthenticated && isSuccess && data?.workspaceId == null;
  const isReady = !isAuthenticated || (isSuccess && data?.workspaceId != null);

  return (
    <WorkspaceContext.Provider value={{ workspaceId, setWorkspaceId, currentMonth, setCurrentMonth, isReady, noWorkspaceAccess }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
