"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Boxes, FlaskConical, Home, Lightbulb, Moon, Settings, Sun } from "lucide-react";
import { useApp } from "./AppProvider";
import { JobsTray } from "./JobsTray";
import { initialsOf } from "./session";

const NAV = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/playground", icon: FlaskConical, label: "Playground" },
  { href: "/pulse", icon: Activity, label: "Pulse" },
  { href: "/ideas", icon: Lightbulb, label: "Ideas" },
  { href: "/skills", icon: Boxes, label: "Skills" },
] as const;

export function AppShell() {
  const { theme, setTheme, adoIdentity } = useApp();
  const pathname = usePathname();
  const signedIn = !!adoIdentity;
  const displayName = adoIdentity ?? "";

  return (
    <header className="sticky top-0 z-40 bg-[var(--bg)]/70 backdrop-blur-xl">
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
            <p className="font-display font-semibold text-base">Hub</p>
            <p className="text-xs text-muted font-mono">Digital · VOIS</p>
          </div>
        </Link>

        <span className="flex-1" />

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <nav className="flex items-center rounded-xl border border-[var(--hairline)] overflow-hidden">
            {NAV.map(({ href, icon: Icon, label }, i) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <div key={href} className="flex items-center">
                  {i > 0 && <span className="w-px h-5 bg-[var(--hairline)]" />}
                  <Link
                    href={href}
                    title={label}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex items-center gap-2 h-10 px-2.5 md:px-3.5 transition-colors ${
                      active ? "text-red bg-[rgba(230,0,0,0.1)]" : "text-muted hover:text-red hover:bg-white/5"
                    }`}
                  >
                    <Icon className="h-[1.05rem] w-[1.05rem]" />
                    <span className="text-sm font-medium hidden md:inline">{label}</span>
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
