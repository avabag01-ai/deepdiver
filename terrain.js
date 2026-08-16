// terrain.js — 구역별 지형(원경/근경 2계층)
// 근경(전경) 지형은 충돌이 있고 폭 최대 화면의 40%, 좌우 벽에 붙어 번갈아 배치되어
// 항상 통로가 확보된다. 원경(배경)은 충돌 없이 장식용으로만 스크롤된다.
//
// 텍스처 캐싱: 절차적 표면 텍스처(균열/얼룩/이끼/지터 외곽선)는 조각이 스폰될 때
// 딱 한 번 오프스크린 캔버스에 구워서 chunk.tex에 저장해두고, 매 프레임에는
// drawImage 한 번으로만 그린다 — 매 프레임 수십 개의 도형을 다시 계산하지 않음.

import { CANVAS_W, CANVAS_H, INK, STROKE, shade, hilite, rgba, glow, stairStack, hash2, lerpColor } from './utils.js';

const FG_MAX_WIDTH_RATIO = 0.4;
const FG_MAX_WIDTH = CANVAS_W * FG_MAX_WIDTH_RATIO;

// 지형은 짧은 덩어리가 아니라 벽처럼 세로로 길게 이어진 형태여야 한다
// (화면 세로 길이의 1.5~3배)
const FG_HEIGHT_MIN = CANVAS_H * 1.5;
const FG_HEIGHT_MAX = CANVAS_H * 3.0;
const BG_HEIGHT_MIN = CANVAS_H * 1.3;
const BG_HEIGHT_MAX = CANVAS_H * 2.4;

