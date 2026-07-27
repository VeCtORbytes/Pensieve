"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function FormattedMarkdown({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={`prose max-w-none text-[#141A22] ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-serif-display font-semibold text-[#141A22] pb-3 mb-4 border-b border-[#E2E7EA]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-serif-display font-medium text-[#3B4CC0] pt-4 pb-2 mb-3 border-b border-[#E2E7EA]/60">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-[#141A22] pt-3 pb-1 mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed mb-3">
              {children}
            </p>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-4 p-4 bg-[#3B4CC0]/5 border-l-4 border-[#3B4CC0] rounded-r-2xl text-xs text-[#141A22] font-medium italic shadow-2xs">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="my-3 space-y-1.5 text-xs sm:text-sm text-neutral-700 pl-5 list-disc leading-relaxed">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 space-y-1.5 text-xs sm:text-sm text-neutral-700 pl-5 list-decimal leading-relaxed">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-5 rounded-2xl border border-[#E2E7EA] shadow-2xs">
              <table className="w-full text-xs text-left border-collapse bg-white">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#F5F7F8] font-semibold text-[#141A22] border-b border-[#E2E7EA]">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="p-3.5 border-r border-[#E2E7EA] last:border-r-0 font-semibold text-[#141A22]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="p-3.5 border-r border-[#E2E7EA] last:border-r-0 border-b border-[#E2E7EA] last:border-b-0 text-neutral-700">
              {children}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-[#F5F7F8] transition-colors">{children}</tr>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            return isInline ? (
              <code className="bg-[#F5F7F8] border border-[#E2E7EA] text-[#3B4CC0] font-mono text-[11px] px-1.5 py-0.5 rounded-md">
                {children}
              </code>
            ) : (
              <pre className="my-4 p-4 bg-[#141A22] text-white font-mono text-xs rounded-2xl overflow-x-auto">
                <code>{children}</code>
              </pre>
            );
          },
          hr: () => <hr className="my-6 border-[#E2E7EA]" />,
          strong: ({ children }) => (
            <strong className="font-semibold text-[#141A22]">{children}</strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
