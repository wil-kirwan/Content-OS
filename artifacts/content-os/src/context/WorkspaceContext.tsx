import { createContext, useContext, useState, ReactNode } from "react";

interface WorkspaceContextType {
  workspaceId: number;
  setWorkspaceId: (id: number) => void;
  currentMonth: string;
  setCurrentMonth: (month: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState<number>(1);
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  return (
    <WorkspaceContext.Provider value={{ workspaceId, setWorkspaceId, currentMonth, setCurrentMonth }}>
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
