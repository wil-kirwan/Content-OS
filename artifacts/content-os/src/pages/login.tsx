import { useAuth } from "@workspace/replit-auth-web";
import logoSrc from "@/assets/x20-blue-logo.svg";

export default function Login() {
  const { login, isLoading } = useAuth();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "hsl(218 88% 19%)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(98,168,219,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(11,59,146,0.35) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-10 px-6 max-w-sm w-full">
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-20 w-20 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <img src={logoSrc} alt="X20" className="h-12 w-12 object-contain" />
          </div>
          <div className="text-center">
            <h1
              className="text-display font-bold text-white tracking-tight"
              style={{ fontSize: "clamp(1.75rem, 5vw, 2.25rem)", lineHeight: 1.1 }}
            >
              X20 Content OS
            </h1>
            <p className="text-sm font-medium tracking-widest uppercase mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
              Marketing Command Center
            </p>
          </div>
        </div>

        <div
          className="w-full rounded-2xl p-8 flex flex-col gap-6"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.10)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="text-center">
            <h2 className="text-white font-semibold text-lg leading-snug">Welcome back</h2>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
              Sign in to access your marketing workspace
            </p>
          </div>

          <button
            onClick={login}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-3 px-5 font-semibold text-sm transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "hsl(219 86% 31%)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.18)",
              boxShadow: "0 2px 12px rgba(11,59,146,0.5)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "hsl(219 86% 38%)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "hsl(219 86% 31%)";
            }}
          >
            {isLoading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="24" height="24" rx="4" fill="currentColor" opacity="0" />
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            Sign in with Replit
          </button>
        </div>

        <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
          X20 / Times 20 Consulting · x20.io
        </p>
      </div>
    </div>
  );
}
