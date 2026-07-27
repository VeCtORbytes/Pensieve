"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Sparkles,
  GitFork,
  Copy,
  Check,
  Download,
  Loader2,
  RefreshCw,
  Code,
  Layers,
  ChevronRight,
  ChevronDown,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import mermaid from "mermaid";

interface MindMapNodeItem {
  id: string;
  label: string;
  category: string;
  description: string;
  parentId: string;
}

interface MindMapData {
  title: string;
  mermaidCode: string;
  nodes: MindMapNodeItem[];
}

interface TreeMindMapNode {
  id: string;
  label: string;
  category: string;
  description: string;
  children: TreeMindMapNode[];
}

function buildTreeFromNodes(nodes: MindMapNodeItem[]): TreeMindMapNode | null {
  if (!nodes || nodes.length === 0) return null;
  const nodeMap = new Map<string, TreeMindMapNode>();
  nodes.forEach((n) =>
    nodeMap.set(n.id, {
      id: n.id,
      label: n.label,
      category: n.category,
      description: n.description,
      children: [],
    })
  );

  let rootNode: TreeMindMapNode | null = null;

  nodes.forEach((n) => {
    const current = nodeMap.get(n.id)!;
    if (!n.parentId || n.parentId === "none" || n.parentId === "root" || !nodeMap.has(n.parentId)) {
      if (!rootNode) rootNode = current;
    } else {
      const parent = nodeMap.get(n.parentId);
      if (parent) parent.children.push(current);
    }
  });

  return rootNode || nodeMap.get(nodes[0].id) || null;
}

