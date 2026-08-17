// item.js — 수집 아이템 3종 + 획득 파티클 버스트

import { INK, STROKE, shade, hilite, glow, rgba, drawBubble } from './utils.js';

export const ITEM_TYPES = {
  pearl: { id: 'pearl', kind: 'collectible', points: 1, radius: 8, name: '진주조개' },
  oxygen: { id: 'oxygen', kind: 'collectible', points: 1, radius: 8, name: '산소캡슐' },
  chest: { id: 'chest', kind: 'collectible', points: 3, radius: 10, name: '보물상자' },
  // 회복 아이템: 발광 해초 캡슐 — 먹으면 데미지 1 회복 (풀피면 보너스 점수로 대체)
  potion: { id: 'potion', kind: 'heal', points: 2, radius: 9, name: '발광 해초 캡슐' },
  // 레벨 목표 대형 아이템: 그 스팟의 바닥에서 한 번만 등장. 획득하면 하강→상승 전환 트리거.
  treasure: { id: 'treasure', kind: 'levelGoal', points: 10, radius: 24, name: '봉인된 보물' },
};

// variant: treasure 전용 — 구역별 테마(shallow/twilight/deepsea/vent)로 생김새를 다르게
export function createItem(type, x, y, variant = null) {
  return { type, x, y, radius: ITEM_TYPES[type].radius, spawnT: 0, collected: false, variant };
}

// 은은하게 밝기가 오르내리는 펄스 계수 (0~1, 아이템마다 위상을 다르게 줘서 화면에
// 여러 개가 함께 있어도 전부 같은 박자로 깜빡이지 않게 한다)
function glowPulse(t, speed, phase = 0) {
  return 0.72 + Math.sin(t * speed + phase) * 0.28;
}

function drawPearl(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(t * 2) * 2;
  ctx.translate(0, bob);
  const pulse = glowPulse(t, 2.6, 0);
  // 은은한 외곽 글로우 — 어두운 배경/지형 사이에서도 눈에 띄도록
  glow(ctx, 0, 0, 17 * pulse, '#ffd9ee', 0.4 * pulse);
  // 조개껍질 (채도를 올려 배경과 대비를 확실히)
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
  ctx.fillStyle = '#ef5f9a';
  ctx.beginPath();
  ctx.moveTo(-9, 2);
  ctx.quadraticCurveTo(-6, -7, 0, -8);
  ctx.quadraticCurveTo(6, -7, 9, 2);
  ctx.quadraticCurveTo(0, 6, -9, 2);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.moveTo(-9, 2); ctx.quadraticCurveTo(0, 5, 9, 2); ctx.quadraticCurveTo(0, 6, -9, 2); }, 0.24);
  glow(ctx, 0, -1, 10 * pulse, '#fff6e0', 0.6 * pulse);
  ctx.fillStyle = '#fff6e0';
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail;
  ctx.beginPath(); ctx.arc(0, -1, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  hilite(ctx, () => { ctx.beginPath(); ctx.arc(-1.3, -2.3, 1.3, 0, Math.PI * 2); }, 0.7);
  ctx.restore();
}

function drawOxygen(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(t * 2.4 + 1) * 2;
  ctx.translate(0, bob);
  const pulse = glowPulse(t, 3.1, 1.4);
  // 산소캡슐은 전신이 밝은 회백색이라 특히 묻히기 쉬우므로 시안색 글로우로 존재감을 준다
  glow(ctx, 0, 0, 16 * pulse, '#7fe0ff', 0.42 * pulse);
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
  ctx.fillStyle = '#f4fbff';
  ctx.beginPath();
  ctx.roundRect(-6, -10, 12, 20, 4);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.roundRect(-1, -10, 7, 20, 3); }, 0.2);
  ctx.fillStyle = '#2fe084';
  ctx.beginPath(); ctx.roundRect(-6, -10, 12, 6, [4, 4, 0, 0]); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail;
  ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(6, -4); ctx.stroke();
  // + 마크
  ctx.strokeStyle = '#1f8f52'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, 6); ctx.moveTo(-3.5, 2.5); ctx.lineTo(3.5, 2.5); ctx.stroke();
  ctx.restore();
}

function drawChest(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(t * 1.8 + 2) * 2;
  ctx.translate(0, bob);
  const pulse = glowPulse(t, 2.2, 2.7);
  glow(ctx, 0, 2, 19 * pulse, '#ffe27a', 0.5 * pulse);
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.silhouette;
  ctx.fillStyle = '#c67a35';
  ctx.beginPath();
  ctx.roundRect(-11, -3, 22, 12, 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9c5c28';
  ctx.beginPath();
  ctx.moveTo(-11, -3); ctx.quadraticCurveTo(0, -14, 11, -3); ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.roundRect(-11, 2, 22, 7, 2); }, 0.24);
  ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(11, -3); ctx.stroke();
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath(); ctx.arc(0, -2, 2.4, 0, Math.PI * 2); ctx.fill();
  glow(ctx, 0, 2, 12 * pulse, '#ffe27a', 0.4 * pulse);
  ctx.restore();
}

