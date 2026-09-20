import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BRAND } from "./brand";
import { useAnimationEngine } from "./animations/engine";
import { useAutomations } from "./automations/engine";
import { Canvas } from "./canvas/Canvas";
import { PanelPager } from "./canvas/PanelPager";
import {
  breakpointFor,
  clonePanel,
  createPanel,
  createWidget,
  docHasCustomCode,
  loadDoc,
  normalizeDoc,
  rectFor,
  removeWidgetFromPanel,
  saveDoc,
  starterDoc,
  uid,
} from "./lib/board";
import type { AnimationRule, BoardDoc, BreakpointKey, Panel, Rect, RenderBoard, Widget, WidgetType } from "./lib/types";
import { useAgentBridge } from "./bridge/useAgentBridge";
import { DataContext, useDataSources } from "./data/store";
import type { DataSource } from "./data/types";
import { createSource } from "./data/registry";
import { buildCommands, type Command } from "./commands/buildCommands";
import { isPaletteHotkey } from "./commands/shortcut";
import { AgentDialog } from "./ui/AgentDialog";
import { AnimationsDialog, newAnimationRule } from "./ui/AnimationsDialog";
import { TemplatesDialog } from "./ui/TemplatesDialog";
import { buildTemplatePanel, templateById } from "./templates";
import { AutomationsDialog, newAutomationRule } from "./ui/AutomationsDialog";
import { CommandPalette } from "./ui/CommandPalette";
import { DataDialog } from "./ui/DataDialog";
import { Icon } from "./ui/icons";
import { Toolbar, type MenuId } from "./ui/Toolbar";
import { Welcome } from "./ui/Welcome";
import { WidgetEditor } from "./ui/WidgetEditor";

const WELCOME_KEY = "d3shboard.welcomed";
const VIEW_HINT_KEY = "d3shboard.viewHints";

const readNumber = (key: string) => {
  try {
    return Number(localStorage.getItem(key) ?? 0);
  } catch {
    return 0;
  }
};
const writeValue = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Non-essential UI hint flag.
  }
};

