"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Boxes, FlaskConical, Home, Lightbulb, Map, Moon, Settings, Sun } from "lucide-react";
import { useApp } from "./AppProvider";
import { JobsTray } from "./JobsTray";
import { initialsOf } from "./session";

const NAV = [
  { href: "/", icon: Home, label: "Home", compact: false },
  { href: "/playground", icon: FlaskConical, label: "Personas", compact: false },
  { href: "/roadmap", icon: Map, label: "Roadmap", compact: false },
  { href: "/pulse", icon: Activity, label: "Pulse", compact: true },
  { href: "/ideas", icon: Lightbulb, label: "Ideas", compact: true },
  { href: "/skills", icon: Boxes, label: "Skills", compact: true },
] as const;

export function AppShell() {
  const { theme, setTheme, adoIdentity } = useApp();
  const pathname = usePathname();
  const signedIn = !!adoIdentity;
  const displayName = adoIdentity ?? "";

  return (
    <header className="relative z-40 bg-[var(--bg)]/70 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center gap-2 sm:gap-3">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div
            className="grid place-items-center h-10 w-10 rounded-xl relative overflow-hidden"
            style={{
              background: "linear-gradient(155deg, var(--red-bright), var(--red) 70%, #b00000)",
              boxShadow: "0 4px 14px -4px var(--red-glow), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            <Boxes className="h-[1.3rem] w-[1.3rem] text-white relative z-10" strokeWidth={2} />
            <span
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.35), transparent 70%)" }}
            />
          </div>
          <div className="leading-tight hidden sm:block">
            <p className="font-display font-semibold text-base">VOIS Digital Engineering Hub</p>
          </div>
        </Link>

        <span className="flex-1" />

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <nav className="flex items-center gap-0.5 rounded-xl border border-[var(--hairline)] p-1">
            {NAV.map(({ href, icon: Icon, label, compact }, i) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              // Divider only where the text group meets the icon group.
              const showDivider = i > 0 && compact && !NAV[i - 1].compact;
              return (
                <div key={href} className="flex items-center">
                  {showDivider && <span className="w-px h-5 bg-[var(--hairline)] mx-1" />}
                  <Link
                    href={href}
                    aria-label={label}
                    aria-current={active ? "page" : undefined}
                    className={`group relative inline-flex items-center gap-2 h-8 rounded-lg px-2.5 transition-colors ${
                      active ? "text-red bg-[rgba(230,0,0,0.1)]" : "text-muted hover:text-red hover:bg-white/5"
                    }`}
                  >
                    <Icon className="h-[1.05rem] w-[1.05rem]" />
                    {!compact && <span className="text-sm font-medium hidden md:inline">{label}</span>}
                    {compact && (
                      <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 -translate-y-1 whitespace-nowrap rounded-md border border-[var(--hairline)] bg-[var(--panel)] px-2 py-1 text-xs font-medium text-ink-dim opacity-0 shadow-lg transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 z-50">
                        {label}
                      </span>
                    )}
                  </Link>
                </div>
              );
            })}
          </nav>

          <JobsTray />
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="grid place-items-center h-10 w-10 rounded-xl border border-[var(--hairline)] text-muted hover:text-ink hover:bg-white/5 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-[1.05rem] w-[1.05rem]" /> : <Moon className="h-[1.05rem] w-[1.05rem]" />}
          </button>

          <Link
            href="/settings"
            title={signedIn ? displayName : "Settings"}
            aria-label={signedIn ? displayName : "Settings"}
            aria-current={pathname.startsWith("/settings") ? "page" : undefined}
            className={`inline-flex items-center gap-2 h-10 rounded-xl border border-[var(--hairline)] hover:bg-white/5 transition-colors ${
              signedIn ? "px-1.5" : "px-2.5 sm:px-3.5"
            }`}
          >
            {signedIn ? (
              <span
                className="grid place-items-center h-7 w-7 rounded-full text-[0.7rem] font-semibold text-white shrink-0"
                style={{ background: "linear-gradient(160deg,#5aa8ff,#3a6fd8)" }}
              >
                {initialsOf(displayName)}
              </span>
            ) : (
              <>
                <Settings className="h-[1.05rem] w-[1.05rem]" />
                <span className="text-sm font-medium hidden sm:inline">Settings</span>
              </>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
