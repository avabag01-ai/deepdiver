// dex.js — 도감(관찰 기록) 시스템: 28종 교육 카드 데이터 + 관찰 기록/보상 저장.
// "바다 생태계 공부"라는 게임 정체성의 핵심 콘텐츠 — 각 종의 실제 서식 수심/크기/
// 특징(아이 눈높이 한 줄)을 담는다. 희귀도는 스폰 가중치(weight)에서 계산한다.

import { SPECIES, speciesById } from './species.js';

const DEX_KEY = 'deepdiver.dex.v1';        // 관찰한 종 id 배열
const DEX_BONUS_KEY = 'deepdiver.dexbonus.v1'; // 구역/전체 완성 보너스 수령 여부

// 28종 카드 정보 — en: 영문명, depth: 실제 서식 수심, size: 실제 성체 크기,
// fact: 흥미로운 사실 한 줄 (생물학 브리프 기반)
export const DEX_INFO = {
  // ---- 표층 ----
  clownfish: { en: 'Clownfish', depth: '1~15m', size: '최대 11cm', fact: '말미잘의 독에 면역이라 그 촉수 속에서 안전하게 살아요.' },
  reefshark: { en: 'Blacktip Reef Shark', depth: '0~80m', size: '최대 1.8m', fact: '산호초 주변을 순찰하듯 도는, 생각보다 겁 많은 상어예요.' },
  morayeel: { en: 'Moray Eel', depth: '1~50m', size: '최대 3m', fact: '입을 뻐끔거리는 건 화가 난 게 아니라 숨을 쉬는 거예요.' },
  seaturtle: { en: 'Green Sea Turtle', depth: '0~40m', size: '최대 1.5m', fact: '한 번 숨을 참으면 5시간까지 잠수할 수 있어요.' },
  orca: { en: 'Orca', depth: '0~100m', size: '최대 9m', fact: '가족(포드)마다 사투리처럼 다른 소리로 대화해요.' },
  flyingfish: { en: 'Flying Fish', depth: '0~20m', size: '최대 45cm', fact: '물 밖으로 뛰어올라 한 번에 400m나 활공할 수 있어요.' },
  bluetang: { en: 'Blue Tang', depth: '2~40m', size: '최대 30cm', fact: '어릴 땐 노란색이었다가 자라면서 파란색으로 변해요.' },
  crab: { en: 'Swimming Crab', depth: '0~50m', size: '최대 20cm', fact: '옆으로 걷지만, 뒷다리를 노처럼 저어 헤엄도 잘 쳐요.' },
  // ---- 트와일라잇존 ----
  moonjelly: { en: 'Moon Jelly', depth: '0~1,000m', size: '최대 40cm', fact: '뇌가 없어도 빛과 어둠, 위아래를 느낄 수 있어요.' },
  lanternfish: { en: 'Lanternfish', depth: '200~1,000m', size: '최대 15cm', fact: '밤마다 수면 근처로 떼지어 올라오는 지구 최대의 통근자예요.' },
  viperfish: { en: 'Viperfish', depth: '200~1,500m', size: '최대 30cm', fact: '이빨이 너무 길어서 입을 완전히 다물지 못해요.' },
  hatchetfish: { en: 'Hatchetfish', depth: '200~1,500m', size: '최대 12cm', fact: '배의 발광기로 자기 그림자를 지워 아래쪽 천적에게 안 보여요.' },
  stiltcrab: { en: 'Giant Spider Crab', depth: '150~800m', size: '다리폭 최대 3.7m', fact: '다리를 활짝 펼치면 자동차보다 넓어요.' },
  glassshrimp: { en: 'Glass Shrimp', depth: '200~1,000m', size: '최대 8cm', fact: '몸이 유리처럼 투명해서 천적 눈에 잘 띄지 않아요.' },
  barreleye: { en: 'Barreleye', depth: '400~800m', size: '최대 15cm', fact: '투명한 돔 모양 머리 속에서 초록 눈이 위를 올려다봐요.' },
  // ---- 심해 ----
  anglerfish: { en: 'Anglerfish', depth: '600~2,000m', size: '최대 1m', fact: '이마의 발광 미끼를 흔들어 먹잇감을 유인해요.' },
  deepoctopus: { en: 'Deep-sea Octopus', depth: '600~2,000m', size: '최대 1m', fact: '심장이 3개나 되고, 피는 파란색이에요.' },
  pelicaneel: { en: 'Pelican Eel', depth: '500~3,000m', size: '최대 80cm', fact: '몸보다 큰 입을 우산처럼 활짝 벌려 사냥해요.' },
  blobfish: { en: 'Blobfish', depth: '600~1,200m', size: '최대 30cm', fact: '심해의 강한 압력 속에서만 제 모습을 유지해요.' },
  dragonfish: { en: 'Dragonfish', depth: '500~2,000m', size: '최대 40cm', fact: '자기만 볼 수 있는 붉은 빛 손전등을 켜고 사냥해요.' },
  ghostoctopus: { en: 'Ghost Octopus', depth: '2,000~4,000m', size: '최대 30cm', fact: '색소가 하나도 없어서 유령처럼 새하얘요.' },
  // ---- 열수구 ----
  vampiresquid: { en: 'Vampire Squid', depth: '600~1,200m', size: '최대 30cm', fact: '위험하면 망토 같은 팔을 뒤집어 몸을 숨겨요.' },
  giantisopod: { en: 'Giant Isopod', depth: '300~2,500m', size: '최대 50cm', fact: '5년 동안 아무것도 먹지 않고 버틴 기록이 있어요.' },
  tubeworms: { en: 'Giant Tube Worm', depth: '2,000~3,000m', size: '최대 3m', fact: '입도 위장도 없이, 몸속 세균이 밥을 만들어줘요.' },
  dumbooctopus: { en: 'Dumbo Octopus', depth: '3,000~7,000m', size: '최대 30cm', fact: '코끼리 귀 같은 지느러미로 펄럭펄럭 헤엄쳐요.' },
  yeticrab: { en: 'Yeti Crab', depth: '2,200~2,600m', size: '최대 15cm', fact: '털북숭이 집게발에 세균을 길러서 먹어요.' },
  dandelionjelly: { en: 'Dandelion Siphonophore', depth: '1,000~3,000m', size: '최대 10cm', fact: '사실 한 마리가 아니라 여러 개체가 모인 하나의 팀이에요.' },
  scalyfootsnail: { en: 'Scaly-foot Snail', depth: '2,400~2,900m', size: '최대 4.5cm', fact: '철 비늘 갑옷을 입은 지구 유일의 동물이에요.' },
  // ---- 나라별 고유종 (1.1 확장) ----
  damselfish: { en: 'Pearl-spot Chromis', depth: '2~15m', size: '최대 17cm', fact: '제주 바다의 터줏대감 — 떼 지어 다니며 텃세가 아주 심해요.' },
  scorpionfish: { en: 'Scorpionfish', depth: '5~80m', size: '최대 30cm', fact: '바위인 척 숨어 있다 순식간에 삼켜요. 등가시엔 독이 있어요.' },
  softcoral: { en: 'Soft Coral', depth: '10~40m', size: '군락 최대 1m', fact: '제주 문섬의 보물 — 딱딱한 뼈대 없이 물살에 하늘하늘 흔들려요.' },
  napoleonfish: { en: 'Napoleon Wrasse', depth: '1~60m', size: '최대 2m', fact: '이마의 커다란 혹이 트레이드마크 — 사람 얼굴도 기억해요.' },
  ribboneel: { en: 'Ribbon Eel', depth: '1~60m', size: '최대 1.3m', fact: '리본처럼 얇은 몸 — 자라면서 검정에서 파랑으로 변신해요.' },
  blindcavefish: { en: 'Blind Cave Fish', depth: '동굴 담수', size: '최대 12cm', fact: '깜깜한 동굴에 살아 눈이 아예 사라졌어요. 물결로 세상을 느껴요.' },
  mandarinfish: { en: 'Mandarin Fish', depth: '1~18m', size: '최대 6cm', fact: '물감을 뿌린 듯한 무늬 — 세상에서 가장 화려한 물고기로 꼽혀요.' },
  pygmyseahorse: { en: 'Pygmy Seahorse', depth: '10~40m', size: '최대 2.4cm', fact: '손톱보다 작고 산호랑 똑같이 생겨서 1969년에야 발견됐어요.' },
  mantaray: { en: 'Reef Manta Ray', depth: '0~40m', size: '날개폭 최대 4.5m', fact: '날개를 펄럭이며 바닷속을 날아요. 물고기 중 두뇌가 가장 커요.' },
  whaleshark: { en: 'Whale Shark', depth: '0~100m', size: '최대 12m', fact: '세상에서 가장 큰 물고기 — 그런데 먹는 건 아주 작은 플랑크톤이에요.' },
  marineiguana: { en: 'Marine Iguana', depth: '0~30m', size: '최대 1.5m', fact: '바다에 잠수하는 유일한 도마뱀 — 물속 해조류를 뜯어 먹어요.' },
  galapagosshark: { en: 'Galapagos Shark', depth: '2~180m', size: '최대 3.7m', fact: '갈라파고스의 순찰대장 — 호기심이 많아 다이버를 따라와요.' },
  arcticchar: { en: 'Arctic Char', depth: '0~70m', size: '최대 1m', fact: '빙하 녹은 물처럼 차가운 곳을 가장 좋아하는 연어의 사촌이에요.' },
};

