import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
// An original boot display, kept as a replaceable material for the later tiny game.
export function makeScreenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 640;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1b2827'; ctx.fillRect(0, 0, 1024, 640);
  ctx.strokeStyle = '#34433d'; ctx.lineWidth = 1;
  for (let x = 32; x < 1024; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 640); ctx.stroke(); }
  for (let y = 32; y < 640; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke(); }
  ctx.fillStyle = '#acb99c'; ctx.font = '20px monospace'; ctx.fillText('HANDHELD SYSTEMS', 54, 58);
  ctx.textAlign = 'right'; ctx.fillText('01', 968, 58);
  ctx.strokeStyle = '#acb99c'; ctx.strokeRect(915, 92, 48, 19); ctx.fillRect(965, 97, 4, 9);
  ctx.fillRect(920, 97, 32, 9);
  ctx.textAlign = 'center'; ctx.fillStyle = '#d6dfba'; ctx.font = 'bold 118px Arial'; ctx.fillText('hello,', 512, 312);
  ctx.fillStyle = '#e5834b'; ctx.fillText('player.', 512, 429);
  ctx.fillStyle = '#aebc9b'; ctx.font = '20px monospace'; ctx.fillText('A SMALL WORLD OF POSSIBILITY', 512, 535);
  ctx.textAlign = 'left'; ctx.fillStyle = '#4c5d4c'; ctx.fillRect(54, 585, 916, 1);
  ctx.fillStyle = '#8e9e86'; ctx.font = '15px monospace'; ctx.fillText('HS–01 / STUDIO EDITION', 54, 613);
  ctx.textAlign = 'right'; ctx.fillText('READY WHEN YOU ARE', 969, 613);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 4;
  return texture;
}


// Deterministic fine-grain plastic; tiny local texture, no image download.
export function makeGrainTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.createImageData(128, 128);
  let seed = 301;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 165 + seed % 60;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(32, 18);
  texture.anisotropy = 4;
  return texture;
}
