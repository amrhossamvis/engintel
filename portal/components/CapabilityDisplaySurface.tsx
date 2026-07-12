"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useApp } from "./AppProvider";
import { Portal } from "./Portal";
import { ExecDashboardApp } from "./ExecDashboardApp";

export function CapabilityDisplaySurface() {
  const { fullscreenCap, closeFullscreen } = useApp();

  useEffect(() => {
    if (!fullscreenCap) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeFullscreen();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreenCap, closeFullscreen]);

  return (
    <Portal>
      <AnimatePresence>
        {fullscreenCap ? (
          <>
            <motion.div
              className="scrim fixed inset-0 z-[70]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeFullscreen}
            />
            <motion.div
              className="fixed inset-2 z-[71] overflow-hidden rounded-2xl border border-[var(--hairline-strong)] panel md:inset-6"
              initial={{ opacity: 0, y: 20, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.99 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              role="dialog"
              aria-modal="true"
              aria-label={fullscreenCap.name}
            >
              <div className="flex h-14 items-center justify-end border-b border-[var(--hairline)] px-3">
                <button
                  onClick={closeFullscreen}
                  className="grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-ink"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="h-[calc(100%-3.5rem)] min-h-0">
                {fullscreenCap.id === "exec-dashboard" ? (
                  <ExecDashboardApp />
                ) : (
                  <div className="grid h-full place-items-center text-sm text-muted">
                    This capability does not have a fullscreen surface yet.
                  </div>
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </Portal>
  );
}
