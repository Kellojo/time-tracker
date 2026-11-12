import { error, type RequestEvent } from '@sveltejs/kit';
import { createHmac } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { getApiKeyByHash, touchApiKeyLastUsed, upsertUser } from '$lib/server/db';
import { findUserByOidcSubject } from '$lib/server/better-auth';
import {
	InvalidTokenError,
	looksLikeJwt,
	mcpOAuthEnabled,
	verifyAccessToken
} from '$lib/server/oauth';
import { ALL_SCOPES } from '$lib/scopes';

const API_KEY_SECRET =
	env.API_KEY_SECRET || env.BETTER_AUTH_SECRET || env.AUTH_SECRET || 'dev-secret';

export function hashApiKey(rawKey: string) {
	return createHmac('sha256', API_KEY_SECRET).update(rawKey).digest('hex');
}

export function parseBearerToken(request: Request) {
	const header = request.headers.get('authorization') || '';
	const [scheme, token] = header.split(' ');
	if (scheme?.toLowerCase() !== 'bearer' || !token) {
		return null;
	}
	return token.trim();
}

/** Who is calling and what they may do. */
export type Principal = {
	userId: string;
	scopes: string[];
	via: 'session' | 'api_key' | 'oauth';
	clientId?: string;
};

export type PrincipalResult =
	| { ok: true; principal: Principal }
	| { ok: false; status: 401 | 403; code: string; message: string };

function sessionPrincipal(event: RequestEvent): Principal | null {
	const user = event.locals.session?.user;
	if (!user?.id) return null;
	upsertUser({ id: user.id, email: user.email, name: user.name, image: user.image });
	return { userId: user.id, scopes: [...ALL_SCOPES], via: 'session' };
}

/**
 * Resolves the caller from (in order) a bearer API key, a bearer OAuth access token from the
 * OIDC provider, or the web session cookie.
 */
export async function resolvePrincipal(event: RequestEvent): Promise<PrincipalResult> {
	const token = parseBearerToken(event.request);
	if (!token) {
		const principal = sessionPrincipal(event);
		return principal
			? { ok: true, principal }
			: { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'Authentication required.' };
	}

	if (mcpOAuthEnabled && looksLikeJwt(token)) {
		try {
			const verified = await verifyAccessToken(token);
			const user = await findUserByOidcSubject(verified.subject);
			if (!user) {
				return {
					ok: false,
					status: 403,
					code: 'UNKNOWN_USER',
					message: 'Sign in to the Time Tracker web app once before connecting a client.'
				};
			}
			upsertUser(user);
			return {
				ok: true,
				principal: {
					userId: user.id,
					scopes: verified.scopes,
					via: 'oauth',
					clientId: verified.clientId
				}
			};
		} catch (err) {
			if (err instanceof InvalidTokenError) {
				return { ok: false, status: 401, code: 'INVALID_TOKEN', message: err.message };
			}
			console.error('Access token verification failed', err);
			return {
				ok: false,
				status: 401,
				code: 'INVALID_TOKEN',
				message: 'Access token could not be verified.'
			};
		}
	}

	const key = getApiKeyByHash(hashApiKey(token));
	if (!key || key.revokedAt) {
		return { ok: false, status: 401, code: 'INVALID_TOKEN', message: 'Invalid API key.' };
	}
	touchApiKeyLastUsed(key.id);
	return { ok: true, principal: { userId: key.userId, scopes: key.scopes, via: 'api_key' } };
}

/** The signed-in web user. Rejects API keys and tokens (used by UI-only endpoints). */
export async function requireUserId(event: RequestEvent) {
	const principal = sessionPrincipal(event);
	if (!principal) throw error(401, 'Unauthorized');
	return principal.userId;
}

/** The caller's user id, accepting a session or a bearer credential carrying `requiredScope`. */
export async function requireUserIdWithApiKey(event: RequestEvent, requiredScope: string) {
	const result = await resolvePrincipal(event);
	if (!result.ok) throw error(result.status, result.message);
	if (!result.principal.scopes.includes(requiredScope)) throw error(403, 'Forbidden');
	return result.principal.userId;
}
