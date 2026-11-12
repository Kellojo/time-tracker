import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserIdWithApiKey } from '$lib/server/auth';
import { startTimer } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	const userId = await requireUserIdWithApiKey(event, 'timer:start');
	const result = startTimer(userId);

	if (!result.started) {
		return json(
			{
				data: null,
				error: {
					code: result.reason,
					message: 'Timer is already running.'
				}
			},
			{ status: 400 }
		);
	}

	return json({
		data: { started: true },
		error: null
	});
};
