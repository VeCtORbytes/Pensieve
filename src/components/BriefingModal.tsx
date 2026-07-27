"use client";

import { useState } from "react";
import { X, FileText, Download, Copy, Check, Printer, Sparkles } from "lucide-react";

export default function BriefingModal({
  data,
  onClose,
}: {
  data: { title: string; markdown: string };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(data.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob([data.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.title.replace(/\s+/g, "-")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-4xl w-full h-[90vh] p-6 sm:p-8 shadow-2xl border border-[#E2E7EA] text-[#141A22] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E7EA] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#3B4CC0]/10 border border-[#3B4CC0]/20 text-[#3B4CC0]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif-display font-medium text-[#141A22]">
                {data.title}
              </h2>
              <p className="text-[11px] text-neutral-500">
                Synthesized intelligence document grounded in notebook sources
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5F7F8] hover:bg-neutral-200 border border-[#E2E7EA] rounded-xl text-xs font-semibold text-[#141A22] transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#1D9E75]" />
                  <span className="text-[#1D9E75]">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Markdown</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141A22] hover:bg-[#3B4CC0] text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .md</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              title="Print Document"
              className="p-2 text-neutral-500 hover:text-[#141A22] hover:bg-[#F5F7F8] rounded-xl transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-[#141A22] hover:bg-[#F5F7F8] rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body - Publication Grade Markdown Reader */}
        <div className="flex-1 my-4 overflow-y-auto p-6 sm:p-8 bg-[#F5F7F8] rounded-3xl border border-[#E2E7EA]">
          <div className="max-w-3xl mx-auto bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-[#E2E7EA] space-y-6 text-[#141A22] leading-relaxed">
            {data.markdown.split("\n\n").map((block, idx) => {
              const trimmed = block.trim();
              if (!trimmed) return null;

              if (trimmed.startsWith("# ")) {
                return (
                  <h1 key={idx} className="text-2xl font-serif-display font-semibold text-[#141A22] pb-2 border-b border-[#E2E7EA]">
                    {trimmed.replace("# ", "")}
                  </h1>
                );
              }

              if (trimmed.startsWith("## ")) {
                return (
                  <h2 key={idx} className="text-lg font-serif-display font-medium text-[#3B4CC0] pt-4 pb-1 border-b border-[#E2E7EA]/60">
                    {trimmed.replace("## ", "")}
                  </h2>
                );
              }

              if (trimmed.startsWith("### ")) {
                return (
                  <h3 key={idx} className="text-sm font-semibold text-[#141A22] pt-2">
                    {trimmed.replace("### ", "")}
                  </h3>
                );
              }

              if (trimmed.startsWith("> ")) {
                return (
                  <blockquote key={idx} className="p-4 bg-[#3B4CC0]/5 border-l-4 border-[#3B4CC0] rounded-r-xl text-xs text-[#141A22] font-medium italic">
                    {trimmed.replace("> ", "")}
                  </blockquote>
                );
              }

              if (trimmed.startsWith("|")) {
                const rows = trimmed.split("\n").filter((r) => r.trim() && !r.includes(":---"));
                return (
                  <div key={idx} className="overflow-x-auto my-4">
                    <table className="w-full text-xs text-left border-collapse border border-[#E2E7EA] rounded-xl overflow-hidden">
                      {rows.map((rowStr, rIdx) => {
                        const cells = rowStr.split("|").filter((_, cIdx, arr) => cIdx > 0 && cIdx < arr.length - 1);
                        if (rIdx === 0) {
                          return (
                            <thead key={rIdx} className="bg-[#F5F7F8] font-semibold text-[#141A22] border-b border-[#E2E7EA]">
                              <tr>
                                {cells.map((c, cIdx) => (
                                  <th key={cIdx} className="p-3 border-r border-[#E2E7EA] last:border-r-0">
                                    {c.trim().replace(/\*\*/g, "")}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                          );
                        }
                        return (
                          <tr key={rIdx} className="border-b border-[#E2E7EA] last:border-b-0 hover:bg-[#F5F7F8]">
                            {cells.map((c, cIdx) => (
                              <td key={cIdx} className="p-3 border-r border-[#E2E7EA] last:border-r-0 text-neutral-700">
                                {c.trim().replace(/\*\*/g, "")}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </table>
                  </div>
                );
              }

              if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                const items = trimmed.split("\n");
                return (
                  <ul key={idx} className="space-y-1.5 text-xs text-neutral-700 pl-4 list-disc">
                    {items.map((it, iIdx) => (
                      <li key={iIdx} className="leading-relaxed">
                        {it.replace(/^[-*]\s+/, "")}
                      </li>
                    ))}
                  </ul>
                );
              }

              return (
                <p key={idx} className="text-xs sm:text-sm text-neutral-700 leading-relaxed">
                  {trimmed}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