export default function App() {
  const [doc, setDoc] = useState<BoardDoc>(() => loadDoc());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [showAutomations, setShowAutomations] = useState(false);
  const [animationsOpen, setAnimationsOpen] = useState<{ editId: string | null } | null>(null);
  const [showWelcome, setShowWelcome] = useState(() => !readNumber(WELCOME_KEY));
  const [viewHint, setViewHint] = useState(false);
  const [windowBp, setWindowBp] = useState<BreakpointKey>(() => breakpointFor(window.innerWidth));
  const [bpOverride, setBpOverride] = useState<BreakpointKey | null>(null);
  const [showAgent, setShowAgent] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showData, setShowData] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<{
    panelId: string;
    widget: Widget;
    index: number;
    animations: AnimationRule[];
  } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const canvasRef = useRef<HTMLDivElement>(null);
  const bridge = useAgentBridge(doc, setDoc);
  const data = useDataSources(doc.sources);

  const setSources = useCallback(
    (sources: DataSource[]) => setDoc((d) => ({ ...d, sources })),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPaletteHotkey(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setOpenMenu(null);
      setPaletteOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    const onResize = () => setWindowBp(breakpointFor(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => saveDoc(doc), [doc]);

  const editing = doc.mode === "edit";
  const bp = editing ? (bpOverride ?? windowBp) : windowBp;
  const fx = useAutomations(doc);

  const shownPanelId = editing ? doc.activePanelId : (fx.panelId ?? doc.activePanelId);
  const panelIndex = Math.max(0, doc.panels.findIndex((p) => p.id === shownPanelId));
  const panel = doc.panels[panelIndex] ?? doc.panels[0];

  const board: RenderBoard = useMemo(() => {
    const hasVisibility = !editing && Object.keys(fx.widgetVisible).length > 0;
    return {
      ...panel,
      accent: !editing && fx.accent ? fx.accent : panel.accent,
      fontFamily: !editing && fx.fontFamily ? fx.fontFamily : panel.fontFamily,
      background: !editing && fx.background ? fx.background : panel.background,
      widgets: hasVisibility
        ? panel.widgets.map((w) => {
            const visible = fx.widgetVisible[w.id];
            if (visible === undefined) return w;
            return { ...w, layouts: { ...w.layouts, [bp]: { ...rectFor(w, bp), hidden: !visible } } };
          })
        : panel.widgets,
      mode: doc.mode,
    };
  }, [panel, fx, editing, bp, doc.mode]);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--accent", board.accent);
    root.setProperty("--accent-ink", BRAND.accentInk);
    root.setProperty("--chrome", BRAND.chrome);
  }, [board.accent]);

  const visibleWidgets = useMemo(
    () => ({ ...board, widgets: board.widgets.filter((w) => !rectFor(w, bp).hidden) }),
    [board, bp],
  );
  useAnimationEngine({
    rootRef: canvasRef,
    panel: visibleWidgets,
    active: !editing,
    accent: board.accent,
    activeAutomationIds: fx.activeIds,
  });

  const patchPanel = useCallback((id: string, patch: Partial<Panel>) => {
    setDoc((d) => ({ ...d, panels: d.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }, []);

  const patchActivePanel = useCallback((patch: Partial<Panel>) => {
    setDoc((d) => ({ ...d, panels: d.panels.map((p) => (p.id === d.activePanelId ? { ...p, ...patch } : p)) }));
  }, []);

  const mapWidgets = useCallback((fn: (ws: Widget[]) => Widget[]) => {
    setDoc((d) => ({
      ...d,
      panels: d.panels.map((p) => (p.id === d.activePanelId ? { ...p, widgets: fn(p.widgets) } : p)),
    }));
  }, []);

  const updateWidget = useCallback(
    (id: string, patch: Partial<Widget>) => mapWidgets((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w))),
    [mapWidgets],
  );

  const updateRect = useCallback(
    (id: string, patch: Partial<Rect>) =>
      mapWidgets((ws) =>
        ws.map((w) => (w.id === id ? { ...w, layouts: { ...w.layouts, [bp]: { ...rectFor(w, bp), ...patch } } } : w)),
      ),
    [bp, mapWidgets],
  );

  const addWidget = useCallback((w: Widget) => mapWidgets((ws) => [...ws, w]), [mapWidgets]);

  const addType = useCallback(
    (type: WidgetType) => {
      const w = createWidget(type, 40, 40, Math.max(0, ...panel.widgets.map((x) => x.z)) + 1);
      addWidget(w);
      setSelectedId(w.id);
    },
    [addWidget, panel.widgets],
  );

  const removeWidget = useCallback(
    (id: string) => {
      setDoc((d) => ({
        ...d,
        panels: d.panels.map((p) => (p.id === d.activePanelId ? removeWidgetFromPanel(p, id) : p)),
      }));
      setSelectedId(null);
      setEditingWidgetId(null);
    },
    [],
  );

  const duplicateWidget = useCallback(
    (id: string) =>
      mapWidgets((ws) => {
        const src = ws.find((w) => w.id === id);
        if (!src) return ws;
        const layouts = { ...src.layouts };
        (Object.keys(layouts) as BreakpointKey[]).forEach((k) => {
          layouts[k] = { ...layouts[k], x: layouts[k].x + 24, y: layouts[k].y + 24 };
        });
        return [...ws, { ...src, id: uid(), z: src.z + 1, layouts }];
      }),
    [mapWidgets],
  );

  const goToPanel = useCallback((index: number) => {
    setDoc((d) => (d.panels[index] ? { ...d, activePanelId: d.panels[index].id } : d));
    setSelectedId(null);
    setEditingWidgetId(null);
  }, []);

  const addPanel = () =>
    setDoc((d) => {
      const p = createPanel(`Page ${d.panels.length + 1}`);
      return { ...d, panels: [...d.panels, p], activePanelId: p.id };
    });

  const duplicatePanel = (id: string) =>
    setDoc((d) => {
      const src = d.panels.find((p) => p.id === id);
      if (!src) return d;
      const copy = clonePanel(src);
      const panels = [...d.panels];
      panels.splice(panels.indexOf(src) + 1, 0, copy);
      return { ...d, panels, activePanelId: copy.id };
    });

  const deletePanel = (id: string) =>
    setDoc((d) => {
      if (d.panels.length < 2) return d;
      const panels = d.panels.filter((p) => p.id !== id);
      return { ...d, panels, activePanelId: d.activePanelId === id ? panels[0].id : d.activePanelId };
    });

  const movePanel = (id: string, dir: -1 | 1) =>
    setDoc((d) => {
      const from = d.panels.findIndex((p) => p.id === id);
      const to = from + dir;
      if (from < 0 || to < 0 || to >= d.panels.length) return d;
      const panels = [...d.panels];
      const [moved] = panels.splice(from, 1);
      panels.splice(to, 0, moved);
      return { ...d, panels };
    });

  const exportDoc = () => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = BRAND.exportFileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importDoc = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const next = normalizeDoc(JSON.parse(await file.text()));
        if (
          docHasCustomCode(next) &&
          !confirm(
            "This backup contains custom animation code that will run on your dashboard. Only load backups from people you trust. Load it anyway?",
          )
        )
          return;
        setDoc(next);
      } catch {
        alert("That file doesn't look like a dashboard backup.");
      }
    };
    input.click();
  };

  const finishEditing = () => {
    setSelectedId(null);
    setEditingWidgetId(null);
    setBpOverride(null);
    setDoc((d) => ({ ...d, mode: "display" }));
    const seen = readNumber(VIEW_HINT_KEY);
    if (seen < 3) {
      writeValue(VIEW_HINT_KEY, String(seen + 1));
      setViewHint(true);
      setTimeout(() => setViewHint(false), 4500);
    }
  };

  const editingWidget = useMemo(
    () => panel.widgets.find((w) => w.id === editingWidgetId) ?? null,
    [panel.widgets, editingWidgetId],
  );

  const setAnimations = (rules: AnimationRule[]) => patchActivePanel({ animations: rules });

  const openNewAnimation = (widgetId?: string) => {
    const rule = newAnimationRule(panel.widgets, widgetId);
    setAnimations([...panel.animations, rule]);
    setEditingWidgetId(null);
    setAnimationsOpen({ editId: rule.id });
  };

  const deleteWithUndo = (id: string) => {
    const index = panel.widgets.findIndex((w) => w.id === id);
    if (index < 0) return;
    const kept = new Set(removeWidgetFromPanel(panel, id).animations);
    setLastDeleted({
      panelId: panel.id,
      widget: panel.widgets[index],
      index,
      animations: panel.animations.filter((a) => !kept.has(a)),
    });
    removeWidget(id);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setLastDeleted(null), 6000);
  };

  const undoDelete = () => {
    if (!lastDeleted) return;
    const { panelId, widget, index, animations } = lastDeleted;
    setDoc((d) => ({
      ...d,
      panels: d.panels.map((p) =>
        p.id === panelId
          ? { ...p, widgets: [...p.widgets.slice(0, index), widget, ...p.widgets.slice(index)], animations: [...p.animations, ...animations] }
          : p,
      ),
    }));
    setSelectedId(widget.id);
    setLastDeleted(null);
    clearTimeout(undoTimer.current);
  };

  const showNotice = (text: string) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  };

  const overlayOpen =
    !!editingWidgetId || showAutomations || !!animationsOpen || showAgent || showTemplates || showData || paletteOpen || showWelcome || openMenu !== null;

  useEffect(() => {
    if (!editing || overlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.tagName === "SELECT" || t?.isContentEditable) return;
      if ((e.key === "Backspace" || e.key === "Delete") && !e.ctrlKey && !e.metaKey && !e.altKey && selectedId) {
        const widget = panel.widgets.find((w) => w.id === selectedId);
        if (!widget) return;
        e.preventDefault();
        if (widget.locked) showNotice("This component is locked.");
        else deleteWithUndo(widget.id);
      } else if (lastDeleted && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoDelete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const applyTemplate = (templateId: string) => {
    const template = templateById(templateId);
    if (!template) return;
    const panel = buildTemplatePanel(template);
    setDoc((d) => ({ ...d, panels: [...d.panels, panel], activePanelId: panel.id }));
    setSelectedId(null);
    setEditingWidgetId(null);
    setShowTemplates(false);
  };

  const resetDoc = () => {
    if (confirm("Start over? This wipes your whole dashboard and can't be undone (unless you've downloaded a backup).")) {
      setDoc(starterDoc());
    }
  };

  const startEditing = () => setDoc((d) => ({ ...d, mode: "edit" }));

  const closeOverlays = () => {
    setEditingWidgetId(null);
    setShowAutomations(false);
    setAnimationsOpen(null);
    setShowAgent(false);
    setShowData(false);
    setOpenMenu(null);
  };

  const commands = paletteOpen
    ? buildCommands({
        doc,
        panel,
        panelIndex,
        editing,
        bp,
        bpOverride,
        selected: panel.widgets.find((w) => w.id === selectedId) ?? null,
        agent: {
          enabled: bridge.settings.enabled,
          hasCode: !!bridge.settings.code,
          status: bridge.status,
          canUndo: bridge.canUndo,
        },
        actions: {
          addType,
          openMenu: setOpenMenu,
          editWidget: setEditingWidgetId,
          selectWidget: setSelectedId,
          duplicateWidget,
          removeWidget: deleteWithUndo,
          updateWidget,
          setHidden: (id, hidden) => updateRect(id, { hidden }),
          patchPanel: patchActivePanel,
          setBp: setBpOverride,
          goToPanel,
          addPanel,
          duplicatePanel,
          deletePanel,
          movePanel,
          renamePanel: (id, name) => patchPanel(id, { name }),
          openAnimations: () => setAnimationsOpen({ editId: null }),
          newAnimation: openNewAnimation,
          openAutomations: () => setShowAutomations(true),
          newAutomation: () => {
            setDoc((d) => ({ ...d, automations: [...d.automations, newAutomationRule(d)] }));
            setShowAutomations(true);
          },
          exportDoc,
          importDoc,
          resetDoc,
          openAgent: () => setShowAgent(true),
          openTemplates: () => setShowTemplates(true),
          openData: () => setShowData(true),
          addSource: (kind) => {
            const created = createSource(kind);
            if (created) setDoc((d) => ({ ...d, sources: [...d.sources, created] }));
            setShowData(true);
          },
          applyTemplate,
          setAgentEnabled: (enabled) => bridge.setSettings({ enabled }),
          undoAgent: bridge.undo,
          finishEditing,
          startEditing,
          openHelp: () => setShowWelcome(true),
        },
      })
    : [];

  const runCommand = (cmd: Command, value?: string) => {
    setPaletteOpen(false);
    closeOverlays();
    if (!cmd.anyMode && !editing) startEditing();
    // Let the palette unmount first so confirm() dialogs and newly opened menus don't fight it for focus.
    requestAnimationFrame(() => {
      if (cmd.prompt) cmd.prompt.run(value ?? "");
      else cmd.run?.();
    });
  };

  return (
    <DataContext.Provider value={data}>
    <main className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-[var(--chrome)] text-white">
      {editing ? (
        <Toolbar
          board={board}
          bp={bp}
          setBp={setBpOverride}
          setBoard={patchActivePanel}
          addType={addType}
          panels={doc.panels}
          activePanelId={doc.activePanelId}
          selectPanel={(id) => setDoc((d) => ({ ...d, activePanelId: id }))}
          addPanel={addPanel}
          renamePanel={(id, name) => patchPanel(id, { name })}
          duplicatePanel={duplicatePanel}
          deletePanel={deletePanel}
          movePanel={movePanel}
          onAutomations={() => setShowAutomations(true)}
          onAnimations={() => setAnimationsOpen({ editId: null })}
          onExport={exportDoc}
          onImport={importDoc}
          onReset={resetDoc}
          onHelp={() => setShowWelcome(true)}
          onTemplates={() => setShowTemplates(true)}
          onData={() => setShowData(true)}
          onAgent={() => setShowAgent(true)}
          agentStatus={bridge.status}
          onCommands={() => setPaletteOpen(true)}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          onDone={finishEditing}
        />
      ) : null}

      <div className="relative min-h-0 flex-1">
        <PanelPager count={doc.panels.length} index={panelIndex} accent={board.accent} go={goToPanel}>
          <Canvas
            ref={canvasRef}
            board={board}
            bp={bp}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onEdit={setEditingWidgetId}
            updateRect={updateRect}
            add={addWidget}
          />
        </PanelPager>
      </div>

      {!editing ? (
        <button
          onClick={startEditing}
          aria-label="Edit dashboard"
          title="Edit dashboard"
          className="fixed right-4 bottom-4 z-40 grid h-11 w-11 place-items-center rounded-full shadow-lg shadow-black/50 transition hover:scale-105"
          style={{ background: board.accent, color: BRAND.accentInk }}
        >
          <Icon name="pencil" size={18} />
        </button>
      ) : null}

      {!editing && viewHint ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
          <div className="rounded-full bg-black/75 px-4 py-2 text-center text-[13px] text-white shadow-lg backdrop-blur">
            This is your finished dashboard. Tap the pencil in the corner to edit again.
          </div>
        </div>
      ) : null}

      {editing && (lastDeleted || notice) ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex flex-col items-center gap-2 px-4">
          {notice ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-[13px] text-white shadow-lg shadow-black/50 backdrop-blur"
            >
              <Icon name="lock" size={14} className="text-[var(--accent)]" />
              {notice}
            </div>
          ) : null}
          {lastDeleted ? (
            <div
              role="status"
              className="pointer-events-auto flex items-center gap-3 rounded-full bg-black/80 py-1.5 pr-1.5 pl-4 text-[13px] text-white shadow-lg shadow-black/50 backdrop-blur"
            >
              Deleted “{lastDeleted.widget.title}”
              <button
                onClick={undoDelete}
                className="rounded-full bg-[var(--accent)] px-3 py-1 text-[12.5px] font-semibold text-[var(--accent-ink)] hover:brightness-110"
              >
                Undo
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {editing && editingWidget ? (
        <WidgetEditor
          board={board}
          bp={bp}
          widget={editingWidget}
          onClose={() => setEditingWidgetId(null)}
          update={updateWidget}
          updateRect={updateRect}
          remove={removeWidget}
          duplicate={duplicateWidget}
          onEditAnimation={(ruleId) => {
            setEditingWidgetId(null);
            setAnimationsOpen({ editId: ruleId });
          }}
          onNewAnimation={openNewAnimation}
        />
      ) : null}

      {editing && showAutomations ? (
        <AutomationsDialog
          doc={doc}
          onClose={() => setShowAutomations(false)}
          setAutomations={(automations) => setDoc((d) => ({ ...d, automations }))}
        />
      ) : null}

      {editing && animationsOpen ? (
        <AnimationsDialog
          panel={panel}
          automations={doc.automations}
          accent={board.accent}
          canvasRef={canvasRef}
          setAnimations={setAnimations}
          initialEditId={animationsOpen.editId}
          onClose={() => setAnimationsOpen(null)}
        />
      ) : null}

      {editing && showData ? (
        <DataDialog sources={doc.sources} setSources={setSources} store={data} onClose={() => setShowData(false)} />
      ) : null}

      {editing && showTemplates ? (
        <TemplatesDialog onPick={applyTemplate} onClose={() => setShowTemplates(false)} />
      ) : null}

      {editing && showAgent ? <AgentDialog bridge={bridge} onClose={() => setShowAgent(false)} /> : null}

      {paletteOpen ? (
        <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} onRun={runCommand} />
      ) : null}

      {showWelcome ? (
        <Welcome
          onClose={() => {
            writeValue(WELCOME_KEY, "1");
            setShowWelcome(false);
          }}
        />
      ) : null}
    </main>
    </DataContext.Provider>
  );
}
