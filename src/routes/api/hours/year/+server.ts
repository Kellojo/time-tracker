import { json, type RequestHandler } from "@sveltejs/kit";
import { requireUserIdWithApiKey } from "$lib/server/auth";
import { getDayTotalsBetween, getTimerStatus, getOfficeDaysInYear } from "$lib/server/db";

function toIsoLocalDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMinutesHuman(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export const GET: RequestHandler = async (event) => {
  const userId = await requireUserIdWithApiKey(event, "hours:read");
  const yearParam = event.url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: "Expected query param year as a valid year number.",
        },
      },
      { status: 400 },
    );
  }

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const today = toIsoLocalDate(new Date());
  const isCurrentYear = year === new Date().getFullYear();

  const storedByDay = getDayTotalsBetween(userId, yearStart, yearEnd);
  const timer = isCurrentYear ? getTimerStatus(userId) : { isRunning: false, elapsedSeconds: 0 };
  const officeDays = getOfficeDaysInYear(userId, year);

  const runningMinutes = timer.isRunning
    ? Math.floor(timer.elapsedSeconds / 60)
    : 0;

  const todayStored = storedByDay[today] ?? 0;

  const yearTotalMinutesStored = Object.values(storedByDay).reduce(
    (sum, minutes) => sum + minutes,
    0,
  );
  const yearTotalMinutesEffective =
    yearTotalMinutesStored + (isCurrentYear ? runningMinutes : 0);

  return json({
    data: {
      year,
      yearStart,
      yearEnd,
      today: isCurrentYear ? today : null,
      todayStored,
      runningElapsedSeconds: timer.elapsedSeconds,
      todayEffective:
        todayStored + (isCurrentYear ? runningMinutes : 0),
      officeDays,
      officeDaysCount: officeDays.length,
      yearTotalMinutesStored,
      yearTotalMinutesStoredHuman: formatMinutesHuman(yearTotalMinutesStored),
      yearTotalMinutesEffective,
      yearTotalMinutesEffectiveHuman: formatMinutesHuman(yearTotalMinutesEffective),
    },
    error: null,
  });
};