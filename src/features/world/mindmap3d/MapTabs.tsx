import { useMemo, useRef, useState } from "react";
import { Plus, Download, Upload, Copy, Trash2 } from "lucide-react";
import { useMindmap } from "./store";
import { fileNameForMap } from "./library";
import { switchToMap, createMapAndSwitch, deleteMapAndReset } from "./runtime";

const CYAN = "#3ff0ff";
const GOLD = "#ffc95c";

function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Spreadsheet-style tab strip for switching between, managing, and porting mindmaps. */
export function MapTabs() {
  const maps = useMindmap((s) => s.maps);
  const activeMapId = useMindmap((s) => s.activeMapId);
  const renameMap = useMindmap((s) => s.renameMap);
  const duplicateMap = useMindmap((s) => s.duplicateMap);
  const exportMap = useMindmap((s) => s.exportMap);
  const importMap = useMindmap((s) => s.importMap);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const tabs = useMemo(() => Object.values(maps).sort((a, b) => a.createdAt - b.createdAt), [maps]);
  const canDelete = tabs.length > 1;

  const flash = (text: string, error = false) => {
    setNotice({ text, error });
    setTimeout(() => setNotice(null), 4000);
  };

  const commitRename = () => {
    if (editingId) renameMap(editingId, draft);
    setEditingId(null);
  };

  const onExport = () => {
    const out = exportMap(activeMapId);
    if (!out) return;
    downloadText(fileNameForMap(out.name), out.fileText);
    flash(`Exported "${out.name}"`);
  };

  const onImportFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let lastId: string | null = null;
    let imported = 0;
    for (const file of Array.from(files)) {
      const result = importMap(await file.text());
      if (result.ok) {
        lastId = result.id;
        imported++;
      } else {
        flash(`${file.name}: ${result.error}`, true);
      }
    }
    if (lastId) {
      switchToMap(lastId);
      flash(`Imported ${imported} mindmap${imported === 1 ? "" : "s"}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const btn = "rounded border p-1 transition hover:bg-white/10 disabled:opacity-30";

  return (
    <div
      className="pointer-events-auto absolute bottom-1 left-2 z-20 flex max-w-[55vw] flex-col gap-1 font-mono text-[10px]"
      data-testid="mindmap-tabs"
    >
      {notice && (
        <div
          className="self-start rounded border px-2 py-1"
          style={{
            borderColor: notice.error ? "rgba(255,79,216,0.5)" : "rgba(63,240,255,0.4)",
            background: "rgba(6,5,13,0.95)",
            color: notice.error ? "#ff4fd8" : CYAN,
          }}
        >
          {notice.text}
        </div>
      )}
      <div
        className="flex items-center gap-1 rounded border px-1 py-1"
        style={{ borderColor: "rgba(63,240,255,0.2)", background: "rgba(6,5,13,0.85)" }}
      >
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {tabs.map((m) => {
            const active = m.id === activeMapId;
            return editingId === m.id ? (
              <input
                key={m.id}
                autoFocus
                value={draft}
                maxLength={80}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="w-32 rounded border bg-black/60 px-2 py-0.5 text-white outline-none"
                style={{ borderColor: GOLD }}
              />
            ) : (
              <button
                key={m.id}
                onClick={() => {
                  setConfirmDeleteId(null);
                  switchToMap(m.id);
                }}
                onDoubleClick={() => {
                  setDraft(m.name);
                  setEditingId(m.id);
                }}
                title={active ? "Double-click to rename" : `Switch to ${m.name}`}
                className="max-w-[160px] shrink-0 truncate rounded border px-2.5 py-0.5 uppercase tracking-wider transition hover:bg-white/10"
                style={{
                  borderColor: active ? GOLD : "rgba(255,255,255,0.12)",
                  color: active ? GOLD : CYAN,
                  background: active ? "rgba(255,201,92,0.1)" : "transparent",
                }}
              >
                {m.name}
              </button>
            );
          })}
        </div>
        <button
          className={btn}
          style={{ borderColor: "rgba(63,240,255,0.3)", color: CYAN }}
          onClick={() => createMapAndSwitch()}
          title="New mindmap"
        >
          <Plus className="h-3 w-3" />
        </button>
        <span className="mx-0.5 h-4 w-px bg-white/15" />
        <button className={btn} style={{ borderColor: "rgba(255,255,255,0.15)" }} onClick={() => duplicateMap(activeMapId)} title="Duplicate this mindmap">
          <Copy className="h-3 w-3" />
        </button>
        <button className={btn} style={{ borderColor: "rgba(255,255,255,0.15)" }} onClick={onExport} title="Export this mindmap to a file (for the phone companion)">
          <Download className="h-3 w-3" />
        </button>
        <button className={btn} style={{ borderColor: "rgba(255,255,255,0.15)" }} onClick={() => fileRef.current?.click()} title="Import mindmap file(s)">
          <Upload className="h-3 w-3" />
        </button>
        {confirmDeleteId === activeMapId ? (
          <button
            className="rounded border px-1.5 py-0.5 uppercase text-[#ff4fd8]"
            style={{ borderColor: "rgba(255,79,216,0.6)" }}
            onClick={() => {
              deleteMapAndReset(activeMapId);
              setConfirmDeleteId(null);
            }}
            onBlur={() => setConfirmDeleteId(null)}
            autoFocus
          >
            Delete?
          </button>
        ) : (
          <button
            className={btn}
            style={{ borderColor: "rgba(255,79,216,0.3)", color: "#ff4fd8" }}
            disabled={!canDelete}
            onClick={() => setConfirmDeleteId(activeMapId)}
            title={canDelete ? "Delete this mindmap" : "Cannot delete the only mindmap"}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => void onImportFiles(e.target.files)}
        />
      </div>
    </div>
  );
}
