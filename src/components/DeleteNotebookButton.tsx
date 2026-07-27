"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteNotebook } from "@/app/actions/notebooks";

export default function DeleteNotebookButton({ notebookId }: { notebookId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this notebook and all its ingested sources?")) {
      return;
    }

    startTransition(() => {
      deleteNotebook(notebookId);
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleDelete}
      aria-label="Delete notebook"
      title="Delete notebook"
      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
