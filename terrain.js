// terrain.js — 구역별 지형(원경/근경 2계층)
// 근경(전경) 지형은 충돌이 있고 폭 최대 화면의 40%, 좌우 벽에 붙어 번갈아 배치되어
// 항상 통로가 확보된다. 원경(배경)은 충돌 없이 장식용으로만 스크롤된다.

import { CANVAS_W, CANVAS_H, INK, STROKE, shade, rgba, glow, stairStack } from './utils.js';

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

// 지형 조각 하나를 생성. side: 'left' | 'right'
// spawnY는 조각의 "위쪽(top)" 기준. 조각은 화면 아래에서 나타나 위로 흘러가므로
// 항상 화면 바닥 부근에서 스폰되고, 세로로 길게(화면의 1.5~3배) 뻗어 벽처럼 보인다.
export function createTerrainChunk(zoneId, side, spawnY) {
  const width = FG_MAX_WIDTH * (0.65 + Math.random() * 0.35);
  const height = FG_HEIGHT_MIN + Math.random() * (FG_HEIGHT_MAX - FG_HEIGHT_MIN);
  return {
    zoneId,
    side,
    x: side === 'left' ? 0 : CANVAS_W - width,
    y: spawnY,
    width,
    height,
    seed: Math.random() * 1000,
    layer: 'fg',
  };
}

export function createBgChunk(zoneId, side, spawnY) {
  const width = CANVAS_W * (0.3 + Math.random() * 0.25);
  const height = BG_HEIGHT_MIN + Math.random() * (BG_HEIGHT_MAX - BG_HEIGHT_MIN);
  return {
    zoneId,
    side,
    x: side === 'left' ? -width * 0.3 : CANVAS_W - width * 0.7,
    y: spawnY,
    width,
    height,
    seed: Math.random() * 1000,
    layer: 'bg',
  };
}

// 벽처럼 세로로 긴 지형의 안쪽(통로쪽) 가장자리를 그릴 때 쓰는 공용 헬퍼.
// 진폭을 조각 전체 높이에 비례시키지 않고 "고정 픽셀 값"으로 둬서, 조각이 아무리
// 길어져도 하나의 거대한 굴곡이 아니라 일정한 리듬으로 반복되는 요철이 되게 한다.
//
// 중요: 위상(phase)은 반드시 "조각 안에서의 상대 위치(localY)"로만 계산해야 한다.
// chunk.y(화면상 절대 좌표)는 매 프레임 스크롤로 바뀌므로, 만약 그 절대좌표를 위상에
// 쓰면 같은 지점의 굴곡이 프레임마다 다른 위상으로 다시 계산되어 지형이 스크롤과
// 별개로 꿈틀거리는 것처럼 보이는 버그가 생긴다(실제로 발생했던 버그). 지형은 시간이나
// 화면 좌표에 따라 변형되지 않고, 스크롤에 의한 수직 이동만 있어야 한다.
function innerEdgeX(innerX, dir, localY, seed, amp, freq) {
  // dir: side==='left'인 벽은 오른쪽(+)으로 튀어나오고, 'right'인 벽은 왼쪽(-)으로 튀어나옴
  const n = Math.sin(localY * freq + seed) * 0.6 + Math.sin(localY * freq * 2.3 + seed * 1.7) * 0.4;
  return innerX + dir * (amp * 0.5 + amp * 0.5 * n);
}

function buildWallPath(ctx, chunk, amp, freq, sampleStep) {
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
    const sx = innerEdgeX(innerX, dir, localY, seed, amp, freq);
    ctx.lineTo(sx, sy);
  }
  ctx.lineTo(outerX, y + height);
  ctx.closePath();
}

