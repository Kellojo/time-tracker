import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserIdWithApiKey } from '$lib/server/auth';
import { getDaySummary } from '$lib/server/tracker';
import { parseIsoDate } from '$lib/time';

export const GET: RequestHandler = async (event) => {
	const userId = await requireUserIdWithApiKey(event, 'hours:read');
	const day = event.params.date;

	if (!parseIsoDate(day)) {
		return json(
			{
				data: null,
				error: { code: 'VALIDATION_ERROR', message: 'Date must be in YYYY-MM-DD format.' }
			},
			{ status: 400 }
		);
	}

	return json({ data: getDaySummary(userId, day), error: null });
};
