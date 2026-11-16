import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';
import {
  CELL_CAPACITY,
  DAYS,
  DISCIPLINE_COLOR,
  // DAYS is used for the column count; labels come from the planner.
  type Finding,
  type Pictogram,
  TECHNICIANS,
} from './data.js';

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const ORANGE = '#ff7a1a';
const BG = '#14161b';
const INK = '#f4f5f7';
const MUTED = '#a7adb8';

/** A canvas-backed unlit plane. `draw` repaints and flags the texture. */
export class CanvasPlane {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: CanvasTexture;
  readonly mesh: Mesh;

  constructor(widthM: number, heightM: number, pxPerM = 1100, transparent = true) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(widthM * pxPerM);
    this.canvas.height = Math.round(heightM * pxPerM);
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    const mat = new MeshBasicMaterial({
      map: this.texture,
      transparent,
      toneMapped: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(widthM, heightM), mat);
  }

  get w() {
    return this.canvas.width;
  }
  get h() {
    return this.canvas.height;
  }

  commit() {
    this.texture.needsUpdate = true;
  }
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Word-wrap text into at most `maxLines` lines. Returns the next y. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  maxLines = 6,
): number {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lineH;
      lines++;
      if (lines >= maxLines) return y;
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineH;
  }
  return y;
}

