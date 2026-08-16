// species.js — 생물 13종 정의 + 구역별 가중치 스폰 풀
// 각 생물: 크기 / sway 진폭·주기 / 표정 / 발광 여부가 서로 다르게 설계됨

import { INK, STROKE, shade, hilite, eye, glow, rgba, weightedPick } from './utils.js';

function outline(ctx, w) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function ellipsePath(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

// ---------------------------------------------------------------------------
// 1. 흰동가리 (clownfish) — 얕은 바다, 작고 통통, 밝은 주황+흰 줄무늬
function drawClownfish(ctx, x, y, t, s) {
  const bob = Math.sin(t * 4) * 2;
  y += bob;
  ctx.save();
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#ff8a3d';
  ellipsePath(ctx, x, y, 14 * s, 9 * s);
  ctx.fill(); ctx.stroke();

  // 꼬리
  ctx.fillStyle = '#ff8a3d';
  ctx.beginPath();
  ctx.moveTo(x - 13 * s, y);
  ctx.lineTo(x - 22 * s, y - 7 * s);
  ctx.lineTo(x - 22 * s, y + 7 * s);
  ctx.closePath();
  outline(ctx, STROKE.part * s); ctx.fill(); ctx.stroke();

  // 흰 줄무늬
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.2 * s;
  ctx.beginPath(); ctx.moveTo(x - 2 * s, y - 8 * s); ctx.lineTo(x - 2 * s, y + 8 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 6 * s, y - 8 * s); ctx.lineTo(x + 6 * s, y + 8 * s); ctx.stroke();
  outline(ctx, STROKE.detail * s);
  ctx.beginPath(); ctx.moveTo(x - 2 * s, y - 8 * s); ctx.lineTo(x - 2 * s, y + 8 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 6 * s, y - 8 * s); ctx.lineTo(x + 6 * s, y + 8 * s); ctx.stroke();

  shade(ctx, () => ellipsePath(ctx, x + 3 * s, y + 4 * s, 12 * s, 6 * s), 0.22);
  eye(ctx, x + 9 * s, y - 2 * s, 2.4 * s);
  ctx.restore();
}

// 2. 리프상어 (reef shark) — 얕은 바다, 유선형, 회색조, 날카로운 인상
function drawReefShark(ctx, x, y, t, s) {
  const sway = Math.sin(t * 1.6) * 3;
  ctx.save();
  ctx.translate(x, y + sway);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#8fa3ad';
  ctx.beginPath();
  ctx.moveTo(-26 * s, 0);
  ctx.quadraticCurveTo(-10 * s, -12 * s, 20 * s, -3 * s);
  ctx.quadraticCurveTo(28 * s, 0, 20 * s, 3 * s);
  ctx.quadraticCurveTo(-10 * s, 12 * s, -26 * s, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // 등지느러미
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#8fa3ad';
  ctx.beginPath();
  ctx.moveTo(-2 * s, -9 * s);
  ctx.lineTo(4 * s, -22 * s);
  ctx.lineTo(10 * s, -8 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // 꼬리
  ctx.beginPath();
  ctx.moveTo(-24 * s, 0);
  ctx.lineTo(-36 * s, -10 * s);
  ctx.lineTo(-32 * s, 1 * s);
  ctx.lineTo(-36 * s, 8 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(4 * s, 4 * s, 16 * s, 6 * s, 0, 0, Math.PI * 2); }, 0.24);
  eye(ctx, 14 * s, -2 * s, 1.8 * s);
  ctx.restore();
}

// 3. 곰치 (moray eel) — 얕은 바다, 길고 구불구불, 바위틈에서 나온 느낌
function drawMorayEel(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  const wob = Math.sin(t * 3) * 6 * s;
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#8a9a52';
  ctx.beginPath();
  ctx.moveTo(-18 * s, 14 * s);
  ctx.quadraticCurveTo(-10 * s + wob, -4 * s, 0, -14 * s);
  ctx.quadraticCurveTo(6 * s, -18 * s, 12 * s, -14 * s);
  ctx.quadraticCurveTo(4 * s + wob, -2 * s, -6 * s, 14 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(-2 * s, 4 * s, 8 * s, 12 * s, 0.2, 0, Math.PI * 2); }, 0.26);
  // 표범무늬 반점 (곰치 특유의 얼룩무늬)
  ctx.fillStyle = 'rgba(45, 40, 20, 0.55)';
  const spots = [[-4, -6], [3, -10], [-9, 4], [1, 6], [-2, 10]];
  for (const [sx, sy] of spots) {
    ctx.beginPath();
    ctx.ellipse((sx + wob * 0.15) * s, sy * s, 2 * s, 1.5 * s, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // 등지느러미 프릴 (등을 따라 이어지는 얇은 지느러미)
  ctx.strokeStyle = 'rgba(200, 220, 150, 0.6)'; ctx.lineWidth = STROKE.detail * s;
  ctx.beginPath();
  ctx.moveTo(1 * s, -13 * s);
  ctx.quadraticCurveTo(8 * s + wob * 0.3, -6 * s, 10 * s, -14.5 * s);
  ctx.stroke();
  // 벌린 입 + 콧구멍
  outline(ctx, STROKE.detail * s);
  ctx.fillStyle = '#3a2a2a';
  ctx.beginPath();
  ctx.ellipse(9 * s, -13 * s, 3.2 * s, 2 * s, 0.4, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8 * s;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo((8.5 + i * 0.6) * s, -14.4 * s); ctx.lineTo((9 + i * 0.6) * s, -13.6 * s);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(12.5 * s, -15.5 * s, 0.5 * s, 0, Math.PI * 2); ctx.fill();
  eye(ctx, 11 * s, -17 * s, 1.8 * s, { open: false });
  ctx.restore();
}

// 4. 문라이트 젤리 (moonlight jellyfish) — 트와일라잇, 반투명 우산+촉수, 은은한 발광
function drawMoonJelly(ctx, x, y, t, s) {
  const pulse = 0.9 + Math.sin(t * 2.2) * 0.12;
  ctx.save();
  ctx.translate(x, y);
  glow(ctx, 0, 0, 30 * s, '#bfe8ff', 0.35);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = 'rgba(210, 240, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 16 * s * pulse, 11 * s * pulse, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(0, -2 * s, 12 * s, 6 * s, 0, Math.PI, 0); }, 0.18);

  ctx.strokeStyle = 'rgba(210,240,255,0.7)';
  ctx.lineWidth = STROKE.detail * s;
  for (let i = -3; i <= 3; i++) {
    const bx = i * 4 * s;
    ctx.beginPath();
    ctx.moveTo(bx, 1 * s);
    ctx.quadraticCurveTo(bx + Math.sin(t * 3 + i) * 5 * s, 16 * s, bx + Math.sin(t * 2 + i) * 3 * s, 30 * s);
    ctx.stroke();
  }
  ctx.restore();
}

// 5. 랜턴피시 (lanternfish) — 트와일라잇, 작고 은빛, 몸 옆 발광점
function drawLanternfish(ctx, x, y, t, s) {
  const sway = Math.sin(t * 3) * 2;
  ctx.save();
  ctx.translate(x, y + sway);
  glow(ctx, -6 * s, 2 * s, 10 * s, '#8ad1ff', 0.5);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#5b6f8f';
  ellipsePath(ctx, 0, 0, 13 * s, 6 * s);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-11 * s, 0); ctx.lineTo(-19 * s, -5 * s); ctx.lineTo(-19 * s, 5 * s); ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 3 * s, 10 * s, 3.5 * s), 0.24);
  ctx.fillStyle = '#bfe6ff';
  for (const dx of [-4, 0, 4]) {
    ctx.beginPath(); ctx.arc(dx * s, 3 * s, 1.1 * s, 0, Math.PI * 2); ctx.fill();
  }
  eye(ctx, 8 * s, -1 * s, 1.8 * s);
  ctx.restore();
}

// 6. 바이퍼피시 (viperfish) — 트와일라잇, 길쭉, 날카로운 이빨, 위협적
function drawViperfish(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#2e3550';
  ctx.beginPath();
  ctx.moveTo(-20 * s, 0);
  ctx.quadraticCurveTo(0, -8 * s, 18 * s, -2 * s);
  ctx.quadraticCurveTo(0, 8 * s, -20 * s, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, -2 * s, 3 * s, 14 * s, 4 * s), 0.28);
  // 이빨
  ctx.strokeStyle = '#e8eef5';
  ctx.lineWidth = 1.4 * s;
  for (const dx of [12, 15, 18]) {
    ctx.beginPath(); ctx.moveTo(dx * s, -2 * s); ctx.lineTo(dx * s + 2 * s, 3 * s); ctx.stroke();
  }
  glow(ctx, 18 * s, -1 * s, 6 * s, '#8ad1ff', 0.4);
  eye(ctx, 8 * s, -3 * s, 2 * s, { glow: '#8ad1ff' });
  ctx.restore();
}

