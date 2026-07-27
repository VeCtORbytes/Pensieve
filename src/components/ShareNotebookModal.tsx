"use client";

import { useState, useEffect } from "react";
import { X, Share2, Copy, Check, Lock, Globe, ExternalLink, Loader2 } from "lucide-react";

export default function ShareNotebookModal({
  notebookId,
  onClose,
}: {
  notebookId: string;
  onClose: () => void;
}) {
  const [isPublic, setIsPublic] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadShareStatus() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/notebooks/${notebookId}/share`);
        if (!res.ok) throw new Error("Failed to load share status");
        const data = await res.json();
        setIsPublic(data.isPublic);
        setShareUrl(data.shareUrl);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    loadShareStatus();
  }, [notebookId]);

  async function handleToggleShare(enable: boolean) {
    try {
      setIsToggling(true);
      setError(null);
      const res = await fetch(`/api/notebooks/${notebookId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable }),
      });
      if (!res.ok) throw new Error("Failed to update share settings");
      const data = await res.json();
      setIsPublic(data.isPublic);
      setShareUrl(data.shareUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsToggling(false);
    }
  }

  function handleCopy() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E2E7EA] text-[#141A22] space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E7EA] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#3B4CC0]/10 border border-[#3B4CC0]/20 text-[#3B4CC0]">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-serif-display font-medium text-[#141A22]">
                Share Notebook
              </h3>
              <p className="text-[11px] text-neutral-500">
                Grant public read-only access to colleagues or classmates
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-[#141A22] rounded-xl hover:bg-[#F5F7F8] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-neutral-400 gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-[#3B4CC0]" />
            Loading share settings...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toggle Card */}
            <div className="p-4 rounded-2xl bg-[#F5F7F8] border border-[#E2E7EA] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {isPublic ? (
                  <div className="p-2 rounded-lg bg-[#1D9E75]/10 text-[#1D9E75] shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-neutral-200 text-neutral-600 shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#141A22]">
                    {isPublic ? "Public Access Enabled" : "Restricted Private Access"}
                  </p>
                  <p className="text-[11px] text-neutral-400 truncate">
                    {isPublic
                      ? "Anyone with the link can view & ask questions"
                      : "Only you can access this notebook"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isToggling}
                onClick={() => handleToggleShare(!isPublic)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isPublic ? "bg-[#1D9E75]" : "bg-neutral-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    isPublic ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Link Box */}
            {isPublic && shareUrl && (
              <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block">
                  Public Share Link
                </label>
                <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-[#E2E7EA] shadow-2xs">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-2 text-xs font-mono text-[#141A22] bg-transparent outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141A22] hover:bg-[#3B4CC0] text-white text-xs font-semibold rounded-lg transition cursor-pointer shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#1D9E75]" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3B4CC0] hover:underline pt-1"
                >
                  <span>Preview Public Page</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {error && <p className="text-xs text-red-600 pt-1">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
