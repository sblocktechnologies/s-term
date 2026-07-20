export interface TerminalKeyboardEvent {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
}

export const PI_IMAGE_PASTE_SEQUENCE: string;

export const PI_EDITOR_SEQUENCES: Readonly<{
  newLine: string;
  lineStart: string;
  lineEnd: string;
  messageStart: string;
  messageEnd: string;
  wordLeft: string;
  wordRight: string;
}>;

export function getPiEditorSequence(
  event: TerminalKeyboardEvent,
  platform: string,
): string | null;