/** Simple, readable pictograms standing in for the finding photo. */
function drawPictogram(
  ctx: CanvasRenderingContext2D,
  kind: Pictogram,
  cx: number,
  cy: number,
  s: number,
  color: string,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const crack = (pts: number[][]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
    for (const p of pts.slice(1)) ctx.lineTo(p[0] * s, p[1] * s);
    ctx.stroke();
  };
  switch (kind) {
    case 'light': {
      ctx.beginPath();
      ctx.arc(0, -0.05 * s, 0.25 * s, Math.PI, 0);
      ctx.stroke();
      ctx.strokeRect(-0.3 * s, -0.08 * s, 0.6 * s, 0.1 * s);
      crack([[-0.05, 0.1], [0.05, 0.22], [-0.04, 0.32], [0.06, 0.42]]);
      crack([[0.25, 0.15], [0.35, 0.25]]);
      crack([[-0.25, 0.15], [-0.35, 0.25]]);
      break;
    }
    case 'door': {
      ctx.strokeRect(-0.25 * s, -0.4 * s, 0.5 * s, 0.8 * s);
      ctx.beginPath();
      ctx.arc(0.15 * s, 0, 0.04 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.setLineDash([s * 0.06, s * 0.05]);
      ctx.strokeStyle = ORANGE;
      crack([[-0.3, -0.45], [-0.3, 0.45]]);
      ctx.setLineDash([]);
      break;
    }
    case 'floor':
    case 'wall': {
      for (let i = -2; i <= 2; i++) {
        crack([[i * 0.18, -0.4], [i * 0.18, 0.4]]);
      }
      ctx.strokeStyle = ORANGE;
      crack([[-0.4, -0.1], [-0.15, 0.0], [-0.05, -0.12], [0.12, 0.08], [0.4, 0.02]]);
      break;
    }
    case 'weld': {
      ctx.strokeRect(-0.4 * s, -0.1 * s, 0.8 * s, 0.2 * s);
      ctx.strokeStyle = ORANGE;
      crack([[-0.05, -0.1], [0.02, -0.02], [-0.04, 0.04], [0.04, 0.1]]);
      ctx.strokeStyle = color;
      crack([[0, -0.4], [0, -0.18]]);
      crack([[-0.15, -0.35], [-0.07, -0.2]]);
      crack([[0.15, -0.35], [0.07, -0.2]]);
      break;
    }
    case 'seal': {
      crack([[-0.4, 0.3], [-0.4, -0.3], [0.4, -0.3]]);
      ctx.strokeStyle = ORANGE;
      ctx.beginPath();
      ctx.moveTo(-0.32 * s, -0.22 * s);
      ctx.bezierCurveTo(-0.1 * s, -0.25 * s, 0.05 * s, 0.05 * s, 0.25 * s, 0.2 * s);
      ctx.stroke();
      break;
    }
    case 'drip': {
      crack([[-0.4, -0.35], [0.4, -0.35]]);
      for (const x of [-0.2, 0.05, 0.28]) {
        ctx.beginPath();
        ctx.moveTo(x * s, -0.2 * s);
        ctx.quadraticCurveTo((x + 0.09) * s, 0.02 * s, x * s, 0.06 * s);
        ctx.quadraticCurveTo((x - 0.09) * s, 0.02 * s, x * s, -0.2 * s);
        ctx.fill();
      }
      ctx.strokeStyle = ORANGE;
      crack([[-0.3, 0.35], [0.3, 0.35]]);
      break;
    }
    case 'pipe': {
      ctx.lineWidth = s * 0.14;
      crack([[-0.45, 0.1], [0.0, 0.1], [0.0, -0.35]]);
      ctx.lineWidth = s * 0.05;
      ctx.strokeStyle = ORANGE;
      for (const a of [-0.5, 0, 0.5]) {
        crack([[0.05, 0.05], [0.05 + Math.cos(a) * 0.3, 0.05 + Math.sin(a) * 0.3]]);
      }
      break;
    }
    case 'panel': {
      ctx.strokeRect(-0.3 * s, -0.38 * s, 0.6 * s, 0.76 * s);
      ctx.beginPath();
      ctx.moveTo(0.05 * s, -0.25 * s);
      ctx.lineTo(-0.1 * s, 0.02 * s);
      ctx.lineTo(0.05 * s, 0.02 * s);
      ctx.lineTo(-0.08 * s, 0.28 * s);
      ctx.strokeStyle = ORANGE;
      ctx.stroke();
      break;
    }
    case 'motor': {
      ctx.beginPath();
      ctx.arc(-0.05 * s, 0, 0.25 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-0.05 * s, 0, 0.08 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ORANGE;
      for (const r of [0.33, 0.42]) {
        ctx.beginPath();
        ctx.arc(-0.05 * s, 0, r * s, -0.5, 0.5);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

export const CARD_W = 0.1;
export const CARD_H = 0.13;

export function drawCard(
  plane: CanvasPlane,
  f: Finding,
  state: { selected: boolean; scheduledLabel?: string },
) {
  const { ctx, w, h } = plane;
  const color = DISCIPLINE_COLOR[f.discipline];
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 4, 4, w - 8, h - 8, 18);
  ctx.fillStyle = '#1d2027';
  ctx.fill();
  ctx.lineWidth = state.selected ? 10 : 4;
  ctx.strokeStyle = state.selected ? ORANGE : '#3a3f4b';
  ctx.stroke();

  // Discipline band
  ctx.save();
  roundRect(ctx, 4, 4, w - 8, 30, 18);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, 30);
  ctx.restore();
  ctx.fillStyle = '#111';
  ctx.font = `700 17px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(f.discipline.toUpperCase(), 14, 20);
  ctx.textAlign = 'right';
  ctx.fillText(f.id, w - 14, 20);
  ctx.textAlign = 'left';

  // "Photo" area
  const py = 40;
  const ph = h * 0.38;
  roundRect(ctx, 12, py, w - 24, ph, 10);
  ctx.fillStyle = '#0d0f13';
  ctx.fill();
  drawPictogram(ctx, f.pictogram, w / 2, py + ph / 2, ph * 0.9, '#d9dde4');

  // Text
  let y = py + ph + 26;
  ctx.fillStyle = INK;
  ctx.font = `700 22px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  y = wrapText(ctx, f.title, 14, y, w - 28, 25, 2);
  ctx.fillStyle = MUTED;
  ctx.font = `500 17px ${FONT}`;
  ctx.fillText(f.area, 14, y + 2);
  y += 26;

  // Badges
  ctx.font = `700 16px ${FONT}`;
  let bx = 14;
  const badge = (text: string, bg: string, fg = '#111') => {
    const tw = ctx.measureText(text).width + 16;
    roundRect(ctx, bx, y - 4, tw, 26, 13);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(text, bx + 8, y + 15);
    bx += tw + 6;
  };
  if (f.foodSafety) badge('FOOD SAFETY', '#ff5a5a', '#fff');
  badge(`${f.daysOpen}d open`, '#3a3f4b', INK);
  if (state.scheduledLabel) {
    y += 32;
    bx = 14;
    badge(state.scheduledLabel, ORANGE, '#111');
  }
  plane.commit();
}

/** Board geometry (metres, in board-local space, origin at centre). */
export const BOARD = {
  width: 0.74,
  height: 0.46,
  labelW: 0.11,
  headerH: 0.05,
  footerH: 0.03,
};

export function cellCenter(tech: number, day: number): [number, number] {
  const gridW = BOARD.width - BOARD.labelW - 0.02;
  const gridH = BOARD.height - BOARD.headerH - BOARD.footerH - 0.02;
  const cw = gridW / DAYS.length;
  const ch = gridH / TECHNICIANS.length;
  const x0 = -BOARD.width / 2 + BOARD.labelW + 0.01;
  const y0 = BOARD.height / 2 - BOARD.headerH - 0.01;
  return [x0 + cw * (day + 0.5), y0 - ch * (tech + 0.5)];
}

export function cellSize(): [number, number] {
  const gridW = BOARD.width - BOARD.labelW - 0.02;
  const gridH = BOARD.height - BOARD.headerH - BOARD.footerH - 0.02;
  return [gridW / DAYS.length, gridH / TECHNICIANS.length];
}

export function drawBoard(
  plane: CanvasPlane,
  load: number[][],
  hours: number[][],
  highlight: [number, number] | null,
  dayLabels: string[],
) {
  const todayIndex = 0;
  const { ctx, w, h } = plane;
  const k = w / BOARD.width; // px per metre
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 0, 0, w, h, 26);
  ctx.fillStyle = 'rgba(20,22,27,0.92)';
  ctx.fill();
  ctx.strokeStyle = '#2c313b';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = INK;
  ctx.font = `700 26px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Week plan', 18, BOARD.headerH * k * 0.5);

  const [cw, ch] = cellSize();
  for (let d = 0; d < DAYS.length; d++) {
    const [cx] = cellCenter(0, d);
    const px = (cx + BOARD.width / 2) * k;
    ctx.textAlign = 'center';
    ctx.fillStyle = d === todayIndex ? ORANGE : MUTED;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(dayLabels[d] + (d === todayIndex ? ' · today' : ''), px, BOARD.headerH * k * 0.55);
  }
  for (let t = 0; t < TECHNICIANS.length; t++) {
    const tech = TECHNICIANS[t];
    const [, cy] = cellCenter(t, 0);
    const py = (BOARD.height / 2 - cy) * k;
    ctx.textAlign = 'left';
    ctx.fillStyle = tech.color;
    ctx.beginPath();
    ctx.arc(22, py - 14, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(tech.name, 36, py - 13);
    ctx.fillStyle = MUTED;
    ctx.font = `500 16px ${FONT}`;
    ctx.fillText(tech.discipline, 36, py + 10);
    for (let d = 0; d < DAYS.length; d++) {
      const [cx, cy2] = cellCenter(t, d);
      const x = (cx - cw / 2 + BOARD.width / 2) * k + 3;
      const y = (BOARD.height / 2 - (cy2 + ch / 2)) * k + 3;
      const isHi = highlight && highlight[0] === t && highlight[1] === d;
      roundRect(ctx, x, y, cw * k - 6, ch * k - 6, 12);
      ctx.fillStyle = isHi ? 'rgba(255,122,26,0.22)' : 'rgba(255,255,255,0.035)';
      ctx.fill();
      ctx.lineWidth = isHi ? 5 : 2;
      ctx.setLineDash(isHi ? [] : [8, 6]);
      ctx.strokeStyle = isHi ? ORANGE : '#363b46';
      ctx.stroke();
      ctx.setLineDash([]);
      // capacity pips
      for (let i = 0; i < CELL_CAPACITY; i++) {
        ctx.beginPath();
        ctx.arc(x + cw * k - 18 - i * 14, y + 14, 5, 0, Math.PI * 2);
        ctx.fillStyle = i < load[t][d] ? tech.color : '#363b46';
        ctx.fill();
      }
      if (hours[t][d] > 0) {
        ctx.fillStyle = MUTED;
        ctx.font = `600 14px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.fillText(`${hours[t][d]}h`, x + 8, y + 15);
      }
    }
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = `500 16px ${FONT}`;
  ctx.fillText(
    'Pinch a card and drop it on a technician’s day. Max 2 jobs per day.',
    18,
    h - BOARD.footerH * k * 0.5,
  );
  plane.commit();
}

export function drawButton(plane: CanvasPlane, label: string, hovered: boolean, primary: boolean) {
  const { ctx, w, h } = plane;
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 3, 3, w - 6, h - 6, (h - 6) / 2);
  ctx.fillStyle = primary
    ? hovered
      ? '#ff9a4d'
      : ORANGE
    : hovered
      ? '#3a404c'
      : '#262a33';
  ctx.fill();
  ctx.fillStyle = primary ? '#111' : INK;
  ctx.font = `700 ${Math.round(h * 0.42)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, w / 2, h / 2 + 1);
  ctx.textAlign = 'left';
  plane.commit();
}

export function drawSimi(
  plane: CanvasPlane,
  title: string,
  body: string,
  footer: string,
  listening: boolean,
) {
  const { ctx, w, h } = plane;
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 0, 0, w, h, 26);
  ctx.fillStyle = 'rgba(20,22,27,0.94)';
  ctx.fill();
  ctx.strokeStyle = ORANGE;
  ctx.lineWidth = 4;
  ctx.stroke();
  // Avatar
  const g = ctx.createRadialGradient(46, 46, 4, 46, 46, 28);
  g.addColorStop(0, '#ffd2a8');
  g.addColorStop(1, ORANGE);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(46, 46, 26, 0, Math.PI * 2);
  ctx.fill();
  if (listening) {
    ctx.strokeStyle = '#ff5a5a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(46, 46, 33, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.font = `700 26px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('SIMI', 86, 36);
  ctx.fillStyle = MUTED;
  ctx.font = `500 16px ${FONT}`;
  ctx.fillText(listening ? 'Listening…' : 'Planning assistant', 86, 60);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ORANGE;
  ctx.font = `700 21px ${FONT}`;
  let y = wrapText(ctx, title, 20, 108, w - 40, 26, 2);
  ctx.fillStyle = INK;
  ctx.font = `500 19px ${FONT}`;
  y = wrapText(ctx, body, 20, y + 6, w - 40, 25, 7);
  ctx.fillStyle = MUTED;
  ctx.font = `500 15px ${FONT}`;
  wrapText(ctx, footer, 20, h - 34, w - 40, 19, 2);
  plane.commit();
}

