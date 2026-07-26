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
    <div className="flex flex-1 overflow-hidden bg-[#090D14] text-[#E6EDF3]">
      {/* Reference rail — persistent from md up */}
      <aside className="hidden md:flex md:w-[260px] lg:w-[300px] shrink-0 flex-col overflow-hidden border-r border-[#222B3D] bg-[#090D14]">
        <SourcePanel notebookId={notebookId} />
      </aside>

      {/* Reference rail — drawer below md */}
      {railOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <button
            type="button"
            aria-label="Close sources"
            onClick={() => setRailOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-xs"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Sources"
            className="relative flex w-[86%] max-w-[330px] flex-col bg-[#090D14] shadow-2xl border-r border-[#222B3D]"
          >
            <div className="flex justify-end border-b border-[#222B3D] px-2 py-1.5">
              <button
                type="button"
                aria-label="Close sources"
                onClick={() => setRailOpen(false)}
                className="rounded-xl p-1.5 text-[#8B949E] transition hover:bg-[#111622] hover:text-[#E6EDF3]"
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
      <section className="flex min-w-0 flex-1 flex-col bg-[#090D14]">
        <ChatPanel
          notebookId={notebookId}
          sourceCount={sourceCount}
          onOpenSources={() => setRailOpen(true)}
        />
      </section>
    </div>
  );
}
