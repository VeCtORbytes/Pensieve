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
    <header className="flex items-center gap-3 border-b border-neutral-200 px-5 py-3">
      <Link href="/" className="text-neutral-400 hover:text-neutral-900">
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="flex-1 rounded px-2 py-1 text-sm font-medium outline-none hover:bg-neutral-100 focus:bg-neutral-100"
      />

      {isPending && <span className="text-xs text-neutral-400">Saving…</span>}

      <button
        onClick={remove}
        aria-label="Delete notebook"
        className="text-neutral-400 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </header>
  );
}