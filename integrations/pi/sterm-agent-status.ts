import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type State = "idle" | "working" | "attention" | "complete" | "error";

function signal(state: State, message?: string) {
  if (!process.stdout.isTTY) return;
  const fields = ["sterm", "v=1", `state=${state}`, "agent=pi"];
  if (message) fields.push(`message=${encodeURIComponent(message.slice(0, 160))}`);
  process.stdout.write(`\x1b]777;${fields.join(";")}\x07`);
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", () => signal("idle", "Ready"));
  pi.on("agent_start", () => signal("working", "Working"));
  pi.on("agent_settled", () => signal("complete", "Turn complete"));
  pi.on("session_shutdown", (event) => {
    if (event.reason === "quit") signal("idle", "Agent exited");
  });
}
