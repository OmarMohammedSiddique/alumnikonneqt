"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

type CopyState = "idle" | "copied" | "failed";

/** Copies the support address, for visitors whose browser has no mail app set up. */
export function CopyAddress({ address, targetId, className }: { address: string; targetId: string; className?: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const reset = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(reset.current), []);

  async function copy() {
    let next: CopyState = "copied";
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // No clipboard access: select the address so one keystroke copies it.
      next = "failed";
      const target = document.getElementById(targetId);
      if (target) window.getSelection()?.selectAllChildren(target);
    }
    setState(next);
    window.clearTimeout(reset.current);
    reset.current = window.setTimeout(() => setState("idle"), 2400);
  }

  return (
    <>
      <button type="button" onClick={copy} className={className}>
        {state === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {state === "copied" ? "Copied" : state === "failed" ? "Address selected" : "Copy address"}
      </button>
      <span role="status" className="sr-only">
        {state === "copied"
          ? "Address copied."
          : state === "failed"
            ? "Copying is unavailable in this browser. The address is selected so you can copy it."
            : ""}
      </span>
    </>
  );
}
