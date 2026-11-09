const DATE_TIME_PARTS = ["year", "month", "day", "hour", "minute", "second"];

function getParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    ...Object.fromEntries(DATE_TIME_PARTS.map((part) => [part, "numeric"])),
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => DATE_TIME_PARTS.includes(part.type))
      .map((part) => [part.type, Number(part.value)]),
  );
}

function zonedMidnightToUtc(year, month, day, timeZone) {
  const targetUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let candidateUtc = targetUtc;

  // Resolve the timezone offset at the target local midnight. Iteration also
  // handles zones whose UTC offset changes around a daylight-saving boundary.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = getParts(new Date(candidateUtc), timeZone);
    const representedAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    const adjustment = representedAsUtc - targetUtc;

    if (adjustment === 0) {
      break;
    }

    candidateUtc -= adjustment;
  }

  return new Date(candidateUtc);
}

/**
 * Returns the current calendar day's UTC boundaries for a configured
 * reporting timezone. The default is India Standard Time for this deployment.
 */
export function getReportingDayRange(
  now = new Date(),
  timeZone = process.env.REPORTING_TIME_ZONE || "Asia/Kolkata",
) {
  const parts = getParts(now, timeZone);
  const nextDate = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + 1),
  );

  const startAt = zonedMidnightToUtc(
    parts.year,
    parts.month,
    parts.day,
    timeZone,
  );
  const endAt = zonedMidnightToUtc(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCDate(),
    timeZone,
  );

  return {
    startAt,
    endAt,
    date: [
      String(parts.year).padStart(4, "0"),
      String(parts.month).padStart(2, "0"),
      String(parts.day).padStart(2, "0"),
    ].join("-"),
    timeZone,
  };
}
