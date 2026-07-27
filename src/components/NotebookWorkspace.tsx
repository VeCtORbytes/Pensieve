"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import SourcePanel from "@/components/SourcePanel";
import ChatPanel from "@/components/ChatPanel";
import StudioPanel from "@/components/StudioPanel";

export default function NotebookWorkspace({
  notebookId,
  sourceCount,
}: {
  notebookId: string;
  sourceCount: number;
}) {
  const [railOpen, setRailOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);

  useEffect(() => {
    if (!railOpen && !studioOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setRailOpen(false);
      setStudioOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [railOpen, studioOpen]);

  return (
    <div className="flex flex-1 overflow-hidden bg-vessel text-ink">
      {/* Sources rail — persistent from md up */}
      <aside className="hidden md:flex md:w-[260px] lg:w-[300px] shrink-0 flex-col overflow-hidden border-r border-rule bg-vessel">
        <SourcePanel notebookId={notebookId} />
      </aside>

      {/* Sources rail — drawer below md, opens from the left */}
      {railOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <button
            type="button"
            aria-label="Close sources"
            onClick={() => setRailOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Sources"
            className="relative flex w-[86%] max-w-[330px] flex-col bg-vessel shadow-2xl border-r border-rule"
          >
            <div className="flex justify-end border-b border-rule px-2 py-1.5">
              <button
                type="button"
                aria-label="Close sources"
                onClick={() => setRailOpen(false)}
                className="rounded-xl p-1.5 text-neutral-400 transition hover:bg-white hover:text-ink"
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

      {/* Conversation column */}
      <section className="flex min-w-0 flex-1 flex-col bg-white">
        <ChatPanel
          notebookId={notebookId}
          sourceCount={sourceCount}
          onOpenSources={() => setRailOpen(true)}
          onOpenStudio={() => setStudioOpen(true)}
        />
      </section>

      {/* Studio rail — persistent from lg up */}
      <aside className="hidden lg:flex lg:w-[320px] xl:w-[360px] shrink-0 flex-col overflow-hidden border-l border-rule bg-vessel">
        <StudioPanel notebookId={notebookId} />
      </aside>

      {/* Studio rail — drawer below lg, opens from the right */}
      {studioOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            aria-label="Close studio"
            onClick={() => setStudioOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Studio"
            className="relative flex w-[86%] max-w-[360px] flex-col bg-vessel shadow-2xl border-l border-rule"
          >
            <div className="flex justify-start border-b border-rule px-2 py-1.5">
              <button
                type="button"
                aria-label="Close studio"
                onClick={() => setStudioOpen(false)}
                className="rounded-xl p-1.5 text-neutral-400 transition hover:bg-white hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <StudioPanel notebookId={notebookId} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
