// sound.js — Web Audio API로 전부 코드 합성하는 사운드 시스템 (오디오 파일 0개, 용량 증가 0)
// iOS Safari 자동재생 정책 대응: AudioContext는 반드시 첫 사용자 제스처 안에서
// initAudio()를 호출해 생성/resume한다 (게임 로직 어디서든 update 루프 등에서 만들면 안 됨).
// 모든 소리는 하나의 마스터 게인(masterGain)을 거쳐 나가므로, 나중에 음소거/볼륨
// 옵션을 붙이려면 masterGain.gain만 조절하면 된다.

let actx = null;
let masterGain = null;

// 수중 앰비언스(브라운 노이즈 드론 + 로우패스) 관련 노드
let noiseSource = null;
let noiseFilter = null;
let noiseGain = null;
let ventOsc = null;
let ventGain = null;

// 짧은 노이즈 버스트(피격음)용으로 재사용하는 화이트 노이즈 버퍼 캐시
let whiteNoiseBufferCache = null;

function now() {
  return actx.currentTime;
}

// 멱등: 이미 만들어져 있으면 resume만 시도(모바일에서 탭 전환 후 suspended 되는 경우 대비)
export function initAudio() {
  if (actx) {
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return; // 아주 오래된 브라우저 폴백: 그냥 무음으로 동작
  actx = new Ctx();
  masterGain = actx.createGain();
  masterGain.gain.value = 0.7;
  masterGain.connect(actx.destination);
}

export function setMasterVolume(v) {
  if (!masterGain) return;
  masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), now(), 0.05);
}

function getWhiteNoiseBuffer() {
  if (whiteNoiseBufferCache) return whiteNoiseBufferCache;
  const len = Math.floor(actx.sampleRate * 0.3);
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  whiteNoiseBufferCache = buf;
  return buf;
}

function createBrownNoiseBuffer(seconds) {
  const len = Math.floor(actx.sampleRate * seconds);
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2; // 브라운 노이즈는 원래 진폭이 작아서 보정 증폭
  }
  return buf;
}

// 짧은 톤(벨/차임의 기본 부품) — attack-decay 엔벨로프의 사인/삼각파 한 알
function playTone(freq, t0, dur, { type = 'sine', vol = 0.2, attack = 0.008 } = {}) {
  if (!actx) return;
  const osc = actx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function playNoiseBurst(t0, dur, vol, { type = 'lowpass', freq = 1200 } = {}) {
  if (!actx) return;
  const src = actx.createBufferSource();
  src.buffer = getWhiteNoiseBuffer();
  const filt = actx.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = freq;
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt).connect(g).connect(masterGain);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// ---- 수중 앰비언스 (배경 드론) -------------------------------------------------
// 낮은 브라운 노이즈를 로우패스로 걸러 "물속 먹먹함"을 낸다. 깊이가 깊어질수록
// 필터 컷오프를 낮춰 더 무겁고 둔탁하게, 열수구 구역에선 아주 낮은 럼블(사인)을 더한다.
export function startAmbience() {
  if (!actx || noiseSource) return;
  noiseSource = actx.createBufferSource();
  noiseSource.buffer = createBrownNoiseBuffer(4);
  noiseSource.loop = true;
  noiseFilter = actx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 2200;
  noiseGain = actx.createGain();
  noiseGain.gain.value = 0.1;
  noiseSource.connect(noiseFilter).connect(noiseGain).connect(masterGain);
  noiseSource.start();

  ventOsc = actx.createOscillator();
  ventOsc.type = 'sine';
  ventOsc.frequency.value = 40;
  ventGain = actx.createGain();
  ventGain.gain.value = 0;
  ventOsc.connect(ventGain).connect(masterGain);
  ventOsc.start();
}

export function stopAmbience() {
  if (!actx || !noiseSource) return;
  const t = now();
  // 클릭 노이즈 방지를 위해 짧게 페이드아웃 후 정지
  noiseGain.gain.setTargetAtTime(0.0001, t, 0.15);
  ventGain.gain.setTargetAtTime(0.0001, t, 0.15);
  const src = noiseSource, vo = ventOsc;
  noiseSource = null; ventOsc = null;
  setTimeout(() => { try { src.stop(); vo.stop(); } catch (e) {} }, 400);
}

// depthM: 현재 수심, zoneId: 'shallow'|'twilight'|'deepsea'|'vent'
export function updateAmbience(depthM, zoneId) {
  if (!actx) return;
  if (!noiseSource) startAmbience(); // 늦게 오디오 컨텍스트가 만들어진 경우(예: 개발용 자동시작) 보강
  if (!noiseFilter) return;
  const t = Math.max(0, Math.min(1, depthM / 2500));
  const cutoff = 2200 - t * 1950; // 표층 2200Hz(밝음) → 심해 250Hz(먹먹함)
  noiseFilter.frequency.setTargetAtTime(cutoff, now(), 0.6);
  noiseGain.gain.setTargetAtTime(0.1 + t * 0.07, now(), 1);
  ventGain.gain.setTargetAtTime(zoneId === 'vent' ? 0.075 : 0, now(), 1.2);
}

// 레벨 클리어(수면 도달) 시 로우패스를 순간적으로 활짝 열어 "물 밖으로 나온" 느낌을 낸다.
export function openAmbienceForSurface() {
  if (!noiseFilter) return;
  noiseFilter.frequency.cancelScheduledValues(now());
  noiseFilter.frequency.setTargetAtTime(6000, now(), 0.25);
}

// ---- 효과음 -------------------------------------------------------------------

// 기포음: 짧은 사인 스윕(뽀글). pitchMul로 랜덤 피치를 줘서 단조롭지 않게.
export function playBubble(pitchMul = 1, vol = 0.16) {
  if (!actx) return;
  const t = now();
  const osc = actx.createOscillator();
  osc.type = 'sine';
  const startF = (650 + Math.random() * 220) * pitchMul;
  const endF = (1500 + Math.random() * 500) * pitchMul;
  osc.frequency.setValueAtTime(startF, t);
  osc.frequency.exponentialRampToValueAtTime(endF, t + 0.09);
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.014);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(g).connect(masterGain);
  osc.start(t); osc.stop(t + 0.14);
}

