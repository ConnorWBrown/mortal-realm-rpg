import { createGame } from "./game/loop";
import { bindCanvasPointer, bindKeyboard, bindTouch } from "./game/input";

const canvas = document.getElementById("game") as HTMLCanvasElement;
if (!canvas) throw new Error("canvas#game not found");

const game = createGame(canvas);

bindKeyboard(game.input);
bindTouch(game.input, document.getElementById("touch-controls")!);
bindCanvasPointer(game.input, canvas);

fitCanvasToViewport(canvas);
window.addEventListener("resize", () => fitCanvasToViewport(canvas));

game.start();

function fitCanvasToViewport(c: HTMLCanvasElement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const aspect = c.width / c.height;
  // 75% of viewport width; shrink if that would exceed viewport height
  const w = Math.min(vw * 0.75, vh * aspect);
  const h = w / aspect;
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
}
