import { ReactNode } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useWorkspace } from "@/context/WorkspaceContext";
import Login from "@/pages/login";
import logoSrc from "@/assets/x20-blue-logo.svg";

function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "hsl(218 88% 19%)" }}
    >
      <div className="flex flex-col items-center gap-4">
        <img src={logoSrc} alt="X20" className="h-10 w-10 opacity-60 animate-pulse" />
        <div className="h-1 w-24 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
          <div
            className="h-full rounded-full animate-pulse"
            style={{ background: "hsl(219 86% 50%)", width: "60%" }}
          />
        </div>
      </div>
    </div>
  );
}

function NoWorkspaceScreen() {
  const { logout } = useAuth();
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: "hsl(218 88% 19%)" }}
    >
      <div className="flex flex-col items-center gap-8 px-6 max-w-sm w-full text-center">
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <img src={logoSrc} alt="X20" className="h-9 w-9 object-contain" />
        </div>
        <div>
          <h2 className="text-white font-bold text-xl" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Access Pending
          </h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
            Your account isn't linked to a workspace yet. Please contact your X20 administrator to get access.
          </p>
        </div>
        <button
          onClick={logout}
          className="text-sm px-5 py-2 rounded-lg transition-colors"
          style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.12)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.85)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Login />;

  return <WorkspaceGuard>{children}</WorkspaceGuard>;
}

function WorkspaceGuard({ children }: { children: ReactNode }) {
  const { isReady, noWorkspaceAccess } = useWorkspace();

  if (noWorkspaceAccess) return <NoWorkspaceScreen />;
  if (!isReady) return <LoadingScreen />;

  return <>{children}</>;
}
