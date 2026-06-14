export interface Stroke {
  id: string;
  color: string;
  width: number; // fraction of canvas width
  points: number[]; // flat normalized [x0,y0,x1,y1,...]
}

/** Draw a stroke onto a 2D context using normalized coords scaled to (w,h). */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  s: Stroke,
  fromIdx: number,
  w: number,
  h: number
): void {
  const pts = s.points;
  if (pts.length < 2) return;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = Math.max(1.5, s.width * w);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const start = Math.max(0, fromIdx - (fromIdx % 2));
  if (pts.length === 2) {
    // a single tap — draw a dot
    ctx.arc(pts[0] * w, pts[1] * h, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    return;
  }
  ctx.moveTo(pts[start] * w, pts[start + 1] * h);
  for (let i = start + 2; i < pts.length; i += 2) {
    ctx.lineTo(pts[i] * w, pts[i + 1] * h);
  }
  ctx.stroke();
}

export const INK_COLORS = ['#111111', '#FB4D4D', '#FF8A3D', '#FFD23D', '#36D399', '#3DA5FF', '#7C5CFF', '#FF6BD6', '#9b6b43', '#ffffff'];
export const INK_WIDTHS = [0.008, 0.018, 0.034];
