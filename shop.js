// shop.js — 진주 재화 + 영구 장비 업그레이드 (메타 진행 루프)
// 런에서 모은 점수(진주·보물상자 등 수집 점수)가 런 종료 시(클리어/조난 모두)
// "진주" 잔고로 합산되고, 상점에서 장비 업그레이드에 소비된다. 전부 localStorage 저장.

const PEARL_KEY = 'deepdiver.pearls.v1';
const UPG_KEY = 'deepdiver.upgrades.v1';

// 장비 5종 — 각 3레벨, 가격은 기하급수적. 1레벨 여러 개는 첫 두세 런(런당 대략
// 15~40진주) 안에 살 수 있도록 초반 가격을 낮게 잡았다.
export const UPGRADES = [
  {
    id: 'oxygen', icon: '🛢️', name: '산소통', maxLevel: 3, prices: [30, 120, 400],
    desc: '최대 하트 +1 (3 → 6)',
    levelDesc: (lv) => `최대 하트 ${3 + lv}개`,
  },
  {
    id: 'lamp', icon: '🔦', name: '헤드램프', maxLevel: 3, prices: [40, 150, 450],
    desc: '심해 조명 반경 +20%씩',
    levelDesc: (lv) => `조명 반경 +${lv * 20}%`,
  },
  {
    id: 'fins', icon: '🦵', name: '롱핀', maxLevel: 3, prices: [30, 100, 300],
    desc: '이동 속도/반응성 +10%씩',
    levelDesc: (lv) => `이동 속도 +${lv * 10}%`,
  },
  {
    id: 'magnet', icon: '🧲', name: '진주 자석', maxLevel: 3, prices: [50, 160, 500],
    desc: '아이템 흡인 반경 확대',
    levelDesc: (lv) => (lv === 0 ? '흡인 없음' : `흡인 반경 ${[0, 60, 100, 150][lv]}px`),
  },
  {
    id: 'suit', icon: '🦺', name: '강화 슈트', maxLevel: 3, prices: [40, 140, 420],
    desc: '피격 무적시간 +0.4초씩',
    levelDesc: (lv) => `무적 ${(1.3 + lv * 0.4).toFixed(1)}초`,
  },
];

export const MAGNET_RADII = [0, 60, 100, 150];

export function loadPearls() {
  try {
    const n = parseInt(localStorage.getItem(PEARL_KEY), 10);
    return isFinite(n) && n >= 0 ? n : 0;
  } catch (e) { return 0; }
}

export function savePearls(n) {
  try { localStorage.setItem(PEARL_KEY, String(Math.max(0, Math.floor(n)))); } catch (e) {}
}

export function loadUpgrades() {
  const base = { oxygen: 0, lamp: 0, fins: 0, magnet: 0, suit: 0 };
  try {
    const raw = localStorage.getItem(UPG_KEY);
    if (!raw) return base;
    const obj = JSON.parse(raw);
    for (const k of Object.keys(base)) {
      const def = UPGRADES.find(u => u.id === k);
      const v = parseInt(obj[k], 10);
      base[k] = isFinite(v) ? Math.max(0, Math.min(def.maxLevel, v)) : 0;
    }
  } catch (e) { /* 손상된 저장값은 초기값으로 */ }
  return base;
}

export function saveUpgrades(upg) {
  try { localStorage.setItem(UPG_KEY, JSON.stringify(upg)); } catch (e) {}
}
