export interface View {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export function createView(canvas: HTMLCanvasElement): View {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.imageSmoothingEnabled = false;
  return { ctx, width: canvas.width, height: canvas.height };
}

export function clear(view: View, color: string) {
  view.ctx.fillStyle = color;
  view.ctx.fillRect(0, 0, view.width, view.height);
}