// ---- 나라별 도감 구분 (siteOnly 종의 country 필드 기준) ----
export const COUNTRIES = [
  { id: 'KR', label: '대한민국', flag: '🇰🇷' },
  { id: 'JP', label: '일본', flag: '🇯🇵' },
  { id: 'IS', label: '아이슬란드', flag: '🇮🇸' },
  { id: 'MV', label: '몰디브', flag: '🇲🇻' },
  { id: 'ID', label: '인도네시아', flag: '🇮🇩' },
  { id: 'MX', label: '멕시코', flag: '🇲🇽' },
  { id: 'EC', label: '에콰도르', flag: '🇪🇨' },
];

export function speciesInCountry(countryId) {
  return SPECIES.filter(sp => sp.country === countryId);
}

// 나라 소속이 없는 종 (기존 28종 — 전 해역/해구 공통)
export function speciesGlobal() {
  return SPECIES.filter(sp => !sp.country);
}

// 희귀도 — 스폰 가중치(weight) 기반: 낮을수록 보기 어렵다
export function rarityOf(speciesId) {
  const w = speciesById(speciesId)?.weight ?? 3;
  if (w >= 5) return { label: '흔함', color: '#9ab8cc' };
  if (w >= 4) return { label: '보통', color: '#7de8a8' };
  if (w >= 3) return { label: '보통', color: '#7de8a8' };
  if (w >= 2) return { label: '희귀', color: '#b48aff' };
  return { label: '전설', color: '#ffd34d' };
}

