// utils.js — 색 유틸, 외곽선 위계 상수, 잉크 셀셰이딩 헬퍼, 가중치 랜덤

export const CANVAS_W = 340;
export const CANVAS_H = 600;

// ---- 잉크(외곽선) 색 & 위계 -------------------------------------------------
export const INK = '#16233B';

export const STROKE = {
  silhouette: 3.4, // 실루엣 (몸통 전체 윤곽)
  part: 2.2,       // 파트 경계 (지느러미, 팔다리 등)
  detail: 1.2,     // 디테일 (눈, 이빨, 무늬 등)
};

// ---- 색 보간 ----------------------------------------------------------------
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const tt = Math.max(0, Math.min(1, t));
  return rgbToHex(a.r + (b.r - a.r) * tt, a.g + (b.g - a.g) * tt, a.b + (b.b - a.b) * tt);
}

export function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function inkAlpha(alpha) {
  return rgba(INK, alpha);
}

// ---- 3톤 셀셰이딩 헬퍼 --------------------------------------------------------
// 그림자는 새 색을 정의하지 않고 잉크색 반투명을 덧얹는다 (alpha 0.22~0.32)
export function shade(ctx, drawPathFn, alpha = 0.26) {
  ctx.save();
  ctx.fillStyle = inkAlpha(alpha);
  drawPathFn();
  ctx.fill();
  ctx.restore();
}

// 하이라이트: 흰색 계열 반투명 (밝은 부분 강조용, 절제해서 사용)
export function hilite(ctx, drawPathFn, alpha = 0.35) {
  ctx.save();
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  drawPathFn();
  ctx.fill();
  ctx.restore();
}

// 눈: 검은자+하이라이트 점 하나로 캐릭터 표정을 만드는 공용 헬퍼
export function eye(ctx, x, y, r, opts = {}) {
  const { open = true, glow = null } = opts;
  ctx.save();
  if (glow) {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = r * 4;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (open) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x + r * 0.15, y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x - r * 0.2, y - r * 0.3, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = INK;
    ctx.lineWidth = STROKE.detail;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.quadraticCurveTo(x, y + r * 0.6, x + r, y);
    ctx.stroke();
  }
  ctx.restore();
}

// 물방울 하나 — 살짝 일그러진 타원 + 위쪽 가장자리 밝은 림 하이라이트로 진짜
// 물방울처럼 보이게 한다(플랫한 원 하나짜리보다 훨씬 사실적). 다이버 기포 트레일,
// 환경 기포, 생물 기포 등 여러 곳에서 공용으로 재사용한다.
export function drawBubble(ctx, x, y, r, alpha = 0.5) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(206,233,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(0.5, r * 0.22);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  // 위쪽 가장자리 밝은 림 하이라이트
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(0.5, r * 0.3);
  ctx.beginPath();
  ctx.arc(x - r * 0.28, y - r * 0.42, r * 0.34, 0.1, Math.PI * 1.15);
  ctx.stroke();
  ctx.restore();
}

// 발광 글로우: 광원(헤드램프, 유인돌기 등)의 방사형 halo
export function glow(ctx, x, y, radius, color, alpha = 0.55) {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.5, rgba(color, alpha * 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 계단식(stair-stack) 반투명 레이어 쌓기: 빛줄기/베일 밴딩 방지용
// drawLayerFn(alpha, index, count) 를 count번 얇은 alpha로 겹쳐 그린다
export function stairStack(ctx, count, baseAlpha, drawLayerFn) {
  for (let i = 0; i < count; i++) {
    ctx.save();
    ctx.globalAlpha = baseAlpha;
    drawLayerFn(i, count);
    ctx.restore();
  }
}

// ---- 결정적 해시 노이즈 (상태 없음, 같은 입력엔 항상 같은 출력) ----------------
// 절차적 텍스처(균열/얼룩/지터)에 사용. Math.random() 대신 이걸 쓰면 매 프레임
// 다시 그려도(캔버스 특성상 필연적으로 매번 다시 그림) 같은 자리에 같은 무늬가
// 나와서 "깜빡이는 노이즈"가 되지 않는다.
export function hash(seed) {
  const n = Math.sin(seed * 12.9898) * 43758.5453;
  return n - Math.floor(n); // [0,1)
}

export function hash2(a, b) {
  const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return n - Math.floor(n); // [0,1)
}

// 여러 색 정지점을 가진 선형 그라디언트를 간단히 생성 (다단 셰이딩용)
// stops: [[offset(0~1), colorString], ...]
export function multiGradient(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}

// ---- 가중치 랜덤 --------------------------------------------------------------
export function weightedPick(entries) {
  // entries: [{ weight, ...payload }]
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return entries[entries.length - 1];
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
