"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { renameNotebook, deleteNotebook } from "@/app/actions/notebooks";

export default function NotebookHeader({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [value, setValue] = useState(title);
  const [isPending, startTransition] = useTransition();

  function save() {
    const clean = value.trim();
    if (!clean || clean === title) {
      setValue(title);
      return;
    }
    startTransition(() => renameNotebook(id, clean));
  }

  function remove() {
    if (!confirm("Delete this notebook and everything in it?")) return;
    startTransition(() => deleteNotebook(id));
  }

  return (
    <header className="flex items-center gap-3 border-b border-[#E2E7EA] px-5 py-3 bg-[#F5F7F8]">
      <Link href="/" className="text-neutral-400 hover:text-[#141A22] transition">
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="flex-1 rounded px-2 py-1 text-base font-serif-display font-normal text-[#141A22] outline-none hover:bg-white/60 focus:bg-white border border-transparent focus:border-[#E2E7EA] transition"
      />

      {isPending && <span className="text-xs font-mono text-neutral-400">Saving…</span>}

      <button
        type="button"
        onClick={remove}
        aria-label="Delete notebook"
        className="text-neutral-400 hover:text-red-600 transition cursor-pointer p-1.5 rounded-lg hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </header>
  );
}