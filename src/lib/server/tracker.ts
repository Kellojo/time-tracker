/**
 * Read models over the time-tracking tables, shared by the REST API and the MCP tools.
 * "Stored" minutes are what is booked for a day; "effective" minutes add the running timer
 * to today.
 */
import {
	getDayMinutes,
	getDayTotalsBetween,
	getOfficeDaysBetween,
	getTimerStatus,
	isOfficeDay
} from '$lib/server/db';
import {
	extraMinutesForDay,
	formatMinutes,
	parseIsoDate,
	toIsoDate,
	todayIso,
	weekDaysOf
} from '$lib/time';

export function formatMinutesHuman(totalMinutes: number) {
	const safe = Math.max(0, Math.floor(totalMinutes));
	return `${Math.floor(safe / 60)}h ${safe % 60}m`;
}

function runningMinutesFor(userId: string, day: string) {
	if (day !== todayIso()) return { elapsedSeconds: 0, minutes: 0 };
	const timer = getTimerStatus(userId);
	return timer.isRunning
		? { elapsedSeconds: timer.elapsedSeconds, minutes: Math.floor(timer.elapsedSeconds / 60) }
		: { elapsedSeconds: 0, minutes: 0 };
}

export function getDaySummary(userId: string, day: string) {
	const totalMinutesStored = getDayMinutes(userId, day);
	const running = runningMinutesFor(userId, day);
	return {
		day,
		totalMinutesStored,
		runningElapsedSeconds: running.elapsedSeconds,
		totalMinutesEffective: totalMinutesStored + running.minutes,
		officeDay: isOfficeDay(userId, day)
	};
}

function summarizeRange(userId: string, days: string[]) {
	const start = days[0];
	const end = days[days.length - 1];
	const stored = getDayTotalsBetween(userId, start, end);
	const officeDays = getOfficeDaysBetween(userId, start, end).sort();
	const today = todayIso();
	const running = days.includes(today)
		? runningMinutesFor(userId, today)
		: { elapsedSeconds: 0, minutes: 0 };

	const entries = days.map((day) => {
		const totalMinutesStored = stored[day] ?? 0;
		const isToday = day === today;
		return {
			day,
			totalMinutesStored,
			runningElapsedSeconds: isToday ? running.elapsedSeconds : 0,
			totalMinutesEffective: totalMinutesStored + (isToday ? running.minutes : 0)
		};
	});

	const totalStored = entries.reduce((sum, d) => sum + d.totalMinutesStored, 0);
	const totalEffective = entries.reduce((sum, d) => sum + d.totalMinutesEffective, 0);
	// Overtime balance against the daily target, counting only days up to today.
	const balanceMinutes = entries
		.filter((d) => d.day <= today)
		.reduce((sum, d) => sum + extraMinutesForDay(parseIsoDate(d.day)!, d.totalMinutesEffective), 0);

	return { entries, officeDays, totalStored, totalEffective, balanceMinutes };
}

export function getWeekSummary(userId: string, reference: Date = new Date()) {
	const days = weekDaysOf(reference);
	const s = summarizeRange(userId, days);
	return {
		weekStart: days[0],
		weekEnd: days[6],
		days: s.entries,
		officeDays: s.officeDays,
		officeDaysCount: s.officeDays.length,
		weekTotalMinutesStored: s.totalStored,
		weekTotalMinutesStoredHuman: formatMinutesHuman(s.totalStored),
		weekTotalMinutesEffective: s.totalEffective,
		weekTotalMinutesEffectiveHuman: formatMinutesHuman(s.totalEffective),
		weekBalanceMinutes: s.balanceMinutes
	};
}

export function getMonthSummary(userId: string, year: number, month: number) {
	const count = new Date(year, month + 1, 0).getDate();
	const days = Array.from({ length: count }, (_, i) => toIsoDate(new Date(year, month, i + 1)));
	const s = summarizeRange(userId, days);
	return {
		month: days[0].slice(0, 7),
		days: s.entries.filter((d) => d.totalMinutesEffective > 0),
		officeDays: s.officeDays,
		officeDaysCount: s.officeDays.length,
		totalMinutesEffective: s.totalEffective,
		totalHuman: formatMinutes(s.totalEffective),
		balanceMinutes: s.balanceMinutes
	};
}

export function getYearSummary(userId: string, year: number) {
	const yearStart = `${year}-01-01`;
	const yearEnd = `${year}-12-31`;
	const today = todayIso();
	const isCurrentYear = year === new Date().getFullYear();
	const stored = getDayTotalsBetween(userId, yearStart, yearEnd);
	const officeDays = getOfficeDaysBetween(userId, yearStart, yearEnd).sort();
	const running = isCurrentYear
		? runningMinutesFor(userId, today)
		: { elapsedSeconds: 0, minutes: 0 };

	const todayStored = stored[today] ?? 0;
	const yearTotalMinutesStored = Object.values(stored).reduce((sum, m) => sum + m, 0);
	const yearTotalMinutesEffective = yearTotalMinutesStored + running.minutes;

	return {
		year,
		yearStart,
		yearEnd,
		today: isCurrentYear ? today : null,
		todayStored,
		runningElapsedSeconds: running.elapsedSeconds,
		todayEffective: todayStored + running.minutes,
		officeDays,
		officeDaysCount: officeDays.length,
		yearTotalMinutesStored,
		yearTotalMinutesStoredHuman: formatMinutesHuman(yearTotalMinutesStored),
		yearTotalMinutesEffective,
		yearTotalMinutesEffectiveHuman: formatMinutesHuman(yearTotalMinutesEffective)
	};
}
