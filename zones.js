// zones.js — 4구역 정의: 수심 경계, 배경, 뎁스베일, 경계 크로스페이드

import { CANVAS_W, CANVAS_H, lerpColor, rgba, stairStack, clamp } from './utils.js';

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
    sky: '#050810',
    mid: '#020308',
    deep: '#000000',
    rayStrength: 0.03,
    rayColor: '#5a8bd6',
    veil: 0.22,
    fogTint: '#050b1a',
    pitchBlack: true, // 헤드램프 조명 마스크 적용 대상 (game.js)
  },
  {
    id: 'vent',
    name: '열수구',
    minDepth: 2000,
    maxDepth: Infinity,
    sky: '#020204',
    mid: '#000000',
    deep: '#000000',
    rayStrength: 0.0,
    rayColor: '#ff9d5c',
    veil: 0.32,
    fogTint: '#05050a',
    pitchBlack: true, // 헤드램프 조명 마스크 적용 대상 (game.js)
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

// 배경 레이어 L0~L3 (원경 그라디언트 + 입자 느낌의 겹 레이어)를 그린다.
// theme: 스팟 테마(globe.js DIVE_SITES.theme) — tint/tintK가 있으면 zone 물 색을
// 그 색조 쪽으로 lerp해 스팟 고유의 물 색감을 만든다. null이면 기존 zone 룩 그대로.
export function drawBackground(ctx, depth, timeSec, theme = null) {
  const { zone, next, t } = zoneBlendAt(depth);

  let sky = lerpColor(zone.sky, next.sky, t);
  let mid = lerpColor(zone.mid, next.mid, t);
  let deep = lerpColor(zone.deep, next.deep, t);
  if (theme && theme.tint && theme.tintK) {
    sky = lerpColor(sky, theme.tint, theme.tintK);
    mid = lerpColor(mid, theme.tint, theme.tintK);
    deep = lerpColor(deep, theme.tint, theme.tintK * 0.8);
  }

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
    drawLightRays(ctx, rayStrength, zone.rayColor, timeSec, depth);
  }

  // L2: 부유 입자 (미세 플랑크톤 느낌) — 얇은 점들. 조류 테마면 한쪽으로 드리프트.
  drawParticles(ctx, depth, timeSec, theme?.driftX || 0);

  // L3: 뎁스베일은 생물 위에 별도로 그림 (drawDepthVeil, game.js에서 생물 렌더 후 호출)
}

