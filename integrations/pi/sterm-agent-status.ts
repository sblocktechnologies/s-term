import { CustomEditor, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { matchesKey, type Component } from "@earendil-works/pi-tui";

type State = "idle" | "working" | "attention" | "complete" | "error";

type NavigableEditor = Component & {
  handleInput: (data: string) => void;
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

function signal(state: State, message?: string) {
  if (!process.stdout.isTTY) return;
  const fields = ["sterm", "v=1", `state=${state}`, "agent=pi"];
  if (message) fields.push(`message=${encodeURIComponent(message.slice(0, 160))}`);
  process.stdout.write(`\x1b]777;${fields.join(";")}\x07`);
}

function addWholeDraftNavigation(component: Component): Component {
  const editor = component as NavigableEditor;
  if (editor.__stermNavigationPatched || typeof editor.handleInput !== "function") return component;

  const originalHandleInput = editor.handleInput.bind(editor);
  editor.handleInput = (data: string) => {
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

  pi.on("session_start", (_event, ctx) => {
    signal("idle", "Ready");
    previousEditorFactory = ctx.ui.getEditorComponent() as typeof previousEditorFactory;
    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      const editor = previousEditorFactory?.(tui, theme, keybindings) ??
        new CustomEditor(tui, theme, keybindings);
      return addWholeDraftNavigation(editor);
    });
  });

  pi.on("agent_start", () => signal("working", "Working"));
  pi.on("agent_settled", () => signal("complete", "Turn complete"));
  pi.on("session_shutdown", (event, ctx) => {
    ctx.ui.setEditorComponent(previousEditorFactory);
    previousEditorFactory = undefined;
    if (event.reason === "quit") signal("idle", "Agent exited");
  });
}
