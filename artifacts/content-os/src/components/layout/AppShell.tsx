import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Calendar, Layers, Activity, LayoutTemplate, Settings } from "lucide-react";
import logoSrc from "@/assets/x20_round_logo_180_1776220680564.png";

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/planner", label: "Master Planner", icon: Calendar },
    { href: "/campaigns", label: "Campaigns", icon: Layers },
    { href: "/integrations", label: "Integrations", icon: Activity },
    { href: "/templates", label: "Templates", icon: LayoutTemplate },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

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
        </nav>

        <div className="p-4 border-t border-white/10 text-xs text-white/40">
          X20 / Times 20 Consulting
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 bg-card border-b flex items-center justify-between px-6 shrink-0">
          <h2 className="font-semibold text-base capitalize">
            {location === "/dashboard" ? "Dashboard" :
             location === "/planner" ? "Master Planner" :
             location.startsWith("/campaigns") ? "Campaigns" :
             location === "/integrations" ? "Integrations" :
             location === "/templates" ? "Templates" :
             location === "/settings" ? "Settings" : ""}
          </h2>
          <div className="text-xs text-muted-foreground">
            x20.io
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
