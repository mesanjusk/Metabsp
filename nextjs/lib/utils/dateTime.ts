// Ported unchanged from backend/src/utils/dateTime.js.
export function formatIST(date: unknown): { date: string; time: string } {
  const d = new Date(date as any);

  if (Number.isNaN(d.getTime())) {
    return { date: '', time: '' };
  }

  return {
    date: d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
    time: d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }),
  };
}
