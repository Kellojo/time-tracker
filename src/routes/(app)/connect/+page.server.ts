import type { PageServerLoad } from './$types';
import { oidcConfig, publicUrl } from '$lib/server/better-auth';
import {
	MCP_PATH,
	mcpOAuthEnabled,
	mcpResourceMetadataUrl,
	mcpResourceUri
} from '$lib/server/oauth';

export const load: PageServerLoad = () => ({
	mcpUrl: `${publicUrl}${MCP_PATH}`,
	oauth:
		mcpOAuthEnabled && oidcConfig
			? { issuer: oidcConfig.issuer, resource: mcpResourceUri, metadataUrl: mcpResourceMetadataUrl }
			: null
});
