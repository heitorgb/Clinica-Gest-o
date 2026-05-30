export function isDateRangeInvalid(startDate: string, endDate: string) {
  return Boolean(startDate && endDate && startDate > endDate);
}
