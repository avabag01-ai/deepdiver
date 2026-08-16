// player.js — 다이버 상태·입력 처리·유영 모션·드로잉
// 다이버는 화면 세로상 대략 고정된 위치(중하단)를 기준으로 하되, 그 기준선을 중심으로
// 일정 범위 안에서 상하로도 자유롭게 움직일 수 있다(좁은 통로에서 생물을 상하로 피하기 위함).
// 배경/지형/생물이 위로 스크롤되는 방식(무한 스크롤 표준 구현)이다.

import { CANVAS_W, CANVAS_H, INK, STROKE, shade, hilite, eye, glow, clamp, rgba } from './utils.js';

function outline(ctx, w) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

export const PLAYER_ANCHOR_Y = CANVAS_H * 0.72; // 기본(중립) y — 세로 이동 범위의 중심
export const PLAYER_RADIUS = 16; // 시각 크기 기준 (충돌 반경은 game.js에서 0.6배 적용)

// 세로 자유 이동 범위: 화면 세로 길이의 약 35% 구간, 중하단에 위치
export const PLAYER_Y_MIN = CANVAS_H * 0.56;
export const PLAYER_Y_MAX = CANVAS_H * 0.91;

const MOVE_ACCEL = 900;      // px/s^2 — 키/버튼 입력 가속도
const MOVE_MAX_SPEED = 240;  // px/s
const MOVE_DAMPING = 6.0;    // 관성 감쇠 계수 (초당)
const DRAG_FOLLOW = 10.0;    // 드래그 시 목표 좌표로 수렴하는 속도 계수

export function createPlayer() {
  return {
    x: CANVAS_W / 2,
    y: PLAYER_ANCHOR_Y,
    vx: 0,
    vy: 0,
    facing: 1,
    swimPhase: 0,
    // 입력 상태
    keys: { left: false, right: false, up: false, down: false },
    dragTargetX: null,
    dragTargetY: null,
    // 시각 전용 오프셋 (충돌엔 영향 없음) — 발차기 유영 모션
    visualYOffset: 0,
  };
}

export function attachPlayerInput(player, canvasEl) {
  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') player.keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') player.keys.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') player.keys.up = true;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') player.keys.down = true;
  };
  const onKeyUp = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') player.keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') player.keys.right = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') player.keys.up = false;
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') player.keys.down = false;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function clientToCanvasXY(clientX, clientY) {
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  let dragging = false;
  canvasEl.addEventListener('pointerdown', (e) => {
    dragging = true;
    const p = clientToCanvasXY(e.clientX, e.clientY);
    player.dragTargetX = p.x;
    player.dragTargetY = p.y;
    canvasEl.setPointerCapture(e.pointerId);
  });
  canvasEl.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = clientToCanvasXY(e.clientX, e.clientY);
    player.dragTargetX = p.x;
    player.dragTargetY = p.y;
  });
  const endDrag = () => { dragging = false; player.dragTargetX = null; player.dragTargetY = null; };
  canvasEl.addEventListener('pointerup', endDrag);
  canvasEl.addEventListener('pointercancel', endDrag);
  canvasEl.addEventListener('pointerleave', endDrag);

  function bindHoldButton(el, dir) {
    if (!el) return;
    const start = (e) => { e.preventDefault(); player.keys[dir] = true; };
    const end = () => { player.keys[dir] = false; };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);
  }
  bindHoldButton(document.getElementById('btnLeft'), 'left');
  bindHoldButton(document.getElementById('btnRight'), 'right');

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}