const TERRAIN_STYLE = {
  shallow: { fg: '#2fae86', bg: '#1c8f9e', accent: '#e8d24a' },   // 산호초
  twilight: { fg: '#4a5568', bg: '#2f3b52', accent: '#6b7a94' },  // 회색 암반
  deepsea: { fg: '#2a3346', bg: '#1a2236', accent: '#3a4560' },   // 심해언덕
  vent: { fg: '#3a2f2a', bg: '#241d1a', accent: '#ff7a3c' },      // 열수구 굴뚝
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// 지형 조각 하나를 생성. side: 'left' | 'right'
// spawnY는 조각의 "위쪽(top)" 기준. 조각은 화면 아래에서 나타나 위로 흘러가므로
// 항상 화면 바닥 부근에서 스폰되고, 세로로 길게(화면의 1.5~3배) 뻗어 벽처럼 보인다.
export function createTerrainChunk(zoneId, side, spawnY) {
  const width = FG_MAX_WIDTH * (0.65 + Math.random() * 0.35);
  const height = FG_HEIGHT_MIN + Math.random() * (FG_HEIGHT_MAX - FG_HEIGHT_MIN);
  const chunk = {
    zoneId,
    side,
    x: side === 'left' ? 0 : CANVAS_W - width,
    y: spawnY,
    width,
    height,
    seed: Math.random() * 1000,
    layer: 'fg',
  };
  chunk.tex = bakeTexture(chunk);
  return chunk;
}

export function createBgChunk(zoneId, side, spawnY) {
  const width = CANVAS_W * (0.3 + Math.random() * 0.25);
  const height = BG_HEIGHT_MIN + Math.random() * (BG_HEIGHT_MAX - BG_HEIGHT_MIN);
  const chunk = {
    zoneId,
    side,
    x: side === 'left' ? -width * 0.3 : CANVAS_W - width * 0.7,
    y: spawnY,
    width,
    height,
    seed: Math.random() * 1000,
    layer: 'bg',
  };
  chunk.tex = bakeTexture(chunk);
  return chunk;
}

// 벽처럼 세로로 긴 지형의 안쪽(통로쪽) 가장자리를 그릴 때 쓰는 공용 헬퍼.
// 진폭을 조각 전체 높이에 비례시키지 않고 "고정 픽셀 값"으로 둬서, 조각이 아무리
// 길어져도 하나의 거대한 굴곡이 아니라 일정한 리듬으로 반복되는 요철이 되게 한다.
//
// jitterAmp>0이면 매끈한 사인 곡선 위에 결정적 해시 노이즈를 더해 손그림 같은
// 매끈함 대신 자연물다운 미세한 요철을 만든다(같은 seed+localY엔 항상 같은 값).
function innerEdgeX(innerX, dir, localY, seed, amp, freq, jitterAmp) {
  const n = Math.sin(localY * freq + seed) * 0.6 + Math.sin(localY * freq * 2.3 + seed * 1.7) * 0.4;
  const jitter = jitterAmp ? (hash2(Math.round(localY * 0.4), seed) - 0.5) * 2 * jitterAmp : 0;
  return innerX + dir * (amp * 0.5 + amp * 0.5 * n + jitter);
}

// chunk: {x,y,width,height,seed,side} — 로컬 좌표로 구울 때는 x=0,y=0인 사본을 넘긴다.
function buildWallPath(ctx, chunk, amp, freq, sampleStep, jitterAmp = 0) {
  const { x, y, width, height, seed, side } = chunk;
  const dir = side === 'left' ? 1 : -1;
  const innerX = side === 'left' ? x + width : x; // 통로에 접한 안쪽 경계
  const outerX = side === 'left' ? x : x + width;  // 화면 벽에 붙은 바깥 경계

  ctx.beginPath();
  ctx.moveTo(outerX, y);
  ctx.lineTo(innerX, y);
  const steps = Math.max(4, Math.round(height / sampleStep));
  for (let i = 1; i <= steps; i++) {
    const localY = (height * i) / steps; // 조각 기준 상대 위치 — chunk.y와 무관, 스크롤해도 고정된 모양 유지
    const sy = y + localY;
    const sx = innerEdgeX(innerX, dir, localY, seed, amp, freq, jitterAmp);
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(outerX, y + height);
  ctx.closePath();
}

// 불규칙 다각형 블롭 하나를 그린다 (원 대신 각 꼭짓점을 해시로 흔들어 자연스러운 얼룩 모양)
function blob(ctx, cx, cy, r, seed, sides = 6, squashY = 0.85) {
  ctx.beginPath();
  for (let s = 0; s < sides; s++) {
    const ang = (Math.PI * 2 * s) / sides;
    const rr = r * (0.55 + hash2(seed + s * 3.7, s) * 0.85);
    const qx = cx + Math.cos(ang) * rr;
    const qy = cy + Math.sin(ang) * rr * squashY;
    if (s === 0) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// 암반 (twilight/deepsea) — 균열, 명암 얼룩, 이끼, 마모 하이라이트, 지터 외곽선
function bakeRock(chunk, zoneId) {
  const { width, height, seed, side, layer } = chunk;
  const isFg = layer === 'fg';
  const style = TERRAIN_STYLE[zoneId];
  const cnv = makeCanvas(width, height);
  const tctx = cnv.getContext('2d');
  const local = { x: 0, y: 0, width, height, seed, side };
  const innerX = side === 'left' ? width : 0;
  const dir = side === 'left' ? 1 : -1;

  // 방향성 광원 다단 그라디언트 (바깥쪽이 밝고 안쪽 통로가 어둡게 — 단일 플랫 대신)
  const outerX = side === 'left' ? 0 : width;
  const grad = tctx.createLinearGradient(outerX, 0, innerX, 0);
  grad.addColorStop(0, lerpColor(style.fg, '#ffffff', isFg ? 0.16 : 0.08));
  grad.addColorStop(0.55, style.fg);
  grad.addColorStop(1, lerpColor(style.fg, '#000000', isFg ? 0.26 : 0.14));
  tctx.fillStyle = isFg ? grad : style.bg;
  if (isFg) { tctx.strokeStyle = INK; tctx.lineWidth = STROKE.silhouette; }

  const sampleStep = isFg ? 18 : 46;
  const jitter = isFg ? 4.6 : 1.4;
  buildWallPath(tctx, local, 22, 0.014, sampleStep, jitter);
  tctx.fill();
  if (isFg) tctx.stroke();

  if (!isFg) {
    // 원경은 저비용 실루엣 + 큰 뭉툭한 그림자 얼룩 두어개만 (블러된 느낌)
    const bshade = 'rgba(0,0,0,0.12)';
    tctx.fillStyle = bshade;
    for (let i = 0; i < 3; i++) {
      const py = hash2(seed, i * 2 + 1) * height;
      const px = innerX - dir * (10 + hash2(seed + 5, i) * width * 0.5);
      blob(tctx, px, py, 28 + hash2(seed + 9, i) * 18, seed + i * 11);
      tctx.fill();
    }
    return cnv;
  }

  // 안쪽 가장자리 그림자
  shade(tctx, () => buildWallPath(tctx, local, 22, 0.014, sampleStep, jitter), 0.2);

  // 다중 톤 명암 얼룩 (표면 거칠기 — 결정적 노이즈로 흩뿌린 밝은/어두운 다각형 패치)
  const patchCount = Math.max(10, Math.round(height / 24));
  for (let i = 0; i < patchCount; i++) {
    const py = hash2(seed, i) * height;
    const px = innerX - dir * (6 + hash2(seed + 7, i) * (width * 0.62));
    const r = 4 + hash2(seed + 13, i) * 8;
    const dark = hash2(seed + 19, i) > 0.42;
    tctx.fillStyle = dark ? rgba(INK, 0.2 + hash2(seed + 23, i) * 0.14) : 'rgba(255,255,255,0.13)';
    blob(tctx, px, py, r, seed + i * 4.1, 6, 0.8);
    tctx.fill();
  }

  // 균열선: 꺾인 여러 세그먼트로 잔금처럼
  const crackCount = Math.max(4, Math.round(height / 95));
  tctx.strokeStyle = rgba(INK, 0.48);
  tctx.lineWidth = STROKE.detail;
  tctx.lineJoin = 'round'; tctx.lineCap = 'round';
  for (let i = 0; i < crackCount; i++) {
    let cx = innerX - dir * hash2(seed + 31, i) * width * 0.35;
    let cy = 16 + hash2(seed + 37, i) * (height - 32);
    tctx.beginPath();
    tctx.moveTo(cx, cy);
    const segs = 3 + Math.floor(hash2(seed + 41, i) * 3);
    for (let s = 0; s < segs; s++) {
      cx += -dir * (6 + hash2(seed + i * 5.3, s) * 9);
      cy += (hash2(seed + i * 7.1, s + 20) - 0.5) * 24;
      tctx.lineTo(cx, cy);
    }
    tctx.stroke();
  }

  // 이끼/조류 얼룩 (짙은 녹색~갈색 반점, 절차적으로 흩뿌림)
  const mossCount = Math.max(5, Math.round(height / 72));
  for (let i = 0; i < mossCount; i++) {
    const my = hash2(seed + 51, i) * height;
    const mx = innerX - dir * (4 + hash2(seed + 57, i) * width * 0.55);
    const mr = 5 + hash2(seed + 61, i) * 6.5;
    const mossColor = hash2(seed + 63, i) > 0.5 ? 'rgba(98,132,56,0.36)' : 'rgba(88,66,38,0.32)';
    tctx.fillStyle = mossColor;
    blob(tctx, mx, my, mr, seed + i * 6.7, 5, 1);
    tctx.fill();
  }

  // 모서리 마모 하이라이트 (안쪽 가장자리를 따라 끊어진 밝은 선 조각들)
  tctx.strokeStyle = 'rgba(255,255,255,0.32)';
  tctx.lineWidth = STROKE.detail * 0.95;
  const wearCount = Math.max(4, Math.round(height / 130));
  for (let i = 0; i < wearCount; i++) {
    const wy = 10 + hash2(seed + 71, i) * (height - 20);
    const wx = innerX - dir * 1.5;
    tctx.beginPath();
    tctx.moveTo(wx, wy);
    tctx.lineTo(wx - dir * (8 + hash2(seed + 75, i) * 8), wy + 6 + hash2(seed + 77, i) * 6);
    tctx.stroke();
  }

  return cnv;
}

// ---------------------------------------------------------------------------
// 산호초 (shallow) — 유기적 가지 + 폴립 점묘 + 다단 그라디언트
function bakeCoral(chunk) {
  const { width, height, seed, side, layer } = chunk;
  const isFg = layer === 'fg';
  const style = TERRAIN_STYLE.shallow;
  const cnv = makeCanvas(width, height);
  const tctx = cnv.getContext('2d');
  const local = { x: 0, y: 0, width, height, seed, side };
  const innerX = side === 'left' ? width : 0;
  const outerX = side === 'left' ? 0 : width;
  const dir = side === 'left' ? 1 : -1;

  const grad = tctx.createLinearGradient(outerX, 0, innerX, 0);
  grad.addColorStop(0, lerpColor(style.fg, '#ffffff', isFg ? 0.3 : 0.12));
  grad.addColorStop(0.6, style.fg);
  grad.addColorStop(1, lerpColor(style.fg, '#000000', isFg ? 0.22 : 0.1));
  tctx.fillStyle = isFg ? grad : style.bg;
  if (isFg) { tctx.strokeStyle = INK; tctx.lineWidth = STROKE.silhouette; }

  const sampleStep = isFg ? 24 : 42;
  const jitter = isFg ? 2.2 : 0.8; // 산호는 암석보다 매끈-유기적이므로 지터는 절제
  buildWallPath(tctx, local, 26, 0.02, sampleStep, jitter);
  tctx.fill();
  if (isFg) tctx.stroke();

  if (!isFg) return cnv; // 원경은 실루엣만, 저비용

  shade(tctx, () => buildWallPath(tctx, local, 26, 0.02, sampleStep, jitter), 0.14);

  // 가지 형태 돌출 (유기적 산호 가지)
  const branchCount = Math.max(3, Math.round(height / 100));
  for (let i = 0; i < branchCount; i++) {
    const by = 26 + hash2(seed + 81, i) * (height - 52);
    const blen = 13 + hash2(seed + 83, i) * 15;
    const bend = (hash2(seed + 85, i) - 0.5) * 12;
    tctx.strokeStyle = INK; tctx.lineWidth = STROKE.part;
    tctx.fillStyle = lerpColor(style.fg, '#ffffff', 0.18);
    tctx.beginPath();
    tctx.moveTo(innerX, by - 3);
    tctx.quadraticCurveTo(innerX - dir * blen * 0.6 + bend, by - blen * 0.5, innerX - dir * blen + bend, by - blen);
    tctx.lineTo(innerX - dir * blen * 0.75 + bend, by - blen + 4.5);
    tctx.quadraticCurveTo(innerX - dir * blen * 0.5 + bend, by - blen * 0.35, innerX, by + 4);
    tctx.closePath();
    tctx.fill(); tctx.stroke();
  }

  // 큰 폴립 (기존 앵커 포인트)
  tctx.fillStyle = style.accent;
  const count = Math.max(3, Math.round(height / 90));
  for (let i = 0; i < count; i++) {
    const py = 30 + i * 90 + Math.sin(seed + i) * 12;
    const px = innerX - dir * (14 + Math.sin(seed * 2 + i) * 8);
    tctx.beginPath(); tctx.arc(px, py, 4, 0, Math.PI * 2); tctx.fill();
    tctx.strokeStyle = INK; tctx.lineWidth = STROKE.detail; tctx.stroke();
  }

  // 폴립 점묘 텍스처 (촘촘한 점 무리 — 유기적 질감의 핵심)
  const clusters = Math.max(5, Math.round(height / 55));
  for (let c = 0; c < clusters; c++) {
    const cy = hash2(seed + 91, c) * height;
    const cx = innerX - dir * (8 + hash2(seed + 93, c) * width * 0.55);
    for (let d = 0; d < 9; d++) {
      const ang = hash2(seed + 95, c * 20 + d) * Math.PI * 2;
      const rr = hash2(seed + 97, c * 20 + d + 1) * 9;
      const dx = cx + Math.cos(ang) * rr;
      const dy = cy + Math.sin(ang) * rr * 0.7;
      tctx.globalAlpha = 0.5 + hash2(seed + 99, c * 7 + d) * 0.35;
      tctx.fillStyle = style.accent;
      tctx.beginPath(); tctx.arc(dx, dy, 1.1, 0, Math.PI * 2); tctx.fill();
    }
  }
  tctx.globalAlpha = 1;

  return cnv;
}

// ---------------------------------------------------------------------------
// 열수구 굴뚝 몸체 (정적 텍스처만 굽고, 애니메이션 연기/글로우는 매 프레임 별도로 그림)
function bakeVentBody(chunk) {
  const { width, height, seed, side, layer } = chunk;
  const isFg = layer === 'fg';
  const style = TERRAIN_STYLE.vent;
  const cnv = makeCanvas(width, height);
  const tctx = cnv.getContext('2d');
  const local = { x: 0, y: 0, width, height, seed, side };
  const innerX = side === 'left' ? width : 0;
  const outerX = side === 'left' ? 0 : width;
  const dir = side === 'left' ? 1 : -1;

  const grad = tctx.createLinearGradient(outerX, 0, innerX, 0);
  grad.addColorStop(0, lerpColor(style.fg, '#ff9d5c', isFg ? 0.12 : 0.05));
  grad.addColorStop(0.55, style.fg);
  grad.addColorStop(1, lerpColor(style.fg, '#000000', isFg ? 0.32 : 0.16));
  tctx.fillStyle = isFg ? grad : style.bg;
  if (isFg) { tctx.strokeStyle = INK; tctx.lineWidth = STROKE.silhouette; }

  const sampleStep = isFg ? 22 : 48;
  const jitter = isFg ? 3 : 1.2;
  buildWallPath(tctx, local, 20, 0.012, sampleStep, jitter);
  tctx.fill();
  if (isFg) tctx.stroke();

  if (!isFg) return cnv;

  shade(tctx, () => buildWallPath(tctx, local, 20, 0.012, sampleStep, jitter), 0.24);

  // 그을음/광물 침전 얼룩 (짙은 회색~검정 + 드문 주황 광물맥)
  const patchCount = Math.max(8, Math.round(height / 30));
  for (let i = 0; i < patchCount; i++) {
    const py = hash2(seed, i) * height;
    const px = innerX - dir * (6 + hash2(seed + 7, i) * width * 0.6);
    const r = 4 + hash2(seed + 13, i) * 7;
    const mineral = hash2(seed + 19, i) > 0.82;
    tctx.fillStyle = mineral ? 'rgba(255,140,70,0.22)' : rgba(INK, 0.16 + hash2(seed + 23, i) * 0.1);
    blob(tctx, px, py, r, seed + i * 4.3, 6, 0.85);
    tctx.fill();
  }

  // 균열 (열에 갈라진 잔금, 광물 침전 색조)
  const crackCount = Math.max(3, Math.round(height / 110));
  tctx.strokeStyle = 'rgba(255,120,60,0.28)';
  tctx.lineWidth = STROKE.detail;
  for (let i = 0; i < crackCount; i++) {
    let cx = innerX - dir * hash2(seed + 31, i) * width * 0.3;
    let cy = 20 + hash2(seed + 37, i) * (height - 40);
    tctx.beginPath();
    tctx.moveTo(cx, cy);
    const segs = 2 + Math.floor(hash2(seed + 41, i) * 3);
    for (let s = 0; s < segs; s++) {
      cx += -dir * (5 + hash2(seed + i * 5, s) * 8);
      cy += (hash2(seed + i * 7, s + 20) - 0.5) * 22;
      tctx.lineTo(cx, cy);
    }
    tctx.stroke();
  }

  return cnv;
}

function bakeTexture(chunk) {
  if (chunk.zoneId === 'shallow') return bakeCoral(chunk);
  if (chunk.zoneId === 'vent') return bakeVentBody(chunk);
  return bakeRock(chunk, chunk.zoneId === 'deepsea' ? 'deepsea' : 'twilight');
}

// ---------------------------------------------------------------------------
function drawVentAnimated(ctx, chunk, timeSec) {
  const { x, y, width, height, seed, side } = chunk;
  const style = TERRAIN_STYLE.vent;
  const innerX = side === 'left' ? x + width : x;
  const dir = side === 'left' ? 1 : -1;
  const count = Math.max(2, Math.round(height / 220));
  for (let i = 0; i < count; i++) {
    const vy = y + 60 + i * 220 + Math.sin(seed + i * 2) * 20;
    const vx = innerX - dir * 6;
    glow(ctx, vx, vy, 34, style.accent, 0.45);
    stairStack(ctx, 6, 0.06, (k) => {
      const rise = (k + 1) * 12 + Math.sin(timeSec * 0.5 + seed + i + k) * 4;
      ctx.fillStyle = '#cfd6e0';
      ctx.beginPath();
      ctx.ellipse(vx + Math.sin(timeSec * 0.3 + i + k) * 4, vy - rise, 10 + k * 2, 8 + k * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

export function drawTerrainChunk(ctx, chunk, timeSec) {
  const isFg = chunk.layer === 'fg';
  ctx.save();
  ctx.globalAlpha = isFg ? 1 : (chunk.zoneId === 'shallow' ? 0.55 : 0.5);
  if (chunk.tex) ctx.drawImage(chunk.tex, chunk.x, chunk.y);
  ctx.restore();
  if (chunk.zoneId === 'vent' && isFg) drawVentAnimated(ctx, chunk, timeSec);
}

// 근경 지형과 다이버의 원형 충돌 판정 (사각형 근사, 살짝 너그럽게)
export function collidesWithTerrain(chunk, px, py, radius) {
  if (chunk.layer !== 'fg') return false;
  const closestX = Math.max(chunk.x, Math.min(px, chunk.x + chunk.width));
  const closestY = Math.max(chunk.y, Math.min(py, chunk.y + chunk.height));
  const dx = px - closestX;
  const dy = py - closestY;
  return (dx * dx + dy * dy) < radius * radius;
}