export default function MindMapModal({
  notebookId,
  onClose,
}: {
  notebookId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<MindMapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"visual" | "mermaid">("mermaid");
  const [copied, setCopied] = useState(false);
  const [selectedNode, setSelectedNode] = useState<TreeMindMapNode | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const mermaidRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      securityLevel: "loose",
      fontFamily: "Inter, sans-serif",
      flowchart: { useMaxWidth: false, htmlLabels: true, curve: "basis" },
    });
  }, []);

  const rootTree = useMemo(() => {
    if (!data?.nodes) return null;
    return buildTreeFromNodes(data.nodes);
  }, [data]);

  async function generateMindMap() {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate mind map");
      }

      const result: MindMapData = await res.json();
      setData(result);
      const constructed = buildTreeFromNodes(result.nodes || []);
      if (constructed) setSelectedNode(constructed);
    } catch (err: any) {
      setError(err.message || "Failed to load mind map");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    generateMindMap();
  }, [notebookId]);

  // Render Mermaid SVG when data or tab changes
  useEffect(() => {
    if (!data || !data.mermaidCode || activeTab !== "mermaid") return;

    let isMounted = true;
    const renderId = `mermaid-svg-${Date.now()}`;

    try {
      mermaid.render(renderId, data.mermaidCode).then(({ svg }) => {
        if (isMounted && mermaidRef.current) {
          mermaidRef.current.innerHTML = svg;
          const svgEl = mermaidRef.current.querySelector("svg");
          if (svgEl) {
            svgEl.style.minWidth = "800px";
            svgEl.style.width = "100%";
            svgEl.style.height = "auto";
          }
        }
      }).catch((e) => {
        console.error("Mermaid render error:", e);
      });
    } catch (e) {
      console.error("Mermaid init error:", e);
    }

    return () => {
      isMounted = false;
    };
  }, [data, activeTab]);

  function handleCopyMermaid() {
    if (!data?.mermaidCode) return;
    navigator.clipboard.writeText(data.mermaidCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadMarkdown() {
    if (!data) return;
    const content = `# ${data.title}\n\n\`\`\`mermaid\n${data.mermaidCode}\n\`\`\`\n`;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.title.replace(/\s+/g, "-")}-MindMap.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-6xl w-full h-[92vh] p-4 sm:p-6 shadow-2xl border border-[#E2E7EA] text-[#141A22] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E7EA] pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#3B4CC0]/10 border border-[#3B4CC0]/20 text-[#3B4CC0]">
              <GitFork className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-serif-display font-normal text-[#141A22]">
                {data?.title || "AI Knowledge Graph & Mind Map"}
              </h2>
              <p className="text-[11px] text-neutral-500">
                Studio AI Diagram — Conceptual hierarchy generated from ingested sources
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data && (
              <>
                {/* View Switcher Tabs */}
                <div className="flex bg-[#F5F7F8] p-0.5 rounded-full border border-[#E2E7EA] text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setActiveTab("mermaid")}
                    className={`px-3 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === "mermaid"
                        ? "bg-white text-[#141A22] font-semibold shadow-xs"
                        : "text-neutral-500 hover:text-[#141A22]"
                    }`}
                  >
                    <Code className="w-3.5 h-3.5 text-[#3B4CC0]" />
                    <span>Diagram View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("visual")}
                    className={`px-3 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                      activeTab === "visual"
                        ? "bg-white text-[#141A22] font-semibold shadow-xs"
                        : "text-neutral-500 hover:text-[#141A22]"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Tree View</span>
                  </button>
                </div>

                {/* Diagram Zoom Controls */}
                {activeTab === "mermaid" && (
                  <div className="flex items-center bg-[#F5F7F8] border border-[#E2E7EA] rounded-full p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.2))}
                      title="Zoom Out"
                      className="p-1.5 text-neutral-600 hover:text-[#141A22] rounded-full hover:bg-white transition cursor-pointer"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-[10px] font-semibold px-2">
                      {Math.round(zoomScale * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoomScale((z) => Math.min(2.5, z + 0.2))}
                      title="Zoom In"
                      className="p-1.5 text-neutral-600 hover:text-[#141A22] rounded-full hover:bg-white transition cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomScale(1)}
                      title="Reset Zoom"
                      className="p-1.5 text-neutral-400 hover:text-[#141A22] rounded-full hover:bg-white transition cursor-pointer border-l border-[#E2E7EA]"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCopyMermaid}
                  title="Copy Mermaid Code"
                  className="p-2 text-neutral-500 hover:text-[#141A22] hover:bg-[#F5F7F8] rounded-xl transition cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-[#1D9E75]" /> : <Copy className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadMarkdown}
                  title="Download Markdown"
                  className="p-2 text-neutral-500 hover:text-[#141A22] hover:bg-[#F5F7F8] rounded-xl transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={generateMindMap}
                  title="Regenerate Mind Map"
                  className="p-2 text-neutral-500 hover:text-[#141A22] hover:bg-[#F5F7F8] rounded-xl transition cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-[#141A22] hover:bg-[#F5F7F8] rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 my-3 overflow-hidden bg-[#F5F7F8] rounded-3xl border border-[#E2E7EA] relative flex">
          {isLoading ? (
            <div className="w-full flex flex-col items-center justify-center p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#3B4CC0]" />
              <p className="text-xs font-semibold text-[#141A22]">
                Synthesizing Large High-Res Mind Map & Diagram...
              </p>
              <p className="text-[11px] text-neutral-400 max-w-xs">
                Extracting core topics, technical terms, and structural relationships from your sources.
              </p>
            </div>
          ) : error ? (
            <div className="w-full flex flex-col items-center justify-center p-12 text-center space-y-3">
              <Info className="w-8 h-8 text-amber-500" />
              <p className="text-xs font-semibold text-[#141A22]">{error}</p>
              <button
                type="button"
                onClick={generateMindMap}
                className="px-4 py-2 rounded-xl bg-[#141A22] text-white text-xs font-semibold hover:bg-[#3B4CC0] transition cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : activeTab === "visual" && rootTree ? (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
              {/* Interactive Tree View */}
              <div className="md:col-span-2 p-5 overflow-y-auto space-y-3 border-r border-[#E2E7EA] bg-white">
                <div className="text-[10px] font-mono font-semibold uppercase text-neutral-400 tracking-wider">
                  Interactive Node Hierarchy (Click node to inspect)
                </div>

                <TreeNodeItem
                  node={rootTree}
                  depth={0}
                  selectedNodeId={selectedNode?.id}
                  onSelectNode={(node) => setSelectedNode(node)}
                />
              </div>

              {/* Node Details Inspector Sidebar */}
              <div className="p-5 bg-[#F5F7F8] overflow-y-auto space-y-4">
                {selectedNode ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono font-semibold text-[#3B4CC0] bg-[#3B4CC0]/10 px-2 py-0.5 rounded border border-[#3B4CC0]/20">
                        {selectedNode.category || "Topic Node"}
                      </span>
                      <h4 className="text-lg font-serif-display font-normal text-[#141A22] pt-1">
                        {selectedNode.label}
                      </h4>
                    </div>

                    {selectedNode.description && (
                      <div className="p-4 bg-white rounded-2xl border border-[#E2E7EA] text-xs text-neutral-600 leading-relaxed shadow-2xs">
                        {selectedNode.description}
                      </div>
                    )}

                    {selectedNode.children && selectedNode.children.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <span className="text-[11px] font-semibold text-neutral-500">
                          Connected Concepts ({selectedNode.children.length})
                        </span>
                        <div className="space-y-1">
                          {selectedNode.children.map((child) => (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => setSelectedNode(child)}
                              className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-[#F5F7F8] border border-[#E2E7EA] text-xs font-medium text-[#141A22] hover:text-[#3B4CC0] transition flex items-center justify-between cursor-pointer"
                            >
                              <span>{child.label}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-xs text-neutral-400 py-12">
                    Click any node in the tree to inspect details.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* High-Res Zoomable Mermaid Diagram View */
            <div className="flex-1 p-6 overflow-auto bg-white flex items-center justify-center relative">
              <div
                ref={mermaidRef}
                style={{ transform: `scale(${zoomScale})`, transformOrigin: "center center" }}
                className="transition-transform duration-200 min-w-full flex items-center justify-center p-6"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TreeNodeItem({
  node,
  depth,
  selectedNodeId,
  onSelectNode,
}: {
  node: TreeMindMapNode;
  depth: number;
  selectedNodeId?: string;
  onSelectNode: (node: TreeMindMapNode) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="space-y-1" style={{ paddingLeft: depth * 18 }}>
      <div
        onClick={() => onSelectNode(node)}
        className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between group ${
          isSelected
            ? "bg-[#3B4CC0]/10 border-[#3B4CC0] shadow-xs text-[#3B4CC0]"
            : "bg-white hover:bg-[#F5F7F8] border-[#E2E7EA] text-[#141A22]"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {hasChildren && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
              className="p-1 text-neutral-400 hover:text-[#141A22] rounded transition"
            >
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          )}

          <div className="min-w-0">
            <div className="font-semibold text-xs truncate group-hover:text-[#3B4CC0]">
              {node.label}
            </div>
            {node.category && (
              <span className="text-[10px] font-mono text-neutral-400 truncate block">
                {node.category}
              </span>
            )}
          </div>
        </div>

        {hasChildren && (
          <span className="text-[10px] font-mono text-neutral-500 bg-[#F5F7F8] px-2 py-0.5 rounded-lg border border-[#E2E7EA]">
            {node.children!.length} subtopics
          </span>
        )}
      </div>

      {hasChildren && isOpen && (
        <div className="space-y-1 pt-1 border-l-2 border-[#E2E7EA] ml-3">
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
