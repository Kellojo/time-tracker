import type { RequestHandler } from './$types';
import { auth } from '$lib/server/better-auth';

const handleAuthRequest: RequestHandler = async ({ request }) => {
	return auth.handler(request);
};

export const GET = handleAuthRequest;
export const POST = handleAuthRequest;
export const PUT = handleAuthRequest;
export const PATCH = handleAuthRequest;
export const DELETE = handleAuthRequest;
export const OPTIONS = handleAuthRequest;
