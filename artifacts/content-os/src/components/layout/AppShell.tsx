import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Calendar, Layers, Activity, LayoutTemplate, Settings, ShieldCheck, LogIn, LogOut } from "lucide-react";
import logoSrc from "@/assets/x20_round_logo_180_1776220680564.png";
import { useAuth } from "@workspace/replit-auth-web";

const ADMIN_EMAIL = "wil.kirwan@gmail.com";

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, login, logout } = useAuth();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/planner", label: "Master Planner", icon: Calendar },
    { href: "/campaigns", label: "Campaigns", icon: Layers },
    { href: "/integrations", label: "Integrations", icon: Activity },
    { href: "/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const pageTitle =
    location === "/dashboard" ? "Dashboard" :
    location === "/planner" ? "Master Planner" :
    location.startsWith("/campaigns") ? "Campaigns" :
    location === "/integrations" ? "Integrations" :
    location === "/templates" ? "Templates" :
    location === "/settings" ? "Settings" :
    location === "/admin" ? "Admin" : "";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
          <img src={logoSrc} alt="X20" className="h-8 w-8 rounded-full flex-shrink-0" />
          <div>
            <p className="font-bold text-sm leading-tight text-white">X20 Content OS</p>
            <p className="text-[10px] text-white/50 leading-tight">Marketing Command Center</p>
          </div>
        </div>

        <nav className="flex-1 py-4 flex flex-col gap-0.5 px-3 overflow-y-auto">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                location.startsWith(item.href)
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/65 hover:bg-white/8 hover:text-white"
              }`}>
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{item.label}</span>
              </div>
            </Link>
          ))}

          {user?.email === ADMIN_EMAIL && (
            <Link href="/admin">
              <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                location === "/admin"
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/65 hover:bg-white/8 hover:text-white"
              }`}>
                <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">Admin</span>
              </div>
            </Link>
          )}
        </nav>

        <div className="p-3 border-t border-white/10">
          {user ? (
            <div className="flex items-center gap-2">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="" className="h-7 w-7 rounded-full flex-shrink-0" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {(user.firstName?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/80 font-medium truncate leading-tight">
                  {user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.email}
                </p>
              </div>
              <button
                onClick={logout}
                className="text-white/40 hover:text-white/80 transition-colors flex-shrink-0"
                title="Log out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-white/50 hover:text-white/80 hover:bg-white/8 transition-colors text-xs"
            >
              <LogIn className="h-3.5 w-3.5" />
              Log in
            </button>
          )}
          <p className="text-[10px] text-white/30 mt-1.5 px-0.5">X20 / Times 20 Consulting</p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 bg-card border-b flex items-center justify-between px-6 shrink-0">
          <h2 className="font-semibold text-base capitalize">{pageTitle}</h2>
          <div className="text-xs text-muted-foreground">x20.io</div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
