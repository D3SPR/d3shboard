import { BREAKPOINTS, FONTS, effectiveStyle, rectFor } from "../lib/board";
import type { BoardDoc, BreakpointKey, Panel, Widget, WidgetType } from "../lib/types";
import type { BridgeStatus } from "../bridge/useAgentBridge";
import { WIDGET_CATALOG, catalogEntry } from "../widgets/catalog";
import type { IconName } from "../ui/icons";
import { BACKGROUND_PRESETS, NAMED_ACCENTS, type MenuId } from "../ui/Toolbar";

export const GROUP_ORDER = [
  "Add",
  "Selected component",
  "Components",
  "Pages",
  "Theme",
  "Screen size",
  "Motion & automations",
  "Agent",
  "Backup",
  "Dashboard",
] as const;

export type CommandGroup = (typeof GROUP_ORDER)[number];

export type Command = {
  id: string;
  label: string;
  group: CommandGroup;
  icon: IconName;
  keywords?: string;
  detail?: string;
  // Runs in whatever mode the dashboard is in; otherwise the app switches to editing first.
  anyMode?: boolean;
  run?: () => void;
  prompt?: { placeholder: string; initial?: string; run: (value: string) => void };
};

export type CommandContext = {
  doc: BoardDoc;
  panel: Panel;
  panelIndex: number;
  editing: boolean;
  bp: BreakpointKey;
  bpOverride: BreakpointKey | null;
  selected: Widget | null;
  agent: { enabled: boolean; hasCode: boolean; status: BridgeStatus; canUndo: boolean };
  actions: {
    addType: (type: WidgetType) => void;
    openMenu: (id: MenuId) => void;
    editWidget: (id: string) => void;
    selectWidget: (id: string) => void;
    duplicateWidget: (id: string) => void;
    removeWidget: (id: string) => void;
    updateWidget: (id: string, patch: Partial<Widget>) => void;
    setHidden: (id: string, hidden: boolean) => void;
    patchPanel: (patch: Partial<Panel>) => void;
    setBp: (bp: BreakpointKey | null) => void;
    goToPanel: (index: number) => void;
    addPanel: () => void;
    duplicatePanel: (id: string) => void;
    deletePanel: (id: string) => void;
    movePanel: (id: string, dir: -1 | 1) => void;
    renamePanel: (id: string, name: string) => void;
    openAnimations: () => void;
    newAnimation: (widgetId?: string) => void;
    openAutomations: () => void;
    newAutomation: () => void;
    exportDoc: () => void;
    importDoc: () => void;
    resetDoc: () => void;
    openAgent: () => void;
    setAgentEnabled: (enabled: boolean) => void;
    undoAgent: () => void;
    finishEditing: () => void;
    startEditing: () => void;
    openHelp: () => void;
  };
};

const SCREEN_ICON: Record<BreakpointKey, IconName> = { sm: "phone", md: "tablet", lg: "computer" };

