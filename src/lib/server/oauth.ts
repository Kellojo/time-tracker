/**
 * OAuth 2.0 resource-server side of the MCP endpoint.
 *
 * The OIDC provider used for sign-in (e.g. Pocket ID) is the authorization server: MCP clients
 * discover it through the protected resource metadata (RFC 9728), get an access token for the
 * resource `<public url>/mcp` (RFC 8707), and present it here. Pocket ID issues those tokens as
 * RFC 9068 JWTs (`typ: at+jwt`) whose `aud` is the requested resource, so they are verified
 * locally against the provider's JWKS.
 */
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload } from 'jose';
import { env } from '$env/dynamic/private';
import { oidcConfig, publicUrl } from '$lib/server/better-auth';

export const MCP_PATH = '/mcp';

/** The RFC 8707 resource identifier MCP clients request tokens for. */
export const mcpResourceUri = (env.MCP_RESOURCE?.trim() || `${publicUrl}${MCP_PATH}`).replace(
	/\/+$/,
	''
);

export const mcpResourceMetadataUrl = `${publicUrl}/.well-known/oauth-protected-resource${MCP_PATH}`;

/** OAuth for MCP is on whenever an OIDC provider is configured, unless switched off. */
export const mcpOAuthEnabled =
	!!oidcConfig && !['0', 'false', 'no'].includes(env.MCP_OAUTH?.trim().toLowerCase() ?? '');

type ProviderMetadata = { issuer: string; jwks_uri: string };

let provider: Promise<{ issuer: string; jwks: ReturnType<typeof createRemoteJWKSet> }> | null =
	null;

function loadProvider() {
	if (!oidcConfig) throw new Error('No OIDC provider is configured.');
	provider ??= fetch(oidcConfig.discoveryUrl)
		.then(async (res) => {
			if (!res.ok) throw new Error(`OIDC discovery failed with HTTP ${res.status}`);
			const meta = (await res.json()) as ProviderMetadata;
			if (!meta.jwks_uri) throw new Error('OIDC discovery document has no jwks_uri');
			return { issuer: meta.issuer, jwks: createRemoteJWKSet(new URL(meta.jwks_uri)) };
		})
		.catch((err) => {
			// Retry discovery on the next request instead of caching the failure.
			provider = null;
			throw err;
		});
	return provider;
}

export class InvalidTokenError extends Error {}

export type VerifiedAccessToken = {
	subject: string;
	clientId: string;
	scopes: string[];
	expiresAt?: number;
};

function scopesOf(payload: JWTPayload): string[] {
	const scopes = new Set<string>();
	if (typeof payload.scope === 'string') {
		for (const scope of payload.scope.split(' ')) if (scope) scopes.add(scope);
	}
	if (Array.isArray(payload.scp)) {
		for (const scope of payload.scp) if (typeof scope === 'string') scopes.add(scope);
	}
	return [...scopes];
}

/** Verifies a JWT access token minted by the OIDC provider for the MCP resource. */
export async function verifyAccessToken(token: string): Promise<VerifiedAccessToken> {
	const { issuer, jwks } = await loadProvider();
	try {
		const { payload } = await jwtVerify(token, jwks, {
			issuer,
			// Pocket ID ignores a trailing slash when matching resources, so accept both spellings.
			audience: [mcpResourceUri, `${mcpResourceUri}/`],
			typ: 'at+jwt',
			requiredClaims: ['sub', 'exp']
		});
		return {
			subject: payload.sub!,
			clientId: String(payload.client_id ?? payload.azp ?? ''),
			scopes: scopesOf(payload),
			expiresAt: payload.exp
		};
	} catch (err) {
		if (err instanceof joseErrors.JOSEError) throw new InvalidTokenError(err.message);
		throw err;
	}
}

/** Whether a bearer token looks like a JWT rather than one of our opaque API keys. */
export function looksLikeJwt(token: string) {
	return token.split('.').length === 3;
}
