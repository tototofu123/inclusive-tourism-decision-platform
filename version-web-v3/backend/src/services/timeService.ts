export function getHKTime(): { datetime: string; weekday: string; hour: number; dateStr: string } {
  const now = new Date();
  const opts = { timeZone: 'Asia/Hong_Kong', hour12: false } as const;
  const hkStr = now.toLocaleString('en-HK', opts);
  const hkDate = new Date(hkStr);
  return {
    datetime: hkStr,
    weekday: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][hkDate.getDay()],
    hour: hkDate.getHours(),
    dateStr: hkDate.toISOString().split('T')[0],
  };
}

export function getWeather(hour: number): string {
  if (hour < 6) return 'night, cool ~23°C';
  if (hour < 9) return 'sunrise, mild ~25°C';
  if (hour < 12) return 'morning, warm ~28°C';
  if (hour < 15) return 'afternoon, hot ~32°C';
  if (hour < 18) return 'late afternoon, warm ~30°C';
  if (hour < 21) return 'evening, mild ~26°C';
  return 'night, cool ~23°C';
}
