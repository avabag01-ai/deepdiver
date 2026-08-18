// species.js — 생물 28종 정의 + 구역별 가중치 스폰 풀
// 각 생물: 심해생물학 브리프 기준 실루엣·색상·동작·과장 포인트를 반영해 부위별 레이어로 그린다.
// sway 카테고리: 뱀형(S자 웨이브) / 원반형(펄스) / 갑각류(몸통고정+말단만) / 유선형(꼬리채찍)

import { INK, STROKE, shade, hilite, eye, glow, rgba, weightedPick, hash2, multiGradient, lerpColor } from './utils.js';

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

// 작은 눈(퇴화/특징 없는 종용) — eye() 헬퍼보다 단순한 점만
function dotEye(ctx, x, y, r, color = INK) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

// 다리 한 쌍(갈고리/집게 끝) 그리기 헬퍼 — 갑각류·등각류 공용
function jointedLeg(ctx, ox, oy, dir, len, ang, kneeBend, w) {
  const kx = ox + Math.sin(ang) * len * 0.5;
  const ky = oy + Math.cos(ang) * len * 0.5 + kneeBend;
  const fx = ox + Math.sin(ang) * len;
  const fy = oy + Math.cos(ang) * len;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.quadraticCurveTo(kx, ky, fx, fy);
  ctx.stroke();
  return { fx, fy };
}

// ---------------------------------------------------------------------------
// 1. 흰동가리 (clownfish) — 얕은 바다, 통통 타원+큰눈, 줄무늬 정확히 3개
function drawClownfish(ctx, x, y, t, s) {
  const flick = Math.sin(t * 7) * 3; // 짧고 빠른 좌우 펄럭임 (유선형 채찍웨이브 축소판)
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(flick * 0.01);

  // 꼬리 (부채꼴, 둥글게)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#FF7A2E';
  ctx.beginPath();
  ctx.moveTo(-12 * s, 0);
  ctx.quadraticCurveTo(-20 * s, -9 * s + flick * 0.3, -24 * s, -7 * s + flick * 0.5);
  ctx.quadraticCurveTo(-19 * s, 0, -24 * s, 7 * s + flick * 0.5);
  ctx.quadraticCurveTo(-20 * s, 9 * s + flick * 0.3, -12 * s, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = STROKE.detail * s;
  ctx.beginPath(); ctx.moveTo(-14 * s, -3 * s); ctx.lineTo(-21 * s, -5 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-14 * s, 3 * s); ctx.lineTo(-21 * s, 5 * s); ctx.stroke();

  // 등지느러미 + 배지느러미 (작게, 통통함 유지)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#FF7A2E';
  ctx.beginPath(); ctx.moveTo(-2 * s, -8 * s); ctx.quadraticCurveTo(2 * s, -13 * s, 6 * s, -8 * s); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 8 * s, 3.2 * s, 2 * s, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // 몸통 (통통한 타원)
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#FF7A2E';
  ellipsePath(ctx, 0, 0, 15 * s, 10.5 * s);
  ctx.fill(); ctx.stroke();
  // 밝은 배 톤
  ctx.fillStyle = '#FFB366';
  ctx.beginPath(); ctx.ellipse(1 * s, 5 * s, 11 * s, 4.5 * s, 0, 0, Math.PI); ctx.fill();
  shade(ctx, () => ellipsePath(ctx, 3 * s, 4 * s, 12 * s, 5.5 * s), 0.2);

  // 흰 줄무늬 정확히 3개 (검은 테두리 필수, 임의로 늘리지 않음)
  const stripes = [-8, 0, 8];
  for (const sx of stripes) {
    ctx.strokeStyle = '#16233B'; ctx.lineWidth = 4.6 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx * s, -9.5 * s); ctx.quadraticCurveTo((sx + 1.5) * s, 0, sx * s, 9.5 * s); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(sx * s, -9 * s); ctx.quadraticCurveTo((sx + 1.5) * s, 0, sx * s, 9 * s); ctx.stroke();
  }

  // 볼살 + 큰 눈
  ctx.fillStyle = 'rgba(255,150,120,0.4)';
  ctx.beginPath(); ctx.ellipse(10 * s, 2 * s, 2.6 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();
  eye(ctx, 11 * s, -2.5 * s, 3.4 * s);
  ctx.restore();
}

// 2. 리프상어 (reef shark) — 얕은 바다, 유선형+카운터셰이딩, 낫모양 꼬리
function drawReefShark(ctx, x, y, t, s) {
  // 유선형 채찍웨이브: 꼬리쪽 진폭이 큰 S자
  ctx.save();
  ctx.translate(x, y);
  const w1 = Math.sin(t * 2.2) * 2;
  const w2 = Math.sin(t * 2.2 - 1.1) * 5;

  // 꼬리 (낫모양, 위쪽 로브가 더 긺, 수직축)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#7E93A0';
  ctx.beginPath();
  ctx.moveTo(-24 * s, 0 + w1);
  ctx.quadraticCurveTo(-34 * s, -16 * s + w2, -30 * s, -3 * s + w2 * 0.6);
  ctx.quadraticCurveTo(-33 * s, 4 * s + w2 * 0.3, -38 * s, 8 * s + w2 * 0.4);
  ctx.quadraticCurveTo(-28 * s, 4 * s + w1, -24 * s, 0 + w1);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // 몸통 (유선형, 뾰족한 주둥이) — 등~배 다단 그라디언트로 카운터셰이딩을 부드럽게 이어지게
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = multiGradient(ctx, 0, -9 * s, 0, 9 * s, [
    [0, '#5E7280'], [0.35, '#7E93A0'], [0.62, '#A6B6C0'], [1, '#EFF4F6'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-24 * s, 0);
  ctx.quadraticCurveTo(-14 * s, -11 * s, 6 * s, -9 * s);
  ctx.quadraticCurveTo(22 * s, -6 * s, 27 * s, 0);
  ctx.quadraticCurveTo(22 * s, 6 * s, 6 * s, 9 * s);
  ctx.quadraticCurveTo(-14 * s, 11 * s, -24 * s, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(6 * s, -1 * s, 18 * s, 5 * s, 0, 0, Math.PI * 2); }, 0.14);
  // 피부 결 텍스처: 몸 곡선을 따라 흐르는 미세한 줄무늬(denticle 결) — 결정적 노이즈로 위치 고정
  ctx.strokeStyle = rgba(INK, 0.16); ctx.lineWidth = STROKE.detail * s * 0.7; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const lx = -18 * s + i * 5 * s;
    const ly = -6 * s + hash2(i, 3.1) * 10 * s;
    const len = (4 + hash2(i, 7.7) * 3) * s;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.quadraticCurveTo(lx + len * 0.5, ly - 1 * s, lx + len, ly - 0.5 * s);
    ctx.stroke();
  }
  // 등쪽 스펙큘러 하이라이트 (젖은 피부 광택 스트리크)
  ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 1.4 * s; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10 * s, -6.5 * s);
  ctx.quadraticCurveTo(2 * s, -8.5 * s, 14 * s, -5 * s);
  ctx.stroke();

  // 등지느러미 (중앙, 큰 삼각형 1개)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#7E93A0';
  ctx.beginPath();
  ctx.moveTo(-3 * s, -8 * s); ctx.lineTo(3 * s, -24 * s); ctx.lineTo(10 * s, -7 * s); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 가슴지느러미
  ctx.beginPath();
  ctx.moveTo(8 * s, 5 * s); ctx.quadraticCurveTo(10 * s, 14 * s, 4 * s, 17 * s); ctx.quadraticCurveTo(4 * s, 9 * s, 8 * s, 5 * s);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // 아가미 슬릿 (눈 뒤쪽 5줄)
  ctx.strokeStyle = rgba(INK, 0.45); ctx.lineWidth = STROKE.detail * s;
  for (let i = 0; i < 5; i++) {
    const gx = (10 + i * 2.2) * s;
    ctx.beginPath(); ctx.moveTo(gx, -6 * s); ctx.lineTo(gx - 1.5 * s, 2 * s); ctx.stroke();
  }
  // 처진 친근한 눈매
  eye(ctx, 21 * s, -3 * s, 2 * s);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2 * s;
  ctx.beginPath(); ctx.moveTo(18.5 * s, -1 * s); ctx.quadraticCurveTo(21 * s, 0.5 * s, 23.5 * s, -1 * s); ctx.stroke();
  ctx.restore();
}

