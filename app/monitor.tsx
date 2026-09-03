"use client";

import { useCallback, useEffect, useState } from "react";
import SearchBar from "./searchbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { getSavedDomains, getPagesByDomain } from "@/lib/storage";

interface DiffLine {
  type: "add" | "remove" | "same";
  text: string;
  lineNum: number;
}

interface PageDiff {
  url: string;
  status: "new" | "changed" | "unchanged";
  oldContent?: string;
  newContent: string;
  addedLines: number;
  removedLines: number;
}

function computeDiff(oldText: string, newText: string): { added: number; removed: number; lines: DiffLine[] } {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const lines: DiffLine[] = [];
  let added = 0, removed = 0, lineNum = 0;
  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    lineNum++;
    if (i >= oldLines.length) { lines.push({ type: "add", text: newLines[i], lineNum }); added++; }
    else if (i >= newLines.length) { lines.push({ type: "remove", text: oldLines[i], lineNum }); removed++; }
    else if (oldLines[i] !== newLines[i]) { lines.push({ type: "remove", text: oldLines[i], lineNum }); lines.push({ type: "add", text: newLines[i], lineNum }); added++; removed++; }
    else { lines.push({ type: "same", text: oldLines[i], lineNum }); }
  }
  return { added, removed, lines };
}

type Filter = "all" | "changed" | "unchanged" | "new";
type ExportFormat = "json" | "csv" | "markdown";

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportDiffs(diffs: PageDiff[], format: ExportFormat) {
  const ts = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    const report = diffs.map((d) => ({
      url: d.url, status: d.status, addedLines: d.addedLines, removedLines: d.removedLines,
    }));
    downloadBlob(JSON.stringify(report, null, 2), `diff-report-${ts}.json`, "application/json");
  } else if (format === "csv") {
    const rows = [["URL", "Status", "Added Lines", "Removed Lines"]];
    for (const d of diffs) rows.push([d.url, d.status, String(d.addedLines), String(d.removedLines)]);
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadBlob(csv, `diff-report-${ts}.csv`, "text/csv");
  } else {
    let md = `# Diff Monitor Report\n\n**Date:** ${ts}\n**Pages:** ${diffs.length}\n\n`;
    const changed = diffs.filter((d) => d.status === "changed");
    const newP = diffs.filter((d) => d.status === "new");
    md += `| Status | Count |\n|--------|-------|\n| Changed | ${changed.length} |\n| New | ${newP.length} |\n| Unchanged | ${diffs.length - changed.length - newP.length} |\n\n`;
    if (changed.length > 0) {
      md += `## Changed Pages\n\n| URL | Added | Removed |\n|-----|-------|--------|\n`;
      for (const d of changed) md += `| ${d.url} | +${d.addedLines} | -${d.removedLines} |\n`;
      md += "\n";
    }
    if (newP.length > 0) {
      md += `## New Pages\n\n`;
      for (const d of newP) md += `- ${d.url} (${d.addedLines} lines)\n`;
    }
    downloadBlob(md, `diff-report-${ts}.md`, "text/markdown");
  }
}