function drawPotion(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(t * 2.2 + 3) * 2;
  ctx.translate(0, bob);
  const pulse = glowPulse(t, 2.9, 4.1);
  glow(ctx, 0, 0, 19 * pulse, '#7dffb0', 0.62 * pulse);
  // 캡슐 몸체 (발광 해초를 담은 유리 캡슐)
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
  ctx.fillStyle = 'rgba(200, 245, 220, 0.5)';
  ctx.beginPath();
  ctx.roundRect(-5, -11, 10, 22, 5);
  ctx.fill(); ctx.stroke();
  // 안의 해초 (발광 초록)
  ctx.strokeStyle = '#3fe08a';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-1.5, 8);
  ctx.quadraticCurveTo(2, 2, -1.5, -4);
  ctx.quadraticCurveTo(-4, -8, 1, -9);
  ctx.stroke();
  ctx.fillStyle = '#bff7d6';
  ctx.beginPath(); ctx.arc(1, -9, 1.6, 0, Math.PI * 2); ctx.fill();
  // 캡슐 마개
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail;
  ctx.fillStyle = '#e8c94a';
  ctx.beginPath(); ctx.roundRect(-5.5, -12, 11, 4, 2); ctx.fill(); ctx.stroke();
  hilite(ctx, () => { ctx.beginPath(); ctx.ellipse(-2, -2, 1.6, 5, 0, 0, Math.PI * 2); }, 0.5);
  ctx.restore();
}

// 레벨 목표 대형 아이템 — 구역 테마별로 생김새가 다르다(표층/트와일라잇=난파선 보물상자,
// 심해=고대 유물 오벨리스크, 열수구=발광 광물 결정체). 일반 아이템보다 훨씬 크고
// 글로우도 두 겹으로 겹쳐 훨씬 화려하게 눈에 띄도록 한다.
const TREASURE_PALETTE = {
  shallow: { body: '#c67a35', body2: '#9c5c28', trim: '#ffd94a', glow: '#ffe27a' },
  twilight: { body: '#7a5230', body2: '#4a3018', trim: '#e0c060', glow: '#ffcf6a' },
  deepsea: { body: '#5a6a8a', body2: '#3a4560', trim: '#bcd8ff', glow: '#8dc8ff' },
  vent: { body: '#8a3a8a', body2: '#5a1f5a', trim: '#ffb0ff', glow: '#ff8ae0' },
};

function drawTreasure(ctx, x, y, t, variant) {
  const zoneId = variant || 'shallow';
  const pal = TREASURE_PALETTE[zoneId] || TREASURE_PALETTE.shallow;
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(t * 1.3) * 3;
  ctx.translate(0, bob);
  const pulse = 0.78 + Math.sin(t * 2.4) * 0.22;
  glow(ctx, 0, 0, 46 * pulse, pal.glow, 0.55 * pulse);
  glow(ctx, 0, 0, 24 * pulse, pal.glow, 0.55 * pulse);

  if (zoneId === 'deepsea') {
    // 고대 유물: 세로로 긴 석상/오벨리스크 + 발광 룬 문양
    ctx.strokeStyle = INK; ctx.lineWidth = STROKE.silhouette;
    ctx.fillStyle = pal.body;
    ctx.beginPath();
    ctx.moveTo(-12, 18); ctx.lineTo(-9, -16); ctx.lineTo(0, -25); ctx.lineTo(9, -16); ctx.lineTo(12, 18);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    shade(ctx, () => { ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(9, -16); ctx.lineTo(12, 18); ctx.lineTo(2, 18); ctx.closePath(); }, 0.26);
    ctx.strokeStyle = pal.trim; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(0, -3, 6.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4.5, -3); ctx.lineTo(4.5, -3); ctx.moveTo(0, -7.5); ctx.lineTo(0, 1.5); ctx.stroke();
  } else if (zoneId === 'vent') {
    // 발광 광물 결정체 군집
    for (const [dx, h, w] of [[-11, 20, 7], [0, 27, 9], [11, 19, 6.5], [-5, 13, 5], [5, 14, 5]]) {
      ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
      ctx.fillStyle = pal.body;
      ctx.beginPath();
      ctx.moveTo(dx - w, 11); ctx.lineTo(dx, -h); ctx.lineTo(dx + w, 11); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = pal.trim;
      ctx.beginPath(); ctx.moveTo(dx, -h); ctx.lineTo(dx + w * 0.4, -h * 0.4); ctx.lineTo(dx, 2); ctx.closePath(); ctx.fill();
    }
  } else {
    // 표층/트와일라잇: 크고 화려한 난파선 보물상자, 흘러나온 금화
    ctx.strokeStyle = INK; ctx.lineWidth = STROKE.silhouette;
    ctx.fillStyle = pal.body;
    ctx.beginPath(); ctx.roundRect(-22, -4, 44, 22, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.body2;
    ctx.beginPath(); ctx.moveTo(-22, -4); ctx.quadraticCurveTo(0, -27, 22, -4); ctx.closePath();
    ctx.fill(); ctx.stroke();
    shade(ctx, () => { ctx.beginPath(); ctx.roundRect(-22, 6, 44, 12, 4); }, 0.26);
    ctx.strokeStyle = pal.trim; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-22, -4); ctx.lineTo(22, -4); ctx.stroke();
    ctx.fillStyle = pal.trim;
    ctx.beginPath(); ctx.arc(0, -3, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail; ctx.stroke();
    for (const [dx, dy, r] of [[-15, 15, 3], [-4, 18, 2.6], [9, 16, 3], [17, 13, 2.4]]) {
      ctx.fillStyle = pal.trim;
      ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
    }
  }
  hilite(ctx, () => { ctx.beginPath(); ctx.ellipse(-7, -9, 4.5, 2.2, -0.3, 0, Math.PI * 2); }, 0.4);
  ctx.restore();
}

const DRAW_FNS = { pearl: drawPearl, oxygen: drawOxygen, chest: drawChest, potion: drawPotion, treasure: drawTreasure };

export function drawItem(ctx, item, timeSec) {
  const fn = DRAW_FNS[item.type];
  if (fn) fn(ctx, item.x, item.y, timeSec + item.spawnT, item.variant);
}

// ---- 획득 파티클 버스트 ------------------------------------------------------
export function createBurst(x, y, color = '#ffe27a') {
  const count = 10;
  const particles = [];
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = 60 + Math.random() * 70;
    particles.push({
      x, y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.3,
      r: 2 + Math.random() * 2,
      color,
    });
  }
  return { particles, done: false };
}

