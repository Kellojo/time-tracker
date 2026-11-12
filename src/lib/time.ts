/** Shared date and duration helpers (client and server). Days are local `YYYY-MM-DD` strings. */

export const DAILY_TARGET_MINUTES = 8 * 60;

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_RE = /^\d{4}-\d{2}$/;

const pad = (value: number) => String(value).padStart(2, '0');

export function toIsoDate(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toMonthKey(year: number, month: number): string {
	return `${year}-${pad(month + 1)}`;
}

export function todayIso(): string {
	return toIsoDate(new Date());
}

/** Parses a `YYYY-MM-DD` string as a local date, or null when it is not a real calendar day. */
export function parseIsoDate(day: string): Date | null {
	if (!DAY_RE.test(day)) return null;
	const [y, m, d] = day.split('-').map(Number);
	const date = new Date(y, m - 1, d);
	return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
		? date
		: null;
}

export function isWeekend(date: Date): boolean {
	const weekday = date.getDay();
	return weekday === 0 || weekday === 6;
}

/** The seven days (Monday first) of the week containing `date`. */
export function weekDaysOf(date: Date): string[] {
	const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
	return Array.from({ length: 7 }, (_, i) => {
		const day = new Date(start);
		day.setDate(start.getDate() + i);
		return toIsoDate(day);
	});
}

/** Minutes worked beyond the daily target: weekends count fully, untracked weekdays not at all. */
export function extraMinutesForDay(date: Date, minutes: number): number {
	if (isWeekend(date)) return minutes;
	return minutes >= 1 ? minutes - DAILY_TARGET_MINUTES : 0;
}

/** `5h 30m`, `5h`, `30m` or `0m`. */
export function formatMinutes(minutes: number): string {
	const safe = Math.max(0, Math.round(minutes));
	const h = Math.floor(safe / 60);
	const m = safe % 60;
	if (h === 0) return `${m}m`;
	if (m === 0) return `${h}h`;
	return `${h}h ${m}m`;
}

export function formatSignedMinutes(minutes: number): string {
	const rounded = Math.round(minutes);
	if (rounded === 0) return '0m';
	return `${rounded < 0 ? '−' : '+'}${formatMinutes(Math.abs(rounded))}`;
}

/** `HH:MM:SS` for a running timer. */
export function formatClock(seconds: number): string {
	const safe = Math.max(0, Math.floor(seconds));
	return [Math.floor(safe / 3600), Math.floor((safe % 3600) / 60), safe % 60].map(pad).join(':');
}

/**
 * Parses a duration typed by a person: `5h 30m`, `5h`, `50m`, `5:30`, `5.5` (hours) or `5,5`.
 * Returns minutes, or null when the input is not understood.
 */
export function parseDuration(value: string): number | null {
	const input = value.trim().toLowerCase();
	if (!input) return null;

	const hm = input.match(/^(\d+)\s*h\s*(?:(\d{1,2})\s*m?)?$/);
	if (hm) {
		const minutes = Number(hm[2] ?? 0);
		return minutes < 60 ? Number(hm[1]) * 60 + minutes : null;
	}

	const m = input.match(/^(\d+)\s*m(?:in)?$/);
	if (m) return Number(m[1]);

	const clock = input.match(/^(\d+):([0-5]\d)$/);
	if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

	const decimal = input.match(/^(\d+(?:[.,]\d+)?)$/);
	if (decimal) return Math.round(Number(decimal[1].replace(',', '.')) * 60);

	return null;
}
