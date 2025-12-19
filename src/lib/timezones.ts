// IANA timezone list with common timezones
export const COMMON_TIMEZONES = [
  { value: 'UTC', label: '(UTC+00:00) UTC' },
  { value: 'Europe/London', label: '(UTC+00:00) London' },
  { value: 'Europe/Paris', label: '(UTC+01:00) Paris, Berlin, Rome' },
  { value: 'Europe/Athens', label: '(UTC+02:00) Athens, Istanbul' },
  { value: 'Asia/Dubai', label: '(UTC+04:00) Dubai' },
  { value: 'Asia/Karachi', label: '(UTC+05:00) Karachi, Tashkent' },
  { value: 'Asia/Dhaka', label: '(UTC+06:00) Dhaka, Almaty' },
  { value: 'Asia/Bangkok', label: '(UTC+07:00) Bangkok, Jakarta' },
  { value: 'Asia/Shanghai', label: '(UTC+08:00) Beijing, Singapore' },
  { value: 'Asia/Tokyo', label: '(UTC+09:00) Tokyo, Seoul' },
  { value: 'Australia/Sydney', label: '(UTC+10:00) Sydney, Melbourne' },
  { value: 'Pacific/Auckland', label: '(UTC+12:00) Auckland' },
  { value: 'America/New_York', label: '(UTC-05:00) New York, Toronto' },
  { value: 'America/Chicago', label: '(UTC-06:00) Chicago, Mexico City' },
  { value: 'America/Denver', label: '(UTC-07:00) Denver, Phoenix' },
  { value: 'America/Los_Angeles', label: '(UTC-08:00) Los Angeles, Seattle' },
  { value: 'America/Anchorage', label: '(UTC-09:00) Anchorage' },
  { value: 'Pacific/Honolulu', label: '(UTC-10:00) Honolulu' },
];

// Get user's current timezone
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// Format timezone for display
export function getTimezoneLabel(timezone: string): string {
  const tz = COMMON_TIMEZONES.find(t => t.value === timezone);
  return tz?.label || timezone;
}