// 7. 어비스 앵글러 (anglerfish) — 심해, 유인돌기가 발광 광원 역할
function drawAnglerfish(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  const lureBob = Math.sin(t * 2.5) * 3 * s;
  glow(ctx, 14 * s, -18 * s + lureBob, 14 * s, '#ffe27a', 0.6);
  // 유인돌기 줄기
  outline(ctx, STROKE.part * s);
  ctx.beginPath();
  ctx.moveTo(4 * s, -10 * s);
  ctx.quadraticCurveTo(10 * s, -20 * s, 14 * s, -18 * s + lureBob);
  ctx.stroke();
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath(); ctx.arc(14 * s, -18 * s + lureBob, 3 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#3b2a3e';
  ctx.beginPath();
  ctx.moveTo(-16 * s, 6 * s);
  ctx.quadraticCurveTo(-14 * s, -14 * s, 6 * s, -10 * s);
  ctx.quadraticCurveTo(20 * s, -4 * s, 14 * s, 8 * s);
  ctx.quadraticCurveTo(0, 16 * s, -16 * s, 6 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, -2 * s, 8 * s, 14 * s, 6 * s), 0.3);

  // 큰 이빨
  ctx.strokeStyle = '#e8eef5';
  ctx.lineWidth = 1.3 * s;
  for (const dx of [-2, 2, 6, 10]) {
    ctx.beginPath(); ctx.moveTo(dx * s, 6 * s); ctx.lineTo(dx * s, 11 * s); ctx.stroke();
  }
  eye(ctx, 8 * s, -4 * s, 2 * s, { glow: '#ffe27a' });
  ctx.restore();
}

// 8. 심해문어 (deep-sea octopus) — 심해, 둥근 머리+다리, 느긋한 표정
function drawDeepOctopus(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#6f4e8c';
  ellipsePath(ctx, 0, -4 * s, 16 * s, 13 * s);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 3 * s, 0, 13 * s, 9 * s), 0.24);

  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#6f4e8c';
  for (let i = -4; i <= 3; i++) {
    const lx = (i + 0.5) * 4.2 * s;
    ctx.beginPath();
    ctx.moveTo(lx, 6 * s);
    ctx.quadraticCurveTo(lx + Math.sin(t * 1.5 + i) * 6 * s, 18 * s, lx + Math.sin(t * 1.2 + i) * 4 * s, 28 * s);
    ctx.lineTo(lx + 3 * s + Math.sin(t * 1.2 + i) * 4 * s, 27 * s);
    ctx.quadraticCurveTo(lx + 3 * s + Math.sin(t * 1.5 + i) * 6 * s, 18 * s, lx + 3 * s, 6 * s);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  eye(ctx, 6 * s, -6 * s, 2.6 * s);
  eye(ctx, -6 * s, -6 * s, 2.6 * s);
  ctx.restore();
}

