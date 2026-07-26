"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import SourcePanel from "@/components/SourcePanel";
import ChatPanel from "@/components/ChatPanel";

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
    <div className="flex flex-1 overflow-hidden bg-[#F5F7F8] text-[#141A22]">
      {/* Reference rail — persistent from md up */}
      <aside className="hidden md:flex md:w-[260px] lg:w-[300px] shrink-0 flex-col overflow-hidden border-r border-[#E2E7EA] bg-[#F5F7F8]">
        <SourcePanel notebookId={notebookId} />
      </aside>

      {/* Reference rail — drawer below md */}
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
            className="relative flex w-[86%] max-w-[330px] flex-col bg-[#F5F7F8] shadow-2xl border-r border-[#E2E7EA]"
          >
            <div className="flex justify-end border-b border-[#E2E7EA] px-2 py-1.5">
              <button
                type="button"
                aria-label="Close sources"
                onClick={() => setRailOpen(false)}
                className="rounded-xl p-1.5 text-neutral-400 transition hover:bg-white hover:text-[#141A22]"
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
        />
      </section>
    </div>
  );
}
