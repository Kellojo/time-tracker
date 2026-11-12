import { betterAuth } from 'better-auth';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { DatabaseSync } from 'node:sqlite';
import { env } from '$env/dynamic/private';

const authSecret =
	env.BETTER_AUTH_SECRET || env.AUTH_SECRET || 'local-build-secret-change-me-32-plus-chars';

const authDb = new DatabaseSync(env.AUTH_DATABASE_PATH || 'auth.db');

function isTruthy(value: string | undefined): boolean {
	if (!value) return false;
	const normalized = value.trim().toLowerCase();
	return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

const rawDevAuthBypass = isTruthy(env.DEV_AUTH_BYPASS);
const isProduction = env.NODE_ENV === 'production';

if (rawDevAuthBypass && isProduction) {
	console.warn('DEV_AUTH_BYPASS is ignored when NODE_ENV=production.');
}

export const devAuthBypassEnabled = rawDevAuthBypass && !isProduction;

/** Public base URL of this app, without a trailing slash. */
export const publicUrl = (env.BETTER_AUTH_URL || 'http://localhost:5173').replace(/\/+$/, '');

function requireEnv(name: string): string {
	const value = env[name]?.trim();
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

/**
 * The OIDC provider used for sign-in, also the authorization server for MCP clients.
 * Optional with DEV_AUTH_BYPASS (which only skips the web login), so MCP OAuth can be tried locally.
 */
export const oidcConfig =
	devAuthBypassEnabled && !env.OIDC_ISSUER?.trim()
		? undefined
		: (() => {
				const issuer = requireEnv('OIDC_ISSUER').replace(/\/+$/, '');
				return {
					issuer,
					clientId: requireEnv('OIDC_CLIENT_ID'),
					clientSecret: requireEnv('OIDC_CLIENT_SECRET'),
					discoveryUrl: new URL('/.well-known/openid-configuration', `${issuer}/`).toString()
				};
			})();

export const auth = betterAuth({
	secret: authSecret,
	baseURL: publicUrl,
	database: authDb,
	basePath: '/api/auth',
	trustedOrigins: [publicUrl],
	plugins: oidcConfig
		? [
				genericOAuth({
					config: [
						{
							providerId: 'oidc',
							discoveryUrl: oidcConfig.discoveryUrl,
							clientId: oidcConfig.clientId,
							clientSecret: oidcConfig.clientSecret,
							scopes: ['openid', 'profile', 'email'],
							pkce: true
						}
					]
				})
			]
		: []
});

export const authReady = auth.$context
	.then(async (ctx) => {
		await ctx.runMigrations();
	})
	.catch((err) => {
		console.error('Better Auth migration failed', err);
		throw err;
	});

export type LinkedUser = {
	id: string;
	email: string | null;
	name: string | null;
	image: string | null;
};

/**
 * The app user linked to an OIDC subject (the `sub` of a token minted by the OIDC provider).
 * Null until that person has signed in to the web app once.
 */
export async function findUserByOidcSubject(subject: string): Promise<LinkedUser | null> {
	await authReady;
	const row = authDb
		.prepare(
			`SELECT u.id AS id, u.email AS email, u.name AS name, u.image AS image
			 FROM "account" a JOIN "user" u ON u.id = a.userId
			 WHERE a.providerId = 'oidc' AND a.accountId = ?`
		)
		.get(subject) as LinkedUser | undefined;
	return row ?? null;
}
