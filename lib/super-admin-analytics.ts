export interface DateRange {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
  currentStartSql: string;
  currentEndSql: string;
  previousStartSql: string;
  previousEndSql: string;
  preset: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toSqlDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function resolveAnalyticsDateRanges(
  preset: string,
  customStart?: string | null,
  customEnd?: string | null
): DateRange {
  const now = new Date();
  let currentStart = new Date(now);
  let currentEnd = new Date(now);
  let previousStart = new Date(now);
  let previousEnd = new Date(now);

  const cleanPreset = (preset || '30days').toLowerCase();

  if (cleanPreset === 'today') {
    currentStart.setHours(0, 0, 0, 0);
    currentEnd.setHours(23, 59, 59, 999);

    previousStart.setDate(previousStart.getDate() - 1);
    previousStart.setHours(0, 0, 0, 0);
    previousEnd.setDate(previousEnd.getDate() - 1);
    previousEnd.setHours(23, 59, 59, 999);
  } else if (cleanPreset === 'yesterday') {
    currentStart.setDate(currentStart.getDate() - 1);
    currentStart.setHours(0, 0, 0, 0);
    currentEnd.setDate(currentEnd.getDate() - 1);
    currentEnd.setHours(23, 59, 59, 999);

    previousStart.setDate(previousStart.getDate() - 2);
    previousStart.setHours(0, 0, 0, 0);
    previousEnd.setDate(previousEnd.getDate() - 2);
    previousEnd.setHours(23, 59, 59, 999);
  } else if (cleanPreset === '7days') {
    currentStart.setDate(currentStart.getDate() - 7);
    currentStart.setHours(0, 0, 0, 0);
    currentEnd.setHours(23, 59, 59, 999);

    previousStart.setDate(previousStart.getDate() - 14);
    previousStart.setHours(0, 0, 0, 0);
    previousEnd.setDate(previousEnd.getDate() - 7);
    previousEnd.setHours(23, 59, 59, 999);
  } else if (cleanPreset === '30days') {
    currentStart.setDate(currentStart.getDate() - 30);
    currentStart.setHours(0, 0, 0, 0);
    currentEnd.setHours(23, 59, 59, 999);

    previousStart.setDate(previousStart.getDate() - 60);
    previousStart.setHours(0, 0, 0, 0);
    previousEnd.setDate(previousEnd.getDate() - 30);
    previousEnd.setHours(23, 59, 59, 999);
  } else if (cleanPreset === 'this_week') {
    const day = currentStart.getDay();
    const diff = currentStart.getDate() - day + (day === 0 ? -6 : 1);
    currentStart.setDate(diff);
    currentStart.setHours(0, 0, 0, 0);
    currentEnd.setHours(23, 59, 59, 999);

    previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - 7);
    previousEnd = new Date(currentStart);
    previousEnd.setMilliseconds(-1);
  } else if (cleanPreset === 'last_week') {
    const day = currentStart.getDay();
    const diff = currentStart.getDate() - day + (day === 0 ? -6 : 1) - 7;
    currentStart.setDate(diff);
    currentStart.setHours(0, 0, 0, 0);
    currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + 6);
    currentEnd.setHours(23, 59, 59, 999);

    previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - 7);
    previousEnd = new Date(currentEnd);
    previousEnd.setDate(previousEnd.getDate() - 7);
  } else if (cleanPreset === 'this_month') {
    currentStart.setDate(1);
    currentStart.setHours(0, 0, 0, 0);
    currentEnd.setHours(23, 59, 59, 999);

    previousStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1, 0, 0, 0, 0);
    previousEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), 0, 23, 59, 59, 999);
  } else if (cleanPreset === 'last_month') {
    currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    currentEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    previousStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
    previousEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
  } else if (cleanPreset === 'this_year') {
    currentStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    currentEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    previousStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    previousEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  } else if (cleanPreset === 'custom' && customStart && customEnd) {
    const s = new Date(customStart);
    s.setHours(0, 0, 0, 0);
    const e = new Date(customEnd);
    e.setHours(23, 59, 59, 999);
    currentStart = s;
    currentEnd = e;

    const spanMs = Math.max(86400000, currentEnd.getTime() - currentStart.getTime());
    previousEnd = new Date(currentStart.getTime() - 1);
    previousStart = new Date(previousEnd.getTime() - spanMs);
  } else {
    // Default 30 days
    currentStart.setDate(currentStart.getDate() - 30);
    currentStart.setHours(0, 0, 0, 0);
    currentEnd.setHours(23, 59, 59, 999);

    previousStart.setDate(previousStart.getDate() - 60);
    previousStart.setHours(0, 0, 0, 0);
    previousEnd.setDate(previousEnd.getDate() - 30);
    previousEnd.setHours(23, 59, 59, 999);
  }

  return {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
    currentStartSql: toSqlDateTime(currentStart),
    currentEndSql: toSqlDateTime(currentEnd),
    previousStartSql: toSqlDateTime(previousStart),
    previousEndSql: toSqlDateTime(previousEnd),
    preset: cleanPreset,
  };
}