// 3. 곰치 (moray eel) — 얕은 바다, 뱀형 S웨이브, 리본 등지느러미+표범무늬
function drawMorayEel(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  const wob = Math.sin(t * 2.6) * 7 * s;
  const wob2 = Math.sin(t * 2.6 - 1.3) * 4 * s;

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#9AA84A';
  ctx.beginPath();
  ctx.moveTo(-16 * s + wob2 * 0.3, 16 * s);
  ctx.quadraticCurveTo(-11 * s + wob, -2 * s, 0, -15 * s);
  ctx.quadraticCurveTo(7 * s, -19 * s, 13 * s, -15 * s);
  ctx.quadraticCurveTo(4 * s + wob, -1 * s, -4 * s + wob2 * 0.3, 16 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(-1 * s + wob * 0.2, 5 * s, 7 * s, 13 * s, 0.15, 0, Math.PI * 2); }, 0.24);

  // 표범무늬 반점
  ctx.fillStyle = 'rgba(50, 42, 18, 0.55)';
  const spots = [[-5, -8], [4, -12], [-10, 2], [2, 6], [-3, 12], [6, -3]];
  for (const [sx, sy] of spots) {
    ctx.beginPath();
    ctx.ellipse((sx + wob * 0.18) * s, sy * s, 2.2 * s, 1.6 * s, 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  // 리본형 등지느러미 (머리~꼬리까지 이어짐)
  ctx.fillStyle = 'rgba(205, 220, 150, 0.7)';
  outline(ctx, STROKE.detail * s);
  ctx.beginPath();
  ctx.moveTo(2 * s, -14.5 * s);
  ctx.quadraticCurveTo(9 * s + wob * 0.4, -4 * s, 0 + wob2 * 0.3, 14 * s);
  ctx.lineTo(-3 * s + wob2 * 0.3, 13 * s);
  ctx.quadraticCurveTo(6 * s + wob * 0.4, -3 * s, 10 * s, -15 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // 벌린 입 + 콧구멍 (위협적이지 않게 둥글림)
  outline(ctx, STROKE.detail * s);
  ctx.fillStyle = '#4a3428';
  ctx.beginPath();
  ctx.ellipse(10 * s, -14 * s, 3.6 * s, 2.2 * s, 0.4, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.9 * s;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo((9.3 + i * 0.7) * s, -15.4 * s); ctx.lineTo((9.8 + i * 0.7) * s, -14.6 * s);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(13.5 * s, -16.8 * s, 0.5 * s, 0, Math.PI * 2); ctx.fill();
  // 작고 흐릿한 눈 (매끈한 비늘없는 피부)
  dotEye(ctx, 12 * s, -18 * s, 1.4 * s, 'rgba(22,35,59,0.6)');
  ctx.beginPath(); ctx.arc(12 * s, -18 * s, 1.9 * s, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(INK, 0.4); ctx.lineWidth = 0.8 * s; ctx.stroke();
  ctx.restore();
}

// 4. 바다거북 (sea turtle) — 얕은 바다, 육각 마디 등갑+노 모양 앞지느러미
function drawSeaTurtle(ctx, x, y, t, s) {
  const flap = Math.sin(t * 1.6) * 0.4; // 앞지느러미 새처럼 크게 업다운
  const flap2 = Math.sin(t * 1.6) * 0.12; // 뒷지느러미 미세 조정
  ctx.save();
  ctx.translate(x, y);

  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#3e8f6b';
  // 뒷지느러미 (작게)
  ctx.save(); ctx.rotate(flap2);
  ctx.beginPath(); ctx.ellipse(-9 * s, 11 * s, 5 * s, 2.6 * s, 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.rotate(-flap2);
  ctx.beginPath(); ctx.ellipse(9 * s, 11 * s, 5 * s, 2.6 * s, -0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
  // 앞지느러미 (크게, 새처럼 업다운)
  ctx.save(); ctx.translate(-13 * s, 0); ctx.rotate(flap);
  ctx.beginPath(); ctx.ellipse(0, 0, 11 * s, 4.2 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = STROKE.detail * s;
  ctx.beginPath(); ctx.moveTo(-7 * s, 0); ctx.lineTo(7 * s, 0); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.translate(13 * s, 0); ctx.rotate(-flap);
  ctx.strokeStyle = INK; ctx.fillStyle = '#3e8f6b';
  ctx.beginPath(); ctx.ellipse(0, 0, 11 * s, 4.2 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = STROKE.detail * s;
  ctx.beginPath(); ctx.moveTo(-7 * s, 0); ctx.lineTo(7 * s, 0); ctx.stroke();
  ctx.restore();

  // 등갑 (하트형에 가깝게) — 위(광원쪽)는 밝고 가장자리로 갈수록 어두워지는 다단 그라디언트
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = multiGradient(ctx, 0, -13 * s, 0, 13 * s, [
    [0, lerpColor('#5cae7e', '#ffffff', 0.32)], [0.4, '#5cae7e'], [0.75, lerpColor('#5cae7e', '#1c3d2c', 0.3)], [1, lerpColor('#5cae7e', '#1c3d2c', 0.5)],
  ]);
  ctx.beginPath();
  ctx.moveTo(0, -13 * s);
  ctx.quadraticCurveTo(15 * s, -11 * s, 15 * s, 3 * s);
  ctx.quadraticCurveTo(15 * s, 12 * s, 0, 13 * s);
  ctx.quadraticCurveTo(-15 * s, 12 * s, -15 * s, 3 * s);
  ctx.quadraticCurveTo(-15 * s, -11 * s, 0, -13 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 갈색~올리브 얼룩 (결정적 노이즈로 크기/위치 흩뿌림)
  for (let i = 0; i < 9; i++) {
    const ox = (hash2(i, 1.7) - 0.5) * 24;
    const oy = (hash2(i, 5.3) - 0.5) * 18;
    const r = 2 + hash2(i, 9.1) * 2.6;
    ctx.fillStyle = `rgba(90,70,30,${0.16 + hash2(i, 13) * 0.14})`;
    ctx.beginPath(); ctx.ellipse(ox * s, oy * s, r * s, r * 0.7 * s, hash2(i, 2) * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(4 * s, 4 * s, 12 * s, 8 * s, 0, 0, Math.PI * 2); }, 0.14);
  // 육각 마디 무늬 (또렷하게) + 각 마디 안쪽 미세 융기선(스큐트 결)
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail * s;
  const hexAt = (cx, cy, r) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.85;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
    // 융기 결 (마디 중심에서 두 방향으로 짧은 선)
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = STROKE.detail * s * 0.6;
    ctx.beginPath(); ctx.moveTo(cx - r * 0.35, cy - r * 0.15); ctx.lineTo(cx + r * 0.35, cy - r * 0.05); ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.restore();
  };
  hexAt(0, -4 * s, 4.6 * s);
  hexAt(-7 * s, 4 * s, 4.2 * s);
  hexAt(7 * s, 4 * s, 4.2 * s);
  hexAt(0, 9 * s, 3.8 * s);
  // 등갑 광택 하이라이트 (매끈한 각질 표면 반사)
  hilite(ctx, () => { ctx.beginPath(); ctx.ellipse(-5 * s, -8 * s, 5 * s, 2.4 * s, -0.3, 0, Math.PI * 2); }, 0.3);

  // 머리 (부리모양 입)
  ctx.fillStyle = '#5cae7e';
  outline(ctx, STROKE.part * s);
  ctx.beginPath(); ctx.ellipse(17 * s, -2 * s, 5.5 * s, 4.3 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3e8f6b';
  ctx.beginPath();
  ctx.moveTo(21.5 * s, -3 * s); ctx.quadraticCurveTo(24.5 * s, -2 * s, 21.5 * s, -0.5 * s); ctx.closePath();
  outline(ctx, STROKE.detail * s); ctx.fill(); ctx.stroke();
  eye(ctx, 19 * s, -3 * s, 1.6 * s);
  ctx.restore();
}

// 5. 범고래 (orca) — 얕은 바다, 눈 위 흰 안장무늬가 표정 핵심
function drawOrca(ctx, x, y, t, s) {
  // 유선형 채찍웨이브지만 몸통은 수직(상하) 웨이브로 헤엄, 등지느러미는 거의 안 흔들림
  ctx.save();
  ctx.translate(x, y);
  const vwave = Math.sin(t * 2.1) * 2.5;
  ctx.translate(0, vwave);

  outline(ctx, STROKE.silhouette * s);
  // 젖은 피부 광택을 살린 다단 그라디언트 (등쪽 짙은 검정 → 옆면에 살짝 밝은 스틸 sheen)
  ctx.fillStyle = multiGradient(ctx, 0, -14 * s, 0, 8 * s, [
    [0, '#101216'], [0.4, '#181B22'], [0.7, '#242833'], [1, '#181B22'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-27 * s, 2 * s);
  ctx.quadraticCurveTo(-8 * s, -15 * s, 23 * s, -2 * s);
  ctx.quadraticCurveTo(30 * s, 2 * s, 23 * s, 6 * s);
  ctx.quadraticCurveTo(-8 * s, 15 * s, -27 * s, 2 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 매끈한 피부 결 텍스처 (몸통 곡선을 따라 흐르는 아주 미세한 줄무늬, 결정적 노이즈로 고정)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = STROKE.detail * s * 0.6; ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const lx = -18 * s + i * 6 * s;
    const ly = -4 * s + hash2(i, 4.4) * 8 * s;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.quadraticCurveTo(lx + 6 * s, ly - 1.5 * s, lx + 12 * s, ly - 0.5 * s);
    ctx.stroke();
  }
  // 스펙큘러 하이라이트 스트리크 (물에 젖은 광택, 등에서 옆구리로 대각선)
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.6 * s; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-14 * s, -8 * s);
  ctx.quadraticCurveTo(-2 * s, -11 * s, 10 * s, -7 * s);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(-10 * s, -3 * s);
  ctx.quadraticCurveTo(0, -5 * s, 8 * s, -2.5 * s);
  ctx.stroke();

  // 흰 배
  ctx.fillStyle = '#F3F6F8';
  ctx.beginPath();
  ctx.ellipse(-3 * s, 7 * s, 16 * s, 6.5 * s, 0.05, 0, Math.PI * 2);
  ctx.fill();
  // 회색 새들패치 (등지느러미 뒤)
  ctx.fillStyle = '#4A5461';
  ctx.beginPath();
  ctx.ellipse(-2 * s, -3 * s, 8 * s, 4.5 * s, -0.35, 0, Math.PI * 2);
  ctx.fill();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(4 * s, 3 * s, 18 * s, 5 * s, 0, 0, Math.PI * 2); }, 0.16);

  // 등지느러미 (매우 큰 삼각, 거의 수직, 미세 흔들림만)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#181B22';
  ctx.beginPath();
  ctx.moveTo(-5 * s, -9 * s); ctx.lineTo(0, -30 * s); ctx.lineTo(8 * s, -8 * s); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 가슴지느러미
  ctx.beginPath();
  ctx.moveTo(10 * s, 5 * s); ctx.quadraticCurveTo(14 * s, 13 * s, 6 * s, 15 * s); ctx.quadraticCurveTo(6 * s, 8 * s, 10 * s, 5 * s);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // 눈 위 흰 타원 "안장" — 눈처럼 보이도록 강조 (표정 핵심)
  ctx.fillStyle = '#F3F6F8';
  ctx.beginPath(); ctx.ellipse(18 * s, -5 * s, 4.2 * s, 2.2 * s, -0.3, 0, Math.PI * 2); ctx.fill();
  outline(ctx, STROKE.detail * s); ctx.stroke();
  // 실제 눈은 그 아래 작은 점
  dotEye(ctx, 19 * s, -2.5 * s, 1 * s);
  ctx.restore();
}

// 6. 날치 (flying fish) — 얕은 바다, 몸길이만큼 과장된 날개지느러미
function drawFlyingFish(ctx, x, y, t, s) {
  const glideFlap = 0.85 + Math.sin(t * 1.2) * 0.15; // 활공시 홀드, 가끔 접힘
  ctx.save();
  ctx.translate(x, y);

  outline(ctx, STROKE.part * s);
  // 날개형 가슴지느러미 (거의 몸길이만큼, 부챗살 무늬막)
  const wingFn = (dirY) => {
    ctx.fillStyle = 'rgba(140, 185, 220, 0.8)';
    ctx.beginPath();
    ctx.moveTo(3 * s, 0);
    ctx.quadraticCurveTo(-8 * s, -22 * s * dirY * glideFlap, -26 * s, -16 * s * dirY * glideFlap);
    ctx.quadraticCurveTo(-10 * s, -3 * s * dirY, -2 * s, 2 * s * dirY);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 부챗살 무늬막 (막 안 방사형 선)
    ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = STROKE.detail * s * 0.7;
    for (let i = 1; i <= 4; i++) {
      const fx = 3 * s - i * 6 * s;
      const fy = -i * 4 * s * dirY * glideFlap;
      ctx.beginPath(); ctx.moveTo(3 * s, 0); ctx.lineTo(fx, fy); ctx.stroke();
    }
    ctx.strokeStyle = INK;
  };
  wingFn(1); wingFn(-1);

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#3E6EA0';
  ctx.beginPath();
  ctx.ellipse(5 * s, 0, 15 * s, 5.5 * s, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#C9D9E5';
  ctx.beginPath(); ctx.ellipse(6 * s, 3 * s, 12 * s, 2.6 * s, 0, 0, Math.PI); ctx.fill();
  // 비대칭 꼬리 (아래쪽 로브가 김)
  ctx.fillStyle = '#3E6EA0';
  ctx.beginPath();
  ctx.moveTo(-10 * s, -1 * s);
  ctx.lineTo(-17 * s, -6 * s);
  ctx.lineTo(-15 * s, 0);
  ctx.lineTo(-22 * s, 8 * s);
  ctx.lineTo(-11 * s, 2 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 7 * s, 2 * s, 11 * s, 3 * s), 0.2);
  eye(ctx, 14 * s, -1 * s, 2 * s);
  ctx.restore();
}

// 7. 블루탱 (blue tang) — 얕은 바다, 원반형+검은 팔레트무늬+노란 꼬리
function drawBlueTang(ctx, x, y, t, s) {
  const microwave = Math.sin(t * 4) * 1.5; // 몸은 거의 안흔들, 지느러미 물결만
  ctx.save();
  ctx.translate(x, y);

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#2D95DE';
  ctx.beginPath();
  ctx.ellipse(0, 0, 13 * s, 12.5 * s, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // 꼬리자루 가시
  ctx.fillStyle = '#1D3A57';
  ctx.beginPath(); ctx.moveTo(-11 * s, 4 * s); ctx.lineTo(-15 * s, 6 * s); ctx.lineTo(-11 * s, 6 * s); ctx.closePath(); ctx.fill();
  // 꼬리 — 노랑 (몸은 파랑)
  ctx.fillStyle = '#FFD23F';
  outline(ctx, STROKE.part * s);
  ctx.beginPath();
  ctx.moveTo(-11 * s, 0);
  ctx.lineTo(-20 * s, -8 * s + microwave);
  ctx.lineTo(-17 * s, 0);
  ctx.lineTo(-20 * s, 8 * s + microwave);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 등/배 지느러미 (미세 물결)
  ctx.fillStyle = '#1D6FA8';
  ctx.beginPath(); ctx.moveTo(-4 * s, -11 * s); ctx.quadraticCurveTo(2 * s + microwave, -16 * s, 7 * s, -10 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4 * s, 11 * s); ctx.quadraticCurveTo(2 * s - microwave, 16 * s, 7 * s, 10 * s); ctx.closePath(); ctx.fill(); ctx.stroke();

  // 검은 팔레트 무늬 (붓자국처럼 그래픽) — 얼굴처럼 안 보이게 뒤쪽 배치
  ctx.fillStyle = '#182338';
  ctx.beginPath();
  ctx.moveTo(1 * s, -10 * s);
  ctx.quadraticCurveTo(-7 * s, -3 * s, -7 * s, 3 * s);
  ctx.quadraticCurveTo(-7 * s, 9 * s, 1 * s, 10 * s);
  ctx.quadraticCurveTo(-2 * s, 3 * s, -2 * s, 0);
  ctx.quadraticCurveTo(-2 * s, -3 * s, 1 * s, -10 * s);
  ctx.closePath();
  ctx.fill();
  shade(ctx, () => ellipsePath(ctx, 3 * s, 4 * s, 10 * s, 7 * s), 0.16);
  ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 1.6 * s;
  ctx.beginPath(); ctx.ellipse(0, 0, 13 * s, 12.5 * s, 0, 0, Math.PI * 2); ctx.stroke();
  eye(ctx, 9 * s, -4 * s, 2.4 * s);
  ctx.restore();
}

// 8. 꽃게 (crab) — 얕은 바다, 몸통 고정+말단만 흔들림, 눈자루+큰 집게
function drawCrab(ctx, x, y, t, s) {
  const pinch = Math.sin(t * 3) * 0.16; // 집게 위협시 번쩍
  const gait = t * 5;
  ctx.save();
  ctx.translate(x, y);

  // 걷는다리 4쌍 (총 8개) — 옆게걸음, 좌우 번갈아 파도
  ctx.strokeStyle = INK; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const legPhase = gait + i * 0.7;
    for (const dir of [-1, 1]) {
      const baseX = dir * (7 + i * 3.4) * s;
      const legAng = dir * (0.55 + i * 0.12);
      const bend = Math.sin(legPhase) * 2.4 * s;
      jointedLeg(ctx, baseX, 5 * s, dir, 11 * s, legAng, bend, STROKE.detail * s);
    }
  }

  // 부채꼴 갑각 (단일 판, 마디 없음)
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#B3502A';
  ctx.beginPath();
  ctx.moveTo(-14 * s, 2 * s);
  ctx.quadraticCurveTo(-14 * s, -9 * s, 0, -10 * s);
  ctx.quadraticCurveTo(14 * s, -9 * s, 14 * s, 2 * s);
  ctx.quadraticCurveTo(14 * s, 8 * s, 0, 9 * s);
  ctx.quadraticCurveTo(-14 * s, 8 * s, -14 * s, 2 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#E1855A';
  ctx.beginPath(); ctx.ellipse(0, -2 * s, 11 * s, 6 * s, 0, Math.PI, 0); ctx.fill();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 4 * s, 11 * s, 4.5 * s), 0.22);
  // 갑각 무늬선
  ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = STROKE.detail * s;
  ctx.beginPath(); ctx.moveTo(-9 * s, -6 * s); ctx.quadraticCurveTo(0, -8 * s, 9 * s, -6 * s); ctx.stroke();

  // 큰 집게발 (과장, 갑각보다 짙은 색으로 대비를 확실히 주어 앞으로 뻗어나온 것이 뚜렷이 보이게)
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(dir * 17 * s, -2 * s);
    ctx.rotate(dir * (0.25 + pinch * 0.6));
    // 집게발 팔(상완) — 짙은 적갈색, 갑각과 색 구분 확실히
    ctx.fillStyle = '#5C1F10';
    outline(ctx, STROKE.part * s);
    ctx.beginPath(); ctx.ellipse(-3 * dir * s, 3 * s, 5.5 * s, 3.2 * s, dir * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7A2A16';
    ctx.beginPath(); ctx.ellipse(2 * dir * s, -0.5 * s, 8.5 * s, 5.8 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.ellipse(1 * dir * s, -2.5 * s, 5 * s, 2.2 * s, 0, 0, Math.PI * 2); ctx.fill();
    // 집게 끝 (검푸른색, 벌어짐 — 과장되게 크게)
    ctx.fillStyle = '#152233';
    ctx.beginPath();
    ctx.moveTo(8 * dir * s, -2 * s); ctx.quadraticCurveTo(dir * 16 * s, -5.5 * s - pinch * 10 * s, dir * 19 * s, -1.5 * s);
    ctx.quadraticCurveTo(dir * 13 * s, 0.5 * s, 8 * dir * s, 0.5 * s);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8 * dir * s, 2 * s); ctx.quadraticCurveTo(dir * 16 * s, 5.5 * s + pinch * 10 * s, dir * 19 * s, 1.5 * s);
    ctx.quadraticCurveTo(dir * 13 * s, 4 * s, 8 * dir * s, 4 * s);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // 좌우로 뻗은 눈자루 2개
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail * s;
  for (const dir of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(dir * 4 * s, -8 * s); ctx.lineTo(dir * 9 * s, -13 * s); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(dir * 9 * s, -13 * s, 2 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(dir * 9.5 * s, -13 * s, 1.1 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// 9. 문라이트 젤리 (moonlight jellyfish) — 트와일라잇, 펄스, 짧은촉수+리본팔4개+네잎클로버
function drawMoonJelly(ctx, x, y, t, s) {
  const pulse = 0.9 + Math.sin(t * 2.2) * 0.14; // 원반형 펄스
  ctx.save();
  ctx.translate(x, y);
  glow(ctx, 0, 0, 26 * s, '#bfe8ff', 0.3 + Math.max(0, Math.sin(t * 2.2)) * 0.15);

  // 리본형 구강팔 4개 (촉수보다 길게 하늘거림)
  ctx.strokeStyle = 'rgba(200,225,245,0.65)'; ctx.lineWidth = 1.8 * s; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const bx = (i - 1.5) * 3 * s;
    ctx.beginPath();
    ctx.moveTo(bx, 2 * s);
    ctx.quadraticCurveTo(bx + Math.sin(t * 1.6 + i) * 6 * s, 20 * s, bx + Math.sin(t * 1.1 + i) * 8 * s, 38 * s);
    ctx.stroke();
  }
  // 짧고 촘촘한 촉수 다수
  ctx.strokeStyle = 'rgba(210,240,255,0.7)'; ctx.lineWidth = STROKE.detail * s;
  for (let i = -6; i <= 6; i++) {
    const bx = i * 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(bx, 1 * s);
    ctx.quadraticCurveTo(bx + Math.sin(t * 3 + i) * 3 * s, 8 * s, bx + Math.sin(t * 2.4 + i) * 2 * s, 14 * s);
    ctx.stroke();
  }

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = 'rgba(214, 242, 255, 0.6)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 17 * s * pulse, 12 * s * pulse, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(0, -2 * s, 13 * s, 6 * s, 0, Math.PI, 0); }, 0.16);
  // 네잎클로버 생식샘 무늬 (갓 중앙에 비침)
  ctx.fillStyle = 'rgba(255,220,150,0.55)';
  for (const [cx, cy] of [[-4, -4], [4, -4], [-4, -1], [4, -1]]) {
    ctx.beginPath(); ctx.ellipse(cx * s * pulse, cy * s * pulse - 3 * s, 3 * s * pulse, 2.4 * s * pulse, 0, 0, Math.PI * 2); ctx.fill();
  }
  hilite(ctx, () => { ctx.beginPath(); ctx.ellipse(-5 * s, -7 * s, 4 * s, 2 * s, -0.3, 0, Math.PI * 2); }, 0.4);
  ctx.restore();
}

// 10. 랜턴피시 (lanternfish) — 트와일라잇, 스타카토, 열지어 박힌 발광점
function drawLanternfish(ctx, x, y, t, s) {
  const flick = Math.sin(t * 9) * 1.5; // 스타카토 지느러미 떨림
  ctx.save();
  ctx.translate(x, y);
  glow(ctx, -4 * s, 1 * s, 12 * s, '#8ad1ff', 0.4);

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#4E5F80';
  ellipsePath(ctx, 0, 0, 13 * s, 6.2 * s);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7C8CA6';
  ctx.beginPath(); ctx.ellipse(0, -1 * s, 12 * s, 3.5 * s, 0, Math.PI, 0); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-11 * s, 0); ctx.lineTo(-19 * s + flick, -5 * s); ctx.lineTo(-19 * s + flick, 5 * s); ctx.closePath();
  outline(ctx, STROKE.part * s); ctx.fillStyle = '#4E5F80'; ctx.fill(); ctx.stroke();
  // 등/배 지느러미 미세 떨림
  ctx.fillStyle = '#4E5F80';
  ctx.beginPath(); ctx.moveTo(-2 * s, -6 * s); ctx.quadraticCurveTo(1 * s + flick, -10 * s, 4 * s, -6 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 3 * s, 10 * s, 3 * s), 0.24);

  // 발광점 (피부에 박힌 점 — 튀어나오지 않게, 옆줄 + 배쪽 열)
  ctx.fillStyle = '#CFEFFF';
  for (const dx of [-8, -4, 0, 4, 8]) {
    ctx.beginPath(); ctx.arc(dx * s, -0.5 * s, 0.8 * s, 0, Math.PI * 2); ctx.fill();
  }
  for (const dx of [-6, -1, 4]) {
    ctx.beginPath(); ctx.arc(dx * s, 4 * s, 0.9 * s, 0, Math.PI * 2); ctx.fill();
  }
  eye(ctx, 8 * s, -1 * s, 2 * s);
  ctx.restore();
}

// 11. 바이퍼피시 (viperfish) — 트와일라잇, 등쪽 발광 낚싯대 미끼, 스냅 동작
function drawViperfish(ctx, x, y, t, s) {
  // 거의 안 움직이다 순간 스냅
  const snapPhase = (t * 0.8) % (Math.PI * 2);
  const snap = Math.pow(Math.max(0, Math.sin(snapPhase)), 10) * 4 * s;
  ctx.save();
  ctx.translate(x + snap, y);

  // 등지느러미 첫 가시 → 낚싯대처럼 길게 발광 미끼 (등쪽에서, 몸 위)
  outline(ctx, STROKE.detail * s);
  const lureBob = Math.sin(t * 1.6) * 2 * s;
  ctx.beginPath();
  ctx.moveTo(-2 * s, -7 * s);
  ctx.quadraticCurveTo(-4 * s, -18 * s, -10 * s, -20 * s + lureBob);
  ctx.stroke();
  glow(ctx, -10 * s, -20 * s + lureBob, 9 * s, '#8ad1ff', 0.6);
  ctx.fillStyle = '#BFEBFF';
  ctx.beginPath(); ctx.arc(-10 * s, -20 * s + lureBob, 2.2 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#232A45';
  ctx.beginPath();
  ctx.moveTo(-20 * s, 0);
  ctx.quadraticCurveTo(0, -8 * s, 19 * s, -2 * s);
  ctx.quadraticCurveTo(0, 8 * s, -20 * s, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, -2 * s, 3 * s, 14 * s, 4 * s), 0.28);

  // 입 못 다물 만큼 긴 송곳니 (몸 밖으로 튀어나옴)
  ctx.strokeStyle = '#EEF3F8'; ctx.lineWidth = 1.6 * s; ctx.lineCap = 'round';
  for (const [dx, dy, len] of [[11, -2, 9], [15, -1, 7], [19, -1, 5]]) {
    ctx.beginPath(); ctx.moveTo(dx * s, dy * s); ctx.lineTo(dx * s + 1.5 * s, dy * s + len * s); ctx.stroke();
  }
  for (const [dx, dy, len] of [[10, 3, 6], [14, 3, 5]]) {
    ctx.beginPath(); ctx.moveTo(dx * s, dy * s); ctx.lineTo(dx * s + 1 * s, dy * s - len * s); ctx.stroke();
  }
  glow(ctx, 17 * s, -1 * s, 6 * s, '#8ad1ff', 0.3);
  eye(ctx, 8 * s, -3 * s, 2.2 * s, { glow: '#8ad1ff' });
  ctx.restore();
}

// 12. 도끼고기 (hatchetfish) — 트와일라잇, 손도끼 실루엣+위를 향한 통형 눈
function drawHatchetfish(ctx, x, y, t, s) {
  const tremble = Math.sin(t * 8) * 0.8; // 거의 정지비행, 지느러미만 미세 떨림
  ctx.save();
  ctx.translate(x, y);
  glow(ctx, -2 * s, 2 * s, 13 * s, '#9fd8ff', 0.4);

  // 가늘고 긴 꼬리자루
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#9FB6CC';
  ctx.beginPath();
  ctx.moveTo(-8 * s, 3 * s); ctx.lineTo(-20 * s, 1 * s); ctx.lineTo(-20 * s, 3.5 * s); ctx.lineTo(-8 * s, 5.5 * s);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#B7C9DC';
  ctx.beginPath();
  ctx.moveTo(-3 * s, -13 * s);
  ctx.quadraticCurveTo(11 * s, -11 * s, 15 * s, -1 * s);
  ctx.quadraticCurveTo(6 * s, 7 * s, -10 * s, 5 * s);
  ctx.quadraticCurveTo(-15 * s, -5 * s, -3 * s, -13 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#E7F1FA';
  ctx.beginPath(); ctx.ellipse(0, 1 * s, 10 * s, 3.5 * s, 0, 0, Math.PI); ctx.fill();
  shade(ctx, () => ellipsePath(ctx, -1 * s, 3 * s, 9 * s, 3 * s), 0.2);

  // 배 가장자리 발광점 일렬
  ctx.fillStyle = '#DFF1FF';
  for (const dx of [-8, -3, 2, 7]) { ctx.beginPath(); ctx.arc(dx * s, 4.5 * s, 1 * s, 0, Math.PI * 2); ctx.fill(); }

  // 지느러미 미세 떨림
  ctx.fillStyle = '#9FB6CC';
  ctx.beginPath(); ctx.moveTo(2 * s, -10 * s); ctx.quadraticCurveTo(5 * s + tremble, -15 * s, 8 * s, -9 * s); ctx.closePath();
  outline(ctx, STROKE.detail * s); ctx.fill(); ctx.stroke();

  // 위를 향한 통형 눈 (옆이 아님) — 크고 또렷, 놀란 표정
  ctx.save();
  ctx.translate(2 * s, -7 * s);
  outline(ctx, STROKE.detail * s);
  ctx.fillStyle = '#2E3B55';
  ctx.beginPath(); ctx.ellipse(0, 0, 2.6 * s, 4.2 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#BFE8FF';
  ctx.beginPath(); ctx.ellipse(0, -1.6 * s, 1.8 * s, 2.2 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(0, -2 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
  hilite(ctx, () => { ctx.beginPath(); ctx.arc(-0.5 * s, -2.6 * s, 0.5 * s, 0, Math.PI * 2); }, 0.9);
  ctx.restore();
  ctx.restore();
}

// 13. 키다리게 (일본 거미게 모델) — 트와일라잇, 극단적으로 긴 다리, 매끈+가시 질감
function drawStiltCrab(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part * s * 0.85; ctx.lineCap = 'round';
  ctx.fillStyle = '#C97A4A';
  // 극단적으로 긴 걷는다리 (몸 대비 압도적)
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const legLen = 30 * s;
    const ang = i * 0.36;
    const kneeX = Math.sin(ang) * legLen * 0.52;
    const kneeY = legLen * 0.42 + Math.cos(t * 0.8 + i) * 1.2 * s;
    const footX = Math.sin(ang) * legLen;
    const footY = Math.cos(t * 0.8 + i) * 1.6 * s + legLen * 0.86;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(kneeX, kneeY, footX, footY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(footX, footY);
    ctx.lineTo(footX + Math.sign(footX || 1) * 3 * s, footY + 3 * s);
    ctx.stroke();
    // 가시 돌기 (매끈+가시, 털 없음)
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(kneeX + (i > 0 ? 2 : -2) * s, kneeY - 2 * s);
    ctx.stroke();
  }
  // 작은 앞집게발
  ctx.lineWidth = STROKE.detail * s;
  for (const dir of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(dir * 2 * s, 1 * s); ctx.lineTo(dir * 9 * s, 6 * s); ctx.stroke();
    ctx.fillStyle = '#C97A4A';
    ctx.beginPath(); ctx.ellipse(dir * 9.5 * s, 7 * s, 2.6 * s, 1.5 * s, dir * 0.3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }
  // 몸통 (작고 뾰족)
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#D68A57';
  ctx.beginPath();
  ctx.moveTo(0, -8 * s); ctx.quadraticCurveTo(6 * s, -3 * s, 5 * s, 3 * s); ctx.quadraticCurveTo(0, 6 * s, -5 * s, 3 * s);
  ctx.quadraticCurveTo(-6 * s, -3 * s, 0, -8 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 1 * s, 1 * s, 4.5 * s, 4 * s), 0.24);
  // 흰 얼룩 (등은 주황~적갈색+흰 얼룩)
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(-1 * s, -2 * s, 2 * s, 1.5 * s, 0, 0, Math.PI * 2); ctx.fill();
  eye(ctx, 2.5 * s, -5 * s, 1.3 * s);
  eye(ctx, -2.5 * s, -5 * s, 1.3 * s);
  ctx.restore();
}

// 14. 투명새우 (glass shrimp) — 트와일라잇, 반투명+도약형
function drawGlassShrimp(ctx, x, y, t, s) {
  const flex = Math.sin(t * 4.5); // 복부 접었다 펴며 도약, 평소엔 더듬이만
  const curl = Math.max(0, flex) * 0.35;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(curl * 0.3);

  // 더듬이 (긴 촉수 두 가닥)
  ctx.strokeStyle = 'rgba(170,205,222,0.85)'; ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.moveTo(11 * s, -4 * s);
  ctx.quadraticCurveTo(20 * s, -9 * s, 27 * s, -5 * s + Math.sin(t * 2) * 2.5 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(11 * s, -4 * s);
  ctx.quadraticCurveTo(18 * s, -1 * s, 25 * s, 3 * s + Math.sin(t * 2 + 1) * 2.5 * s);
  ctx.stroke();

  outline(ctx, STROKE.part * s);
  ctx.fillStyle = 'rgba(205, 228, 238, 0.45)';
  ctx.beginPath();
  ctx.moveTo(-15 * s, 0);
  ctx.quadraticCurveTo(-5 * s, -9 * s, 11 * s, -4 * s);
  ctx.quadraticCurveTo(4 * s, 5 * s, -15 * s, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 구부러진 복부 마디 (셀로판 느낌, 내부 소화관 줄무늬)
  ctx.strokeStyle = 'rgba(150,190,210,0.75)'; ctx.lineWidth = STROKE.detail * s;
  for (let i = -1; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-3 * s + i * 4.2 * s, -3 * s - curl * i * 2 * s);
    ctx.lineTo(-5 * s + i * 4.2 * s, 2 * s + curl * i * 2 * s);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120,150,90,0.5)'; ctx.lineWidth = 1.2 * s;
  ctx.beginPath(); ctx.moveTo(-13 * s, -1 * s); ctx.quadraticCurveTo(-2 * s, -3 * s, 8 * s, -3 * s); ctx.stroke();

  // 유영각 (마디 아래)
  ctx.strokeStyle = 'rgba(160,195,215,0.9)'; ctx.lineWidth = 0.8 * s;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.moveTo(i * 4 * s, 0); ctx.lineTo(i * 4 * s - 1 * s, 4 * s); ctx.stroke();
  }
  // 꼬리 부채
  ctx.fillStyle = 'rgba(190, 220, 232, 0.55)';
  ctx.beginPath();
  ctx.moveTo(-14 * s, 0); ctx.lineTo(-22 * s, -4.5 * s); ctx.lineTo(-18 * s, 0); ctx.lineTo(-22 * s, 4.5 * s);
  ctx.closePath();
  outline(ctx, STROKE.detail * s); ctx.fill(); ctx.stroke();

  // 눈 (크고 진하게, 대비)
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(9 * s, -5.5 * s, 1.9 * s, 0, Math.PI * 2); ctx.fill();
  hilite(ctx, () => { ctx.beginPath(); ctx.arc(8.3 * s, -6.2 * s, 0.6 * s, 0, Math.PI * 2); }, 0.9);
  ctx.restore();
}

// 15. 미즈우오 (barreleye) — 트와일라잇, 투명 돔+위를 향한 통형 초록 눈(최우선 정체성)
function drawBarreleye(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#4A5568';
  ctx.beginPath();
  ctx.ellipse(0, 5 * s, 13 * s, 6.5 * s, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-11 * s, 5 * s); ctx.lineTo(-18 * s, 1 * s); ctx.lineTo(-18 * s, 9 * s); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 매우 작은 입 (눈에 안 띄게)
  ctx.strokeStyle = rgba(INK, 0.5); ctx.lineWidth = 0.8 * s;
  ctx.beginPath(); ctx.moveTo(10 * s, 6.5 * s); ctx.lineTo(12 * s, 6.5 * s); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 8 * s, 10 * s, 3.5 * s), 0.22);

  // 투명 돔 머리 (돔 안에 눈이 비쳐 보이도록 먼저 그림자 눈 위치 확보)
  ctx.fillStyle = 'rgba(190, 230, 245, 0.5)';
  ctx.beginPath();
  ctx.arc(0, -2 * s, 11.5 * s, Math.PI, 0);
  ctx.closePath();
  outline(ctx, STROKE.part * s);
  ctx.fill(); ctx.stroke();

  // 통형 눈, 위를 향함 (형광 초록, 최우선 정체성 — 크고 뚜렷)
  for (const dx of [-4.5, 4.5]) {
    ctx.save();
    ctx.translate(dx * s, -4 * s);
    outline(ctx, STROKE.detail * s);
    ctx.fillStyle = '#1B7A45';
    ctx.beginPath(); ctx.ellipse(0, 0, 2.8 * s, 5.5 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4CE08A';
    ctx.beginPath(); ctx.ellipse(0, -2 * s, 2 * s, 3.2 * s, 0, 0, Math.PI * 2); ctx.fill();
    glow(ctx, 0, -2 * s, 6 * s, '#8dffb8', 0.35);
    hilite(ctx, () => { ctx.beginPath(); ctx.ellipse(-0.6 * s, -4 * s, 0.7 * s, 1.1 * s, 0, 0, Math.PI * 2); }, 0.8);
    ctx.restore();
  }
  // 돔 하이라이트
  hilite(ctx, () => { ctx.beginPath(); ctx.ellipse(-6 * s, -8 * s, 3 * s, 1.6 * s, -0.4, 0, Math.PI * 2); }, 0.35);
  ctx.restore();
}

// 16. 어비스 앵글러 (anglerfish) — 심해, 이마의 낚싯대+미끼 과장, 초승달 입
function drawAnglerfish(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  const lureBob = Math.sin(t * 2.2) * 3 * s; // 몸 거의 정지, 미끼만 까딱까딱

  // 유인돌기 줄기 (이마에서, 안테나 길이 과장)
  outline(ctx, STROKE.part * s);
  ctx.beginPath();
  ctx.moveTo(2 * s, -11 * s);
  ctx.quadraticCurveTo(8 * s, -24 * s, 17 * s, -22 * s + lureBob);
  ctx.stroke();
  glow(ctx, 17 * s, -22 * s + lureBob, 16 * s, '#ffe27a', 0.65);
  ctx.fillStyle = '#FFE27A';
  ctx.beginPath(); ctx.arc(17 * s, -22 * s + lureBob, 4 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  hilite(ctx, () => { ctx.beginPath(); ctx.arc(15.5 * s, -23.5 * s + lureBob, 1.3 * s, 0, Math.PI * 2); }, 0.8);

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#4A2A52';
  ctx.beginPath();
  ctx.moveTo(-17 * s, 6 * s);
  ctx.quadraticCurveTo(-15 * s, -15 * s, 6 * s, -11 * s);
  ctx.quadraticCurveTo(21 * s, -4 * s, 15 * s, 9 * s);
  ctx.quadraticCurveTo(0, 17 * s, -17 * s, 6 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, -2 * s, 9 * s, 15 * s, 6 * s), 0.3);
  ctx.fillStyle = 'rgba(120,80,140,0.3)';
  ctx.beginPath(); ctx.ellipse(-4 * s, -6 * s, 9 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();

  // 크고 초승달 입 + 안쪽으로 굽은 이빨
  ctx.fillStyle = '#6B3D74';
  ctx.beginPath();
  ctx.moveTo(-14 * s, 5 * s);
  ctx.quadraticCurveTo(0, 15 * s, 13 * s, 8 * s);
  ctx.quadraticCurveTo(0, 10 * s, -14 * s, 5 * s);
  ctx.closePath();
  outline(ctx, STROKE.part * s); ctx.fill(); ctx.stroke();
  // 위쪽 이빨(아래로) + 아래쪽 이빨(위로) 삼각 톱니, 안쪽으로 살짝 굽음
  ctx.fillStyle = '#EEF3F8';
  for (const dx of [-9, -4, 1, 6, 11]) {
    ctx.beginPath();
    ctx.moveTo(dx * s, 6.5 * s);
    ctx.lineTo(dx * s + 2.2 * s, 6.8 * s);
    ctx.lineTo(dx * s + 1 * s, 11 * s);
    ctx.closePath();
    ctx.fill();
  }
  for (const dx of [-6, -1, 4, 9]) {
    ctx.beginPath();
    ctx.moveTo(dx * s, 12.5 * s);
    ctx.lineTo(dx * s + 2.2 * s, 12.3 * s);
    ctx.lineTo(dx * s + 1.2 * s, 8.7 * s);
    ctx.closePath();
    ctx.fill();
  }
  eye(ctx, 8 * s, -4 * s, 2.4 * s, { glow: '#ffe27a' });
  ctx.restore();
}

// 17. 심해문어 (deep-sea octopus) — 심해, 둥근 머리+8다리 방사형, 느긋한 표정
function drawDeepOctopus(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#5C3A78';
  ellipsePath(ctx, 0, -4 * s, 16 * s, 13 * s);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7A5296';
  ctx.beginPath(); ctx.ellipse(1 * s, -8 * s, 12 * s, 7 * s, 0, Math.PI, 0); ctx.fill();
  shade(ctx, () => ellipsePath(ctx, 3 * s, 0, 13 * s, 9 * s), 0.24);

  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#5C3A78';
  for (let i = -4; i <= 3; i++) {
    const lx = (i + 0.5) * 4.2 * s;
    const legPhase = t * 1.5 + i * 0.8;
    ctx.beginPath();
    ctx.moveTo(lx, 6 * s);
    ctx.quadraticCurveTo(lx + Math.sin(legPhase) * 7 * s, 18 * s, lx + Math.sin(legPhase * 0.8) * 5 * s, 29 * s);
    ctx.lineTo(lx + 3.4 * s + Math.sin(legPhase * 0.8) * 5 * s, 28 * s);
    ctx.quadraticCurveTo(lx + 3.4 * s + Math.sin(legPhase) * 7 * s, 18 * s, lx + 3.4 * s, 6 * s);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  // 눈 크고 순하게
  eye(ctx, 6 * s, -6 * s, 3 * s);
  eye(ctx, -6 * s, -6 * s, 3 * s);
  ctx.restore();
}

// 18. 펠리컨장어 (pelican eel) — 심해, 몸 부피 절반 이상인 거대 입주머니
function drawPelicanEel(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  // 뱀형 S자 웨이브 — 몸통(채찍꼬리)만 크게, 머리는 거의 고정
  const tailWob = Math.sin(t * 1.7) * 6 * s;
  const tailWob2 = Math.sin(t * 1.7 - 1) * 3 * s;

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#1C1826';
  // 매우 가늘고 긴 채찍형 몸통(꼬리)
  ctx.beginPath();
  ctx.moveTo(4 * s, -1.5 * s);
  ctx.quadraticCurveTo(18 * s, tailWob2 - 3 * s, 32 * s + tailWob, tailWob2 - 2 * s);
  ctx.lineTo(32 * s + tailWob, tailWob2 + 1.5 * s);
  ctx.quadraticCurveTo(18 * s, tailWob2 + 3 * s, 4 * s, 3.5 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 꼬리 끝 작은 발광기 (붉은빛)
  glow(ctx, 32 * s + tailWob, tailWob2 - 0.2 * s, 6 * s, '#ff5c4d', 0.55);
  ctx.fillStyle = '#FF5C4D';
  ctx.beginPath(); ctx.arc(32 * s + tailWob, tailWob2 - 0.2 * s, 1.6 * s, 0, Math.PI * 2); ctx.fill();

  // 거대 입주머니 (몸 전체 부피의 절반 이상)
  ctx.fillStyle = '#241F33';
  ctx.beginPath();
  ctx.moveTo(4 * s, -13 * s);
  ctx.quadraticCurveTo(-22 * s, -13 * s, -25 * s, 3 * s);
  ctx.quadraticCurveTo(-14 * s, 15 * s, 4 * s, 10 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3D3350';
  ctx.beginPath();
  ctx.moveTo(2 * s, -8 * s); ctx.quadraticCurveTo(-16 * s, -8 * s, -19 * s, 2 * s); ctx.quadraticCurveTo(-10 * s, 6 * s, 2 * s, 4 * s);
  ctx.closePath(); ctx.fill();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(-9 * s, 2 * s, 13 * s, 8 * s, 0, 0, Math.PI * 2); }, 0.28);

  // 눈은 매우 작게
  dotEye(ctx, 0 * s, -6 * s, 1 * s);
  ctx.beginPath(); ctx.arc(0, -6 * s, 1.4 * s, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(INK, 0.4); ctx.lineWidth = 0.6 * s; ctx.stroke();
  // 작은 이빨 (안쪽으로 굽음)
  ctx.strokeStyle = '#C9D3E0'; ctx.lineWidth = 1 * s;
  for (const dx of [-1, 2, 5]) {
    ctx.beginPath(); ctx.moveTo(dx * s, -12.5 * s); ctx.quadraticCurveTo(dx * s + 1 * s, -10.5 * s, dx * s, -10 * s); ctx.stroke();
  }
  ctx.restore();
}

// 19. 블롭피쉬 (blobfish) — 심해, 처진 젤리질+시무룩 표정 극대화
function drawBlobfish(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#D9A0A0';
  ctx.beginPath();
  ctx.moveTo(-15 * s, 3 * s);
  ctx.quadraticCurveTo(-17 * s, -10 * s, -2 * s, -12 * s);
  ctx.quadraticCurveTo(13 * s, -12 * s, 16 * s, 1 * s);
  ctx.quadraticCurveTo(17 * s, 11 * s, 4 * s, 13 * s);
  ctx.quadraticCurveTo(-11 * s, 14 * s, -15 * s, 3 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(2 * s, 7 * s, 13 * s, 6 * s, 0, 0, Math.PI * 2); }, 0.26);
  // 무디고 흐물흐물한 질감 — 광택 없음, 아주 옅은 톤 변화만
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.ellipse(-6 * s, -6 * s, 8 * s, 4 * s, 0.2, 0, Math.PI * 2); ctx.fill();

  // 처진 코 (실루엣 핵심, 팔자주름 포함)
  ctx.fillStyle = '#D9A0A0';
  ctx.beginPath();
  ctx.ellipse(7 * s, 3 * s, 6 * s, 4.6 * s, 0.35, 0, Math.PI * 2);
  outline(ctx, STROKE.part * s); ctx.fill(); ctx.stroke();
  // 팔자주름
  ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = STROKE.detail * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(2 * s, -1 * s); ctx.quadraticCurveTo(1 * s, 5 * s, 4 * s, 9 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-2 * s, -3 * s); ctx.quadraticCurveTo(-4 * s, 4 * s, -1 * s, 10 * s); ctx.stroke();
  // 처진 입
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6 * s, 8 * s); ctx.quadraticCurveTo(-1 * s, 12 * s, 6 * s, 8.5 * s); ctx.stroke();

  eye(ctx, -1 * s, -5 * s, 2.4 * s, { open: false });
  eye(ctx, -9 * s, -5 * s, 2.4 * s, { open: false });
  ctx.restore();
}

// 20. 심해드래곤피쉬 (deep-sea dragonfish) — 심해, 턱 아래 발광 수염(몸길이만큼)
function drawDragonfish(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  // 몸통은 거의 고정, 턱수염만 낚싯줄처럼 좌우로 느리게
  const barbelSway = Math.sin(t * 1.2) * 6 * s;
  const barbelSway2 = Math.sin(t * 1.2 - 0.6) * 4 * s;

  // 어두운 배경(심해)에서도 실루엣이 읽히도록 은은한 냉색 림라이트를 몸 뒤에 깐다
  ctx.save();
  ctx.strokeStyle = 'rgba(120,150,200,0.3)';
  ctx.lineWidth = STROKE.silhouette * s * 2.6;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-24 * s, 0);
  ctx.quadraticCurveTo(-5 * s, -7 * s, 17 * s, -1 * s);
  ctx.quadraticCurveTo(-5 * s, 7 * s, -24 * s, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#1E2338'; // 벨벳 검정~짙갈 (배경 대비 확보를 위해 살짝 밝게 조정)
  ctx.beginPath();
  ctx.moveTo(-24 * s, 0);
  ctx.quadraticCurveTo(-5 * s, -7 * s, 17 * s, -1 * s);
  ctx.quadraticCurveTo(-5 * s, 7 * s, -24 * s, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#333B5C';
  ctx.beginPath(); ctx.ellipse(-4 * s, -2 * s, 16 * s, 3 * s, 0, Math.PI, 0); ctx.fill();
  shade(ctx, () => ellipsePath(ctx, -3 * s, 3 * s, 15 * s, 3.5 * s), 0.28);

  // 턱 아래에서 몸길이 몇 배로 늘어지는 긴 발광 수염 (턱 아래, 이마 아님)
  outline(ctx, STROKE.detail * s);
  ctx.beginPath();
  ctx.moveTo(9 * s, 4 * s);
  ctx.quadraticCurveTo(11 * s + barbelSway2, 16 * s, 10 * s + barbelSway, 28 * s);
  ctx.quadraticCurveTo(9 * s + barbelSway * 1.3, 38 * s, 12 * s + barbelSway * 1.5, 46 * s);
  ctx.stroke();
  glow(ctx, 12 * s + barbelSway * 1.5, 46 * s, 10 * s, '#ffb066', 0.65);
  ctx.fillStyle = '#FFB066';
  ctx.beginPath(); ctx.arc(12 * s + barbelSway * 1.5, 46 * s, 2.6 * s, 0, Math.PI * 2); ctx.fill();

  // 이빨 (삼각형, 위/아래 교차)
  ctx.fillStyle = '#E8EEF5';
  for (const dx of [7, 10, 13, 16]) {
    ctx.beginPath();
    ctx.moveTo(dx * s, -3 * s); ctx.lineTo(dx * s + 2 * s, -3.2 * s); ctx.lineTo(dx * s + 1 * s, 2.5 * s);
    ctx.closePath(); ctx.fill();
  }
  for (const dx of [8, 11, 14]) {
    ctx.beginPath();
    ctx.moveTo(dx * s, 4.5 * s); ctx.lineTo(dx * s + 2 * s, 4.7 * s); ctx.lineTo(dx * s + 1 * s, 0 * s);
    ctx.closePath(); ctx.fill();
  }

  // 눈 아래 발광기 (청백색) — 눈 바로 아래 붙여서 자연스럽게
  glow(ctx, 6 * s, -0.5 * s, 5.5 * s, '#bfe8ff', 0.5);
  ctx.fillStyle = '#BFE8FF';
  ctx.beginPath(); ctx.arc(6 * s, -0.5 * s, 1.1 * s, 0, Math.PI * 2); ctx.fill();
  eye(ctx, 6 * s, -4 * s, 2.1 * s);
  ctx.restore();
}

// 21. 유령문어 (ghost octopus / Casper) — 심해, 창백한 우윳빛+웹형 우산, 지느러미 없음
function drawGhostOctopus(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  glow(ctx, 0, 0, 11 * s, '#eef3f7', 0.2);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = 'rgba(238, 240, 244, 0.92)'; // 창백한 우윳빛 흰색 고정 (보라 넣지 않음)
  ellipsePath(ctx, 0, -4 * s, 14 * s, 11 * s);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 3 * s, 0, 11 * s, 7 * s), 0.13);

  // 웹으로 이어진 다리 (막 형태, 우산처럼 느릿하게 부유)
  ctx.fillStyle = 'rgba(236, 239, 244, 0.8)';
  outline(ctx, STROKE.part * s);
  ctx.beginPath();
  ctx.moveTo(-13 * s, 4 * s);
  for (let i = -3; i <= 3; i++) {
    const lx = i * 4.2 * s;
    const ly = 19 * s + Math.sin(t * 0.9 + i) * 2.5 * s;
    ctx.quadraticCurveTo(lx - 2 * s, 13 * s, lx, ly);
  }
  ctx.lineTo(13 * s, 4 * s);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 웹 주름선 (다리 경계 느낌만 살짝)
  ctx.strokeStyle = rgba(INK, 0.18); ctx.lineWidth = STROKE.detail * s;
  for (let i = -2; i <= 2; i++) {
    const lx = i * 4.2 * s;
    ctx.beginPath(); ctx.moveTo(lx, 5 * s); ctx.lineTo(lx, 17 * s + Math.sin(t * 0.9 + i) * 2 * s); ctx.stroke();
  }
  eye(ctx, 5 * s, -6 * s, 2.6 * s);
  eye(ctx, -5 * s, -6 * s, 2.6 * s);
  ctx.restore();
}

// 22. 흡혈오징어 (vampire squid) — 열수구, 큰 붉은 눈이 핵심, 망토형 팔
function drawVampireSquid(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  glow(ctx, 0, 4 * s, 12 * s, '#7a2a3a', 0.3);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#3A1424';
  ellipsePath(ctx, 0, -2 * s, 13 * s, 10 * s);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#521B2E';
  ctx.beginPath(); ctx.ellipse(1 * s, -5 * s, 10 * s, 5.5 * s, 0, Math.PI, 0); ctx.fill();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 2 * s, 10 * s, 6 * s), 0.3);

  // 팔 8개가 망토처럼 이어짐 (부드럽게 흔들림)
  ctx.fillStyle = '#5A1E30';
  for (let i = -4; i <= 3; i++) {
    const lx = (i + 0.5) * 3.4 * s;
    const legPhase = t * 1.3 + i;
    ctx.beginPath();
    ctx.moveTo(lx, 4 * s);
    ctx.quadraticCurveTo(lx + Math.sin(legPhase) * 4 * s, 12 * s, lx, 20 * s);
    ctx.lineTo(lx + 2.6 * s, 19 * s);
    ctx.quadraticCurveTo(lx + 2.6 * s + Math.sin(legPhase) * 4 * s, 12 * s, lx + 2.6 * s, 4 * s);
    ctx.closePath();
    outline(ctx, STROKE.part * s);
    ctx.fill(); ctx.stroke();
  }
  // 팔 안쪽 가시(cirri) 줄
  ctx.strokeStyle = 'rgba(150,60,80,0.6)'; ctx.lineWidth = 0.7 * s;
  for (let i = -3; i <= 2; i++) {
    const lx = (i + 0.9) * 3.4 * s;
    ctx.beginPath(); ctx.moveTo(lx, 8 * s); ctx.lineTo(lx + 1 * s, 10 * s); ctx.stroke();
  }
  // 팔 끝 청백색 발광점
  ctx.fillStyle = '#CFEFFF';
  for (let i = -4; i <= 3; i++) {
    const lx = (i + 0.5) * 3.4 * s + Math.sin(t * 1.3 + i) * 2 * s;
    ctx.beginPath(); ctx.arc(lx, 19.5 * s, 0.8 * s, 0, Math.PI * 2); ctx.fill();
  }

  // 매우 크고 붉게 빛나는 눈 (이름값 표현 핵심)
  eye(ctx, 8.5 * s, -4 * s, 4.2 * s, { glow: '#ff4d6d' });
  eye(ctx, -8.5 * s, -4 * s, 4.2 * s, { glow: '#ff4d6d' });
  ctx.restore();
}

// 23. 대왕등각류 (giant isopod) — 열수구, 마디판7개 갑옷+7쌍 갈고리 다리
function drawGiantIsopod(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#D3B79C';
  ellipsePath(ctx, 0, 0, 18 * s, 10.5 * s);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#E4CDB4';
  ctx.beginPath(); ctx.ellipse(1 * s, -3 * s, 15 * s, 6 * s, 0, Math.PI, 0); ctx.fill();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 4 * s, 15 * s, 6 * s), 0.24);

  // 겹친 마디판 7개 (뚜렷하고 굵은 마디선 — 갑옷처럼)
  outline(ctx, STROKE.part * s);
  for (let i = -3; i <= 3; i++) {
    const mx = i * 4.6 * s;
    ctx.beginPath();
    ctx.moveTo(mx, -9.5 * s);
    ctx.quadraticCurveTo(mx + 1.5 * s, 0, mx, 9.5 * s);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = STROKE.detail * s * 0.7;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath(); ctx.moveTo(i * 4.6 * s + 1 * s, -8 * s); ctx.lineTo(i * 4.6 * s + 1.5 * s, -2 * s); ctx.stroke();
  }
  // 꼬리 끝 부채꼴 마디
  ctx.fillStyle = '#D3B79C';
  ctx.beginPath();
  ctx.moveTo(15 * s, -6 * s);
  ctx.quadraticCurveTo(23 * s, 0, 15 * s, 6 * s);
  ctx.quadraticCurveTo(19 * s, 0, 15 * s, -6 * s);
  ctx.closePath();
  outline(ctx, STROKE.part * s); ctx.fill(); ctx.stroke();

  // 다리 7쌍 (갈고리형 끝, 집게 없음)
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail * s; ctx.lineCap = 'round';
  for (let i = -3; i <= 3; i++) {
    const mx = i * 4.6 * s;
    const legY = 9 * s + Math.sin(t * 1.8 + i) * 1 * s;
    ctx.beginPath();
    ctx.moveTo(mx, 8 * s);
    ctx.quadraticCurveTo(mx - 1 * s, 13 * s, mx - 2.5 * s, legY + 6 * s);
    ctx.stroke();
    // 갈고리 끝
    ctx.beginPath();
    ctx.arc(mx - 2.5 * s, legY + 6 * s, 1 * s, Math.PI * 0.2, Math.PI * 1.1);
    ctx.stroke();
  }
  dotEye(ctx, 16 * s, -3 * s, 1.3 * s);
  ctx.beginPath(); ctx.arc(16 * s, -3 * s, 1.8 * s, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(INK, 0.4); ctx.lineWidth = 0.7 * s; ctx.stroke();
  ctx.restore();
}

// 24. 관벌레군집 (tube worm colony) — 열수구, 고정형(얼굴 없음), 붉은 깃털 플룸
function drawTubeWorms(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  const tubes = [[-13, 26, 1.0], [-4, 33, 1.15], [5, 24, 0.9], [13, 30, 1.05], [-9, 19, 0.75]];
  for (const [tx, baseH, scaleH] of tubes) {
    const h = baseH * s * scaleH;
    outline(ctx, STROKE.part * s);
    ctx.fillStyle = '#EDE6D6';
    ctx.beginPath();
    ctx.moveTo(tx * s - 2.4 * s, 2 * s);
    ctx.lineTo(tx * s - 1.6 * s, -h);
    ctx.lineTo(tx * s + 1.6 * s, -h);
    ctx.lineTo(tx * s + 2.4 * s, 2 * s);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    shade(ctx, () => { ctx.beginPath(); ctx.moveTo(tx * s, 2 * s); ctx.lineTo(tx * s + 0.3 * s, -h); ctx.lineTo(tx * s + 2.4 * s, -h * 0.9); ctx.lineTo(tx * s + 2.4 * s, 2 * s); ctx.closePath(); }, 0.18);
    // 마디 밴드 텍스처
    ctx.strokeStyle = rgba(INK, 0.28); ctx.lineWidth = STROKE.detail * s * 0.8;
    for (let b = 1; b < 5; b++) {
      const by = 2 * s - (h + 2 * s) * (b / 5);
      ctx.beginPath(); ctx.moveTo(tx * s - 2.3 * s, by); ctx.lineTo(tx * s + 2.3 * s, by); ctx.stroke();
    }

    // 아가미 깃털 플룸 (양치식물 잎처럼 가지런한 방사형 — 흐물거리지 않음, 얼굴 없음)
    const sway = Math.sin(t * 0.7 + tx) * 1 * s;
    ctx.save();
    ctx.translate(tx * s + sway * 0.3, -h);
    ctx.fillStyle = '#D82E42';
    ctx.beginPath();
    ctx.ellipse(0, 2 * s, 3.4 * s, 6 * s, 0, 0, Math.PI * 2);
    outline(ctx, STROKE.detail * s); ctx.fill(); ctx.stroke();
    // 방사형 깃 필라멘트 (좌우 대칭, 가지런히)
    ctx.strokeStyle = '#F0687A'; ctx.lineWidth = 1 * s; ctx.lineCap = 'round';
    for (let f = -4; f <= 4; f++) {
      const fAng = (f / 4) * 0.9;
      const flen = 5 * s - Math.abs(f) * 0.4 * s;
      ctx.beginPath();
      ctx.moveTo(0, 2 * s);
      ctx.lineTo(Math.sin(fAng) * flen + sway * 0.2, 2 * s - Math.cos(fAng) * flen - 2 * s);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

// 25. 덤보문어 (dumbo octopus) — 열수구, 큰 귀 지느러미(핵심)+젤리질 둥근몸
function drawDumboOctopus(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  const flap = Math.sin(t * 4.5) * 7 * s; // 귀 지느러미가 주 동력원 — 새처럼 퍼덕
  glow(ctx, 0, 0, 12 * s, '#ffe0f0', 0.18);

  // 큰 귀 모양 지느러미 2개 (과장 — 이름·매력 핵심)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = 'rgba(240, 200, 235, 0.85)';
  ctx.beginPath();
  ctx.ellipse(-15 * s, -3 * s, 10 * s, 6 * s + flap * 0.35, -0.35, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(15 * s, -3 * s, 10 * s, 6 * s - flap * 0.35, 0.35, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = 'rgba(248, 220, 240, 0.92)'; // 연한 분홍~크림 반투명
  ellipsePath(ctx, 0, -1 * s, 13 * s, 11.5 * s);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 3 * s, 10 * s, 7 * s), 0.16);

  // 짧고 통통한 다리 8개 (우산처럼 오므렸다 폄)
  const spread = 0.7 + Math.sin(t * 1.2) * 0.2;
  ctx.fillStyle = 'rgba(240, 200, 235, 0.9)';
  for (let i = -4; i <= 3; i++) {
    const lx = (i + 0.5) * 3.6 * s * spread;
    ctx.beginPath();
    ctx.moveTo(lx, 7 * s);
    ctx.quadraticCurveTo(lx + Math.sin(t * 1.5 + i) * 2.5 * s, 13 * s, lx * 1.1, 17 * s);
    ctx.lineTo(lx * 1.1 + 2.6 * s, 16.5 * s);
    ctx.quadraticCurveTo(lx + 2.6 * s + Math.sin(t * 1.5 + i) * 2.5 * s, 13 * s, lx + 2.6 * s, 7 * s);
    ctx.closePath();
    outline(ctx, STROKE.detail * s);
    ctx.fill(); ctx.stroke();
  }
  // 입 주변 짙은 보라
  ctx.fillStyle = 'rgba(120, 60, 140, 0.5)';
  ctx.beginPath(); ctx.ellipse(0, 7 * s, 5 * s, 2.6 * s, 0, 0, Math.PI * 2); ctx.fill();

  eye(ctx, 6 * s, -3 * s, 3.4 * s);
  eye(ctx, -6 * s, -3 * s, 3.4 * s);
  ctx.restore();
}

// 26. 열수유황게 (yeti crab) — 열수구, 털로 덥수룩한 집게발(핵심), 눈 거의 없음
function drawYetiCrab(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  const wave = Math.sin(t * 1.6) * 0.12; // 집게 좌우로 까딱, 다리는 조심스레

  // 다리 (짧게 — 키다리게와 차별화, 털 핵심)
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail * s; ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const legPhase = t * 1.2 + i;
    jointedLeg(ctx, i * 5 * s, 5 * s, Math.sign(i), 8 * s, i * 0.4, Math.sin(legPhase) * 1.2 * s, STROKE.detail * s);
    // 다리 털
    ctx.strokeStyle = 'rgba(240,235,215,0.7)'; ctx.lineWidth = 0.6 * s;
    for (let f = 0; f < 3; f++) {
      const fx = i * 5 * s + Math.sin(i * 0.4) * 4 * s * (f / 3);
      const fy = 5 * s + f * 2.5 * s;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.sign(i) * 2 * s, fy - 1 * s); ctx.stroke();
    }
    ctx.strokeStyle = INK;
  }

  // 털로 덥수룩한 큰 집게발 (뭉게구름처럼 과장 — "예티" 이름값)
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(dir * 15 * s, -1 * s);
    ctx.rotate(dir * (0.3 + wave));
    // 뭉실한 털 뭉치 (여러 겹 원)
    ctx.fillStyle = 'rgba(245, 240, 222, 0.9)';
    for (const [ox, oy, r] of [[0, 0, 8], [-3, -3, 5], [3, -2, 5], [-2, 4, 4.5], [3, 4, 4.5]]) {
      ctx.beginPath(); ctx.arc(ox * s, oy * s, r * s, 0, Math.PI * 2); ctx.fill();
    }
    outline(ctx, STROKE.part * s);
    ctx.beginPath(); ctx.ellipse(0, 0, 9 * s, 6 * s, 0, 0, Math.PI * 2); ctx.stroke();
    // 털 텍스처 (뾰족뾰족한 짧은 선 다수 — 뭉게구름 실루엣)
    ctx.strokeStyle = 'rgba(230,220,190,0.8)'; ctx.lineWidth = 0.7 * s;
    for (let i = 0; i < 10; i++) {
      const ang = (Math.PI * 2 * i) / 10;
      const r1 = 8 * s, r2 = 10.5 * s;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1 * 0.7);
      ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2 * 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#EEE8D8';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 1 * s, 2 * s, 8 * s, 4 * s), 0.2);
  // 눈은 거의 퇴화 — 작은 점, 크게 그리지 않음
  dotEye(ctx, 3 * s, -3 * s, 0.6 * s, rgba(INK, 0.5));
  dotEye(ctx, -3 * s, -3 * s, 0.6 * s, rgba(INK, 0.5));
  ctx.restore();
}

// 27. 민들레해파리 (Atolla, dandelion jellyfish) — 열수구, 진한 붉은색+비대칭 긴 촉수1
function drawDandelionJelly(ctx, x, y, t, s) {
  const pulse = 0.9 + Math.sin(t * 2) * 0.14; // 원반형 펄스
  ctx.save();
  ctx.translate(x, y);
  const alarm = Math.max(0, Math.sin(t * 5)) > 0.85 ? 1 : 0; // 간헐적 경보 섬광
  glow(ctx, 0, 0, 18 * s, alarm ? '#bfe8ff' : '#ff5a5a', alarm ? 0.55 : 0.25);

  // 짧은 촉수 다수 (~20, 갓 가장자리)
  ctx.strokeStyle = 'rgba(200,50,50,0.6)'; ctx.lineWidth = STROKE.detail * s * 0.8;
  for (let i = 0; i < 20; i++) {
    const ang = (Math.PI * 2 * i) / 20;
    const len = (5 + Math.sin(t * 1.5 + i) * 1) * s;
    const bx = Math.cos(ang) * 6 * s * pulse, by = Math.sin(ang) * 4 * s * pulse + 1 * s;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(ang) * len, by + Math.abs(Math.sin(ang)) * len * 0.4 + len * 0.8);
    ctx.stroke();
  }
  // 유독 하나만 길게 늘어진 촉수 (비대칭 디테일 필수)
  ctx.strokeStyle = 'rgba(200,40,45,0.75)'; ctx.lineWidth = STROKE.detail * s;
  ctx.beginPath();
  ctx.moveTo(-3 * s, 3 * s);
  ctx.quadraticCurveTo(-12 * s, 20 * s, -6 * s + Math.sin(t * 0.8) * 3 * s, 40 * s);
  ctx.stroke();
  if (alarm) {
    ctx.fillStyle = '#BFE8FF';
    ctx.beginPath(); ctx.arc(-6 * s + Math.sin(t * 0.8) * 3 * s, 40 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
  }

  // 작고 둥근 갓 (매끈한 돔 — 자기교차 없는 단순 반타원)
  const rx = 11 * s * pulse, ry = 8.5 * s * pulse;
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = alarm ? 'rgba(220,110,130,0.85)' : 'rgba(190,35,42,0.92)'; // 진한 붉은색
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(0, -1 * s, 6 * s, 3 * s, 0, Math.PI, 0); }, 0.22);
  hilite(ctx, () => { ctx.beginPath(); ctx.ellipse(-3 * s, -4 * s, 2.4 * s, 1.2 * s, -0.3, 0, Math.PI * 2); }, 0.3);
  // 왕관모양 홈 (테두리를 따라 도는 얕은 스캘럽 장식선 — 실루엣은 건드리지 않음)
  ctx.strokeStyle = 'rgba(90,10,15,0.55)'; ctx.lineWidth = STROKE.detail * s;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI - (Math.PI * i) / 8;
    const nx = Math.cos(a) * rx * 0.78, ny = -Math.sin(a) * ry * 0.6 - 1 * s;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rx * 0.92, -Math.sin(a) * ry * 0.78 - 0.5 * s);
    ctx.lineTo(nx, ny);
    ctx.stroke();
  }
  ctx.restore();
}

// 28. 스케일풋 고둥 (scaly-foot snail) — 열수구, 나선 껍질+철빛 금속 비늘 발
function drawScalyfootSnail(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  glow(ctx, 6 * s, -4 * s, 10 * s, '#ff9d5c', 0.18);
  // 몸통(발) 매우 느린 수축/이완 (갑각류형: 몸통 고정+말단만)
  const breathe = 1 + Math.sin(t * 0.7) * 0.03;
  ctx.scale(breathe, 1);

  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#6E5744';
  ctx.beginPath();
  ctx.ellipse(2 * s, 4 * s, 14 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8A6E56';
  ctx.beginPath(); ctx.ellipse(3 * s, 1.5 * s, 10 * s, 3.5 * s, 0, Math.PI, 0); ctx.fill();
  shade(ctx, () => ellipsePath(ctx, 4 * s, 7 * s, 10 * s, 3.8 * s), 0.24);

  // 발 옆면 전체를 덮는 겹겹 금속 비늘 (이 종의 유일무이한 정체성 — 갑옷조각처럼 각지게)
  for (let row = -1; row <= 1; row++) {
    for (let i = -2; i <= 2; i++) {
      const sx = i * 4 * s + 2 * s + row * 1.5 * s;
      const sy = (6 + row * 2.4) * s;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(0.2 * row);
      ctx.fillStyle = '#5C4B39';
      ctx.beginPath();
      ctx.moveTo(0, -1.9 * s); ctx.lineTo(1.9 * s, 0); ctx.lineTo(0, 1.9 * s); ctx.lineTo(-1.9 * s, 0);
      ctx.closePath();
      outline(ctx, STROKE.detail * s * 0.7); ctx.fill(); ctx.stroke();
      // 금속 광택 하이라이트
      ctx.fillStyle = 'rgba(255, 210, 150, 0.75)';
      ctx.beginPath(); ctx.moveTo(-0.4 * s, -1.1 * s); ctx.lineTo(0.9 * s, -0.1 * s); ctx.lineTo(-0.2 * s, 0.3 * s); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  // 나선 껍질 (매끈함, 비늘 없음 — 3층 정도)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#332920';
  ctx.beginPath();
  ctx.arc(-2 * s, -2 * s, 9 * s, 0.4, Math.PI * 1.6);
  ctx.arc(1 * s, -1 * s, 5 * s, Math.PI * 1.3, 0.2, true);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = rgba(INK, 0.4); ctx.lineWidth = STROKE.detail * s;
  ctx.beginPath(); ctx.arc(-2 * s, -2 * s, 5.5 * s, 0.4, Math.PI * 1.4); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -1.5 * s, 2.6 * s, 0.4, Math.PI * 1.3); ctx.stroke();
  // 껍질 광택 하이라이트
  ctx.strokeStyle = 'rgba(255, 205, 150, 0.5)'; ctx.lineWidth = STROKE.detail * s * 0.8;
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
// 나라별 고유종 (1.1 확장) — 각 종은 특정 다이빙 스팟(siteOnly)에서만 등장한다.

// 29. 자리돔 (제주) — 작고 통통한 진갈색 몸 + 꼬리자루의 흰 점 하나가 포인트
function drawDamselfish(ctx, x, y, t, s) {
  const flick = Math.sin(t * 8) * 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(flick * 0.012);
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#4A3A34';
  ctx.beginPath();
  ctx.moveTo(-9 * s, 0);
  ctx.lineTo(-15 * s, -6 * s + flick * 0.4);
  ctx.lineTo(-13 * s, 0);
  ctx.lineTo(-15 * s, 6 * s + flick * 0.4);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#5C463C';
  ellipsePath(ctx, 0, 0, 11 * s, 8.5 * s);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7A6252';
  ctx.beginPath(); ctx.ellipse(1 * s, 4 * s, 8 * s, 3.4 * s, 0, 0, Math.PI); ctx.fill();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 3 * s, 8 * s, 4.5 * s), 0.18);
  // 등지느러미
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#4A3A34';
  ctx.beginPath(); ctx.moveTo(-3 * s, -7.5 * s); ctx.quadraticCurveTo(1 * s, -11 * s, 5 * s, -7 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  // 시그니처: 꼬리자루 흰 점
  ctx.fillStyle = '#F4F0E8';
  ctx.beginPath(); ctx.arc(-8.5 * s, -3 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
  outline(ctx, STROKE.detail * s); ctx.stroke();
  eye(ctx, 7.5 * s, -2 * s, 2.6 * s);
  ctx.restore();
}

// 30. 쏨뱅이 (제주) — 붉은 바위색 매복형, 삐죽삐죽 지느러미 가시 + 큰 입
function drawScorpionfish(ctx, x, y, t, s) {
  const breathe = Math.sin(t * 1.6) * 0.8; // 매복형: 거의 안 움직이고 숨만 쉼
  ctx.save();
  ctx.translate(x, y);
  // 가슴지느러미 (부채, 바닥에 짚은 느낌)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#8A4030';
  ctx.beginPath(); ctx.ellipse(2 * s, 7 * s, 8 * s, 4 * s, 0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 몸통 (울퉁불퉁 바위 실루엣)
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#A85038';
  ctx.beginPath();
  ctx.moveTo(-14 * s, 3 * s);
  ctx.quadraticCurveTo(-12 * s, -5 * s, -5 * s, -7 * s + breathe);
  ctx.lineTo(-2 * s, -5 * s); ctx.lineTo(1 * s, -8 * s + breathe); ctx.lineTo(4 * s, -5.5 * s);
  ctx.lineTo(7 * s, -7 * s); ctx.quadraticCurveTo(13 * s, -4 * s, 14 * s, 1 * s);
  ctx.quadraticCurveTo(12 * s, 6 * s, 4 * s, 7 * s);
  ctx.quadraticCurveTo(-6 * s, 8 * s, -14 * s, 3 * s);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 얼룩덜룩 위장 무늬
  ctx.fillStyle = 'rgba(70,26,20,0.45)';
  for (const [px, py, r] of [[-7, -1, 3.2], [0, 2, 2.6], [6, -1, 2.8], [-2, -4, 2]]) {
    ctx.beginPath(); ctx.arc(px * s, py * s, r * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,170,120,0.35)';
  for (const [px, py] of [[-10, 2], [3, 5], [9, 2]]) {
    ctx.beginPath(); ctx.arc(px * s, py * s, 1.6 * s, 0, Math.PI * 2); ctx.fill();
  }
  shade(ctx, () => ellipsePath(ctx, 2 * s, 4 * s, 11 * s, 4 * s), 0.2);
  // 독가시 (등 위 뾰족뾰족 — 위험 신호)
  ctx.strokeStyle = '#5C2418'; ctx.lineWidth = STROKE.detail * s * 1.2; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const gx = (-6 + i * 3.4) * s;
    ctx.beginPath(); ctx.moveTo(gx, -6 * s); ctx.lineTo(gx + 0.6 * s, -10.5 * s - breathe); ctx.stroke();
  }
  // 뿌루퉁한 큰 입 + 작은 눈
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part * s;
  ctx.beginPath(); ctx.moveTo(10 * s, 2.5 * s); ctx.quadraticCurveTo(13.5 * s, 3 * s, 14 * s, 0.5 * s); ctx.stroke();
  eye(ctx, 9.5 * s, -3.5 * s, 2 * s);
  ctx.restore();
}

// 31. 연산호 (제주 문섬) — 분홍/보라 가지 군락, 고정형이지만 관찰 대상
function drawSoftCoral(ctx, x, y, t, s) {
  const swayA = Math.sin(t * 1.2) * 0.08;
  ctx.save();
  ctx.translate(x, y);
  // 밑동 바위
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#6A5A52';
  ctx.beginPath(); ctx.ellipse(0, 12 * s, 9 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 가지 3~5개 (물살에 하늘하늘)
  const branches = [[-6, -0.5, 16, '#E86A9E'], [-1, -0.1, 21, '#F08ABA'], [4, 0.35, 17, '#D95A8E'], [8, 0.6, 12, '#E87AAE']];
  for (const [bx, ang, len, color] of branches) {
    ctx.save();
    ctx.translate(bx * s, 10 * s);
    ctx.rotate(ang * 0.35 + swayA);
    outline(ctx, STROKE.part * s);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-2.2 * s, 0);
    ctx.quadraticCurveTo(-3 * s, -len * 0.5 * s, -1.2 * s, -len * s);
    ctx.quadraticCurveTo(0, -(len + 2) * s, 1.2 * s, -len * s);
    ctx.quadraticCurveTo(3 * s, -len * 0.5 * s, 2.2 * s, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // 폴립 점묘 (밝은 끝)
    ctx.fillStyle = '#FFD8EC';
    for (let i = 0; i < 5; i++) {
      const py = -(len - 2 - i * (len / 6)) * s;
      const px = Math.sin(i * 2.2 + bx) * 1.6 * s;
      ctx.beginPath(); ctx.arc(px, py, 0.9 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  shade(ctx, () => ellipsePath(ctx, 2 * s, 12 * s, 7 * s, 3 * s), 0.2);
  ctx.restore();
}

// 32. 나폴레옹피시 (오키나와) — 커다란 초록 몸 + 이마 혹 + 두툼한 입술
function drawNapoleonfish(ctx, x, y, t, s) {
  const cruise = Math.sin(t * 2.2) * 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(cruise * 0.008);
  // 꼬리
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#2E7A5E';
  ctx.beginPath();
  ctx.moveTo(-16 * s, 0);
  ctx.quadraticCurveTo(-24 * s, -9 * s + cruise * 0.4, -26 * s, -8 * s);
  ctx.lineTo(-23 * s, 0);
  ctx.lineTo(-26 * s, 8 * s + cruise * 0.4);
  ctx.quadraticCurveTo(-24 * s, 9 * s, -16 * s, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 몸통 (크고 묵직한 타원)
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#3E9A72';
  ctx.beginPath();
  ctx.moveTo(-17 * s, 1 * s);
  ctx.quadraticCurveTo(-14 * s, -10 * s, -2 * s, -12 * s);
  // 시그니처: 이마 혹 (crest)
  ctx.quadraticCurveTo(8 * s, -13.5 * s, 12 * s, -9 * s);
  ctx.quadraticCurveTo(17 * s, -5 * s, 17.5 * s, 0);
  ctx.quadraticCurveTo(17 * s, 6 * s, 10 * s, 9 * s);
  ctx.quadraticCurveTo(-4 * s, 12 * s, -17 * s, 1 * s);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 미로 무늬 (얼굴~몸의 구불구불 세로줄)
  ctx.strokeStyle = 'rgba(20,70,52,0.55)'; ctx.lineWidth = STROKE.detail * s;
  for (let i = 0; i < 5; i++) {
    const lx = (-10 + i * 5) * s;
    ctx.beginPath();
    ctx.moveTo(lx, -8 * s);
    ctx.quadraticCurveTo(lx + Math.sin(i * 2.7) * 3 * s, 0, lx, 8 * s);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(150,230,190,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 5 * s, 13 * s, 5 * s, 0, 0, Math.PI); ctx.fill();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 5 * s, 13 * s, 6 * s), 0.16);
  // 두툼한 입술
  ctx.fillStyle = '#8FD8B4';
  outline(ctx, STROKE.part * s);
  ctx.beginPath(); ctx.ellipse(16.5 * s, 2 * s, 2.6 * s, 3.4 * s, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  eye(ctx, 10 * s, -5 * s, 2.8 * s);
  ctx.restore();
}

// 33. 리본장어 (오키나와) — 파랑+노랑 리본 S웨이브, 콧잎이 나풀
function drawRibbonEel(ctx, x, y, t, s) {
  ctx.save();
  ctx.translate(x, y);
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    const px = (-22 + u * 40) * s;
    const py = Math.sin(t * 3.2 + u * 5.2) * 6 * s * (0.4 + u * 0.6);
    pts.push([px, py]);
  }
  // 리본 몸 (파랑 띠 + 노랑 등 테두리)
  ctx.strokeStyle = INK; ctx.lineWidth = 7.5 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.stroke();
  ctx.strokeStyle = '#2E5EDE'; ctx.lineWidth = 5.6 * s;
  ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.stroke();
  ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 1.6 * s;
  ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py - 2.2 * s) : ctx.moveTo(px, py - 2.2 * s)); ctx.stroke();
  // 머리 (마지막 점) — 콧잎 나풀 + 노랑 주둥이
  const [hx, hy] = pts[12];
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#2E5EDE';
  ctx.beginPath(); ctx.ellipse(hx, hy, 4.4 * s, 3.6 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FFD23F';
  ctx.beginPath(); ctx.moveTo(hx + 3 * s, hy - 1 * s); ctx.quadraticCurveTo(hx + 8 * s, hy - 3 * s + Math.sin(t * 6) * s, hx + 7 * s, hy); ctx.quadraticCurveTo(hx + 8 * s, hy + 3 * s, hx + 3 * s, hy + 1 * s); ctx.closePath(); ctx.fill();
  outline(ctx, STROKE.detail * s); ctx.stroke();
  eye(ctx, hx + 1 * s, hy - 1.2 * s, 1.6 * s);
  ctx.restore();
}

// 34. 블라인드 케이브피시 (세노테) — 창백한 분홍, 눈이 아예 없음
function drawBlindCavefish(ctx, x, y, t, s) {
  const flick = Math.sin(t * 5.5) * 2.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(flick * 0.012);
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#F0C8C0';
  ctx.beginPath();
  ctx.moveTo(-10 * s, 0);
  ctx.lineTo(-17 * s, -6 * s + flick * 0.5);
  ctx.lineTo(-14.5 * s, 0);
  ctx.lineTo(-17 * s, 6 * s + flick * 0.5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#F6DAD2';
  ellipsePath(ctx, 0, 0, 13 * s, 7.5 * s);
  ctx.fill(); ctx.stroke();
  // 반투명 몸 안쪽이 살짝 비침 (창백함 강조)
  ctx.fillStyle = 'rgba(220,140,140,0.28)';
  ctx.beginPath(); ctx.ellipse(-2 * s, 0.5 * s, 6 * s, 3 * s, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(2 * s, -3 * s, 7 * s, 2.4 * s, -0.08, 0, Math.PI * 2); ctx.fill();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 3 * s, 10 * s, 4 * s), 0.12);
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#F0C8C0';
  ctx.beginPath(); ctx.moveTo(-2 * s, -6.5 * s); ctx.quadraticCurveTo(2 * s, -10 * s, 5 * s, -6.5 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  // 시그니처: 눈이 있어야 할 자리가 매끈함 (점 하나 없음) + 감각 수염 라인
  ctx.strokeStyle = rgba(INK, 0.25); ctx.lineWidth = STROKE.detail * s;
  ctx.beginPath(); ctx.moveTo(8 * s, 1 * s); ctx.quadraticCurveTo(11 * s, 2 * s, 12.5 * s, 1.4 * s); ctx.stroke();
  ctx.restore();
}

// 35. 만다린피시 (라자암팟) — 주황 바탕 + 파랑 소용돌이 무늬, 세상에서 가장 화려
function drawMandarinfish(ctx, x, y, t, s) {
  const hover = Math.sin(t * 3.4) * 1.6;
  ctx.save();
  ctx.translate(x, y + hover * 0.4);
  // 부채 꼬리
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#F08030';
  ctx.beginPath(); ctx.ellipse(-12 * s, 0, 5 * s, 6.5 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#2E7EDE'; ctx.lineWidth = 1.2 * s;
  ctx.beginPath(); ctx.ellipse(-12 * s, 0, 3.2 * s, 4.6 * s, 0, 0, Math.PI * 2); ctx.stroke();
  // 몸통 (둥글넓적)
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#F89040';
  ellipsePath(ctx, 0, 0, 12 * s, 8.5 * s);
  ctx.fill(); ctx.stroke();
  // 시그니처: 파랑 소용돌이 줄무늬 (물감 뿌린 듯)
  ctx.strokeStyle = '#2E7EDE'; ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8 * s, -4 * s); ctx.quadraticCurveTo(-2 * s, -8 * s, 3 * s, -4 * s); ctx.quadraticCurveTo(6 * s, -2 * s, 4 * s, 1 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-9 * s, 3 * s); ctx.quadraticCurveTo(-3 * s, 7 * s, 4 * s, 4.5 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4 * s, -1 * s); ctx.quadraticCurveTo(-1 * s, 1.5 * s, -5 * s, 3 * s); ctx.stroke();
  ctx.strokeStyle = '#3EDEA8'; ctx.lineWidth = 1.1 * s;
  ctx.beginPath(); ctx.moveTo(6 * s, -5 * s); ctx.quadraticCurveTo(9 * s, -3 * s, 8 * s, 0); ctx.stroke();
  // 큰 등지느러미 (돛처럼, 파랑 테)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#F08030';
  ctx.beginPath(); ctx.moveTo(-4 * s, -7.5 * s); ctx.quadraticCurveTo(0, -14 * s + hover * 0.5, 6 * s, -7.5 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#2E7EDE'; ctx.lineWidth = 1.4 * s;
  ctx.beginPath(); ctx.moveTo(-2.5 * s, -8 * s); ctx.quadraticCurveTo(0.5 * s, -12 * s + hover * 0.5, 4.5 * s, -8 * s); ctx.stroke();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 3 * s, 9 * s, 4.5 * s), 0.14);
  eye(ctx, 8.5 * s, -2.5 * s, 2.6 * s);
  ctx.restore();
}

// 36. 피그미 해마 (라자암팟) — 손톱만 한 분홍 해마, 몸에 산호같은 돌기
function drawPygmySeahorse(ctx, x, y, t, s) {
  const drift = Math.sin(t * 2.6) * 1.4;
  ctx.save();
  ctx.translate(x, y + drift * 0.5);
  ctx.rotate(Math.sin(t * 1.8) * 0.06);
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#F2A0B4';
  // S자 몸통 (머리-배-말린 꼬리)
  ctx.beginPath();
  ctx.moveTo(2 * s, -12 * s);
  ctx.quadraticCurveTo(7 * s, -11 * s, 6 * s, -6 * s);
  ctx.quadraticCurveTo(8 * s, 2 * s, 4 * s, 7 * s);
  ctx.quadraticCurveTo(1 * s, 11 * s, -3 * s, 10 * s);
  ctx.quadraticCurveTo(-6.5 * s, 9 * s, -5 * s, 6 * s);
  ctx.quadraticCurveTo(-4 * s, 4.5 * s, -2 * s, 5.5 * s);
  ctx.quadraticCurveTo(0.5 * s, 6.5 * s, 1 * s, 3 * s);
  ctx.quadraticCurveTo(1.5 * s, -2 * s, 0 * s, -5 * s);
  ctx.quadraticCurveTo(-2 * s, -9 * s, -1 * s, -11 * s);
  ctx.quadraticCurveTo(0, -13 * s, 2 * s, -12 * s);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 주둥이
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#F2A0B4';
  ctx.beginPath(); ctx.ellipse(5 * s, -11 * s, 3 * s, 1.5 * s, 0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 시그니처: 산호 폴립을 닮은 붉은 돌기들
  ctx.fillStyle = '#E05A78';
  for (const [px, py] of [[3, -8], [5, -3], [4, 2], [1, 6], [-2, -3], [0, -0.5]]) {
    ctx.beginPath(); ctx.arc(px * s, py * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
  }
  outline(ctx, STROKE.detail * s);
  for (const [px, py] of [[3, -8], [5, -3], [4, 2]]) {
    ctx.beginPath(); ctx.arc(px * s, py * s, 1.5 * s, 0, Math.PI * 2); ctx.stroke();
  }
  // 팔랑 등지느러미
  ctx.fillStyle = 'rgba(255,200,215,0.75)';
  ctx.beginPath(); ctx.moveTo(-1 * s, -2 * s); ctx.quadraticCurveTo(-6 * s + drift, -1 * s, -2 * s, 2 * s); ctx.closePath(); ctx.fill();
  eye(ctx, 2 * s, -10 * s, 1.7 * s);
  ctx.restore();
}

// 37. 만타레이 (몰디브) — 검은 다이아몬드 날개 + 흰 배, 날갯짓 활공
function drawMantaRay(ctx, x, y, t, s) {
  const flap = Math.sin(t * 1.6) * 6; // 느리고 우아한 날갯짓
  ctx.save();
  ctx.translate(x, y);
  // 꼬리 (가늘고 길게)
  ctx.strokeStyle = INK; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-16 * s, 1 * s); ctx.quadraticCurveTo(-26 * s, 2 * s + flap * 0.3, -33 * s, 0.5 * s); ctx.stroke();
  // 날개+몸 실루엣 (다이아몬드)
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#20303E';
  ctx.beginPath();
  ctx.moveTo(14 * s, 0);
  ctx.quadraticCurveTo(6 * s, -3 * s, -2 * s, -4 * s);
  ctx.quadraticCurveTo(8 * s, -8 * s - flap, 20 * s, -16 * s - flap); // 오른 날개끝(위)
  ctx.quadraticCurveTo(4 * s, -9 * s - flap * 0.6, -8 * s, -5 * s);
  ctx.quadraticCurveTo(-16 * s, -2 * s, -16 * s, 0.5 * s);
  ctx.quadraticCurveTo(-16 * s, 3 * s, -8 * s, 5 * s);
  ctx.quadraticCurveTo(4 * s, 9 * s + flap * 0.6, 20 * s, 16 * s + flap); // 왼 날개끝(아래)
  ctx.quadraticCurveTo(8 * s, 8 * s + flap, -2 * s, 4 * s);
  ctx.quadraticCurveTo(6 * s, 3 * s, 14 * s, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 흰 배 얼룩 (만타 개체식별 무늬)
  ctx.fillStyle = 'rgba(240,248,252,0.85)';
  ctx.beginPath(); ctx.ellipse(-2 * s, 0.5 * s, 8 * s, 3.4 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20303E';
  ctx.beginPath(); ctx.arc(-5 * s, 0.5 * s, 1.1 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-1 * s, 1.4 * s, 0.9 * s, 0, Math.PI * 2); ctx.fill();
  shade(ctx, () => ellipsePath(ctx, -2 * s, 2 * s, 10 * s, 3.5 * s), 0.15);
  // 머리지느러미 (세팔릭 핀 한 쌍 — 뿔처럼)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#20303E';
  ctx.beginPath(); ctx.moveTo(13 * s, -2 * s); ctx.quadraticCurveTo(19 * s, -4 * s, 18 * s, -1 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(13 * s, 2 * s); ctx.quadraticCurveTo(19 * s, 4 * s, 18 * s, 1 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  eye(ctx, 11 * s, -1.5 * s, 1.8 * s);
  ctx.restore();
}

// 38. 고래상어 (몰디브) — 세상에서 가장 큰 물고기, 회청색+흰 점 격자
function drawWhaleShark(ctx, x, y, t, s) {
  const cruise = Math.sin(t * 1.4) * 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(cruise * 0.004);
  // 꼬리 (초승달, 위쪽이 김)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#3E5A72';
  ctx.beginPath();
  ctx.moveTo(-22 * s, 0);
  ctx.quadraticCurveTo(-27 * s, -4 * s, -30 * s, -12 * s + cruise * 0.5);
  ctx.quadraticCurveTo(-26 * s, -2 * s, -25 * s, 1 * s);
  ctx.quadraticCurveTo(-27 * s, 5 * s, -29 * s, 8 * s + cruise * 0.5);
  ctx.quadraticCurveTo(-25 * s, 6 * s, -22 * s, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 몸통 (넓적하고 긴 유선형)
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#48688A';
  ctx.beginPath();
  ctx.moveTo(-23 * s, 0);
  ctx.quadraticCurveTo(-16 * s, -8 * s, 0, -9.5 * s);
  ctx.quadraticCurveTo(14 * s, -10 * s, 22 * s, -5 * s);
  ctx.quadraticCurveTo(25.5 * s, -2 * s, 25.5 * s, 0.5 * s);
  ctx.quadraticCurveTo(25 * s, 3.5 * s, 18 * s, 6 * s);
  ctx.quadraticCurveTo(2 * s, 10 * s, -12 * s, 7 * s);
  ctx.quadraticCurveTo(-20 * s, 5 * s, -23 * s, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 배 (연한 회백)
  ctx.fillStyle = 'rgba(220,232,240,0.5)';
  ctx.beginPath(); ctx.ellipse(0, 6 * s, 18 * s, 3.4 * s, 0, 0, Math.PI); ctx.fill();
  // 등 융기선 3줄
  ctx.strokeStyle = 'rgba(20,40,60,0.4)'; ctx.lineWidth = STROKE.detail * s;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-18 * s, (-6 + i * 2.2) * s);
    ctx.quadraticCurveTo(0, (-8.5 + i * 2.4) * s, 20 * s, (-4 + i * 1.8) * s);
    ctx.stroke();
  }
  // 시그니처: 흰 점 격자 (체크판 무늬)
  ctx.fillStyle = 'rgba(235,245,250,0.9)';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      const px = (-18 + c * 5.4 + (r % 2) * 2.7) * s;
      const py = (-6.5 + r * 3.6) * s;
      ctx.beginPath(); ctx.arc(px, py, 1.05 * s, 0, Math.PI * 2); ctx.fill();
    }
  }
  shade(ctx, () => ellipsePath(ctx, 2 * s, 4 * s, 20 * s, 5 * s), 0.15);
  // 등지느러미 + 넓적한 입
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#3E5A72';
  ctx.beginPath(); ctx.moveTo(-6 * s, -9 * s); ctx.quadraticCurveTo(-2 * s, -14 * s, 3 * s, -9 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(19 * s, -1.5 * s); ctx.quadraticCurveTo(24 * s, -0.5 * s, 25 * s, 1 * s); ctx.stroke();
  eye(ctx, 17 * s, -4.5 * s, 1.6 * s);
  ctx.restore();
}

// 39. 바다이구아나 (갈라파고스) — 잠수하는 유일한 도마뱀, 꼬리로 헤엄
function drawMarineIguana(ctx, x, y, t, s) {
  const tailWave = Math.sin(t * 3.2) * 5;
  ctx.save();
  ctx.translate(x, y);
  // 꼬리 (좌우로 저으며 추진 — 세로로 납작)
  ctx.strokeStyle = INK; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10 * s, 1 * s);
  ctx.quadraticCurveTo(-17 * s, 2 * s + tailWave * 0.4, -23 * s, tailWave * s * 0.16 + 1 * s);
  ctx.stroke();
  ctx.strokeStyle = '#3A4038'; ctx.lineWidth = 3.4 * s;
  ctx.beginPath();
  ctx.moveTo(-10 * s, 1 * s);
  ctx.quadraticCurveTo(-17 * s, 2 * s + tailWave * 0.4, -23 * s, tailWave * s * 0.16 + 1 * s);
  ctx.stroke();
  // 뒷다리 (몸에 붙임 — 유영 자세)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#464C42';
  ctx.beginPath(); ctx.ellipse(-6 * s, 4.5 * s, 4 * s, 2 * s, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 몸통
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#4E5648';
  ctx.beginPath();
  ctx.moveTo(-11 * s, 1 * s);
  ctx.quadraticCurveTo(-6 * s, -4.5 * s, 3 * s, -4.5 * s);
  ctx.quadraticCurveTo(10 * s, -4 * s, 12 * s, -1 * s);
  ctx.quadraticCurveTo(13 * s, 2 * s, 8 * s, 4 * s);
  ctx.quadraticCurveTo(-2 * s, 6.5 * s, -11 * s, 1 * s);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 시그니처: 등 가시 볏 (머리~꼬리)
  ctx.strokeStyle = '#2E3428'; ctx.lineWidth = STROKE.detail * s * 1.2; ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const gx = (-9 + i * 3.2) * s;
    const gy = (-3.6 + Math.abs(i - 3) * 0.5) * s;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 0.4 * s, gy - 3 * s); ctx.stroke();
  }
  // 얼룩 (소금기 하얀 자국 — 재채기로 소금 배출)
  ctx.fillStyle = 'rgba(220,225,215,0.35)';
  ctx.beginPath(); ctx.arc(6 * s, -2 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
  shade(ctx, () => ellipsePath(ctx, 0, 3 * s, 9 * s, 3 * s), 0.2);
  // 뭉툭한 머리 + 앞발
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#4E5648';
  ctx.beginPath(); ctx.ellipse(13 * s, -1.5 * s, 4.4 * s, 3.6 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(4 * s, 4.5 * s, 3 * s, 1.7 * s, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  eye(ctx, 14 * s, -2.5 * s, 1.8 * s);
  ctx.restore();
}

// 40. 갈라파고스 상어 — 묵직한 회색 몸, 둥근 코, 높은 등지느러미
function drawGalapagosShark(ctx, x, y, t, s) {
  const tailWhip = Math.sin(t * 2.6) * 4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tailWhip * 0.006);
  // 꼬리 (헤테로세르카)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#5E6E7E';
  ctx.beginPath();
  ctx.moveTo(-18 * s, 0);
  ctx.quadraticCurveTo(-23 * s, -3 * s, -26 * s, -10 * s + tailWhip * 0.5);
  ctx.quadraticCurveTo(-22.5 * s, -2 * s, -21.5 * s, 0.5 * s);
  ctx.quadraticCurveTo(-23 * s, 3.5 * s, -24.5 * s, 6 * s + tailWhip * 0.4);
  ctx.quadraticCurveTo(-21 * s, 4 * s, -18 * s, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 몸통 (리프상어보다 두툼)
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#6E8090';
  ctx.beginPath();
  ctx.moveTo(-19 * s, 0);
  ctx.quadraticCurveTo(-10 * s, -7 * s, 4 * s, -6.5 * s);
  ctx.quadraticCurveTo(15 * s, -5.5 * s, 20 * s, -1.5 * s);
  ctx.quadraticCurveTo(21.5 * s, 0.5 * s, 19 * s, 2 * s);
  ctx.quadraticCurveTo(8 * s, 6.5 * s, -8 * s, 5.5 * s);
  ctx.quadraticCurveTo(-16 * s, 4.5 * s, -19 * s, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 카운터셰이딩 흰 배
  ctx.fillStyle = 'rgba(235,242,248,0.75)';
  ctx.beginPath(); ctx.ellipse(0, 3.6 * s, 15 * s, 2.8 * s, 0, 0, Math.PI); ctx.fill();
  shade(ctx, () => ellipsePath(ctx, 2 * s, 2 * s, 15 * s, 4 * s), 0.14);
  // 시그니처: 유난히 높고 곧은 첫 등지느러미
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#5E6E7E';
  ctx.beginPath(); ctx.moveTo(-5 * s, -6 * s); ctx.lineTo(-1 * s, -14.5 * s); ctx.quadraticCurveTo(1.5 * s, -8 * s, 4 * s, -6 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  // 가슴지느러미
  ctx.beginPath(); ctx.moveTo(2 * s, 3 * s); ctx.quadraticCurveTo(-1 * s, 10 * s, -6 * s, 11 * s); ctx.quadraticCurveTo(-2 * s, 6 * s, -2 * s, 3.5 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  // 아가미 5줄 + 둥근 코 + 눈
  ctx.strokeStyle = rgba(INK, 0.45); ctx.lineWidth = STROKE.detail * s;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo((8 + i * 1.7) * s, -3.5 * s); ctx.lineTo((8.5 + i * 1.7) * s, 1.5 * s); ctx.stroke();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part * s;
  ctx.beginPath(); ctx.moveTo(17 * s, 1.5 * s); ctx.quadraticCurveTo(19.5 * s, 1.8 * s, 20.5 * s, 0.5 * s); ctx.stroke();
  eye(ctx, 15.5 * s, -2.8 * s, 1.9 * s);
  ctx.restore();
}

// 41. 북극 곤들매기 (실프라) — 은빛 몸 + 분홍 배, 연한 점무늬 (연어 사촌)
function drawArcticChar(ctx, x, y, t, s) {
  const flick = Math.sin(t * 4.6) * 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(flick * 0.008);
  // 꼬리 (얕은 브이)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#7A96A8';
  ctx.beginPath();
  ctx.moveTo(-14 * s, 0);
  ctx.lineTo(-21 * s, -7 * s + flick * 0.4);
  ctx.lineTo(-19 * s, 0);
  ctx.lineTo(-21 * s, 7 * s + flick * 0.4);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 몸통 (길쭉 유선형)
  outline(ctx, STROKE.silhouette * s);
  ctx.fillStyle = '#96AEBE';
  ctx.beginPath();
  ctx.moveTo(-15 * s, 0);
  ctx.quadraticCurveTo(-8 * s, -6.5 * s, 4 * s, -6 * s);
  ctx.quadraticCurveTo(13 * s, -5 * s, 17 * s, -1 * s);
  ctx.quadraticCurveTo(18 * s, 0.5 * s, 16.5 * s, 1.5 * s);
  ctx.quadraticCurveTo(8 * s, 6 * s, -6 * s, 5.5 * s);
  ctx.quadraticCurveTo(-12 * s, 5 * s, -15 * s, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 시그니처: 산란기 분홍 배
  ctx.fillStyle = 'rgba(240,140,130,0.6)';
  ctx.beginPath(); ctx.ellipse(0, 3.6 * s, 13 * s, 2.6 * s, 0, 0, Math.PI); ctx.fill();
  // 은빛 하이라이트 + 연한 점무늬
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.ellipse(2 * s, -2.5 * s, 11 * s, 2 * s, -0.06, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(250,235,225,0.75)';
  for (const [px, py] of [[-9, -2], [-4, -3.5], [2, -3], [7, -2.2], [-6, 1], [1, 0.5], [9, 0]]) {
    ctx.beginPath(); ctx.arc(px * s, py * s, 0.85 * s, 0, Math.PI * 2); ctx.fill();
  }
  shade(ctx, () => ellipsePath(ctx, 2 * s, 2.5 * s, 13 * s, 3.4 * s), 0.13);
  // 등지느러미 + 기름지느러미(연어과 시그니처)
  outline(ctx, STROKE.part * s);
  ctx.fillStyle = '#7A96A8';
  ctx.beginPath(); ctx.moveTo(-3 * s, -5.8 * s); ctx.quadraticCurveTo(1 * s, -9.5 * s, 5 * s, -5.6 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-10 * s, -4.4 * s, 1.6 * s, 1.1 * s, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  eye(ctx, 13 * s, -2.2 * s, 2.2 * s);
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
  { id: 'barreleye', name: '미즈우오', zone: 'twilight', weight: 2, size: 1.1, swayAmp: 4, swayPeriod: 3.0, glowing: true, draw: drawBarreleye },

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

  // ---- 나라별 고유종 (1.1 확장) — siteOnly: 해당 다이빙 스팟에서만 스폰 ----
  { id: 'damselfish', name: '자리돔', zone: 'shallow', weight: 7, size: 0.8, swayAmp: 9, swayPeriod: 1.9, glowing: false, draw: drawDamselfish, siteOnly: 'jeju', country: 'KR' },
  { id: 'scorpionfish', name: '쏨뱅이', zone: 'shallow', weight: 5, size: 1.1, swayAmp: 2, swayPeriod: 4.2, glowing: false, draw: drawScorpionfish, siteOnly: 'jeju', country: 'KR' },
  { id: 'softcoral', name: '연산호', zone: 'shallow', weight: 5, size: 1.2, swayAmp: 1.5, swayPeriod: 4.6, glowing: false, draw: drawSoftCoral, siteOnly: 'jeju', country: 'KR' },
  { id: 'napoleonfish', name: '나폴레옹피시', zone: 'shallow', weight: 6, size: 1.6, swayAmp: 5, swayPeriod: 3.2, glowing: false, draw: drawNapoleonfish, siteOnly: 'okinawa', country: 'JP' },
  { id: 'ribboneel', name: '리본장어', zone: 'shallow', weight: 6, size: 1.0, swayAmp: 6, swayPeriod: 2.4, glowing: false, draw: drawRibbonEel, siteOnly: 'okinawa', country: 'JP' },
  { id: 'blindcavefish', name: '블라인드 케이브피시', zone: 'shallow', weight: 7, size: 0.9, swayAmp: 7, swayPeriod: 2.0, glowing: false, draw: drawBlindCavefish, siteOnly: 'cenote', country: 'MX' },
  { id: 'mandarinfish', name: '만다린피시', zone: 'shallow', weight: 6, size: 0.85, swayAmp: 6, swayPeriod: 2.2, glowing: false, draw: drawMandarinfish, siteOnly: 'rajaampat', country: 'ID' },
  { id: 'pygmyseahorse', name: '피그미 해마', zone: 'shallow', weight: 5, size: 0.7, swayAmp: 4, swayPeriod: 3.0, glowing: false, draw: drawPygmySeahorse, siteOnly: 'rajaampat', country: 'ID' },
  { id: 'mantaray', name: '만타레이', zone: 'shallow', weight: 6, size: 1.7, swayAmp: 6, swayPeriod: 3.6, glowing: false, draw: drawMantaRay, siteOnly: 'maldives', country: 'MV' },
  { id: 'whaleshark', name: '고래상어', zone: 'shallow', weight: 5, size: 1.9, swayAmp: 4, swayPeriod: 4.0, glowing: false, draw: drawWhaleShark, siteOnly: 'maldives', country: 'MV' },
  { id: 'marineiguana', name: '바다이구아나', zone: 'shallow', weight: 6, size: 1.1, swayAmp: 5, swayPeriod: 2.8, glowing: false, draw: drawMarineIguana, siteOnly: 'galapagos', country: 'EC' },
  { id: 'galapagosshark', name: '갈라파고스 상어', zone: 'twilight', weight: 7, size: 1.5, swayAmp: 6, swayPeriod: 3.0, glowing: false, draw: drawGalapagosShark, siteOnly: 'galapagos', country: 'EC' },
  { id: 'arcticchar', name: '북극 곤들매기', zone: 'shallow', weight: 7, size: 1.0, swayAmp: 7, swayPeriod: 2.2, glowing: false, draw: drawArcticChar, siteOnly: 'silfra', country: 'IS' },
];

// ---------------------------------------------------------------------------
// 헤드램프 어둠 연출용 발광 지점 좌표 (미드나이트존/헤달존 전용, game.js에서 사용).
// 좌표는 각 draw 함수 안에서 실제로 glow()/eye({glow}) 호출에 쓰인 위치와 동일한
// "s배 전" 기준 오프셋이다 (game.js에서 creature.curX + dx*sp.size 로 환산).
// 이 리스트에 없는(비발광) 종은 조명 범위 밖에서는 아예 보이지 않는다.
export const GLOW_SPOTS = {
  moonjelly: [{ dx: 0, dy: 0, r: 14, color: '#bfe8ff', alpha: 0.4 }],
  lanternfish: [
    { dx: -4, dy: 1, r: 7, color: '#8ad1ff', alpha: 0.5 },
    { dx: -8, dy: -0.5, r: 1, color: '#cfefff', alpha: 0.85 },
    { dx: 0, dy: -0.5, r: 1, color: '#cfefff', alpha: 0.85 },
    { dx: 8, dy: -0.5, r: 1, color: '#cfefff', alpha: 0.85 },
  ],
  viperfish: [{ dx: -10, dy: -20, r: 6, color: '#8ad1ff', alpha: 0.65 }],
  hatchetfish: [{ dx: -2, dy: 2, r: 8, color: '#9fd8ff', alpha: 0.45 }],
  barreleye: [
    { dx: -4.5, dy: -6, r: 4, color: '#8dffb8', alpha: 0.5 },
    { dx: 4.5, dy: -6, r: 4, color: '#8dffb8', alpha: 0.5 },
  ],
  anglerfish: [{ dx: 17, dy: -22, r: 12, color: '#ffe27a', alpha: 0.75 }],
  pelicaneel: [{ dx: 32, dy: 0, r: 5, color: '#ff5c4d', alpha: 0.6 }],
  dragonfish: [
    { dx: 12, dy: 46, r: 7, color: '#ffb066', alpha: 0.7 },
    { dx: 6, dy: -0.5, r: 3.5, color: '#bfe8ff', alpha: 0.5 },
  ],
  vampiresquid: [
    { dx: 8.5, dy: -4, r: 4.5, color: '#ff4d6d', alpha: 0.75 },
    { dx: -8.5, dy: -4, r: 4.5, color: '#ff4d6d', alpha: 0.75 },
  ],
  dumbooctopus: [{ dx: 0, dy: -2, r: 9, color: '#ffe0f0', alpha: 0.3 }],
  dandelionjelly: [{ dx: 0, dy: 0, r: 12, color: '#ff5a5a', alpha: 0.45 }],
};

export function speciesGlowSpots(id) {
  return GLOW_SPOTS[id] || null;
}

// siteId(옵션): 현재 다이빙 스팟 id — siteOnly 종은 자기 스팟에서만 풀에 들어간다.
export function speciesPoolForZone(zoneId, siteId = null) {
  return SPECIES.filter(sp => sp.zone === zoneId && (!sp.siteOnly || sp.siteOnly === siteId));
}

export function speciesById(id) {
  return SPECIES.find(sp => sp.id === id);
}

// 구역별 가중치 스폰 + "골고루 등장" 보정
// - 오래 안 나온 종일수록 실제 뽑힐 확률이 급격히 올라가 30~60초 내 최소 1회 등장을 보장
// - 방금 나온 종은 크게 억제해 같은 종 연속 반복을 방지
export function pickSpeciesForZone(zoneId, lastSpawnAt, lastSpeciesId, timeSec, siteId = null) {
  const pool = speciesPoolForZone(zoneId, siteId);
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