function drawLightRays(ctx, strength, color, timeSec, depth = 0) {
  // 부드러운 갓레이: 광선마다 세로 방향 선형 그라디언트(소실점 쪽 최대 → 도달
  // 한계에서 0)로 채워 아래로 갈수록 자연스럽게 사라지고, 폭이 다른 삼각형
  // 3장을 겹쳐 가장자리를 페더링한다(딱 떨어지는 경계선 제거). 전체 알파도
  // 이전(중심부 합산 0.45)보다 훨씬 낮게(중심부 ~0.13) 억제.
  const vanishX = CANVAS_W * 0.5 + Math.sin(timeSec * 0.05) * 30;
  const vanishY = -80;
  // 깊이에 따른 도달 거리 감쇠: 표층에선 화면 거의 끝까지, 트와일라잇에선
  // 화면 하단 절반이 사실상 광선 없는 어둠이 되게 상단만 비춘다.
  const depthT = clamp((depth - 20) / 500, 0, 1);
  const reachY = CANVAS_H * (0.98 - depthT * 0.58);
  // 폭/간격/기울기/세기가 제각각인 비균등 광선 셋 (기계적 반복감 제거)
  const rayDefs = [
    { angle: -0.42, width: 24, sway: 1.3, mul: 0.7 },
    { angle: -0.17, width: 46, sway: 0.7, mul: 1.1 },
    { angle: 0.04, width: 28, sway: 1.05, mul: 0.8 },
    { angle: 0.22, width: 54, sway: 0.85, mul: 1.0 },
    { angle: 0.39, width: 32, sway: 1.2, mul: 0.65 },
  ];

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const len = 900;
  for (const ray of rayDefs) {
    const baseAngle = Math.PI / 2 + ray.angle
      + Math.sin(timeSec * 0.06 * ray.sway + ray.angle * 5) * 0.025;
    const dx = Math.cos(baseAngle), dy = Math.sin(baseAngle);
    const nx = -dy, ny = dx;

    // 세로 페이드: 소실점 근처가 가장 밝고 reachY에서 완전히 사라짐
    const a = 0.05 * strength * ray.mul;
    const grad = ctx.createLinearGradient(vanishX, vanishY, vanishX + dx * ((reachY - vanishY) / dy), reachY);
    grad.addColorStop(0, rgba(color, a));
    grad.addColorStop(0.5, rgba(color, a * 0.55));
    grad.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = grad;

    // 가장자리 페더: 폭이 다른 삼각형 3장 겹침 — 바깥 가장자리는 1겹(옅음),
    // 중심부는 3겹이 합산돼 부드러운 단면 프로파일이 된다
    for (const wf of [1, 0.6, 0.3]) {
      const w = ray.width * wf;
      ctx.beginPath();
      ctx.moveTo(vanishX, vanishY);
      ctx.lineTo(vanishX + dx * len + nx * w, vanishY + dy * len + ny * w);
      ctx.lineTo(vanishX + dx * len - nx * w, vanishY + dy * len - ny * w);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

const PARTICLE_COUNT = 26;
let particleSeeds = null;
function drawParticles(ctx, depth, timeSec, driftX = 0) {
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
    const rawX = p.x + Math.sin(timeSec * 0.6 + p.phase) * 6 + timeSec * driftX;
    const x = ((rawX % CANVAS_W) + CANVAS_W) % CANVAS_W;
    ctx.beginPath();
    ctx.arc(x, y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 헤드램프 조명 마스크 — 미드나이트존/헤달존 전용.
// 화면 전체를 거의 새까맣게 덮되, 다이버(빛의 중심) 주위 타원형 구멍만 뚫어
// 그 안쪽 지형/생물만 보이게 한다. radial gradient + 비균등 scale로 세로로 긴
// "조명 원뿔" 느낌을 내며, 매 프레임 gradient 1회 생성 + fillRect 1회만 사용해
// 무거운 픽셀 연산 없이 저비용으로 처리한다.
// lightY는 다이버보다 하강방향(화면 아래쪽, y 증가 방향)으로 치우치게 하여
// 앞으로 다가올 장애물을 더 멀리서부터 비추도록 해 최소 반응시간을 확보한다.
export function drawHeadlampDarkness(ctx, playerX, playerY, opts = {}) {
  const rx = opts.rx ?? 100;
  const ry = opts.ry ?? 225;
  const biasY = opts.biasY ?? 55; // 하강 방향(화면 아래)으로 조명 중심을 살짝 이동
  const cx = playerX;
  const cy = playerY + biasY;
  const aspect = ry / rx;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, aspect);
  const grad = ctx.createRadialGradient(0, 0, rx * 0.22, 0, 0, rx);
  grad.addColorStop(0, 'rgba(2,4,10,0)');
  grad.addColorStop(0.55, 'rgba(2,4,10,0.5)');
  grad.addColorStop(0.85, 'rgba(2,4,10,0.9)');
  grad.addColorStop(1, 'rgba(2,4,10,0.97)');
  ctx.fillStyle = grad;
  // 캔버스 밖으로 크게 채워도 실제 렌더 비용은 캔버스 뷰포트 크기로 자동 클리핑되어 저렴하다.
  ctx.fillRect(-4000, -4000 / aspect, 8000, 8000 / aspect);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 화면 전체 후처리 오버레이 (목업 참조: 채도 높고 대비 강한 "물속에 있다" 느낌).
// 셰이더 없이 캔버스 합성만으로 근사 — 매 프레임 저비용(그라디언트/파티클 소수)만 사용.

// 마린 스노(부유 미세입자) — 배경 파티클(drawParticles)과 달리 씬 전체 위에
// 맨 마지막에 그려서 카메라에 가까운 부유물처럼 보이게 한다. 개수가 적어
// (20~40개) 오프스크린 캐싱 없이 매 프레임 직접 그려도 비용이 낮다.
const SNOW_COUNT = 32;
let snowSeeds = null;
export function drawMarineSnow(ctx, depth, timeSec, driftX = 0) {
  if (!snowSeeds) {
    snowSeeds = Array.from({ length: SNOW_COUNT }, () => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H,
      r: 0.7 + Math.random() * 1.7,
      speed: 4 + Math.random() * 9,
      drift: Math.random() * Math.PI * 2,
      alpha: 0.2 + Math.random() * 0.4,
    }));
  }
  ctx.save();
  for (const p of snowSeeds) {
    // 다이버 하강 방향과 반대(상대적으로 위)로 아주 느리게 흘러 근경 부유물 느낌
    const raw = p.y - timeSec * p.speed - depth * 0.1;
    const y = ((raw % CANVAS_H) + CANVAS_H) % CANVAS_H;
    const rawX = p.x + Math.sin(timeSec * 0.35 + p.drift) * 9 + timeSec * driftX;
    const x = ((rawX % CANVAS_W) + CANVAS_W) % CANVAS_W;
    ctx.fillStyle = `rgba(224,238,248,${p.alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 색조 보정 — 구역 색을 그대로 곱연산(multiply)으로 살짝 덧씌워 "물속 색감"의
// 통일감을 준다. 깊어질수록 틴트가 짙어진다.
export function drawColorGrade(ctx, depth) {
  const { zone, next, t } = zoneBlendAt(depth);
  const tintColor = lerpColor(zone.fogTint || '#0a2a54', next.fogTint || zone.fogTint || '#0a2a54', t);
  const depthT = clamp(depth / 1400, 0, 1);
  const alpha = 0.05 + depthT * 0.17;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = rgba(tintColor, alpha);
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // multiply만 쓰면 전체가 탁해지므로, 아주 옅은 청록 overlay를 얹어 채도/대비를 살짝 보정
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = 'rgba(120, 220, 230, 0.05)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// 비네팅 — 화면 가장자리를 향해 어두워지는 radial gradient 한 번으로 근사.
export function drawVignette(ctx, strength = 0.5) {
  ctx.save();
  const cx = CANVAS_W / 2, cy = CANVAS_H * 0.46;
  const g = ctx.createRadialGradient(cx, cy, CANVAS_H * 0.22, cx, cy, CANVAS_H * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.7, `rgba(2,6,14,${strength * 0.45})`);
  g.addColorStop(1, `rgba(2,6,14,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();
}

// 세 오버레이를 한 번에 — game.js 렌더 루프 맨 마지막에 한 번만 호출하면 됨.
export function drawPostProcess(ctx, depth, timeSec, driftX = 0) {
  drawMarineSnow(ctx, depth, timeSec, driftX);
  drawColorGrade(ctx, depth);
  drawVignette(ctx);
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
