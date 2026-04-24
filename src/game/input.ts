export type Direction = "up" | "down" | "left" | "right";
export type Button = "a" | "b";
export type InputName = Direction | Button;

export interface PointerClick {
  /** Canvas-space pixel coordinates. */
  x: number;
  y: number;
}

export interface InputState {
  held: Set<InputName>;
  pressedThisFrame: Set<InputName>;
  consumePress(name: InputName): boolean;
  consumePointerClick(): PointerClick | null;
  _press(name: InputName): void;
  _release(name: InputName): void;
  _pointerDown(x: number, y: number): void;
  _endFrame(): void;
}

export function createInput(): InputState {
  const held = new Set<InputName>();
  const pressedThisFrame = new Set<InputName>();
  const pointerClicks: PointerClick[] = [];
  return {
    held,
    pressedThisFrame,
    consumePress(name) {
      if (pressedThisFrame.has(name)) {
        pressedThisFrame.delete(name);
        return true;
      }
      return false;
    },
    consumePointerClick() {
      return pointerClicks.shift() ?? null;
    },
    _press(name) {
      if (!held.has(name)) pressedThisFrame.add(name);
      held.add(name);
    },
    _release(name) {
      held.delete(name);
    },
    _pointerDown(x, y) {
      pointerClicks.push({ x, y });
    },
    _endFrame() {
      pressedThisFrame.clear();
    },
  };
}

const KEY_MAP: Record<string, InputName> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  z: "a",
  x: "b",
  " ": "a",
  Enter: "a",
  Escape: "b",
};

export function bindKeyboard(input: InputState) {
  window.addEventListener("keydown", (e) => {
    const name = KEY_MAP[e.key];
    if (!name) return;
    e.preventDefault();
    if (!e.repeat) input._press(name);
  });
  window.addEventListener("keyup", (e) => {
    const name = KEY_MAP[e.key];
    if (!name) return;
    e.preventDefault();
    input._release(name);
  });
}

export function bindTouch(input: InputState, root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-input]").forEach((el) => {
    const name = el.dataset.input as InputName;
    const press = (ev: Event) => {
      ev.preventDefault();
      input._press(name);
    };
    const release = (ev: Event) => {
      ev.preventDefault();
      input._release(name);
    };
    el.addEventListener("touchstart", press, { passive: false });
    el.addEventListener("touchend", release, { passive: false });
    el.addEventListener("touchcancel", release, { passive: false });
    el.addEventListener("mousedown", press);
    el.addEventListener("mouseup", release);
    el.addEventListener("mouseleave", release);
  });
}

/**
 * Translate pointerdown events on the game canvas into canvas-space clicks.
 * Accounts for the CSS `max-width: 100% / max-height: 100%` scaling so the
 * reported coordinates match the logical canvas resolution.
 */
export function bindCanvasPointer(input: InputState, canvas: HTMLCanvasElement) {
  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    input._pointerDown(x, y);
  });
}