export function drawStats(
  plane: CanvasPlane,
  s: { backlog: number; planned: number; foodSafetyLeft: number; overdueRisk: number; streak: number; done: boolean },
) {
  const { ctx, w, h } = plane;
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 0, 0, w, h, 26);
  ctx.fillStyle = 'rgba(20,22,27,0.94)';
  ctx.fill();
  ctx.strokeStyle = '#2c313b';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = `700 15px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('SIMA XR · MORNING PLAN', 20, 34);
  ctx.fillStyle = INK;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(s.done ? 'Plan ready ✓' : 'Plan your week', 20, 72);

  const total = s.backlog + s.planned;
  const pct = total ? s.planned / total : 1;
  roundRect(ctx, 20, 92, w - 40, 16, 8);
  ctx.fillStyle = '#2c313b';
  ctx.fill();
  if (pct > 0) {
    roundRect(ctx, 20, 92, Math.max(16, (w - 40) * pct), 16, 8);
    ctx.fillStyle = s.done ? '#5fd38d' : ORANGE;
    ctx.fill();
  }
  const row = (label: string, value: string, y: number, color = INK) => {
    ctx.fillStyle = MUTED;
    ctx.font = `500 18px ${FONT}`;
    ctx.fillText(label, 20, y);
    ctx.fillStyle = color;
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(value, w - 20, y);
    ctx.textAlign = 'left';
  };
  row('To schedule', String(s.backlog), 146);
  row('Scheduled', `${s.planned}/${total}`, 178);
  row('Food-safety open', String(s.foodSafetyLeft), 210, s.foodSafetyLeft ? '#ff5a5a' : '#5fd38d');
  row('Past due date', String(s.overdueRisk), 242, s.overdueRisk ? '#ff5a5a' : '#5fd38d');
  row('Planning streak', `${s.streak} day${s.streak === 1 ? '' : 's'}`, 274, ORANGE);
  plane.commit();
}
