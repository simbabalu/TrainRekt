import { getLocalDateKey } from './getLocalDateKey';

export function isYesterday(dateKey: string, referenceDate: Date): boolean {
  const previousDay = new Date(referenceDate);
  previousDay.setDate(previousDay.getDate() - 1);
  return dateKey === getLocalDateKey(previousDay);
}