export function buildCommands(ctx: CommandContext): Command[] {
  const { doc, panel, panelIndex, selected, actions: a } = ctx;
  const cmds: Command[] = [];
  const bpLabel = BREAKPOINTS.find((b) => b.key === ctx.bp)!.label;

  for (const item of WIDGET_CATALOG) {
    cmds.push({
      id: `add.${item.type}`,
      label: `Add ${item.label.toLowerCase()}`,
      group: "Add",
      icon: item.icon,
      keywords: `new insert create component widget ${item.type} ${item.description}`,
      run: () => a.addType(item.type),
    });
  }

  if (selected && ctx.editing) {
    const name = `“${selected.title}”`;
    const rect = rectFor(selected, ctx.bp);
    cmds.push(
      { id: "sel.edit", label: `Edit ${name}`, group: "Selected component", icon: "pencil", keywords: "open settings change", run: () => a.editWidget(selected.id) },
      { id: "sel.duplicate", label: `Duplicate ${name}`, group: "Selected component", icon: "copy", keywords: "copy clone", run: () => a.duplicateWidget(selected.id) },
      {
        id: "sel.delete",
        label: `Delete ${name}`,
        group: "Selected component",
        icon: "trash",
        detail: "⌫",
        keywords: "remove trash backspace",
        run: () => a.removeWidget(selected.id),
      },
      {
        id: "sel.front",
        label: `Bring ${name} to front`,
        group: "Selected component",
        icon: "layers",
        keywords: "layer order z top above",
        run: () => a.updateWidget(selected.id, { z: Math.max(...panel.widgets.map((w) => w.z)) + 1 }),
      },
      {
        id: "sel.back",
        label: `Send ${name} to back`,
        group: "Selected component",
        icon: "layers",
        keywords: "layer order z bottom behind",
        run: () => a.updateWidget(selected.id, { z: Math.min(...panel.widgets.map((w) => w.z)) - 1 }),
      },
      {
        id: "sel.lock",
        label: selected.locked ? `Unlock ${name}` : `Lock ${name} in place`,
        group: "Selected component",
        icon: "lock",
        keywords: "lock unlock pin freeze",
        run: () => a.updateWidget(selected.id, { locked: !selected.locked }),
      },
      {
        id: "sel.hide",
        label: rect.hidden ? `Show ${name} on ${bpLabel.toLowerCase()}` : `Hide ${name} on ${bpLabel.toLowerCase()}`,
        group: "Selected component",
        icon: "eye",
        keywords: "hide show visible screen size",
        run: () => a.setHidden(selected.id, !rect.hidden),
      },
      {
        id: "sel.autofit",
        label: selected.style.autoFit ? `Turn off auto-fit for ${name}` : `Turn on auto-fit for ${name}`,
        group: "Selected component",
        icon: "move",
        keywords: "auto fit scale size text resize centre center automatic",
        run: () => {
          const shown = effectiveStyle(selected, rect);
          a.updateWidget(selected.id, {
            style: selected.style.autoFit
              ? { ...selected.style, autoFit: false, fontSize: Math.round(shown.fontSize), padding: shown.padding, align: shown.align }
              : { ...selected.style, autoFit: true },
          });
        },
      },
      {
        id: "sel.title",
        label: selected.showTitle ? `Hide the name on ${name}` : `Show the name on ${name}`,
        group: "Selected component",
        icon: "text",
        keywords: "title heading label",
        run: () => a.updateWidget(selected.id, { showTitle: !selected.showTitle }),
      },
      {
        id: "sel.allScreens",
        label: `Use ${name}'s position on every screen size`,
        group: "Selected component",
        icon: "move",
        keywords: "copy layout phone tablet computer all",
        run: () => a.updateWidget(selected.id, { layouts: { sm: { ...rect }, md: { ...rect }, lg: { ...rect } } }),
      },
      {
        id: "sel.animate",
        label: `Animate ${name}`,
        group: "Selected component",
        icon: "sparkles",
        keywords: "animation motion move effect",
        run: () => a.newAnimation(selected.id),
      },
    );
  }

  for (const w of panel.widgets) {
    cmds.push({
      id: `widget.edit.${w.id}`,
      label: `Edit “${w.title}”`,
      group: "Components",
      icon: catalogEntry(w.type).icon,
      detail: catalogEntry(w.type).label,
      keywords: `open settings select ${w.type}`,
      run: () => {
        a.selectWidget(w.id);
        a.editWidget(w.id);
      },
    });
  }

  cmds.push(
    { id: "page.new", label: "New page", group: "Pages", icon: "plus", keywords: "add panel create screen", run: a.addPanel },
    {
      id: "page.rename",
      label: `Rename this page (“${panel.name}”)…`,
      group: "Pages",
      icon: "pencil",
      keywords: "name title panel",
      prompt: { placeholder: "New page name", initial: panel.name, run: (name) => name.trim() && a.renamePanel(panel.id, name.trim()) },
    },
    { id: "page.duplicate", label: "Duplicate this page", group: "Pages", icon: "copy", keywords: "copy clone panel", run: () => a.duplicatePanel(panel.id) },
    { id: "page.menu", label: "Open pages menu", group: "Pages", icon: "pages", keywords: "panels manage", run: () => a.openMenu("pages") },
  );
  if (doc.panels.length > 1) {
    cmds.push({
      id: "page.delete",
      label: `Delete this page (“${panel.name}”)`,
      group: "Pages",
      icon: "trash",
      keywords: "remove trash panel",
      run: () => confirm(`Delete “${panel.name}” and everything on it?`) && a.deletePanel(panel.id),
    });
  }
  if (panelIndex > 0) {
    cmds.push(
      { id: "page.prev", label: "Previous page", group: "Pages", icon: "left", detail: "←", keywords: "back go panel", anyMode: true, run: () => a.goToPanel(panelIndex - 1) },
      { id: "page.moveEarlier", label: "Move this page earlier", group: "Pages", icon: "left", keywords: "reorder order panel", run: () => a.movePanel(panel.id, -1) },
    );
  }
  if (panelIndex < doc.panels.length - 1) {
    cmds.push(
      { id: "page.next", label: "Next page", group: "Pages", icon: "right", detail: "→", keywords: "forward go panel", anyMode: true, run: () => a.goToPanel(panelIndex + 1) },
      { id: "page.moveLater", label: "Move this page later", group: "Pages", icon: "right", keywords: "reorder order panel", run: () => a.movePanel(panel.id, 1) },
    );
  }
  doc.panels.forEach((p, i) => {
    if (i === panelIndex) return;
    cmds.push({
      id: `page.go.${p.id}`,
      label: `Go to page: ${p.name}`,
      group: "Pages",
      icon: "pages",
      keywords: "open switch show panel",
      anyMode: true,
      run: () => a.goToPanel(i),
    });
  });

  cmds.push({ id: "theme.open", label: "Open theme editor", group: "Theme", icon: "palette", keywords: "colours colors style look background font", run: () => a.openMenu("theme") });
  for (const accent of NAMED_ACCENTS) {
    cmds.push({
      id: `theme.accent.${accent.name}`,
      label: `Highlight colour: ${accent.name}`,
      group: "Theme",
      icon: "palette",
      detail: panel.accent.toLowerCase() === accent.color ? "Current" : undefined,
      keywords: `accent colour color ${accent.color}`,
      run: () => a.patchPanel({ accent: accent.color }),
    });
  }
  for (const preset of BACKGROUND_PRESETS) {
    cmds.push({
      id: `theme.bg.${preset.label}`,
      label: `Background: ${preset.label}`,
      group: "Theme",
      icon: "image",
      keywords: "wallpaper gradient colour color",
      run: () => a.patchPanel({ background: { ...panel.background, ...preset.bg } }),
    });
  }
  for (const font of FONTS) {
    const name = font === "system-ui" ? "Device default" : font;
    cmds.push({
      id: `theme.font.${font}`,
      label: `Font: ${name}`,
      group: "Theme",
      icon: "text",
      detail: panel.fontFamily === font ? "Current" : undefined,
      keywords: "typeface lettering",
      run: () => a.patchPanel({ fontFamily: font }),
    });
  }
  cmds.push(
    {
      id: "theme.snap",
      label: panel.snap ? "Turn off snap to grid" : "Turn on snap to grid",
      group: "Theme",
      icon: "move",
      keywords: "grid align",
      run: () => a.patchPanel({ snap: !panel.snap }),
    },
    {
      id: "theme.grid",
      label: panel.showGrid ? "Hide grid dots" : "Show grid dots",
      group: "Theme",
      icon: "move",
      keywords: "grid dots guides",
      run: () => a.patchPanel({ showGrid: !panel.showGrid }),
    },
  );

  for (const b of BREAKPOINTS) {
    cmds.push({
      id: `screen.${b.key}`,
      label: `Arrange for ${b.label.toLowerCase()}`,
      group: "Screen size",
      icon: SCREEN_ICON[b.key],
      detail: ctx.editing && ctx.bp === b.key ? "Current" : `${b.width}px`,
      keywords: "screen size layout breakpoint device responsive",
      run: () => a.setBp(b.key),
    });
  }
  if (ctx.bpOverride) {
    cmds.push({
      id: "screen.auto",
      label: "Arrange for this window's size",
      group: "Screen size",
      icon: "computer",
      keywords: "screen size reset automatic",
      run: () => a.setBp(null),
    });
  }
  cmds.push({ id: "screen.menu", label: "Open screen size menu", group: "Screen size", icon: "tablet", keywords: "phone tablet computer", run: () => a.openMenu("screen") });

  cmds.push(
    { id: "motion.animations", label: "Open animations", group: "Motion & automations", icon: "sparkles", keywords: "animate motion effects", run: a.openAnimations },
    { id: "motion.automations", label: "Open automations", group: "Motion & automations", icon: "zap", keywords: "rules schedule time", run: a.openAutomations },
    { id: "motion.newAutomation", label: "New automation rule", group: "Motion & automations", icon: "zap", keywords: "add create rule schedule", run: a.newAutomation },
  );
  if (panel.widgets.length) {
    cmds.push({ id: "motion.newAnimation", label: "New animation", group: "Motion & automations", icon: "sparkles", keywords: "add create animate effect", run: () => a.newAnimation() });
  }

  cmds.push({ id: "agent.open", label: "Connect an AI agent", group: "Agent", icon: "bot", keywords: "mcp claude ai bridge pair", run: a.openAgent });
  if (ctx.agent.enabled) {
    cmds.push({ id: "agent.disconnect", label: "Disconnect AI agent", group: "Agent", icon: "bot", detail: ctx.agent.status, keywords: "mcp stop bridge", anyMode: true, run: () => a.setAgentEnabled(false) });
  } else if (ctx.agent.hasCode) {
    cmds.push({ id: "agent.reconnect", label: "Reconnect AI agent", group: "Agent", icon: "bot", keywords: "mcp start bridge", anyMode: true, run: () => a.setAgentEnabled(true) });
  }
  if (ctx.agent.canUndo) {
    cmds.push({ id: "agent.undo", label: "Undo last agent change", group: "Agent", icon: "undo", keywords: "revert mcp", anyMode: true, run: a.undoAgent });
  }

  cmds.push(
    { id: "backup.download", label: "Download a backup", group: "Backup", icon: "save", keywords: "export save file json", anyMode: true, run: a.exportDoc },
    { id: "backup.load", label: "Load a backup", group: "Backup", icon: "copy", keywords: "import open file json restore", run: a.importDoc },
    { id: "backup.reset", label: "Start over", group: "Backup", icon: "trash", keywords: "reset wipe clear new", run: a.resetDoc },
  );

  cmds.push(
    ctx.editing
      ? { id: "dash.view", label: "Done — view finished dashboard", group: "Dashboard", icon: "eye", keywords: "preview display present finish", anyMode: true, run: a.finishEditing }
      : { id: "dash.edit", label: "Edit dashboard", group: "Dashboard", icon: "pencil", keywords: "change modify", anyMode: true, run: a.startEditing },
    { id: "dash.help", label: "Show the welcome guide", group: "Dashboard", icon: "help", keywords: "help tutorial how", anyMode: true, run: a.openHelp },
  );

  return cmds;
}
