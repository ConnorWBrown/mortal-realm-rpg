import { createGame } from "./game/loop";
import { bindKeyboard, bindTouch } from "./game/input";

const canvas = document.getElementById("game") as HTMLCanvasElement;
if (!canvas) throw new Error("canvas#game not found");

const game = createGame(canvas);

bindKeyboard(game.input);
bindTouch(game.input, document.getElementById("touch-controls")!);

fitCanvasToViewport(canvas);
window.addEventListener("resize", () => fitCanvasToViewport(canvas));

game.start();

function fitCanvasToViewport(c: HTMLCanvasElement) {
  // Canvas internal resolution stays 320x240 (pixelated scaling via CSS).
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = Math.max(1, Math.min(Math.floor(vw / c.width), Math.floor(vh / c.height)));
  c.style.width = `${c.width * scale}px`;
  c.style.height = `${c.height * scale}px`;
}