// 9. 펠리컨장어 (pelican eel) — 심해, 거대한 입주머니가 특징
function drawPelicanEel(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  const tailWob = Math.sin(t * 2) * 4 * s;
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#241f33';
  // 몸통(꼬리)
  ctx.beginPath();
  ctx.moveTo(6 * s, -2 * s);
  ctx.quadraticCurveTo(20 * s + tailWob, 0, 30 * s + tailWob, -2 * s);
  ctx.quadraticCurveTo(20 * s + tailWob, 6 * s, 6 * s, 6 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 큰 입주머니
  ctx.beginPath();
  ctx.moveTo(6 * s, -10 * s);
  ctx.quadraticCurveTo(-16 * s, -10 * s, -18 * s, 4 * s);
  ctx.quadraticCurveTo(-8 * s, 12 * s, 6 * s, 8 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(-6 * s, 2 * s, 10 * s, 6 * s, 0, 0, Math.PI * 2); }, 0.28);
  glow(ctx, 28 * s + tailWob, -1 * s, 5 * s, '#ff8a5c', 0.5);
  eye(ctx, 2 * s, -6 * s, 1.6 * s);
  ctx.restore();
}

// 10. 흡혈오징어 (vampire squid) — 열수구, 붉은빛, 망토처럼 이어진 팔
function drawVampireSquid(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  glow(ctx, 0, 4 * s, 10 * s, '#5a2a3a', 0.3);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#3a1424';
  ellipsePath(ctx, 0, -2 * s, 13 * s, 10 * s);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 2 * s, 10 * s, 6 * s), 0.3);

  ctx.fillStyle = '#5a1e30';
  for (let i = -4; i <= 3; i++) {
    const lx = (i + 0.5) * 3.4 * s;
    ctx.beginPath();
    ctx.moveTo(lx, 4 * s);
    ctx.quadraticCurveTo(lx + Math.sin(t * 1.4 + i) * 4 * s, 12 * s, lx, 20 * s);
    ctx.lineTo(lx + 2.6 * s, 19 * s);
    ctx.quadraticCurveTo(lx + 2.6 * s + Math.sin(t * 1.4 + i) * 4 * s, 12 * s, lx + 2.6 * s, 4 * s);
    ctx.closePath();
    outline(ctx, STROKE.part * s);
    ctx.fill(); ctx.stroke();
  }
  // 발광 안구 뒤 photophore
  ctx.fillStyle = '#ffb3c6';
  ctx.beginPath(); ctx.arc(-8 * s, 8 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(8 * s, 8 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
  eye(ctx, 8 * s, -4 * s, 3 * s, { glow: '#ff4d6d' });
  eye(ctx, -8 * s, -4 * s, 3 * s, { glow: '#ff4d6d' });
  ctx.restore();
}

// 11. 대왕등각류 (giant isopod) — 열수구, 갑각 마디, 단단한 인상
function drawGiantIsopod(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#a9977a';
  ellipsePath(ctx, 0, 0, 17 * s, 10 * s);
  ctx.fill(); ctx.stroke();
  // 마디
  outline(ctx, STROKE.part * s);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 5 * s, -9 * s);
    ctx.quadraticCurveTo(i * 5 * s, 0, i * 5 * s, 9 * s);
    ctx.stroke();
  }
  shade(ctx, () => ellipsePath(ctx, 2 * s, 4 * s, 14 * s, 6 * s), 0.24);
  // 다리
  ctx.strokeStyle = INK;
  ctx.lineWidth = STROKE.detail * s;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 4 * s, 8 * s);
    ctx.lineTo(i * 4 * s + Math.sin(t * 2 + i) * 2 * s, 14 * s);
    ctx.stroke();
  }
  eye(ctx, 14 * s, -2 * s, 1.6 * s);
  ctx.restore();
}

