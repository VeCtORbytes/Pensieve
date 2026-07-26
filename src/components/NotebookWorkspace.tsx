"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import SourcePanel from "@/components/SourcePanel";
import ChatPanel from "@/components/ChatPanel";

/**
 * Two-pane workspace. The reference rail is a fixed column from `md` up and a
 * dismissible drawer below it, because at phone widths a 260px rail leaves the
 * conversation too narrow to read.
 */
export default function NotebookWorkspace({
  notebookId,
  sourceCount,
}: {
  notebookId: string;
  sourceCount: number;
}) {
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    if (!railOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setRailOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [railOpen]);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Reference rail — persistent from md up */}
      <aside className="hidden md:flex md:w-[260px] lg:w-[300px] shrink-0 flex-col overflow-hidden border-r border-rule bg-vessel">
        <SourcePanel notebookId={notebookId} />
      </aside>

      {/* Reference rail — drawer below md */}
      {railOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <button
            type="button"
            aria-label="Close sources"
            onClick={() => setRailOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Sources"
            className="relative flex w-[86%] max-w-[330px] flex-col bg-vessel shadow-2xl"
          >
            {/* SourcePanel supplies its own "SOURCES (n)" header, so this is
                just the drawer's close affordance. */}
            <div className="flex justify-end border-b border-rule px-2 py-1.5">
              <button
                type="button"
                aria-label="Close sources"
                onClick={() => setRailOpen(false)}
                className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-200/60 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <SourcePanel notebookId={notebookId} />
            </div>
          </aside>
        </div>
      )}

      {/* Conversation. min-w-0 lets the text column shrink instead of forcing
          the flex row wider than the viewport. */}
      <section className="flex min-w-0 flex-1 flex-col bg-surface">
        <ChatPanel
          notebookId={notebookId}
          sourceCount={sourceCount}
          onOpenSources={() => setRailOpen(true)}
        />
      </section>
    </div>
  );
}