export default function Monitor() {
  const [data, setData] = useState<any[] | null>(null);
  const [snapshots, setSnapshots] = useState<Map<string, string>>(new Map());
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const { toast } = useToast();

  // Load previous snapshots from IndexedDB on mount
  const loadSnapshots = useCallback(async () => {
    try {
      const domains = await getSavedDomains();
      const map = new Map<string, string>();
      for (const d of domains) {
        const pages = await getPagesByDomain(d.domain);
        for (const p of pages) map.set(p.url, p.content);
      }
      setSnapshots(map);
    } catch {}
  }, []);

  useEffect(() => { loadSnapshots(); }, [loadSnapshots]);

  const diffs: PageDiff[] = (data || []).filter((p) => p?.url).map((page) => {
    const oldContent = snapshots.get(page.url);
    if (!oldContent) return { url: page.url, status: "new" as const, newContent: page.content || "", addedLines: (page.content || "").split("\n").length, removedLines: 0 };
    if (oldContent === (page.content || "")) return { url: page.url, status: "unchanged" as const, oldContent, newContent: page.content || "", addedLines: 0, removedLines: 0 };
    const { added, removed } = computeDiff(oldContent, page.content || "");
    return { url: page.url, status: "changed" as const, oldContent, newContent: page.content || "", addedLines: added, removedLines: removed };
  });

  const changedCount = diffs.filter((d) => d.status === "changed").length;
  const unchangedCount = diffs.filter((d) => d.status === "unchanged").length;
  const newCount = diffs.filter((d) => d.status === "new").length;

  const filtered = filter === "all" ? diffs : diffs.filter((d) => d.status === filter);
  const selectedDiff = diffs.find((d) => d.url === selectedUrl);
  const diffLines = selectedDiff?.oldContent ? computeDiff(selectedDiff.oldContent, selectedDiff.newContent).lines : null;
  const displayLines = diffLines && showOnlyDiffs ? diffLines.filter((l) => l.type !== "same") : diffLines;

  const onSaveComplete = () => {
    const newMap = new Map(snapshots);
    (data || []).forEach((p) => { if (p?.url) newMap.set(p.url, p.content || ""); });
    setSnapshots(newMap);
    toast({ title: "Snapshot saved", description: "Current crawl stored as baseline for future comparisons." });
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <SearchBar setDataValues={setData} onSaveComplete={onSaveComplete} />
      <div className="flex-1 overflow-auto p-4 max-w-7xl mx-auto w-full">
        {diffs.length > 0 ? (
          <>
            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{diffs.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Pages Scanned</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-yellow-500/10 border-yellow-500/20">
                <p className="text-2xl font-bold text-yellow-400">{changedCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Changed</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-green-500/10 border-green-500/20">
                <p className="text-2xl font-bold text-green-400">{unchangedCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Unchanged</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-blue-500/10 border-blue-500/20">
                <p className="text-2xl font-bold text-blue-400">{newCount}</p>
                <p className="text-xs text-muted-foreground mt-1">New Pages</p>
              </div>
            </div>

            {/* Result Banner */}
            {changedCount === 0 ? (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 mb-6 text-center">
                <p className="text-green-400 font-semibold text-lg">No changes detected!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  All {unchangedCount} existing pages are identical to the last snapshot.
                  {newCount > 0 && ` ${newCount} new page${newCount !== 1 ? "s" : ""} discovered.`}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 mb-6 text-center">
                <p className="text-yellow-400 font-semibold text-lg">
                  {changedCount} page{changedCount !== 1 ? "s" : ""} changed since last snapshot
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Select a page below to view the diff. Re-crawl anytime to compare again.
                </p>
              </div>
            )}

            {/* Download + Filter */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => exportDiffs(diffs, exportFormat)}>
                Download Report
              </Button>
              <div className="flex-1" />
              {(["all", "changed", "unchanged", "new"] as Filter[]).map((key) => {
                const counts: Record<Filter, number> = { all: diffs.length, changed: changedCount, unchanged: unchangedCount, new: newCount };
                const labels: Record<Filter, string> = { all: "All", changed: "Changed", unchanged: "Unchanged", new: "New" };
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant={filter === key ? "default" : "outline"}
                    onClick={() => setFilter(key)}
                    className="text-xs"
                  >
                    {labels[key]} ({counts[key]})
                  </Button>
                );
              })}
            </div>

            {/* Split View: Page List + Diff Viewer */}
            <div className="flex gap-4 h-[calc(100vh-420px)] min-h-[300px]">
              {/* Page List */}
              <div className="w-2/5 border rounded-lg overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                  <span className="flex-1">Page URL</span>
                  <span className="w-20 text-center">Status</span>
                  <span className="w-20 text-right">Changes</span>
                </div>
                <div className="overflow-auto flex-1">
                  {filtered.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">No pages match this filter.</div>
                  ) : (
                    filtered.map((diff) => (
                      <button
                        key={diff.url}
                        className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/30 transition-colors text-sm flex items-center gap-2 ${selectedUrl === diff.url ? "bg-muted/50 border-l-2 border-l-[#3bde77]" : ""}`}
                        onClick={() => setSelectedUrl(diff.url)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-mono text-xs">{diff.url}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); copyUrl(diff.url); }}
                              className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy URL"
                            >
                              {copiedUrl === diff.url ? (
                                <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                              )}
                            </button>
                          </div>
                        </div>
                        <Badge
                          variant={diff.status === "changed" ? "secondary" : diff.status === "new" ? "default" : "outline"}
                          className={`text-[10px] w-20 justify-center ${diff.status === "new" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : diff.status === "unchanged" ? "text-green-400 border-green-500/30" : ""}`}
                        >
                          {diff.status}
                        </Badge>
                        <span className="text-xs w-20 text-right tabular-nums text-muted-foreground">
                          {diff.status === "changed" ? (
                            <><span className="text-green-400">+{diff.addedLines}</span>{" "}<span className="text-red-400">-{diff.removedLines}</span></>
                          ) : diff.status === "new" ? (
                            <span className="text-blue-400">+{diff.addedLines}</span>
                          ) : (
                            <span className="text-muted-foreground/50">--</span>
                          )}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Diff Viewer */}
              <div className="flex-1 border rounded-lg overflow-hidden flex flex-col">
                {selectedDiff ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b text-xs shrink-0">
                      <span className="font-mono truncate flex-1">{selectedDiff.url}</span>
                      {diffLines && (
                        <Button
                          size="sm"
                          variant={showOnlyDiffs ? "default" : "outline"}
                          className="text-[10px] h-6 px-2"
                          onClick={() => setShowOnlyDiffs(!showOnlyDiffs)}
                        >
                          {showOnlyDiffs ? "Show All Lines" : "Diffs Only"}
                        </Button>
                      )}
                      <Badge variant={selectedDiff.status === "changed" ? "secondary" : selectedDiff.status === "new" ? "default" : "outline"} className="text-[10px]">
                        {selectedDiff.status}
                      </Badge>
                    </div>
                    <div className="overflow-auto flex-1 font-mono text-xs leading-5">
                      {displayLines && displayLines.length > 0 ? (
                        displayLines.map((line, i) => (
                          <div
                            key={i}
                            className={`px-3 py-px flex ${
                              line.type === "add" ? "bg-green-500/10" : line.type === "remove" ? "bg-red-500/10" : ""
                            }`}
                          >
                            <span className="w-10 shrink-0 text-muted-foreground/50 text-right mr-3 select-none">{line.lineNum}</span>
                            <span className={`w-4 shrink-0 select-none ${
                              line.type === "add" ? "text-green-400" : line.type === "remove" ? "text-red-400" : "text-muted-foreground/30"
                            }`}>
                              {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                            </span>
                            <span className={line.type === "add" ? "text-green-300" : line.type === "remove" ? "text-red-300" : ""}>
                              {line.text}
                            </span>
                          </div>
                        ))
                      ) : selectedDiff.status === "unchanged" ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          <div className="text-center">
                            <p className="text-lg font-semibold text-green-400 mb-1">No changes</p>
                            <p>This page is identical to the last snapshot.</p>
                          </div>
                        </div>
                      ) : selectedDiff.status === "new" ? (
                        <pre className="p-3 whitespace-pre-wrap break-all text-muted-foreground">{selectedDiff.newContent.slice(0, 10000)}{selectedDiff.newContent.length > 10000 ? "\n\n... truncated ..." : ""}</pre>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">No diff available</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center space-y-2">
                      <svg className="w-10 h-10 mx-auto opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <p className="text-sm">Select a page to view its diff</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Snapshot Info */}
            <div className="mt-4 text-xs text-muted-foreground text-center">
              {snapshots.size > 0
                ? `Comparing against ${snapshots.size} stored page snapshots. Re-crawl to update the baseline.`
                : "First crawl — all pages shown as new. Crawl again later to see changes."}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <svg
              height={64}
              width={64}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              className="fill-[#3bde77] opacity-30"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M20.646 5.196A2.25 2.25 0 0 0 17.199 2.304L15.447 4.391A4.5 4.5 0 0 1 8.553 4.391L6.801 2.304A2.25 2.25 0 0 0 3.354 5.196L8.697 11.564A4.5 4.5 0 0 1 9.75 14.457L9.75 20.25A2.25 2.25 0 0 0 14.25 20.25L14.25 14.457A4.5 4.5 0 0 1 15.303 11.564L20.646 5.196Z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-muted-foreground">Spider Diff Monitor</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Crawl a website to take a snapshot. Crawl it again later to see exactly
              what changed — added lines, removed lines, and unchanged pages — all in a
              side-by-side diff viewer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
