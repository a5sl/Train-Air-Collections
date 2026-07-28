const SOLAR_TERMS = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
  '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
  '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
  '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];

const C21 = [
  5.4055, 20.12, 3.87, 18.73, 5.63, 20.646,
  4.81, 20.1, 5.52, 21.04, 5.678, 21.37,
  7.108, 22.83, 7.5, 23.13, 7.646, 23.042,
  8.318, 23.438, 7.438, 22.36, 7.18, 21.94,
];

function termDay(year: number, index: number): number {
  const y = year % 100;
  const d = 0.2422;
  const l = Math.floor(y / 4);
  return Math.floor(y * d + C21[index]) - l;
}

export function getCurrentSolarTerm(date?: Date): string {
  const now = date || new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const idx1 = (month - 1) * 2;
  const idx2 = (month - 1) * 2 + 1;
  const day1 = termDay(year, idx1);
  const day2 = termDay(year, idx2);
  if (day >= day2) return SOLAR_TERMS[idx2];
  if (day >= day1) return SOLAR_TERMS[idx1];
  const prevIdx2 = ((month - 2 + 12) % 12) * 2 + 1;
  return SOLAR_TERMS[prevIdx2];
}

export function getSolarTermRange(date?: Date): string {
  const now = date || new Date();
  const current = getCurrentSolarTerm(now);
  const idx = SOLAR_TERMS.indexOf(current);
  const next = SOLAR_TERMS[(idx + 1) % 24];
  return current + '\u2014' + next;
}