// dtSec: 반드시 초 단위로 정규화된 델타타임
export function updatePlayer(player, dtSec, timeSec) {
  if (player.dragTargetX !== null) {
    const diffX = player.dragTargetX - player.x;
    player.vx = diffX * DRAG_FOLLOW;
    const diffY = player.dragTargetY - player.y;
    player.vy = diffY * DRAG_FOLLOW;
  } else {
    let accelX = 0;
    if (player.keys.left) accelX -= MOVE_ACCEL;
    if (player.keys.right) accelX += MOVE_ACCEL;
    player.vx += accelX * dtSec;
    const dampX = Math.exp(-MOVE_DAMPING * dtSec);
    player.vx *= dampX;

    let accelY = 0;
    if (player.keys.up) accelY -= MOVE_ACCEL;
    if (player.keys.down) accelY += MOVE_ACCEL;
    player.vy += accelY * dtSec;
    const dampY = Math.exp(-MOVE_DAMPING * dtSec);
    player.vy *= dampY;
  }

  player.vx = clamp(player.vx, -MOVE_MAX_SPEED, MOVE_MAX_SPEED);
  player.x += player.vx * dtSec;
  player.vy = clamp(player.vy, -MOVE_MAX_SPEED, MOVE_MAX_SPEED);
  player.y += player.vy * dtSec;

  const margin = PLAYER_RADIUS + 4;
  if (player.x < margin) { player.x = margin; if (player.vx < 0) player.vx = 0; }
  if (player.x > CANVAS_W - margin) { player.x = CANVAS_W - margin; if (player.vx > 0) player.vx = 0; }
  if (player.y < PLAYER_Y_MIN) { player.y = PLAYER_Y_MIN; if (player.vy < 0) player.vy = 0; }
  if (player.y > PLAYER_Y_MAX) { player.y = PLAYER_Y_MAX; if (player.vy > 0) player.vy = 0; }

  if (Math.abs(player.vx) > 8) player.facing = player.vx > 0 ? 1 : -1;

  // 발차기 리듬 유영 모션: 기본 진폭 ±7px + 느린 보조 파동 ±5px 합성 (연출 전용, 충돌엔 미반영)
  player.swimPhase = timeSec;
  const kick = Math.sin(timeSec * 6.5) * 7;
  const slow = Math.sin(timeSec * 1.3) * 5;
  player.visualYOffset = kick + slow;
}

// 다이버 배색 — 참고 이미지(화사한 카드 아이콘 스타일)에 맞춘 밝고 채도 높은 팔레트.
// 주변 생물들과 겹치지 않는 청록+노랑 조합으로 "이 캐릭터가 주인공"임을 실루엣만으로도 알 수 있게 함.
const SUIT_MAIN = '#2FB0AE';      // 웻슈트 메인 (밝은 청록)
const SUIT_PANEL = '#0E7C82';     // 가슴판/다리 구역 음영 패널 (짙은 청록)
const SUIT_ACCENT = '#FFD34D';    // 어깨/옆선 포인트 (밝은 노랑)
const SUIT_BELT = '#1B3A4B';      // 벨트·지퍼 (짙은 남색)
const TANK_COLOR = '#CFDBE2';     // 산소통 몸체 (은회색)
const TANK_SHADE = '#9FB2BC';
const VALVE_COLOR = '#E14B3F';    // 산소통 밸브 (빨강)
const FIN_COLOR = '#FFD34D';      // 오리발 (밝은 노랑)
const FIN_SHADE = '#E0AA2A';
const GLOVE_COLOR = '#1B3A4B';
const SKIN_COLOR = '#FBCB98';
const MASK_RIM_OUTER = '#16233B';
const MASK_RIM_INNER = '#3A4F63'; // 마스크 테두리 고무 질감 이중 윤곽
const GLASS_COLOR = 'rgba(196, 238, 255, 0.88)';
const LAMP_BODY = '#FFE07A';
const LAMP_LENS = '#FFFBEA';