// UI 클릭(핀 탭 / 다이빙 시작 버튼)
export function playClick() {
  if (!actx) return;
  const t = now();
  playTone(950, t, 0.07, { type: 'triangle', vol: 0.14, attack: 0.004 });
  playTone(1400, t + 0.02, 0.05, { type: 'sine', vol: 0.08, attack: 0.004 });
}

// 진주: 맑은 톤 1개 (배음 하나 얹어 벨 느낌)
export function playPearl() {
  if (!actx) return;
  const t = now();
  playTone(1568, t, 0.35, { type: 'sine', vol: 0.22, attack: 0.005 });
  playTone(3136, t, 0.2, { type: 'sine', vol: 0.06, attack: 0.005 });
}

// 산소/기타 소형 수집: 진주보다 살짝 낮고 짧은 톤 (구분감)
export function playOxygen() {
  if (!actx) return;
  const t = now();
  playTone(1175, t, 0.28, { type: 'sine', vol: 0.2, attack: 0.005 });
}

// 보물상자: 3음 상승 아르페지오
export function playChest() {
  if (!actx) return;
  const t = now();
  const notes = [523.25, 659.25, 784.0];
  notes.forEach((f, i) => playTone(f, t + i * 0.075, 0.32, { type: 'triangle', vol: 0.18, attack: 0.005 }));
}

// 회복약: 따뜻한 상승 스윕 (삼각파 + 로우패스로 부드럽게)
export function playPotion() {
  if (!actx) return;
  const t = now();
  const osc = actx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(320, t);
  osc.frequency.exponentialRampToValueAtTime(720, t + 0.32);
  const filt = actx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 2200;
  const g = actx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  osc.connect(filt).connect(g).connect(masterGain);
  osc.start(t); osc.stop(t + 0.4);
}

// 레벨 보물(바닥 대형 아이템): 화려한 팡파레
export function playTreasureFanfare() {
  if (!actx) return;
  const t = now();
  const notes = [523.25, 659.25, 784.0, 1046.5, 1318.5];
  notes.forEach((f, i) => {
    const t0 = t + i * 0.09;
    playTone(f, t0, 0.4, { type: 'triangle', vol: 0.2, attack: 0.006 });
    playTone(f * 2, t0, 0.25, { type: 'sine', vol: 0.06, attack: 0.006 });
  });
}

// 피격: 둔탁한 저음 텀프 + 짧은 노이즈 버스트 (과하지 않게)
export function playHit() {
  if (!actx) return;
  const t = now();
  const osc = actx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.16);
  const g = actx.createGain();
  g.gain.setValueAtTime(0.28, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(g).connect(masterGain);
  osc.start(t); osc.stop(t + 0.22);
  playNoiseBurst(t, 0.1, 0.16, { type: 'bandpass', freq: 900 });
}

// 발광 생물 근접 힌트 — 아주 은은한 트레몰로 톤 (긴장감 연출용, intensity 0~1)
export function playCreatureHint(intensity = 0.5) {
  if (!actx) return;
  const t = now();
  const osc = actx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(680 + intensity * 120, t);
  const g = actx.createGain();
  const vol = 0.02 + intensity * 0.035;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  osc.connect(g).connect(masterGain);
  osc.start(t); osc.stop(t + 0.6);
}

// 레벨 클리어(수면 도달): 밝은 팡파레 + 로우패스 개방
export function playLevelClearFanfare() {
  if (!actx) return;
  openAmbienceForSurface();
  const t = now();
  const notes = [523.25, 659.25, 784.0, 1046.5, 1318.5, 1568.0];
  notes.forEach((f, i) => {
    const t0 = t + i * 0.1;
    playTone(f, t0, 0.5, { type: 'triangle', vol: 0.22, attack: 0.006 });
    playTone(f * 1.5, t0, 0.35, { type: 'sine', vol: 0.07, attack: 0.006 });
  });
}