export function updateBurst(burst, dtSec) {
  let alive = false;
  for (const p of burst.particles) {
    p.life += dtSec;
    if (p.life >= p.maxLife) continue;
    alive = true;
    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
    p.vx *= (1 - 3 * dtSec);
    p.vy *= (1 - 3 * dtSec);
  }
  burst.done = !alive;
}

export function drawBurst(ctx, burst) {
  for (const p of burst.particles) {
    if (p.life >= p.maxLife) continue;
    const alpha = 1 - p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ---- 환경/생물 기포 파티클 (기존 burst 파티클 시스템과 같은 update/draw 패턴 재사용) ----
// 화면 전체 동시 기포 개수는 game.js에서 30개로 제한한다.
export function createBubbleColumn(x, baseY, count, sizeScale = 1, speedScale = 1) {
  const bubbles = [];
  for (let i = 0; i < count; i++) {
    bubbles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: baseY - i * (8 + Math.random() * 7),
      r: (1.3 + Math.random() * 2.1) * sizeScale,
      vy: (24 + Math.random() * 20) * speedScale,
      wobPhase: Math.random() * Math.PI * 2,
      wobSpeed: 2.6 + Math.random() * 2.2,
      wobAmp: (2 + Math.random() * 4) * sizeScale,
      life: 0,
      maxLife: 1.6 + Math.random() * 1.6,
    });
  }
  return bubbles;
}

// 다이버 호흡 기포 뭉치 — 마스크/호흡기 위치에서 주기적으로 뿜어져 나와 화면 위로
// 또렷하게 상승하는 연출용. 환경 기포보다 크고 불투명하며, 상승하면서 점점 커진다.
export function createBreathBubbles(x, y) {
  const count = 3 + Math.floor(Math.random() * 4); // 3~6개, 크기 제각각
  const bubbles = [];
  for (let i = 0; i < count; i++) {
    bubbles.push({
      x: x + (Math.random() - 0.5) * 9,
      y: y - Math.random() * 10,
      r: 1.6 + Math.random() * 2.2,
      vy: 38 + Math.random() * 26, // 스크롤과 별개로 화면 기준 위로 (충분히 빠르게)
      wobPhase: Math.random() * Math.PI * 2,
      wobSpeed: 3 + Math.random() * 2.5,
      wobAmp: 3 + Math.random() * 4,
      life: 0,
      maxLife: 2.6 + Math.random() * 1.2, // 화면 위까지 도달할 만큼 길게
      alpha: 0.85,
      grow: 0.9, // 수명에 걸쳐 최대 +90% 크기 성장 (수압 감소 연출)
    });
  }
  return bubbles;
}

export function updateBubbles(bubbles, dtSec) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.life += dtSec;
    b.y -= b.vy * dtSec; // 기포는 스크롤 방향과 무관하게 항상 수면 쪽(위)으로 떠오름
    if (b.life >= b.maxLife) bubbles.splice(i, 1);
  }
}

export function drawBubbles(ctx, bubbles) {
  for (const b of bubbles) {
    const growT = Math.min(1, b.life / 0.3);
    const fadeT = Math.max(0, 1 - b.life / b.maxLife);
    const lifeFrac = Math.min(1, b.life / b.maxLife);
    const x = b.x + Math.sin(b.life * b.wobSpeed + b.wobPhase) * b.wobAmp;
    const r = b.r * (0.55 + 0.45 * growT) * (1 + (b.grow || 0) * lifeFrac); // 상승하며 성장
    drawBubble(ctx, x, b.y, r, (b.alpha ?? 0.5) * fadeT);
  }
}