function drawCoralSilhouette(ctx, chunk, isFg) {
  const { x, y, width, height, seed, side } = chunk;
  const style = TERRAIN_STYLE.shallow;
  const innerX = side === 'left' ? x + width : x;
  ctx.save();
  ctx.globalAlpha = isFg ? 1 : 0.55;
  ctx.fillStyle = isFg ? style.fg : style.bg;
  if (isFg) { ctx.strokeStyle = INK; ctx.lineWidth = STROKE.silhouette; }
  buildWallPath(ctx, chunk, 26, 0.02, 42);
  ctx.fill();
  if (isFg) ctx.stroke();
  if (isFg) {
    // 안쪽 가장자리를 따라 그림자를 얇게 얹어 입체감 (밝은 산호 표면 vs 그늘진 안쪽)
    shade(ctx, () => buildWallPath(ctx, chunk, 26, 0.02, 42), 0.16);
    // 산호 폴립 디테일: 조각 전체 길이를 따라 일정 간격으로 반복
    ctx.fillStyle = style.accent;
    const count = Math.max(3, Math.round(height / 90));
    for (let i = 0; i < count; i++) {
      const py = y + 30 + i * 90 + (Math.sin(seed + i) * 12);
      const px = innerX - (side === 'left' ? 1 : -1) * (14 + Math.sin(seed * 2 + i) * 8);
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail; ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRockSilhouette(ctx, chunk, isFg, zoneId) {
  const { x, y, width, height, seed, side } = chunk;
  const style = TERRAIN_STYLE[zoneId];
  const innerX = side === 'left' ? x + width : x;
  ctx.save();
  ctx.globalAlpha = isFg ? 1 : 0.5;
  ctx.fillStyle = isFg ? style.fg : style.bg;
  if (isFg) { ctx.strokeStyle = INK; ctx.lineWidth = STROKE.silhouette; }
  buildWallPath(ctx, chunk, 22, 0.014, 55);
  ctx.fill();
  if (isFg) ctx.stroke();
  if (isFg) {
    shade(ctx, () => buildWallPath(ctx, chunk, 22, 0.014, 55), 0.2);
    // 균열선: 조각 길이를 따라 일정 간격 반복, 안쪽 가장자리에서 바깥쪽으로
    ctx.strokeStyle = rgba(INK, 0.3);
    ctx.lineWidth = STROKE.detail;
    const count = Math.max(3, Math.round(height / 80));
    for (let i = 0; i < count; i++) {
      const cy = y + 20 + i * 80 + Math.sin(seed + i * 1.3) * 10;
      const cx = innerX;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - (side === 'left' ? 1 : -1) * 16, cy + 20);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawVentSilhouette(ctx, chunk, isFg, timeSec) {
  const { x, y, width, height, seed, side } = chunk;
  const style = TERRAIN_STYLE.vent;
  const innerX = side === 'left' ? x + width : x;
  const dir = side === 'left' ? 1 : -1;
  ctx.save();
  ctx.globalAlpha = isFg ? 1 : 0.5;

  // 굴뚝 벽면: 마디마다 살짝 부풀었다 좁아지는 지형 (고정 진폭, 조각 길이와 무관)
  ctx.fillStyle = isFg ? style.fg : style.bg;
  if (isFg) { ctx.strokeStyle = INK; ctx.lineWidth = STROKE.silhouette; }
  buildWallPath(ctx, chunk, 20, 0.012, 60);
  ctx.fill();
  if (isFg) ctx.stroke();

  if (isFg) {
    shade(ctx, () => buildWallPath(ctx, chunk, 20, 0.012, 60), 0.24);
    // 열수 분출구: 조각 길이를 따라 일정 간격으로 글로우+굴뚝 입 반복
    const count = Math.max(2, Math.round(height / 220));
    for (let i = 0; i < count; i++) {
      const vy = y + 60 + i * 220 + Math.sin(seed + i * 2) * 20;
      const vx = innerX - dir * 6;
      glow(ctx, vx, vy, 34, style.accent, 0.45);
      // 연기: 계단식 얇은 알파로 밴딩 없이
      stairStack(ctx, 6, 0.06, (k) => {
        const rise = (k + 1) * 12 + Math.sin(timeSec * 0.5 + seed + i + k) * 4;
        ctx.fillStyle = '#cfd6e0';
        ctx.beginPath();
        ctx.ellipse(vx + Math.sin(timeSec * 0.3 + i + k) * 4, vy - rise, 10 + k * 2, 8 + k * 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  ctx.restore();
}

export function drawTerrainChunk(ctx, chunk, timeSec) {
  const isFg = chunk.layer === 'fg';
  switch (chunk.zoneId) {
    case 'shallow': drawCoralSilhouette(ctx, chunk, isFg); break;
    case 'twilight':
    case 'deepsea': drawRockSilhouette(ctx, chunk, isFg, chunk.zoneId); break;
    case 'vent': drawVentSilhouette(ctx, chunk, isFg, timeSec); break;
    default: drawRockSilhouette(ctx, chunk, isFg, 'deepsea');
  }
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
