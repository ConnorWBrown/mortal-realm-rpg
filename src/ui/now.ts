/**
 * Top-left "Now" input box.
 *
 * Two roles:
 *   1. Displays the current focus — populated externally via `setNowText`
 *      when the player selects a task/quest.
 *   2. Accepts typed text. Pressing Enter calls `onSubmit` with the trimmed
 *      text; the caller creates a task in the Default quest.
 *
 * The box is a plain HTML input overlaid on the canvas. While it's focused
 * we return `true` from `isNowFocused()` so the game loop knows to ignore
 * keyboard input — otherwise WASD would still move the player while typing.
 */

export interface NowBox {
  input: HTMLInputElement;
  setText(text: string): void;
  isFocused(): boolean;
  blur(): void;
}

export interface NowBoxOptions {
  initialText: string;
  onChange(text: string): void;
  onSubmit(text: string): void;
}

export function bindNowBox(opts: NowBoxOptions): NowBox {
  const input = document.getElementById("now-input") as HTMLInputElement | null;
  if (!input) throw new Error("#now-input not found");

  input.value = opts.initialText;

  input.addEventListener("input", () => {
    opts.onChange(input.value);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const text = input.value;
      opts.onSubmit(text);
    } else if (e.key === "Escape") {
      e.preventDefault();
      input.blur();
    }
    // Swallow the event so game input doesn't also react to this key.
    e.stopPropagation();
  });

  // Stop pointer events inside the Now box from falling through to the canvas.
  const box = document.getElementById("now-box");
  if (box) {
    box.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  return {
    input,
    setText(text) {
      input.value = text;
    },
    isFocused() {
      return document.activeElement === input;
    },
    blur() {
      input.blur();
    },
  };
}

/** True if the given KeyboardEvent targeted the Now input (so game input should skip it). */
export function isNowEvent(e: KeyboardEvent): boolean {
  const target = e.target as Element | null;
  return !!target && target.id === "now-input";
}