export const ZONE_LABELS = [
  { id: 'shallow', label: '표층' },
  { id: 'twilight', label: '트와일라잇존' },
  { id: 'deepsea', label: '심해' },
  { id: 'vent', label: '열수구' },
];

export function speciesInZone(zoneId) {
  return SPECIES.filter(sp => sp.zone === zoneId);
}

// ---- 관찰 기록 (localStorage) ----
export function loadObservedSet() {
  try {
    const raw = localStorage.getItem(DEX_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr.filter(id => speciesById(id)));
  } catch (e) { /* 손상 시 빈 기록 */ }
  return new Set();
}

export function saveObservedSet(set) {
  try { localStorage.setItem(DEX_KEY, JSON.stringify(Array.from(set))); } catch (e) {}
}

// ---- 완성 보너스 수령 기록 ----
export function loadDexBonuses() {
  const base = { shallow: false, twilight: false, deepsea: false, vent: false, all: false };
  try {
    const raw = localStorage.getItem(DEX_BONUS_KEY);
    if (raw) Object.assign(base, JSON.parse(raw));
  } catch (e) {}
  return base;
}

export function saveDexBonuses(b) {
  try { localStorage.setItem(DEX_BONUS_KEY, JSON.stringify(b)); } catch (e) {}
}

// ---- 썸네일/상세 일러스트 — 게임 draw 함수를 오프스크린 캔버스에 렌더해 재사용 ----
// observed=false면 검은 실루엣(미확인 종). 결과 캔버스는 호출측에서 캐시한다.
export function renderSpeciesThumb(speciesId, size = 56, observed = true, scaleMul = 1) {
  const sp = speciesById(speciesId);
  const cnv = document.createElement('canvas');
  cnv.width = size; cnv.height = size;
  const ctx = cnv.getContext('2d');
  ctx.save();
  ctx.translate(size / 2, size / 2);
  // 종 크기(sp.size)에 반비례한 배율로 썸네일 안에 대략 맞춘다
  const s = (size / 64) * (1.35 / sp.size) * scaleMul;
  ctx.scale(s, s);
  sp.draw(ctx, 0, 0, 1.7, sp.size); // t=1.7: 적당히 자연스러운 애니메이션 위상 한 컷
  ctx.restore();
  if (!observed) {
    // 미관찰: 실루엣만 — 그린 픽셀을 전부 검정으로 덮는다
    ctx.save();
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#0b1018';
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }
  return cnv;
}
