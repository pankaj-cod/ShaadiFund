const longDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2027-02-14" -> "14 February 2027". Calendar dates have no time zone, so UTC is used throughout. */
export function formatCalendarDate(isoDate: string): string {
  return longDate.format(new Date(`${isoDate}T00:00:00Z`));
}

export function coupleNames(partnerOne: string | null, partnerTwo: string | null): string {
  const names = [partnerOne?.trim(), partnerTwo?.trim()].filter(Boolean);
  return names.length > 0 ? names.join(" & ") : "Your wedding";
}
