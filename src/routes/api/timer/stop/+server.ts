import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserIdWithApiKey } from '$lib/server/auth';
import { stopTimer } from '$lib/server/db';
import { parseIsoDate, todayIso } from '$lib/time';

export const POST: RequestHandler = async (event) => {
	const userId = await requireUserIdWithApiKey(event, 'timer:stop');
	const body = await event.request.json().catch(() => ({}));

	const day = typeof body?.day === 'string' && parseIsoDate(body.day) ? body.day : todayIso();

	const result = stopTimer(userId, day);
	if (!result.stopped) {
		return json(
			{
				data: null,
				error: {
					code: result.reason,
					message: 'Timer is not currently running.'
				}
			},
			{ status: 400 }
		);
	}

	return json({
		data: result,
		error: null
	});
};
