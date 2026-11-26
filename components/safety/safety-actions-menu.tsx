"use client";

import { useEffect, useRef, useState } from "react";
import { Flag, MoreVertical, ShieldAlert } from "lucide-react";
import { ReportDialog } from "./report-dialog";
import { BlockDialog } from "./block-dialog";
import { successorPicker } from "@/lib/focus-after-removal";

const TRIGGER_ATTRIBUTE = "data-safety-trigger";

// The page heading, made focusable without joining the Tab order.
function pageHeading(): HTMLElement | null {
  const heading = document.querySelector<HTMLElement>("main h1") ?? document.querySelector<HTMLElement>("h1");
  if (heading && !heading.hasAttribute("tabindex")) heading.tabIndex = -1;
  return heading;
}

interface SafetyActionsMenuProps {
  targetId: string;
  targetName: string;
  onBlocked?: () => void;
  onReported?: () => void;
}

export function SafetyActionsMenu({
  targetId,
  targetName,
  onBlocked,
  onReported,
}: SafetyActionsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const successorRef = useRef<() => HTMLElement | null>(() => null);

  // Blocking can remove this member's card, and the trigger with it. Focus then
  // moves to the safety menu of the nearest remaining card, or the page heading.
  const openBlockDialog = () => {
    const trigger = triggerRef.current;
    const triggers = Array.from(document.querySelectorAll<HTMLElement>(`[${TRIGGER_ATTRIBUTE}]`));
    successorRef.current = trigger ? successorPicker(triggers, trigger) : () => null;
    setMenuOpen(false);
    setBlockOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <>
      <div className="relative inline-block text-left">
        <button
          type="button"
          ref={triggerRef}
          data-safety-trigger=""
          onClick={() => setMenuOpen((prev) => !prev)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary transition-colors"
          aria-label={`Safety options for ${targetName}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <MoreVertical className="size-4" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              role="menu"
              className="absolute right-0 z-50 mt-1 w-44 rounded-lg border bg-popover p-1 shadow-lg focus:outline-hidden animate-in fade-in zoom-in-95 duration-100"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setReportOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground hover:bg-muted focus:bg-muted focus:outline-hidden"
              >
                <Flag className="size-3.5 text-muted-foreground" />
                <span>Report profile</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={openBlockDialog}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:outline-hidden"
              >
                <ShieldAlert className="size-3.5" />
                <span>Block member</span>
              </button>
            </div>
          </>
        )}
      </div>

      {reportOpen && (
        <ReportDialog
          reportedId={targetId}
          reportedName={targetName}
          isOpen={reportOpen}
          onClose={() => setReportOpen(false)}
          onReportSubmitted={() => onReported?.()}
          returnFocusRef={triggerRef}
        />
      )}

      {blockOpen && (
        <BlockDialog
          targetId={targetId}
          targetName={targetName}
          isOpen={blockOpen}
          onClose={() => setBlockOpen(false)}
          onBlocked={() => onBlocked?.()}
          returnFocusRef={triggerRef}
          fallbackFocus={() => successorRef.current() ?? pageHeading()}
        />
      )}
    </>
  );
}
