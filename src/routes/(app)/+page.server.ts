import type { PageServerLoad } from './$types';
import { requireUserId } from '$lib/server/auth';
import { getDayTotalsBetween, getOfficeDaysBetween, getTimerStatus } from '$lib/server/db';
import { toIsoDate } from '$lib/time';

/** Server-rendered starting state (current month ± one), so the page doesn't flash empty. */
export const load: PageServerLoad = async (event) => {
	const userId = await requireUserId(event);
	const now = new Date();
	const from = toIsoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
	const to = toIsoDate(new Date(now.getFullYear(), now.getMonth() + 2, 0));
	const timer = getTimerStatus(userId);

	return {
		booked: getDayTotalsBetween(userId, from, to),
		officeDays: getOfficeDaysBetween(userId, from, to),
		// Elapsed rather than a start time, so a client clock that is off doesn't skew the timer.
		timerElapsedSeconds: timer.isRunning ? timer.elapsedSeconds : null
	};
};
