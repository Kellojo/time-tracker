import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserIdWithApiKey } from '$lib/server/auth';
import { parseIsoDate } from '$lib/time';
import { setDayMinutes } from '$lib/server/db';

export const PUT: RequestHandler = async (event) => {
	const userId = await requireUserIdWithApiKey(event, 'hours:write');
	const day = event.params.date;

	if (!parseIsoDate(day)) {
		return json(
			{
				data: null,
				error: {
					code: 'VALIDATION_ERROR',
					message: 'Date must be in YYYY-MM-DD format.'
				}
			},
			{ status: 400 }
		);
	}

	const body = await event.request.json().catch(() => ({}));
	const minutes = Number(body?.minutes);

	if (!Number.isFinite(minutes) || minutes < 0 || minutes > 24 * 60) {
		return json(
			{
				data: null,
				error: {
					code: 'VALIDATION_ERROR',
					message: 'minutes must be between 0 and 1440.'
				}
			},
			{ status: 400 }
		);
	}

	const totalMinutes = setDayMinutes(userId, day, minutes);

	return json({
		data: { day, totalMinutes },
		error: null
	});
};
