// boat.js — 다이빙 보트 + 수면 장면 드로잉 (인트로/아웃트로 연출용).
// 이미지 없이 Canvas 2D, 기존 스타일가이드 준수: 잉크 남색 외곽선, 3단 위계, 셀셰이딩.

import { CANVAS_W, INK, STROKE, shade, hilite, rgba, glow } from './utils.js';

function outline(ctx, w) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

// ---------------------------------------------------------------------------
// 다이빙 보트 (측면, 왼쪽을 바라봄). style: 'small'(열대 다이빙 보트) | 'research'(연구선/모선)
// (x, y)는 수면 위 흘수선 중앙 기준. bob(둥실거림)은 호출측에서 y로 넣는다.
export function drawBoat(ctx, x, y, t, style = 'small') {
  const research = style === 'research';
  const S = research ? 1.35 : 1;
  ctx.save();
  ctx.translate(x, y);

  // 선체 그림자(수면 반사 어른거림)
  ctx.fillStyle = 'rgba(10,24,40,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 6 * S, 52 * S, 5 * S, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- 선체 ----
  outline(ctx, STROKE.silhouette);
  ctx.fillStyle = research ? '#D8DEE6' : '#F4F0E4';
  ctx.beginPath();
  ctx.moveTo(-52 * S, -2 * S);                      // 선미 상단
  ctx.lineTo(38 * S, -2 * S);                       // 갑판선
  ctx.quadraticCurveTo(52 * S, -4 * S, 56 * S, -14 * S); // 이물(뱃머리) 위로 솟음
  ctx.lineTo(48 * S, -2 * S);
  ctx.quadraticCurveTo(50 * S, 6 * S, 40 * S, 9 * S);
  ctx.lineTo(-44 * S, 9 * S);                       // 바닥
  ctx.quadraticCurveTo(-52 * S, 8 * S, -52 * S, -2 * S);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 흘수선 스트라이프
  ctx.fillStyle = research ? '#C0503C' : '#2FA8B8';
  ctx.beginPath();
  ctx.moveTo(-51 * S, 3 * S); ctx.lineTo(47 * S, 3 * S);
  ctx.lineTo(45 * S, 7 * S); ctx.lineTo(-46 * S, 7 * S);
  ctx.closePath(); ctx.fill();
  shade(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-44 * S, 6 * S); ctx.lineTo(40 * S, 6 * S);
    ctx.lineTo(40 * S, 9 * S); ctx.lineTo(-44 * S, 9 * S);
    ctx.closePath();
  }, 0.18);
  // 현창(둥근 창)
  ctx.fillStyle = '#9FD8E8';
  for (let i = 0; i < (research ? 4 : 3); i++) {
    const px = (-30 + i * 22) * S;
    ctx.beginPath(); ctx.arc(px, 0.5 * S, 2.6 * S, 0, Math.PI * 2); ctx.fill();
    outline(ctx, STROKE.detail); ctx.stroke();
  }

  // ---- 조타실 ----
  outline(ctx, STROKE.part);
  ctx.fillStyle = research ? '#EAEEF2' : '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(-6 * S, -26 * S, 34 * S, 24 * S, 3 * S);
  ctx.fill(); ctx.stroke();
  // 창문 (파란 밴드)
  ctx.fillStyle = '#8FD4E8';
  ctx.beginPath();
  ctx.roundRect(-2 * S, -22 * S, 26 * S, 8 * S, 2 * S);
  ctx.fill();
  outline(ctx, STROKE.detail); ctx.stroke();
  hilite(ctx, () => { ctx.beginPath(); ctx.roundRect(0, -21 * S, 8 * S, 3 * S, 1.5 * S); }, 0.7);
  // 지붕 + 안테나/깃발
  ctx.fillStyle = research ? '#C0503C' : '#2FA8B8';
  ctx.beginPath();
  ctx.roundRect(-8 * S, -30 * S, 38 * S, 5 * S, 2 * S);
  ctx.fill();
  outline(ctx, STROKE.part); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail;
  ctx.beginPath(); ctx.moveTo(2 * S, -30 * S); ctx.lineTo(2 * S, -42 * S); ctx.stroke();
  ctx.fillStyle = '#E8534A';
  ctx.beginPath();
  ctx.moveTo(2 * S, -42 * S);
  ctx.lineTo(12 * S, -39.5 * S + Math.sin(t * 5) * 0.8);
  ctx.lineTo(2 * S, -37 * S);
  ctx.closePath(); ctx.fill();
  outline(ctx, STROKE.detail); ctx.stroke();

  // ---- 다이빙 플랫폼(선미) + 사다리 ----
  outline(ctx, STROKE.part);
  ctx.fillStyle = '#C9B98E';
  ctx.beginPath();
  ctx.roundRect(-64 * S, -3 * S, 14 * S, 4 * S, 1.5 * S);
  ctx.fill(); ctx.stroke();
  // 사다리 (물속으로)
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail * 1.1;
  ctx.beginPath(); ctx.moveTo(-62 * S, 1 * S); ctx.lineTo(-62 * S, 14 * S); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-56 * S, 1 * S); ctx.lineTo(-56 * S, 14 * S); ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(-62 * S, (4 + i * 4) * S); ctx.lineTo(-56 * S, (4 + i * 4) * S); ctx.stroke();
  }

  // ---- 난간 ----
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail;
  ctx.beginPath(); ctx.moveTo(-50 * S, -2 * S); ctx.lineTo(-50 * S, -9 * S); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-30 * S, -2 * S); ctx.lineTo(-30 * S, -9 * S); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10 * S, -2 * S); ctx.lineTo(-10 * S, -9 * S); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-52 * S, -9 * S); ctx.lineTo(-8 * S, -9 * S); ctx.stroke();

  // ---- 연구선 전용: 크레인 + 컨테이너 (해구 스팟의 스케일감) ----
  if (research) {
    // 컨테이너
    ctx.fillStyle = '#D9762A';
    outline(ctx, STROKE.part);
    ctx.beginPath();
    ctx.roundRect(-46 * S, -14 * S, 22 * S, 12 * S, 1.5 * S);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = rgba(INK, 0.4); ctx.lineWidth = STROKE.detail;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((-46 + i * 5.5) * S, -14 * S);
      ctx.lineTo((-46 + i * 5.5) * S, -2 * S);
      ctx.stroke();
    }
    // 크레인 (A자 프레임 + 와이어 + 훅)
    ctx.strokeStyle = '#8A6416'; ctx.lineWidth = STROKE.part * 1.2;
    ctx.beginPath(); ctx.moveTo(-18 * S, -2 * S); ctx.lineTo(-34 * S, -34 * S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-26 * S, -2 * S); ctx.lineTo(-34 * S, -34 * S); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail;
    ctx.beginPath(); ctx.moveTo(-34 * S, -34 * S); ctx.lineTo(-52 * S, -20 * S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-52 * S, -20 * S); ctx.lineTo(-52 * S, -8 * S + Math.sin(t * 1.8) * 1.5); ctx.stroke();
    ctx.fillStyle = '#8A6416';
    ctx.beginPath(); ctx.arc(-52 * S, -6 * S + Math.sin(t * 1.8) * 1.5, 2.2 * S, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 수면 장면: 하늘 + 구름 + 태양 + 물결 라인. waterY = 수면의 화면 y.
// 아래(물속)는 기존 게임 배경이 그려져 있다고 가정하고 그 위에 겹친다.
export function drawSurfaceScene(ctx, waterY, t) {
  if (waterY < -80) return;
  ctx.save();

  // 하늘 (수면 위) — 수면이 화면 상단 1/3쯤에 있을 때 하늘이 다 보이도록 폭을 좁게 잡는다
  // (예전엔 400px라 파란 부분·태양·구름이 전부 화면 밖이었음)
  const skyTop = waterY - 300;
  const sky = ctx.createLinearGradient(0, skyTop, 0, waterY);
  sky.addColorStop(0, '#6FC6EA');
  sky.addColorStop(0.55, '#A9E2F5');
  sky.addColorStop(1, '#E9F8FF');
  ctx.fillStyle = sky;
  ctx.fillRect(0, skyTop, CANVAS_W, waterY - skyTop);

  // 태양 + 글로우
  glow(ctx, CANVAS_W * 0.18, waterY - 152, 44, '#FFF3C0', 0.5);
  ctx.fillStyle = '#FFEFA8';
  ctx.beginPath(); ctx.arc(CANVAS_W * 0.18, waterY - 152, 18, 0, Math.PI * 2); ctx.fill();

  // 구름 퍼프 (느리게 흐름)
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const drift = (t * 4) % (CANVAS_W + 160) - 80;
  for (const [ox, oy, s] of [[drift, -178, 1], [((drift + 200) % (CANVAS_W + 160)) - 80, -118, 0.7]]) {
    ctx.beginPath();
    ctx.ellipse(ox, waterY + oy, 34 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(ox + 22 * s, waterY + oy + 3 * s, 24 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(ox - 24 * s, waterY + oy + 4 * s, 20 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 물결 라인 (수면 경계) — sin 물결 + 흰 포말 하이라이트
  ctx.beginPath();
  ctx.moveTo(-10, waterY);
  for (let x = -10; x <= CANVAS_W + 10; x += 8) {
    ctx.lineTo(x, waterY + Math.sin(x * 0.06 + t * 2.4) * 2.4 + Math.sin(x * 0.13 - t * 1.7) * 1.2);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(210,245,255,0.5)';
  ctx.lineWidth = 5;
  ctx.stroke();

  // 수면 바로 아래 밝은 굴절 밴드 (물속에서 올려다본 스넬창 느낌)
  const refr = ctx.createLinearGradient(0, waterY, 0, waterY + 90);
  refr.addColorStop(0, 'rgba(230,250,255,0.5)');
  refr.addColorStop(1, 'rgba(230,250,255,0)');
  ctx.fillStyle = refr;
  ctx.fillRect(0, waterY, CANVAS_W, 90);

  ctx.restore();
}

// 상승 마지막 구간(수심 30m 이하): 위쪽에 수면이 서서히 밝아오는 신호
export function drawSurfaceApproach(ctx, depthM, t) {
  if (depthM > 30) return;
  const k = 1 - depthM / 30; // 0→1
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, 170 * (0.5 + k * 0.5));
  g.addColorStop(0, `rgba(210,245,255,${0.38 * k})`);
  g.addColorStop(1, 'rgba(210,245,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, 170);
  // 일렁이는 수면 밑면 라인 (가까워질수록 또렷)
  if (k > 0.35) {
    ctx.strokeStyle = `rgba(255,255,255,${(k - 0.35) * 0.55})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = -10; x <= CANVAS_W + 10; x += 8) {
      const y = 12 + Math.sin(x * 0.07 + t * 2.2) * 3;
      if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// 스팟 → 배 스타일 (해구급 깊이는 연구선/모선)
export function boatStyleForSite(site) {
  return site && site.targetDepth > 700 ? 'research' : 'small';
}

// 다이버가 서고/오르내리는 지점 — drawBoat의 실제 도형에서 유도한다.
// (연구선은 1.35배라 하드코딩하면 다이버가 크레인 앞에 붕 떠서 서게 된다)
// 반환값은 (BOAT_X, surfaceY) 기준 오프셋. 배 원점 y = surfaceY - 4 + bob.
export function boatAnchors(style) {
  const S = style === 'research' ? 1.35 : 1;
  return {
    S,
    deckX: -57 * S,        // 다이빙 플랫폼 중앙 (선미)
    ladderX: -59 * S,      // 사다리 중앙
    deckY: -(28 + 3 * S),  // 플랫폼 위에 발이 닿는 다이버 원점 y
    entryX: -57 * S - 14,  // 백롤로 굴러 떨어지는 착수 지점
  };
}
