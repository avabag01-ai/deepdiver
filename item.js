// item.js — 수집 아이템 3종 + 획득 파티클 버스트

import { INK, STROKE, shade, hilite, glow, rgba } from './utils.js';

export const ITEM_TYPES = {
  pearl: { id: 'pearl', kind: 'collectible', points: 1, radius: 8, name: '진주조개' },
  oxygen: { id: 'oxygen', kind: 'collectible', points: 1, radius: 8, name: '산소캡슐' },
  chest: { id: 'chest', kind: 'collectible', points: 3, radius: 10, name: '보물상자' },
  // 회복 아이템: 발광 해초 캡슐 — 먹으면 데미지 1 회복 (풀피면 보너스 점수로 대체)
  potion: { id: 'potion', kind: 'heal', points: 2, radius: 9, name: '발광 해초 캡슐' },
};

export function createItem(type, x, y) {
  return { type, x, y, radius: ITEM_TYPES[type].radius, spawnT: 0, collected: false };
}

function drawPearl(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(t * 2) * 2;
  ctx.translate(0, bob);
  // 조개껍질
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
  ctx.fillStyle = '#d68fae';
  ctx.beginPath();
  ctx.moveTo(-9, 2);
  ctx.quadraticCurveTo(-6, -7, 0, -8);
  ctx.quadraticCurveTo(6, -7, 9, 2);
  ctx.quadraticCurveTo(0, 6, -9, 2);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.moveTo(-9, 2); ctx.quadraticCurveTo(0, 5, 9, 2); ctx.quadraticCurveTo(0, 6, -9, 2); }, 0.24);
  glow(ctx, 0, -1, 10, '#fff6e0', 0.5);
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
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
  ctx.fillStyle = '#e8e8ec';
  ctx.beginPath();
  ctx.roundRect(-6, -10, 12, 20, 4);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.roundRect(-1, -10, 7, 20, 3); }, 0.2);
  ctx.fillStyle = '#3fbf6a';
  ctx.beginPath(); ctx.roundRect(-6, -10, 12, 6, [4, 4, 0, 0]); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail;
  ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(6, -4); ctx.stroke();
  // + 마크
  ctx.strokeStyle = '#2f8f52'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, 6); ctx.moveTo(-3.5, 2.5); ctx.lineTo(3.5, 2.5); ctx.stroke();
  ctx.restore();
}

function drawChest(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(t * 1.8 + 2) * 2;
  ctx.translate(0, bob);
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.silhouette;
  ctx.fillStyle = '#a5652f';
  ctx.beginPath();
  ctx.roundRect(-11, -3, 22, 12, 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8a5024';
  ctx.beginPath();
  ctx.moveTo(-11, -3); ctx.quadraticCurveTo(0, -14, 11, -3); ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.roundRect(-11, 2, 22, 7, 2); }, 0.24);
  ctx.strokeStyle = '#e8c94a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(11, -3); ctx.stroke();
  ctx.fillStyle = '#e8c94a';
  ctx.beginPath(); ctx.arc(0, -2, 2.4, 0, Math.PI * 2); ctx.fill();
  glow(ctx, 0, 2, 12, '#ffe27a', 0.3);
  ctx.restore();
}

function drawPotion(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(t * 2.2 + 3) * 2;
  ctx.translate(0, bob);
  glow(ctx, 0, 0, 14, '#7dffb0', 0.55);
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

const DRAW_FNS = { pearl: drawPearl, oxygen: drawOxygen, chest: drawChest, potion: drawPotion };

export function drawItem(ctx, item, timeSec) {
  const fn = DRAW_FNS[item.type];
  if (fn) fn(ctx, item.x, item.y, timeSec + item.spawnT);
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
