import type { AssistantMessage } from "@earendil-works/pi-ai";
import { CustomEditor, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { matchesKey, type Component } from "@earendil-works/pi-tui";

type State = "idle" | "working" | "attention" | "complete" | "error";

type NavigableEditor = Component & {
  handleInput: (data: string) => void;
  onPasteImage?: () => void;
  state?: {
    lines: string[];
    cursorLine: number;
    cursorCol: number;
  };
  preferredVisualCol?: number | null;
  snappedFromCursorCol?: number | null;
  scrollOffset?: number;
  __stermNavigationPatched?: boolean;
};

const isSTerm = process.env.TERM_PROGRAM === "S-Term" && Boolean(process.env.STERM_SESSION_ID);
const supportsTelemetryHeader = isSTerm && process.env.STERM_TELEMETRY_HEADER === "1";

function emit(fields: Array<[string, string | number | boolean | undefined]>) {
  if (!process.stdout.isTTY) return;
  const encoded = ["sterm", "v=1"];
  for (const [key, value] of fields) {
    if (value === undefined) continue;
    encoded.push(`${key}=${encodeURIComponent(typeof value === "boolean" ? (value ? "1" : "0") : String(value))}`);
  }
  process.stdout.write(`\x1b]777;${encoded.join(";")}\x07`);
}

function signal(state: State, message?: string) {
  emit([
    ["state", state],
    ["agent", "pi"],
    ["message", message?.slice(0, 160)],
  ]);
}

function addWholeDraftNavigation(component: Component): Component {
  const editor = component as NavigableEditor;
  if (editor.__stermNavigationPatched || typeof editor.handleInput !== "function") return component;

  const originalHandleInput = editor.handleInput.bind(editor);
  editor.handleInput = (data: string) => {
    if (isSTerm && matchesKey(data, "ctrl+shift+v") && editor.onPasteImage) {
      editor.onPasteImage();
      return;
    }

    const moveToStart = matchesKey(data, "ctrl+home");
    const moveToEnd = matchesKey(data, "ctrl+end");
    if (!moveToStart && !moveToEnd) {
      originalHandleInput(data);
      return;
    }

    const state = editor.state;
    if (!state || !Array.isArray(state.lines) || state.lines.length === 0) {
      originalHandleInput(data);
      return;
    }

    if (moveToStart) {
      state.cursorLine = 0;
      state.cursorCol = 0;
      editor.scrollOffset = 0;
    } else {
      state.cursorLine = state.lines.length - 1;
      state.cursorCol = state.lines[state.cursorLine]?.length ?? 0;
    }
    editor.preferredVisualCol = null;
    editor.snappedFromCursorCol = null;
    editor.invalidate();
  };
  editor.__stermNavigationPatched = true;
  return component;
}

export default function (pi: ExtensionAPI) {
  let previousEditorFactory: ReturnType<ExtensionContext["ui"]["getEditorComponent"]>;
  let currentContext: ExtensionContext | undefined;
  let getGitBranch: () => string | null = () => null;
  let gitTimer: ReturnType<typeof setInterval> | undefined;
  let active = false;
  let refreshInFlight = false;
  let refreshPending = false;
  let lastTelemetry = "";

  const refreshTelemetry = async (ctx: ExtensionContext) => {
    if (!supportsTelemetryHeader || !active) return;
    currentContext = ctx;
    if (refreshInFlight) {
      refreshPending = true;
      return;
    }
    refreshInFlight = true;
    try {
      let gitDirty: boolean | undefined;
      try {
        const result = await pi.exec("git", ["status", "--porcelain=v1", "--untracked-files=normal"], {
          cwd: ctx.cwd,
          timeout: 2500,
        });
        if (result.code === 0) gitDirty = result.stdout.trim().length > 0;
      } catch {
        gitDirty = undefined;
      }

      let input = 0;
      let output = 0;
      let cacheRead = 0;
      let cacheWrite = 0;
      let cost = 0;
      for (const entry of ctx.sessionManager.getEntries()) {
        if (entry.type !== "message" || entry.message.role !== "assistant") continue;
        const message = entry.message as AssistantMessage;
        input += message.usage.input;
        output += message.usage.output;
        cacheRead += message.usage.cacheRead;
        cacheWrite += message.usage.cacheWrite;
        cost += message.usage.cost.total;
      }

      const model = ctx.model;
      const context = ctx.getContextUsage();
      const fields: Array<[string, string | number | boolean | undefined]> = [
        ["event", "telemetry"],
        ["agent", "pi"],
        ["cwd", ctx.cwd],
        ["branch", getGitBranch() || undefined],
        ["dirty", gitDirty],
        ["provider", model?.provider],
        ["model", model?.id],
        ["thinking", pi.getThinkingLevel()],
        ["input", input],
        ["output", output],
        ["cacheRead", cacheRead],
        ["cacheWrite", cacheWrite],
        ["cost", Number(cost.toFixed(6))],
        ["sub", model ? ctx.modelRegistry.isUsingOAuth(model) : undefined],
        ["contextTokens", context?.tokens ?? undefined],
        ["contextWindow", context?.contextWindow ?? model?.contextWindow],
        ["contextPercent", context?.percent === null ? undefined : context?.percent],
      ];
      const fingerprint = JSON.stringify(fields);
      if (fingerprint !== lastTelemetry) {
        lastTelemetry = fingerprint;
        emit(fields);
      }
    } finally {
      refreshInFlight = false;
      if (refreshPending && active && currentContext) {
        refreshPending = false;
        void refreshTelemetry(currentContext);
      }
    }
  };

  pi.on("session_start", (_event, ctx) => {
    active = true;
    currentContext = ctx;
    lastTelemetry = "";
    signal("idle", "Ready");

    previousEditorFactory = ctx.ui.getEditorComponent() as typeof previousEditorFactory;
    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      const editor = previousEditorFactory?.(tui, theme, keybindings) ??
        new CustomEditor(tui, theme, keybindings);
      return addWholeDraftNavigation(editor);
    });

    if (supportsTelemetryHeader) {
      ctx.ui.setFooter((_tui, _theme, footerData) => {
        getGitBranch = () => footerData.getGitBranch();
        const unsubscribe = footerData.onBranchChange(() => void refreshTelemetry(ctx));
        void refreshTelemetry(ctx);
        return {
          render: () => [],
          invalidate() {},
          dispose: unsubscribe,
        };
      });
      gitTimer = setInterval(() => {
        if (currentContext) void refreshTelemetry(currentContext);
      }, 5000);
      gitTimer.unref?.();
    }
  });

  pi.on("agent_start", (_event, ctx) => {
    signal("working", "Working");
    void refreshTelemetry(ctx);
  });
  pi.on("turn_end", (_event, ctx) => void refreshTelemetry(ctx));
  pi.on("model_select", (_event, ctx) => void refreshTelemetry(ctx));
  pi.on("thinking_level_select", (_event, ctx) => void refreshTelemetry(ctx));
  pi.on("agent_settled", (_event, ctx) => {
    signal("complete", "Turn complete");
    void refreshTelemetry(ctx);
  });
  pi.on("session_shutdown", (event, ctx) => {
    active = false;
    currentContext = undefined;
    refreshPending = false;
    if (gitTimer) clearInterval(gitTimer);
    gitTimer = undefined;
    getGitBranch = () => null;
    if (supportsTelemetryHeader) ctx.ui.setFooter(undefined);
    ctx.ui.setEditorComponent(previousEditorFactory);
    previousEditorFactory = undefined;
    if (event.reason === "quit") signal("idle", "Agent exited");
  });
}
