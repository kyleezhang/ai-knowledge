export function now_utc_iso(): string {
  return new Date().toISOString();
}

export function format_local_date_for_id(
  date: Date,
  timezone = 'Asia/Shanghai',
): string {
  const parts = local_date_parts(date, timezone);
  return `${parts.year}${parts.month}${parts.day}`;
}

export function format_local_year_month(
  date: Date,
  timezone = 'Asia/Shanghai',
): { year: string; month: string } {
  const parts = local_date_parts(date, timezone);
  return {
    year: parts.year,
    month: parts.month,
  };
}

function local_date_parts(
  date: Date,
  timezone: string,
): { year: string; month: string; day: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);

  return {
    year: part_value(parts, 'year'),
    month: part_value(parts, 'month'),
    day: part_value(parts, 'day'),
  };
}

function part_value(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  const part = parts.find((item) => item.type === type);
  if (part === undefined) {
    throw new Error(`Missing date part: ${type}`);
  }
  return part.value;
}
