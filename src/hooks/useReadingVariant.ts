"use client";

import { useCallback, useEffect, useState } from "react";
import { VariantKind, isVariantKind } from "@/lib/locator";

const EVENT_NAME = "pensieve:reading-variant";

const storageKey = (notebookId: string) => `pensieve:reading-variant:${notebookId}`;

/**
 * The language rendering the reader currently has selected.
 *
 * Shared between the source viewer and the chat panel — which are siblings, not
 * parent and child — via a window event plus localStorage, so switching language
 * anywhere also changes the language answers come back in. Persisted per
 * notebook.
 */
export function useReadingVariant(notebookId: string) {
  const [variant, setVariant] = useState<VariantKind>("ORIGINAL");
  /**
   * False until the reader actually picks a language. The chat route only
   * receives an explicit choice; otherwise it infers the language from the
   * question, so an English question is answered in English by default.
   */
  const [isExplicit, setIsExplicit] = useState(false);

  // Hydrate after mount so server and client markup match.
  useEffect(() => {
    if (!notebookId) return;
    try {
      const stored = window.localStorage.getItem(storageKey(notebookId));
      if (isVariantKind(stored)) {
        setVariant(stored);
        setIsExplicit(true);
      }
    } catch {
      /* private browsing or disabled storage */
    }
  }, [notebookId]);

  useEffect(() => {
    if (!notebookId) return;

    const onChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.notebookId === notebookId && isVariantKind(detail?.variant)) {
        setVariant(detail.variant);
        setIsExplicit(detail.explicit !== false);
      }
    };

    window.addEventListener(EVENT_NAME, onChange);
    return () => window.removeEventListener(EVENT_NAME, onChange);
  }, [notebookId]);

  const select = useCallback(
    (next: VariantKind) => {
      setVariant(next);
      setIsExplicit(true);
      try {
        window.localStorage.setItem(storageKey(notebookId), next);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, {
          detail: { notebookId, variant: next, explicit: true },
        })
      );
    },
    [notebookId]
  );

  /** Clears the explicit choice and goes back to following the question. */
  const reset = useCallback(() => {
    setVariant("ORIGINAL");
    setIsExplicit(false);
    try {
      window.localStorage.removeItem(storageKey(notebookId));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { notebookId, variant: "ORIGINAL", explicit: false },
      })
    );
  }, [notebookId]);

  return { variant, isExplicit, select, reset } as const;
}
