// player.js — 다이버 상태·입력 처리·유영 모션·드로잉
// 다이버는 화면 세로상 대략 고정된 위치(중하단)를 기준으로 하되, 그 기준선을 중심으로
// 일정 범위 안에서 상하로도 자유롭게 움직일 수 있다(좁은 통로에서 생물을 상하로 피하기 위함).
// 배경/지형/생물이 위로 스크롤되는 방식(무한 스크롤 표준 구현)이다.

import { CANVAS_W, CANVAS_H, INK, STROKE, shade, hilite, eye, glow, clamp } from './utils.js';

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

export function drawPlayer(ctx, player) {
  const x = player.x;
  const y = player.y + player.visualYOffset;
  const facing = player.facing;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);

  // 헤드램프 광원 (아래쪽/전방을 비추는 근거광)
  glow(ctx, 6, -2, 46, '#fff3c4', 0.35);

  // 산소통 (몸 뒤쪽)
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
  ctx.fillStyle = '#c9432f';
  ctx.beginPath();
  ctx.roundRect(-13, -14, 8, 24, 3);
  ctx.fill(); ctx.stroke();
  ctx.restore();

  // 몸통 (둥근 2등신)
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.silhouette;
  ctx.fillStyle = '#2f8fd6';
  ctx.beginPath();
  ctx.ellipse(0, 8, 13, 15, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  shade(ctx, () => { ctx.beginPath(); ctx.ellipse(4, 14, 10, 9, 0, 0, Math.PI * 2); }, 0.24);

  // 물갈퀴 (오리발)
  const finKick = Math.sin(player.swimPhase * 6.5) * 6;
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
  ctx.fillStyle = '#1b3a63';
  ctx.beginPath();
  ctx.moveTo(-4, 20);
  ctx.quadraticCurveTo(-2 + finKick * 0.5, 30, -3 + finKick, 40);
  ctx.quadraticCurveTo(2 + finKick, 42, 4 + finKick, 36);
  ctx.quadraticCurveTo(3, 26, 3, 20);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 스트랩 라인 디테일
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail;
  ctx.beginPath(); ctx.moveTo(-3, 22); ctx.lineTo(3, 22); ctx.stroke();

  // 손목밴드 팔
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
  ctx.fillStyle = '#2f8fd6';
  ctx.beginPath();
  ctx.ellipse(10, 2 + finKick * 0.15, 4.5, 9, -0.5, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#e8c94a'; ctx.lineWidth = STROKE.detail;
  ctx.beginPath(); ctx.arc(12, 8, 3.2, 0, Math.PI * 2); ctx.stroke();

  // 머리 + 큰 마스크
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.silhouette;
  ctx.fillStyle = '#f2c79c';
  ctx.beginPath();
  ctx.ellipse(2, -10, 12, 11, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // 마스크 유리
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.part;
  ctx.fillStyle = 'rgba(200, 235, 255, 0.85)';
  ctx.beginPath();
  ctx.ellipse(5, -9, 9, 7.5, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // 유리 반사광
  hilite(ctx, () => { ctx.beginPath(); ctx.ellipse(3, -12, 3.5, 2, -0.4, 0, Math.PI * 2); }, 0.55);
  eye(ctx, 7, -9, 2.2);

  // 헤드램프 본체
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.detail;
  ctx.fillStyle = '#e8d24a';
  ctx.beginPath();
  ctx.arc(8, -17, 3.4, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff8dc';
  ctx.beginPath();
  ctx.arc(8, -17, 1.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