export function drawPlayer(ctx, player) {
  const x = player.x;
  const y = player.y + player.visualYOffset;
  const facing = player.facing;

  const finKick = Math.sin(player.swimPhase * 6.5) * 5;
  const armSwing = Math.sin(player.swimPhase * 6.5 + 1.4) * 2.4;
  // 다이버 특유의 헤엄치는 자세감: 상하 이동 속도에 따라 몸 전체를 살짝 기울여
  // 직립 원통형이 아니라 앞으로 나아가는 다이빙 자세처럼 보이게 한다.
  const dive = clamp((player.vy ?? 0) / 220, -1, 1);
  const tilt = dive * 0.22 + Math.sin(player.swimPhase * 6.5) * 0.03;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.rotate(tilt);

  // 귀여운 마스코트 비율: 머리(마스크 포함)가 몸통보다 훨씬 크게, 몸통은 짧고 통통한 2등신 구성.
  // 아래 각 파트는 이 비율을 기준으로 배치된다 — 머리 중심 (2,-11), 몸통 중심 (0,5).

  // 헤드램프 광원 (아래쪽/전방을 비추는 근거광)
  glow(ctx, 8, -19, 40, '#fff3c4', 0.32);

  // ---- 산소통 (등 뒤에 옆모습으로 살짝 걸치게, 짧고 통통하게) ----
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
  ctx.fillStyle = TANK_COLOR;
  ctx.beginPath();
  ctx.roundRect(-15.5, -9, 7, 19, 3.2);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.roundRect(-13, -9, 4.2, 19, 2.6); }, 0.22);
  // 탱크 밸브 + 라벨 링
  ctx.fillStyle = VALVE_COLOR;
  ctx.beginPath(); ctx.roundRect(-14, -12.5, 4.4, 4, 1.3); ctx.fill();
  outline(ctx, STROKE.detail); ctx.stroke();
  ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = STROKE.detail;
  ctx.beginPath(); ctx.moveTo(-15.5, 1); ctx.lineTo(-8.5, 1); ctx.stroke();
  // 호스 라인: 밸브에서 마스크 쪽으로 곡선으로 이어짐
  ctx.strokeStyle = SUIT_BELT; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-11.5, -11);
  ctx.quadraticCurveTo(-3, -9 + Math.sin(player.swimPhase * 3) * 1.3, 3, -6);
  ctx.stroke();
  ctx.restore();

  // ---- 뒤쪽 팔 (짧고 통통한 파닥이는 팔, 뻣뻣하지 않게 둥글림) ----
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
  ctx.fillStyle = SUIT_MAIN;
  ctx.beginPath();
  ctx.ellipse(-9.5, 5 - armSwing * 0.2, 3.6, 6.4, 0.5, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(-9.5, 7 - armSwing * 0.2, 2.6, 4.4, 0.5, 0, Math.PI * 2); }, 0.24);
  ctx.fillStyle = GLOVE_COLOR;
  ctx.beginPath(); ctx.arc(-10.5, 10 - armSwing * 0.2, 2.6, 0, Math.PI * 2);
  outline(ctx, STROKE.detail); ctx.fill(); ctx.stroke();
  ctx.restore();

  // ---- 오리발 (핀) — 짧고 통통한 부채꼴 핀 날 + 스트랩 (과장된 길이 지양) ----
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
  ctx.fillStyle = FIN_COLOR;
  ctx.beginPath();
  ctx.moveTo(-5.5, 14);
  ctx.lineTo(5.5, 14);
  ctx.quadraticCurveTo(7 + finKick * 0.3, 19, 5 + finKick, 24);
  ctx.quadraticCurveTo(9 + finKick, 27, 6 + finKick, 31);
  ctx.quadraticCurveTo(0 + finKick * 0.7, 28, -2 + finKick * 0.6, 24);
  ctx.quadraticCurveTo(-4.5, 19, -5.5, 14);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  shade(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(0, 16.5);
    ctx.quadraticCurveTo(5 + finKick * 0.5, 21, 3 + finKick, 28);
    ctx.lineTo(-1 + finKick * 0.6, 23.5);
    ctx.quadraticCurveTo(-2, 19, 0, 16.5);
  }, 0.24);
  // 핀 골(리브) 라인 디테일
  ctx.strokeStyle = rgba(INK, 0.4); ctx.lineWidth = STROKE.detail;
  ctx.beginPath();
  ctx.moveTo(0, 17.5); ctx.quadraticCurveTo(2 + finKick * 0.5, 23, 1 + finKick, 28);
  ctx.stroke();
  // 발 스트랩
  ctx.strokeStyle = SUIT_BELT; ctx.lineWidth = 2.3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-5, 15.5); ctx.lineTo(5, 15.5); ctx.stroke();
  outline(ctx, STROKE.detail);
  ctx.beginPath(); ctx.moveTo(-5, 15.5); ctx.lineTo(5, 15.5); ctx.stroke();

  // ---- 몸통 (통통하고 둥근 웻슈트 — 타원보다 원에 가깝게, 부드러운 곡선) ----
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.silhouette;
  ctx.fillStyle = SUIT_MAIN;
  ctx.beginPath();
  ctx.ellipse(0, 6, 12.5, 11, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // 가슴판 (짙은 색 패널로 구역 분할, 통통한 몸에 맞춰 둥글게)
  ctx.fillStyle = SUIT_PANEL;
  ctx.beginPath();
  ctx.moveTo(-6.5, -2);
  ctx.quadraticCurveTo(0, 1.5, 6.5, -2);
  ctx.quadraticCurveTo(6, 8, 0, 12.5);
  ctx.quadraticCurveTo(-6, 8, -6.5, -2);
  ctx.closePath();
  ctx.fill();
  outline(ctx, STROKE.part); ctx.stroke();

  // 어깨 포인트 스트라이프 (화사한 노랑 악센트, 통통한 몸 곡선을 따라감)
  ctx.strokeStyle = SUIT_ACCENT; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8.5, -2); ctx.quadraticCurveTo(-10.5, 3, -7.5, 8.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8.5, -2); ctx.quadraticCurveTo(10.5, 3, 7.5, 8.5); ctx.stroke();
  outline(ctx, STROKE.detail);
  ctx.beginPath(); ctx.moveTo(-8.5, -2); ctx.quadraticCurveTo(-10.5, 3, -7.5, 8.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8.5, -2); ctx.quadraticCurveTo(10.5, 3, 7.5, 8.5); ctx.stroke();

  // 지퍼 라인 (중앙)
  ctx.strokeStyle = rgba(INK, 0.55); ctx.lineWidth = STROKE.detail; ctx.setLineDash([1.5, 1.5]);
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 11); ctx.stroke();
  ctx.setLineDash([]);

  // 벨트 (통통한 배 곡선을 따라 둥글게)
  ctx.strokeStyle = SUIT_BELT; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-8, 10); ctx.quadraticCurveTo(0, 13.5, 8, 10); ctx.stroke();
  ctx.fillStyle = SUIT_ACCENT;
  ctx.beginPath(); ctx.roundRect(-2.2, 9.3, 4.4, 3.2, 1); ctx.fill();
  outline(ctx, STROKE.detail); ctx.stroke();

  // 웻슈트 주름 (겨드랑이/허리 접히는 부분 — 통통한 곡선이 자연스럽게 따라가도록)
  ctx.strokeStyle = rgba(INK, 0.28); ctx.lineWidth = STROKE.detail * 0.9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9.5, 2); ctx.quadraticCurveTo(-7, 4, -8.5, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(9.5, 2); ctx.quadraticCurveTo(7, 4, 8.5, 7); ctx.stroke();

  // 하단 음영 (셀셰이딩 3톤 — 잉크 반투명 레이어)
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(3.5, 11, 8, 5.5, 0, 0, Math.PI * 2); }, 0.2);

  // ---- 앞쪽 팔 + 장갑 (짧고 통통, 부드럽게 굽음) ----
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
  ctx.fillStyle = SUIT_MAIN;
  ctx.beginPath();
  ctx.ellipse(9.5, 2 + armSwing * 0.3, 4, 7, -0.45, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(11, 3.5 + armSwing * 0.3, 2.6, 5, -0.45, 0, Math.PI * 2); }, 0.22);
  ctx.strokeStyle = SUIT_ACCENT; ctx.lineWidth = STROKE.detail;
  ctx.beginPath(); ctx.arc(11.5, 6.5 + armSwing * 0.3, 2.8, 0, Math.PI * 2); ctx.stroke();
  // 장갑
  ctx.fillStyle = GLOVE_COLOR;
  ctx.beginPath(); ctx.arc(12.5, 9 + armSwing * 0.3, 2.9, 0, Math.PI * 2);
  outline(ctx, STROKE.detail); ctx.fill(); ctx.stroke();
  ctx.restore();

  // ---- 머리 (피부) — 몸통보다 훨씬 크게, 2등신 비율의 핵심 ----
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.silhouette;
  ctx.fillStyle = SKIN_COLOR;
  ctx.beginPath();
  ctx.ellipse(1.5, -12, 14.5, 14, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(-4.5, -8, 8, 7, 0, 0, Math.PI * 2); }, 0.16);
  // 귀여운 볼 라인 (머리 아래쪽 통통함 강조)
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.beginPath(); ctx.ellipse(1.5, -3, 12, 4, 0, 0, Math.PI); ctx.fill();

  // ---- 마스크 (이중 윤곽 고무 테두리 + 큰 유리) — 머리 크기에 맞춰 확대, 턱 아래로 여백을 남겨 표정이 드러나게 함 ----
  // 바깥 고무 테두리
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.silhouette;
  ctx.fillStyle = MASK_RIM_OUTER;
  ctx.beginPath();
  ctx.ellipse(5.5, -13, 12, 9.2, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // 안쪽 고무 테두리 (질감 이중선)
  ctx.strokeStyle = MASK_RIM_INNER; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.ellipse(5.5, -13, 10.8, 8.1, 0, 0, Math.PI * 2); ctx.stroke();
  // 유리
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
  ctx.fillStyle = GLASS_COLOR;
  ctx.beginPath();
  ctx.ellipse(5.5, -13, 9.8, 7.2, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // 유리 반사광 (큰 하이라이트 + 작은 스파클)
  hilite(ctx, () => { ctx.beginPath(); ctx.ellipse(2.5, -17, 4.2, 2.4, -0.4, 0, Math.PI * 2); }, 0.6);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(12.5, -17.5); ctx.lineTo(13.8, -15.5); ctx.lineTo(12.5, -13.5); ctx.lineTo(11.2, -15.5);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  // 눈썹 (표정 포인트 — 살짝 위로, 즐거운 인상)
  ctx.strokeStyle = INK; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(2, -19.5); ctx.quadraticCurveTo(5, -21.6, 8.5, -19.8); ctx.stroke();

  // 눈 (아주 크고 반짝이게 — 큰 하이라이트 1개 + 작은 스파클 1개 추가)
  const eyeR = 4.2;
  eye(ctx, 7.5, -12.5, eyeR, { glow: null });
  // 추가 작은 스파클 (반대쪽, eye() 헬퍼의 기본 하이라이트에 더해 반짝임 강화)
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.arc(7.5 + eyeR * 0.42, -12.5 + eyeR * 0.35, eyeR * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // 마스크 아래(턱)로 드러난 입 — 크고 뚜렷하게 웃는 입(활짝 미소), 마스크 테두리 아래 여백에 위치
  ctx.strokeStyle = INK; ctx.lineWidth = 1.9; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-1.5, -0.5);
  ctx.quadraticCurveTo(4.5, 6.5, 11, 0);
  ctx.stroke();
  ctx.fillStyle = 'rgba(224,90,80,0.55)';
  ctx.beginPath();
  ctx.moveTo(-1.2, -0.2); ctx.quadraticCurveTo(4.5, 5.6, 10.7, 0.2); ctx.quadraticCurveTo(4.5, 3.6, -1.2, -0.2);
  ctx.fill();
  // 볼터치 (생기 포인트, 통통한 볼에 맞춰 크고 화사하게)
  ctx.fillStyle = 'rgba(255,130,140,0.6)';
  ctx.beginPath(); ctx.ellipse(-5.5, -4, 3.6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,130,140,0.42)';
  ctx.beginPath(); ctx.ellipse(15, -6.5, 2.6, 2, 0, 0, Math.PI * 2); ctx.fill();

  // ---- 헤드램프 (스트랩 + 몸체 + 렌즈) — 큰 머리에 맞춰 확대 ----
  ctx.strokeStyle = SUIT_BELT; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(-7, -19.5); ctx.quadraticCurveTo(3, -25.5, 11, -20.5); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail;
  ctx.fillStyle = LAMP_BODY;
  ctx.beginPath();
  ctx.arc(9.5, -21.5, 4.6, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = rgba(INK, 0.4); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(9.5, -21.5, 3.1, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = LAMP_LENS;
  ctx.beginPath();
  ctx.arc(9.5, -21.5, 2, 0, Math.PI * 2);
  ctx.fill();
  hilite(ctx, () => { ctx.beginPath(); ctx.arc(8.5, -22.5, 0.85, 0, Math.PI * 2); }, 0.8);

  // ---- 숨 기포 트레일 (마스크 옆에서 주기적으로 떠오름, 다이빙 생동감) ----
  const bubblePhase = player.swimPhase * 0.9;
  for (let i = 0; i < 3; i++) {
    const bt = (bubblePhase + i * 0.7) % 1.4;
    if (bt > 1) continue;
    const by = -15 - bt * 22;
    const bx = 4 + Math.sin(bt * 7 + i) * 2.4;
    const br = (0.9 + i * 0.35) * (1 - bt * 0.3);
    ctx.save();
    ctx.globalAlpha = 0.55 * (1 - bt);
    ctx.strokeStyle = 'rgba(220,245,255,0.9)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
