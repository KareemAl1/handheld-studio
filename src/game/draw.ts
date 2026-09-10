import type { GameState } from './engine';

const WIDTH = 1024;
const HEIGHT = 640;
const LANE_X = [284, 512, 740];
const INK = '#e9e4d6';
const ORANGE = '#ee8550';
const DARK = '#1d2926';

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string) {
  context.fillStyle = fill;
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function text(context: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = INK, weight = 500, align: CanvasTextAlign = 'left') {
  context.font = `${weight} ${size}px "Arial", sans-serif`;
  context.fillStyle = color;
  context.textAlign = align;
  context.fillText(value, x, y);
}

function signal(context: CanvasRenderingContext2D, x: number, y: number) {
  context.save();
  context.translate(x, y);
  context.rotate(Math.PI / 4);
  roundedRect(context, -22, -22, 44, 44, 7, ORANGE);
  roundedRect(context, -7, -7, 14, 14, 3, DARK);
  context.restore();
}

function hazard(context: CanvasRenderingContext2D, x: number, y: number) {
  roundedRect(context, x - 30, y - 30, 60, 60, 10, '#34413b');
  context.strokeStyle = INK;
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(x - 30, y - 30, 60, 60, 10);
  context.stroke();
  context.lineWidth = 6;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(x - 12, y - 12);
  context.lineTo(x + 12, y + 12);
  context.moveTo(x + 12, y - 12);
  context.lineTo(x - 12, y + 12);
  context.stroke();
}

/** Entire original game display, drawn directly into the console's texture. */
export function drawGame(context: CanvasRenderingContext2D, state: GameState, reducedMotion: boolean): void {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = DARK;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  text(context, 'HS / ORIGINALS', 48, 47, 22, '#a2b1a3', 600);
  text(context, 'SIGNAL RUN', 48, 91, 32, INK, 700);
  text(context, 'SCORE', WIDTH - 48, 47, 22, '#a2b1a3', 600, 'right');
  text(context, String(state.score).padStart(3, '0'), WIDTH - 48, 92, 39, ORANGE, 700, 'right');

  roundedRect(context, 162, 119, 700, 438, 24, '#25322d');
  context.strokeStyle = '#47594c';
  context.lineWidth = 2;
  context.setLineDash([7, 13]);
  context.lineDashOffset = reducedMotion ? 0 : -state.elapsed * 30;
  for (const x of [398, 626]) {
    context.beginPath();
    context.moveTo(x, 138);
    context.lineTo(x, 540);
    context.stroke();
  }
  context.setLineDash([]);

  // A quiet fixed arrival line communicates where collecting and dodging count.
  context.strokeStyle = '#728473';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(187, 504);
  context.lineTo(837, 504);
  context.stroke();
  for (const x of LANE_X) {
    roundedRect(context, x - 4, 528, 8, 8, 4, '#819482');
  }

  context.save();
  context.beginPath();
  context.rect(170, 123, 684, 434);
  context.clip();
  for (const entity of state.entities) {
    const y = 151 + entity.progress * 353;
    if (entity.kind === 'signal') signal(context, LANE_X[entity.lane], y);
    else hazard(context, LANE_X[entity.lane], y);
  }
  context.restore();

  const playerX = LANE_X[state.lane];
  roundedRect(context, playerX - 33, 476, 66, 54, 15, '#111f1a');
  roundedRect(context, playerX - 29, 467, 58, 53, 13, INK);
  roundedRect(context, playerX - 19, 478, 38, 12, 4, ORANGE);
  roundedRect(context, playerX - 14, 502, 28, 5, 2, '#657364');

  text(context, 'DIAMONDS +10', 48, 600, 23, ORANGE, 600);
  text(context, '3 LANES. KEEP MOVING.', WIDTH - 48, 600, 23, '#b7c4b4', 500, 'right');

  if (state.phase !== 'running') {
    context.fillStyle = 'rgba(19, 30, 25, 0.65)';
    context.fillRect(0, 112, WIDTH, 454);
    roundedRect(context, 174, 160, 676, 326, 28, '#e9e4d6');
    text(context, state.phase === 'ready' ? 'ONE SMALL GAME' : state.phase === 'paused' ? 'TAKE YOUR TIME' : 'ANOTHER SIGNAL AWAITS', 512, 210, 23, '#687466', 700, 'center');
    const title = state.phase === 'ready' ? 'Signal Run' : state.phase === 'paused' ? 'Paused' : 'Run complete';
    text(context, title, 512, 284, 67, DARK, 700, 'center');

    if (state.phase === 'ready') {
      signal(context, 260, 347);
      text(context, 'Collect diamonds', 302, 356, 28, DARK, 600);
      hazard(context, 571, 347);
      text(context, 'Dodge crosses', 615, 356, 28, DARK, 600);
      text(context, 'Start below. Move with arrow keys or touch pads.', 512, 424, 25, '#52634f', 500, 'center');
    } else if (state.phase === 'paused') {
      text(context, `Score ${state.score}`, 512, 349, 34, '#a74725', 700, 'center');
      text(context, 'Resume below when you are ready.', 512, 424, 27, '#52634f', 500, 'center');
    } else {
      text(context, `${state.score} points collected`, 512, 350, 36, '#a74725', 700, 'center');
      text(context, 'Restart below for a fresh run.', 512, 424, 27, '#52634f', 500, 'center');
    }
  }
  context.restore();
}
