"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalFocusOptions {
  isOpen: boolean;
  onClose: () => void;
  // Where focus goes when the dialog closes. Needed when the control that
  // opened the dialog (a menu item, for example) no longer exists by then.
  returnFocusRef?: RefObject<HTMLElement | null>;
  // Used when the return target has been removed from the page by the time
  // the dialog closes, for example when blocking removes the member's card.
  fallbackFocus?: () => HTMLElement | null;
}

// Keyboard behaviour for a modal dialog (WCAG 2.4.3 and 2.1.2): focus moves
// into the dialog when it opens, Tab stays inside it, Escape closes it, and
// focus returns to where the person was when it closes. Mark the preferred
// first control with `data-autofocus`.
export function useModalFocus<T extends HTMLElement>({
  isOpen,
  onClose,
  returnFocusRef,
  fallbackFocus,
}: ModalFocusOptions): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  const fallbackFocusRef = useRef(fallbackFocus);

  useEffect(() => {
    onCloseRef.current = onClose;
    fallbackFocusRef.current = fallbackFocus;
  }, [onClose, fallbackFocus]);

  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.getClientRects().length > 0,
      );

    const first =
      container.querySelector<HTMLElement>("[data-autofocus]") ?? focusable()[0] ?? container;
    first.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (!container.contains(active)) {
        event.preventDefault();
        firstItem.focus();
      } else if (event.shiftKey && (active === firstItem || active === container)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const returnTarget = returnFocusRef?.current ?? null;
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const target = returnTarget ?? previous;
      if (target && target.isConnected) target.focus();
      else fallbackFocusRef.current?.()?.focus();
    };
  }, [isOpen, returnFocusRef]);

  return containerRef;
}