// 12. 관벌레군집 (tube worm colony) — 열수구, 고정형(스폰만, 흔들림 최소), 붉은 깃털
function drawTubeWorms(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  const tubes = [[-11, 24], [-3, 30], [6, 22], [13, 27]];
  for (const [tx, baseH] of tubes) {
    const h = baseH * s + Math.sin(t + tx) * 1.5 * s;
    outline(ctx, STROKE.part * s);
    ctx.fillStyle = '#efe8da';
    ctx.beginPath();
    ctx.rect(tx * s - 2.2 * s, -h * 0.12, 4.4 * s, h);
    ctx.fill(); ctx.stroke();
    shade(ctx, () => ctx.rect(tx * s, -h * 0.12, 2.2 * s, h), 0.2);
    // 마디 밴드 텍스처
    ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = STROKE.detail * s;
    for (let b = 1; b < 4; b++) {
      const by = -h * 0.12 + (h * b) / 4;
      ctx.beginPath(); ctx.moveTo(tx * s - 2.2 * s, by); ctx.lineTo(tx * s + 2.2 * s, by); ctx.stroke();
    }

    // 아가미 깃털 (붉은 몸통 + 하얀 깃털 필라멘트)
    ctx.fillStyle = '#e8465a';
    ctx.beginPath();
    ctx.ellipse(tx * s, -h * 0.12, 3.8 * s, 6.5 * s, 0, 0, Math.PI * 2);
    outline(ctx, STROKE.detail * s);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.9 * s; ctx.lineCap = 'round';
    for (let f = -2; f <= 2; f++) {
      const fx = tx * s + f * 1.4 * s;
      ctx.beginPath();
      ctx.moveTo(fx, -h * 0.12 - 5 * s);
      ctx.lineTo(fx + Math.sin(t * 1.5 + f) * 0.8 * s, -h * 0.12 + 3 * s);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// 13. 덤보문어 (dumbo octopus) — 열수구, 최고 희귀도, 귀 지느러미가 특징적
function drawDumboOctopus(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  const flap = Math.sin(t * 5) * 6 * s;
  glow(ctx, 0, 0, 8 * s, '#cfe8ff', 0.15);
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#c9a3d9';
  // 귀 지느러미
  ctx.beginPath();
  ctx.ellipse(-14 * s, -4 * s, 9 * s, 5 * s + flap * 0.3, -0.3, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(14 * s, -4 * s, 9 * s, 5 * s - flap * 0.3, 0.3, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#d9b8e8';
  ellipsePath(ctx, 0, -2 * s, 13 * s, 11 * s);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 2 * s, 10 * s, 7 * s), 0.22);

  ctx.fillStyle = '#d9b8e8';
  for (let i = -4; i <= 3; i++) {
    const lx = (i + 0.5) * 3.4 * s;
    ctx.beginPath();
    ctx.moveTo(lx, 6 * s);
    ctx.quadraticCurveTo(lx + Math.sin(t * 1.5 + i) * 4 * s, 14 * s, lx, 20 * s);
    ctx.lineTo(lx + 2.4 * s, 19 * s);
    ctx.quadraticCurveTo(lx + 2.4 * s + Math.sin(t * 1.5 + i) * 4 * s, 14 * s, lx + 2.4 * s, 6 * s);
    ctx.closePath();
    outline(ctx, STROKE.detail * s);
    ctx.fill(); ctx.stroke();
  }
  eye(ctx, 6 * s, -4 * s, 3 * s);
  eye(ctx, -6 * s, -4 * s, 3 * s);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// ---- 확장 종 (구역별 서식 다양성 보강) --------------------------------------

// 14. 바다거북 (sea turtle) — 얕은 바다, 둥근 등갑(마디무늬)+지느러미형 앞발
function drawSeaTurtle(ctx, x, y, t, s) {
  const flap = Math.sin(t * 1.6) * 0.35;
  ctx.save();
  ctx.translate(x, y);
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#3e8f6b';
  // 앞지느러미 (퍼덕임)
  ctx.save(); ctx.rotate(flap);
  ctx.beginPath(); ctx.ellipse(-13 * s, 2 * s, 9 * s, 4 * s, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.rotate(-flap);
  ctx.beginPath(); ctx.ellipse(13 * s, 2 * s, 9 * s, 4 * s, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#5cae7e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 15 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(3 * s, 3 * s, 12 * s, 8 * s, 0, 0, Math.PI * 2); }, 0.22);
  // 등갑 마디
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail;
  ctx.beginPath();
  ctx.moveTo(0, -10 * s); ctx.lineTo(0, 10 * s);
  ctx.moveTo(-8 * s, -4 * s); ctx.lineTo(8 * s, -4 * s);
  ctx.moveTo(-9 * s, 4 * s); ctx.lineTo(9 * s, 4 * s);
  ctx.stroke();
  // 머리
  ctx.fillStyle = '#5cae7e';
  outline(ctx, STROKE.part * s);
  ctx.beginPath(); ctx.ellipse(16 * s, -1 * s, 5 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  eye(ctx, 18 * s, -2 * s, 1.4 * s);
  ctx.restore();
}

// 15. 범고래 (orca) — 얕은 바다, 흑백 안장무늬, 큰 등지느러미
function drawOrca(ctx, x, y, t, s) {
  const sway = Math.sin(t * 1.4) * 3;
  ctx.save();
  ctx.translate(x, y + sway);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#20242c';
  ctx.beginPath();
  ctx.moveTo(-26 * s, 2 * s);
  ctx.quadraticCurveTo(-8 * s, -14 * s, 22 * s, -2 * s);
  ctx.quadraticCurveTo(28 * s, 2 * s, 22 * s, 5 * s);
  ctx.quadraticCurveTo(-8 * s, 14 * s, -26 * s, 2 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 흰 배/눈점 무늬
  ctx.fillStyle = '#eef2f5';
  ctx.beginPath();
  ctx.ellipse(-2 * s, 6 * s, 15 * s, 6 * s, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath(); ctx.ellipse(16 * s, -3 * s, 3 * s, 1.6 * s, -0.3, 0, Math.PI * 2); ctx.fill();
  // 안장무늬
  ctx.fillStyle = '#3c4552';
  ctx.beginPath();
  ctx.ellipse(2 * s, -6 * s, 8 * s, 4 * s, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // 등지느러미
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#20242c';
  ctx.beginPath();
  ctx.moveTo(-4 * s, -8 * s); ctx.lineTo(2 * s, -26 * s); ctx.lineTo(8 * s, -7 * s); ctx.closePath();
  ctx.fill(); ctx.stroke();
  eye(ctx, 17 * s, -3 * s, 1.6 * s);
  ctx.restore();
}

// 16. 날치 (flying fish) — 얕은 바다, 큰 날개형 가슴지느러미
function drawFlyingFish(ctx, x, y, t, s) {
  const glide = Math.sin(t * 2.4) * 2;
  ctx.save();
  ctx.translate(x, y + glide);
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = 'rgba(150, 190, 220, 0.75)';
  // 날개형 지느러미
  ctx.beginPath();
  ctx.moveTo(2 * s, -1 * s);
  ctx.quadraticCurveTo(-6 * s, -18 * s, -20 * s, -14 * s);
  ctx.quadraticCurveTo(-8 * s, -4 * s, -2 * s, 2 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2 * s, 1 * s);
  ctx.quadraticCurveTo(-6 * s, 18 * s, -20 * s, 14 * s);
  ctx.quadraticCurveTo(-8 * s, 4 * s, -2 * s, -2 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#4a7fb5';
  ctx.beginPath();
  ctx.ellipse(4 * s, 0, 15 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-11 * s, 0); ctx.lineTo(-19 * s, -6 * s); ctx.lineTo(-19 * s, 6 * s); ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 6 * s, 3 * s, 11 * s, 3.5 * s), 0.22);
  eye(ctx, 13 * s, -1 * s, 1.8 * s);
  ctx.restore();
}

// 17. 블루탱 (blue tang) — 얕은 바다, 밝은 파랑 원반형 몸+검은 무늬
function drawBlueTang(ctx, x, y, t, s) {
  const sway = Math.sin(t * 3.2) * 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway * 0.02);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#3aa0e0';
  ctx.beginPath();
  ctx.ellipse(0, 0, 13 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-11 * s, 0); ctx.lineTo(-19 * s, -8 * s); ctx.lineTo(-19 * s, 8 * s); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 검은 무늬 (팔레트 서전피시 특유의 곡선 밴드)
  ctx.strokeStyle = '#16233B'; ctx.lineWidth = 3.4 * s; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(9 * s, -9 * s);
  ctx.quadraticCurveTo(-2 * s, 0, 9 * s, 9 * s);
  ctx.stroke();
  ctx.fillStyle = '#f2c744';
  ctx.beginPath(); ctx.moveTo(-11 * s, 0); ctx.lineTo(-19 * s, -8 * s); ctx.lineTo(-19 * s, 8 * s); ctx.closePath(); ctx.fill();
  outline(ctx, STROKE.detail * s);
  shade(ctx, () => ellipsePath(ctx, 3 * s, 4 * s, 10 * s, 7 * s), 0.2);
  eye(ctx, 8 * s, -3 * s, 2.2 * s);
  ctx.restore();
}

// 18. 꽃게 (crab) — 얕은 바다, 넓은 갑각+큰 집게발
function drawCrab(ctx, x, y, t, s) {
  const pinch = Math.sin(t * 3) * 0.15;
  ctx.save();
  ctx.translate(x, y);
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#d9622f';
  // 집게발
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(dir * 15 * s, -2 * s);
    ctx.rotate(dir * (0.3 + pinch));
    ctx.beginPath();
    ctx.ellipse(0, 0, 7 * s, 4.5 * s, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // 다리
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail * s;
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    ctx.beginPath();
    ctx.moveTo(i * 5 * s, 6 * s);
    ctx.lineTo(i * 6.5 * s, 14 * s + Math.sin(t * 3 + i) * 1.5 * s);
    ctx.stroke();
  }
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#e8763e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 14 * s, 9 * s, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 3 * s, 11 * s, 5 * s), 0.24);
  eye(ctx, 5 * s, -6 * s, 1.6 * s);
  eye(ctx, -5 * s, -6 * s, 1.6 * s);
  ctx.restore();
}

// 19. 도끼고기 (hatchetfish) — 트와일라잇, 납작한 도끼 모양, 은빛 발광
function drawHatchetfish(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  glow(ctx, 0, 4 * s, 12 * s, '#9fd8ff', 0.4);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#a8bfd6';
  ctx.beginPath();
  ctx.moveTo(-4 * s, -12 * s);
  ctx.quadraticCurveTo(10 * s, -10 * s, 14 * s, 0);
  ctx.quadraticCurveTo(4 * s, 6 * s, -12 * s, 4 * s);
  ctx.quadraticCurveTo(-14 * s, -6 * s, -4 * s, -12 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 0, 2 * s, 10 * s, 4 * s), 0.22);
  ctx.fillStyle = '#dff1ff';
  for (const dx of [-6, -1, 4]) { ctx.beginPath(); ctx.arc(dx * s, 3 * s, 1 * s, 0, Math.PI * 2); ctx.fill(); }
  eye(ctx, 4 * s, -6 * s, 3 * s, { glow: '#bfe8ff' });
  ctx.restore();
}

// 20. 키다리게 (stilt / yeti-type crab) — 트와일라잇, 길고 가는 다리
function drawStiltCrab(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part * s; ctx.lineCap = 'round';
  ctx.fillStyle = '#d4b3cc';
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const legLen = 20 * s;
    const ang = i * 0.32;
    const kneeX = Math.sin(ang) * legLen * 0.55;
    const kneeY = legLen * 0.5 + Math.cos(t + i) * 1.5 * s;
    const footX = Math.sin(ang) * legLen;
    const footY = Math.cos(t + i) * 2 * s + legLen * 0.85;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    // 발끝 작은 집게
    ctx.beginPath();
    ctx.moveTo(footX, footY);
    ctx.lineTo(footX + Math.sign(footX || 1) * 2.5 * s, footY + 2.5 * s);
    ctx.stroke();
  }
  // 작은 앞집게발
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail * s;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(dir * 2 * s, 2 * s);
    ctx.lineTo(dir * 6 * s, 8 * s);
    ctx.stroke();
    ctx.fillStyle = '#d4b3cc';
    ctx.beginPath(); ctx.ellipse(dir * 6.5 * s, 9 * s, 2 * s, 1.3 * s, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#d4b3cc';
  ctx.beginPath();
  ctx.ellipse(0, -2 * s, 7 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 1 * s, 0, 5 * s, 3 * s), 0.24);
  // 등딱지 무늬선
  ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = STROKE.detail * s;
  ctx.beginPath(); ctx.moveTo(-4 * s, -3 * s); ctx.lineTo(4 * s, -3 * s); ctx.stroke();
  eye(ctx, 3 * s, -4 * s, 1.3 * s);
  eye(ctx, -3 * s, -4 * s, 1.3 * s);
  ctx.restore();
}

// 21. 투명새우 (glass shrimp) — 트와일라잇, 반투명 몸+마디
function drawGlassShrimp(ctx, x, y, t, s) {
  const curl = Math.sin(t * 3) * 0.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(curl);
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = 'rgba(200, 225, 235, 0.5)';
  ctx.beginPath();
  ctx.moveTo(-14 * s, 0);
  ctx.quadraticCurveTo(-4 * s, -8 * s, 10 * s, -4 * s);
  ctx.quadraticCurveTo(4 * s, 4 * s, -14 * s, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(180,210,225,0.8)'; ctx.lineWidth = STROKE.detail * s;
  for (let i = -1; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(-2 * s + i * 4 * s, -3 * s); ctx.lineTo(-4 * s + i * 4 * s, 2 * s); ctx.stroke();
  }
  // 작은 유영각 (마디 아래 다리)
  ctx.strokeStyle = 'rgba(160,195,215,0.9)'; ctx.lineWidth = 0.8 * s;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.moveTo(i * 4 * s, 0); ctx.lineTo(i * 4 * s - 1 * s, 4 * s); ctx.stroke();
  }
  // 꼬리 부채
  ctx.fillStyle = 'rgba(190, 220, 232, 0.55)';
  ctx.beginPath();
  ctx.moveTo(-14 * s, 0); ctx.lineTo(-21 * s, -4 * s); ctx.lineTo(-18 * s, 0); ctx.lineTo(-21 * s, 4 * s);
  ctx.closePath();
  outline(ctx, STROKE.detail * s); ctx.fill(); ctx.stroke();
  // 더듬이 (긴 촉수 두 가닥)
  ctx.strokeStyle = 'rgba(170,205,222,0.85)'; ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  ctx.moveTo(10 * s, -4 * s);
  ctx.quadraticCurveTo(18 * s, -8 * s, 24 * s, -5 * s + Math.sin(t * 2) * 2 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10 * s, -4 * s);
  ctx.quadraticCurveTo(16 * s, -2 * s, 22 * s, 1 * s + Math.sin(t * 2 + 1) * 2 * s);
  ctx.stroke();
  eye(ctx, 8 * s, -5 * s, 1.6 * s);
  ctx.restore();
}

// 22. 미즈우오 (barreleye) — 트와일라잇, 투명 돔 머리+위를 향한 통형 눈
function drawBarreleye(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#8fa8bf';
  ctx.beginPath();
  ctx.ellipse(0, 4 * s, 13 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // 투명 돔
  ctx.fillStyle = 'rgba(210, 235, 250, 0.55)';
  ctx.beginPath();
  ctx.arc(0, -2 * s, 10 * s, Math.PI, 0);
  ctx.closePath();
  outline(ctx, STROKE.part * s);
  ctx.fill(); ctx.stroke();
  // 통형 눈 (위를 향함)
  ctx.fillStyle = '#2fae6a';
  for (const dx of [-4, 4]) {
    ctx.beginPath(); ctx.ellipse(dx * s, -3 * s, 2.4 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
    outline(ctx, STROKE.detail * s); ctx.stroke();
  }
  shade(ctx, () => ellipsePath(ctx, 2 * s, 6 * s, 10 * s, 4 * s), 0.22);
  ctx.restore();
}

// 23. 블롭피쉬 (blobfish) — 심해, 축 처진 젤리질 몸+시무룩한 표정
function drawBlobfish(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#d69a9a';
  ctx.beginPath();
  ctx.moveTo(-14 * s, 2 * s);
  ctx.quadraticCurveTo(-16 * s, -10 * s, -2 * s, -12 * s);
  ctx.quadraticCurveTo(12 * s, -12 * s, 15 * s, 0);
  ctx.quadraticCurveTo(16 * s, 10 * s, 4 * s, 12 * s);
  ctx.quadraticCurveTo(-10 * s, 13 * s, -14 * s, 2 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(2 * s, 6 * s, 12 * s, 6 * s, 0, 0, Math.PI * 2); }, 0.26);
  // 처진 코 (특유의 실루엣)
  ctx.fillStyle = '#d69a9a';
  ctx.beginPath();
  ctx.ellipse(6 * s, 2 * s, 5 * s, 4 * s, 0.3, 0, Math.PI * 2);
  outline(ctx, STROKE.part * s); ctx.fill(); ctx.stroke();
  eye(ctx, -2 * s, -5 * s, 2.2 * s, { open: false });
  eye(ctx, -8 * s, -5 * s, 2.2 * s, { open: false });
  ctx.restore();
}

// 24. 심해드래곤피쉬 (deep-sea dragonfish) — 심해, 턱밑 발광 수염 + 날카로운 이빨
function drawDragonfish(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  const barbelSway = Math.sin(t * 1.8) * 3 * s;
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#1c1f30';
  ctx.beginPath();
  ctx.moveTo(-22 * s, 0);
  ctx.quadraticCurveTo(-4 * s, -7 * s, 16 * s, -1 * s);
  ctx.quadraticCurveTo(-4 * s, 7 * s, -22 * s, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, -3 * s, 3 * s, 14 * s, 3.5 * s), 0.28);
  // 턱밑 발광 수염
  outline(ctx, STROKE.detail * s);
  ctx.beginPath();
  ctx.moveTo(8 * s, 3 * s);
  ctx.quadraticCurveTo(10 * s + barbelSway, 14 * s, 9 * s + barbelSway, 22 * s);
  ctx.stroke();
  glow(ctx, 9 * s + barbelSway, 22 * s, 8 * s, '#ffb066', 0.6);
  ctx.fillStyle = '#ffb066';
  ctx.beginPath(); ctx.arc(9 * s + barbelSway, 22 * s, 2.4 * s, 0, Math.PI * 2); ctx.fill();
  // 이빨
  ctx.strokeStyle = '#e8eef5'; ctx.lineWidth = 1.2 * s;
  for (const dx of [8, 11, 14]) { ctx.beginPath(); ctx.moveTo(dx * s, -1 * s); ctx.lineTo(dx * s + 1.6 * s, 3 * s); ctx.stroke(); }
  eye(ctx, 6 * s, -3 * s, 1.8 * s, { glow: '#ffb066' });
  ctx.restore();
}

// 25. 유령문어 (ghost octopus) — 심해, 창백한 반투명 몸+웹형 다리
function drawGhostOctopus(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  glow(ctx, 0, 0, 10 * s, '#dfe8f0', 0.2);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = 'rgba(225, 232, 240, 0.85)';
  ellipsePath(ctx, 0, -4 * s, 14 * s, 11 * s);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 3 * s, 0, 11 * s, 7 * s), 0.16);
  // 웹으로 이어진 다리 (막 형태)
  ctx.fillStyle = 'rgba(225, 232, 240, 0.7)';
  outline(ctx, STROKE.part * s);
  ctx.beginPath();
  ctx.moveTo(-13 * s, 4 * s);
  for (let i = -3; i <= 3; i++) {
    const lx = i * 4.2 * s;
    const ly = 20 * s + Math.sin(t * 1.2 + i) * 3 * s;
    ctx.quadraticCurveTo(lx - 2 * s, 14 * s, lx, ly);
  }
  ctx.lineTo(13 * s, 4 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  eye(ctx, 5 * s, -6 * s, 2.4 * s);
  eye(ctx, -5 * s, -6 * s, 2.4 * s);
  ctx.restore();
}

// 26. 열수유황게 (hydrothermal / yeti crab) — 열수구, 하얗고 털 많은 집게발
function drawYetiCrab(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail * s;
  ctx.fillStyle = '#e8e2d4';
  // 털 많은 집게발
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(dir * 14 * s, 0);
    ctx.rotate(dir * 0.25);
    ctx.beginPath(); ctx.ellipse(0, 0, 8 * s, 5 * s, 0, 0, Math.PI * 2);
    outline(ctx, STROKE.part * s); ctx.fill(); ctx.stroke();
    // 털 텍스처
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * 2.5 * s, -3 * s); ctx.lineTo(i * 2.5 * s + dir, -6 * s); ctx.stroke();
    }
    ctx.restore();
  }
  outline(ctx, STROKE.silhouette * s);
  ctx.beginPath();
  ctx.ellipse(0, 0, 10 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 1 * s, 2 * s, 8 * s, 4 * s), 0.22);
  eye(ctx, 3 * s, -4 * s, 1.2 * s, { open: false });
  eye(ctx, -3 * s, -4 * s, 1.2 * s, { open: false });
  ctx.restore();
}

// 27. 민들레해파리 (dandelion jellyfish) — 열수구, 작은 갓+가늘게 방사하는 촉수
function drawDandelionJelly(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  glow(ctx, 0, 0, 20 * s, '#ffd9a0', 0.3);
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = 'rgba(255, 220, 180, 0.6)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7 * s, 5 * s, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 210, 160, 0.75)';
  ctx.lineWidth = STROKE.detail * s;
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI * 2 * i) / 10 + Math.sin(t + i) * 0.15;
    const len = 12 * s + Math.sin(t * 1.5 + i) * 2 * s;
    ctx.beginPath();
    ctx.moveTo(0, 1 * s);
    ctx.lineTo(Math.cos(ang) * len, 1 * s + Math.abs(Math.sin(ang)) * len * 0.6 + len * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

// 28. 스케일풋 고둥 (scaly-foot snail) — 열수구, 나선 껍질+철빛 비늘
function drawScalyfootSnail(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  glow(ctx, 6 * s, -4 * s, 10 * s, '#ff9d5c', 0.18);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#4a3d33';
  ctx.beginPath();
  ctx.ellipse(2 * s, 4 * s, 12 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 4 * s, 6 * s, 9 * s, 3.5 * s), 0.26);
  // 발 비늘 텍스처 (여러 줄, 철빛 광택 포인트 포함)
  for (let row = -1; row <= 1; row++) {
    for (let i = -2; i <= 2; i++) {
      const sx = i * 4 * s + 2 * s + row * 1.5 * s;
      const sy = (6 + row * 2.4) * s;
      ctx.fillStyle = '#6b5a48';
      ctx.beginPath(); ctx.arc(sx, sy, 1.4 * s, 0, Math.PI * 2); ctx.fill();
      outline(ctx, STROKE.detail * s * 0.7); ctx.stroke();
      ctx.fillStyle = 'rgba(220,200,170,0.5)';
      ctx.beginPath(); ctx.arc(sx - 0.4 * s, sy - 0.4 * s, 0.5 * s, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 나선 껍질
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#332920';
  ctx.beginPath();
  ctx.arc(-2 * s, -2 * s, 9 * s, 0.4, Math.PI * 1.6);
  ctx.arc(1 * s, -1 * s, 5 * s, Math.PI * 1.3, 0.2, true);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = rgba(INK, 0.4); ctx.lineWidth = STROKE.detail * s;
  ctx.beginPath(); ctx.arc(-2 * s, -2 * s, 5.5 * s, 0.4, Math.PI * 1.4); ctx.stroke();
  // 철빛 금속 광택 하이라이트 (호 형태로 곡면을 따라)
  ctx.strokeStyle = 'rgba(255, 205, 150, 0.55)'; ctx.lineWidth = STROKE.detail * s * 0.8;
  ctx.beginPath(); ctx.arc(-2 * s, -2 * s, 8 * s, 0.9, 1.7); ctx.stroke();
  // 더듬이 (눈자루)
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail * s;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(11 * s, 1 * s);
    ctx.lineTo(13 * s + dir * 1.5 * s, -3 * s + Math.sin(t + dir) * 0.8 * s);
    ctx.stroke();
    ctx.fillStyle = '#5c4c3d';
    ctx.beginPath(); ctx.arc(13 * s + dir * 1.5 * s, -3 * s + Math.sin(t + dir) * 0.8 * s, 0.9 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
export const SPECIES = [
  // 얕은 바다 (8종)
  { id: 'clownfish', name: '흰동가리', zone: 'shallow', weight: 5, size: 1.0, swayAmp: 10, swayPeriod: 2.2, glowing: false, draw: drawClownfish },
  { id: 'reefshark', name: '리프상어', zone: 'shallow', weight: 3, size: 1.5, swayAmp: 6, swayPeriod: 3.0, glowing: false, draw: drawReefShark },
  { id: 'morayeel', name: '곰치', zone: 'shallow', weight: 3, size: 1.1, swayAmp: 4, swayPeriod: 2.6, glowing: false, draw: drawMorayEel },
  { id: 'seaturtle', name: '바다거북', zone: 'shallow', weight: 3, size: 1.4, swayAmp: 5, swayPeriod: 3.4, glowing: false, draw: drawSeaTurtle },
  { id: 'orca', name: '범고래', zone: 'shallow', weight: 2, size: 1.7, swayAmp: 5, swayPeriod: 3.2, glowing: false, draw: drawOrca },
  { id: 'flyingfish', name: '날치', zone: 'shallow', weight: 4, size: 0.9, swayAmp: 9, swayPeriod: 1.6, glowing: false, draw: drawFlyingFish },
  { id: 'bluetang', name: '블루탱', zone: 'shallow', weight: 4, size: 0.9, swayAmp: 8, swayPeriod: 2.0, glowing: false, draw: drawBlueTang },
  { id: 'crab', name: '꽃게', zone: 'shallow', weight: 3, size: 1.0, swayAmp: 2, swayPeriod: 4.0, glowing: false, draw: drawCrab },

  // 트와일라잇존 (7종)
  { id: 'moonjelly', name: '문라이트 젤리', zone: 'twilight', weight: 4, size: 1.2, swayAmp: 14, swayPeriod: 3.4, glowing: true, draw: drawMoonJelly },
  { id: 'lanternfish', name: '랜턴피시', zone: 'twilight', weight: 5, size: 0.9, swayAmp: 8, swayPeriod: 1.8, glowing: true, draw: drawLanternfish },
  { id: 'viperfish', name: '바이퍼피시', zone: 'twilight', weight: 3, size: 1.2, swayAmp: 6, swayPeriod: 2.4, glowing: true, draw: drawViperfish },
  { id: 'hatchetfish', name: '도끼고기', zone: 'twilight', weight: 4, size: 0.8, swayAmp: 7, swayPeriod: 1.7, glowing: true, draw: drawHatchetfish },
  { id: 'stiltcrab', name: '키다리게', zone: 'twilight', weight: 2, size: 1.1, swayAmp: 2, swayPeriod: 4.2, glowing: false, draw: drawStiltCrab },
  { id: 'glassshrimp', name: '투명새우', zone: 'twilight', weight: 3, size: 0.9, swayAmp: 6, swayPeriod: 2.1, glowing: false, draw: drawGlassShrimp },
  { id: 'barreleye', name: '미즈우오', zone: 'twilight', weight: 2, size: 1.1, swayAmp: 4, swayPeriod: 3.0, glowing: false, draw: drawBarreleye },

  // 심해 (6종)
  { id: 'anglerfish', name: '어비스 앵글러', zone: 'deepsea', weight: 4, size: 1.3, swayAmp: 5, swayPeriod: 3.2, glowing: true, draw: drawAnglerfish },
  { id: 'deepoctopus', name: '심해문어', zone: 'deepsea', weight: 4, size: 1.4, swayAmp: 7, swayPeriod: 2.8, glowing: false, draw: drawDeepOctopus },
  { id: 'pelicaneel', name: '펠리컨장어', zone: 'deepsea', weight: 3, size: 1.5, swayAmp: 5, swayPeriod: 2.4, glowing: true, draw: drawPelicanEel },
  { id: 'blobfish', name: '블롭피쉬', zone: 'deepsea', weight: 3, size: 1.2, swayAmp: 3, swayPeriod: 3.8, glowing: false, draw: drawBlobfish },
  { id: 'dragonfish', name: '심해드래곤피쉬', zone: 'deepsea', weight: 3, size: 1.2, swayAmp: 5, swayPeriod: 2.6, glowing: true, draw: drawDragonfish },
  { id: 'ghostoctopus', name: '유령문어', zone: 'deepsea', weight: 2, size: 1.3, swayAmp: 4, swayPeriod: 3.0, glowing: false, draw: drawGhostOctopus },

  // 열수구 (7종)
  { id: 'vampiresquid', name: '흡혈오징어', zone: 'vent', weight: 4, size: 1.2, swayAmp: 8, swayPeriod: 2.6, glowing: true, draw: drawVampireSquid },
  { id: 'giantisopod', name: '대왕등각류', zone: 'vent', weight: 4, size: 1.3, swayAmp: 3, swayPeriod: 3.6, glowing: false, draw: drawGiantIsopod },
  { id: 'tubeworms', name: '관벌레군집', zone: 'vent', weight: 3, size: 1.4, swayAmp: 1.5, swayPeriod: 4.5, glowing: false, draw: drawTubeWorms },
  { id: 'dumbooctopus', name: '덤보문어', zone: 'vent', weight: 1, size: 1.3, swayAmp: 9, swayPeriod: 2.2, glowing: true, draw: drawDumboOctopus },
  { id: 'yeticrab', name: '열수유황게', zone: 'vent', weight: 3, size: 1.0, swayAmp: 2, swayPeriod: 3.8, glowing: false, draw: drawYetiCrab },
  { id: 'dandelionjelly', name: '민들레해파리', zone: 'vent', weight: 2, size: 1.1, swayAmp: 6, swayPeriod: 3.2, glowing: true, draw: drawDandelionJelly },
  { id: 'scalyfootsnail', name: '스케일풋 고둥', zone: 'vent', weight: 2, size: 1.0, swayAmp: 1, swayPeriod: 5.0, glowing: false, draw: drawScalyfootSnail },
];

export function speciesPoolForZone(zoneId) {
  return SPECIES.filter(sp => sp.zone === zoneId);
}

export function speciesById(id) {
  return SPECIES.find(sp => sp.id === id);
}

// 구역별 가중치 스폰 + "골고루 등장" 보정
// - 오래 안 나온 종일수록 실제 뽑힐 확률이 급격히 올라가 30~60초 내 최소 1회 등장을 보장
// - 방금 나온 종은 크게 억제해 같은 종 연속 반복을 방지
export function pickSpeciesForZone(zoneId, lastSpawnAt, lastSpeciesId, timeSec) {
  const pool = speciesPoolForZone(zoneId);
  if (pool.length === 0) return null;
  const entries = pool.map(sp => {
    const last = lastSpawnAt[sp.id] ?? -999;
    const elapsed = timeSec - last;
    // 20초마다 1배씩 긴급도가 붙고 최대 8배까지 — 희귀종(가중치1)도 결국 뽑히도록
    const urgency = Math.min(elapsed / 20, 8);
    let w = sp.weight * (1 + urgency);
    if (pool.length > 1 && sp.id === lastSpeciesId) w *= 0.12;
    return { weight: Math.max(w, 0.0001), sp };
  });
  return weightedPick(entries).sp;
}
