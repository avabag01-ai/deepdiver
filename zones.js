// zones.js — 4구역 정의: 수심 경계, 배경, 뎁스베일, 경계 크로스페이드

import { CANVAS_W, CANVAS_H, lerpColor, rgba, stairStack } from './utils.js';

export const ZONES = [
  {
    id: 'shallow',
    name: '얕은 바다',
    minDepth: 0,
    maxDepth: 80,
    sky: '#8fe3ea',      // 밝은 하늘색
    mid: '#4fc7d6',
    deep: '#1f9bb8',     // 청록
    rayStrength: 1.0,
    rayColor: '#eafcff',
    veil: 0,             // 뎁스베일 없음
    fogTint: null,
  },
  {
    id: 'twilight',
    name: '트와일라잇존',
    minDepth: 80,
    maxDepth: 600,
    sky: '#1f5c9e',
    mid: '#123f78',
    deep: '#0a2a54',
    rayStrength: 0.5,
    rayColor: '#bfe3ff',
    veil: 0.08,
    fogTint: '#0a2a54',
  },
  {
    id: 'deepsea',
    name: '심해',
    minDepth: 600,
    maxDepth: 2000,
    sky: '#0c1c3a',
    mid: '#081328',
    deep: '#050b1a',
    rayStrength: 0.12,
    rayColor: '#5a8bd6',
    veil: 0.22,
    fogTint: '#050b1a',
  },
  {
    id: 'vent',
    name: '열수구',
    minDepth: 2000,
    maxDepth: Infinity,
    sky: '#0a0a14',
    mid: '#08080f',
    deep: '#05050a',
    rayStrength: 0.0,
    rayColor: '#ff9d5c',
    veil: 0.32,
    fogTint: '#05050a',
  },
];

export function zoneAt(depth) {
  for (const z of ZONES) {
    if (depth >= z.minDepth && depth < z.maxDepth) return z;
  }
  return ZONES[ZONES.length - 1];
}

// 구역 인덱스 + 경계 크로스페이드 진행률(0~1, 다음 구역과의 전환)을 반환
export function zoneBlendAt(depth) {
  const idx = ZONES.findIndex(z => depth >= z.minDepth && depth < z.maxDepth);
  const zi = idx === -1 ? ZONES.length - 1 : idx;
  const z = ZONES[zi];
  const next = ZONES[Math.min(zi + 1, ZONES.length - 1)];
  const fadeBand = Math.min(120, (z.maxDepth - z.minDepth) * 0.25) || 120;
  let t = 0;
  if (isFinite(z.maxDepth)) {
    t = Math.max(0, Math.min(1, (depth - (z.maxDepth - fadeBand)) / fadeBand));
  }
  return { zone: z, next, t };
}

// 배경 레이어 L0~L3 (원경 그라디언트 + 입자 느낌의 겹 레이어)를 그린다
export function drawBackground(ctx, depth, timeSec) {
  const { zone, next, t } = zoneBlendAt(depth);

  const sky = lerpColor(zone.sky, next.sky, t);
  const mid = lerpColor(zone.mid, next.mid, t);
  const deep = lerpColor(zone.deep, next.deep, t);

  // L0: 수직 그라디언트 베이스
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0, sky);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // L1: 빛줄기 (수면에서 내려오는 사선 광선)
  const rayStrength = zone.rayStrength * (1 - t) + next.rayStrength * t;
  if (rayStrength > 0.01) {
    drawLightRays(ctx, rayStrength, zone.rayColor, timeSec);
  }

  // L2: 부유 입자 (미세 플랑크톤 느낌) — 얇은 점들
  drawParticles(ctx, depth, timeSec);

  // L3: 뎁스베일은 생물 위에 별도로 그림 (drawDepthVeil, game.js에서 생물 렌더 후 호출)
}

function drawLightRays(ctx, strength, color, timeSec) {
  // 밴딩 방지: 한 점(수면 위 소실점)으로 수렴하는 마름모형 광선을
  // 얇은 알파(0.05 내외)로 여러 장 계단식으로 겹쳐 그린다.
  const vanishX = CANVAS_W * 0.5 + Math.sin(timeSec * 0.05) * 30;
  const vanishY = -80;
  const rayDefs = [
    { angle: -0.35, width: 46, len: 720 },
    { angle: -0.12, width: 34, len: 780 },
    { angle: 0.08, width: 40, len: 760 },
    { angle: 0.30, width: 50, len: 700 },
  ];

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const ray of rayDefs) {
    const baseAngle = Math.PI / 2 + ray.angle + Math.sin(timeSec * 0.08 + ray.angle * 3) * 0.02;
    const farX = vanishX + Math.cos(baseAngle) * ray.len;
    const farY = vanishY + Math.sin(baseAngle) * ray.len;
    const nx = -Math.sin(baseAngle); // 폭 방향 법선
    const ny = Math.cos(baseAngle);

    stairStack(ctx, 10, 0.045 * strength, (i, count) => {
      const growth = (i + 1) / count;
      const w = ray.width * growth;
      const fx = vanishX + (farX - vanishX) * growth;
      const fy = vanishY + (farY - vanishY) * growth;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(vanishX, vanishY);
      ctx.lineTo(fx + nx * w, fy + ny * w);
      ctx.lineTo(fx - nx * w, fy - ny * w);
      ctx.closePath();
      ctx.fill();
    });
  }
  ctx.restore();
}

const PARTICLE_COUNT = 26;
let particleSeeds = null;
function drawParticles(ctx, depth, timeSec) {
  if (!particleSeeds) {
    particleSeeds = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H,
      r: 0.6 + Math.random() * 1.4,
      speed: 6 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
    }));
  }
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const p of particleSeeds) {
    // 다이버 하강 = 세상이 위로 흐르는 방향이므로 부유 입자도 같은 방향(위)으로 흘려
    // 지형/생물 스크롤과 시각적으로 결이 맞게 한다.
    const raw = p.y - timeSec * p.speed - depth * 0.15;
    const y = ((raw % CANVAS_H) + CANVAS_H) % CANVAS_H;
    const x = p.x + Math.sin(timeSec * 0.6 + p.phase) * 6;
    ctx.beginPath();
    ctx.arc(x, y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 뎁스베일: 심해 구간에서 생물 위에 덧씌우는 반투명 남색 레이어 (거리감 표현)
// 계단식으로 얇게 쌓아 밴딩을 방지한다.
export function drawDepthVeil(ctx, depth) {
  const { zone, next, t } = zoneBlendAt(depth);
  const veil = zone.veil * (1 - t) + next.veil * t;
  if (veil <= 0.005) return;
  const tint = zone.fogTint || '#050b1a';
  stairStack(ctx, 8, veil / 8, () => {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  });
}
