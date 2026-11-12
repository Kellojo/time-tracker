import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserId } from '$lib/server/auth';
import { deleteApiKey } from '$lib/server/db';

export const DELETE: RequestHandler = async (event) => {
	const userId = await requireUserId(event);
	const id = event.params.id;

	if (!id) {
		return json(
			{
				data: null,
				error: {
					code: 'VALIDATION_ERROR',
					message: 'Missing key id.'
				}
			},
			{ status: 400 }
		);
	}

	const deleted = deleteApiKey(userId, id);

	if (!deleted) {
		return json(
			{
				data: null,
				error: {
					code: 'NOT_FOUND',
					message: 'API key not found.'
				}
			},
			{ status: 404 }
		);
	}

	return json({
		data: { deleted: true },
		error: null
	});
};
