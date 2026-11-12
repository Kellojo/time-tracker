<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import InfoIcon from '@lucide/svelte/icons/info';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import CopyButton from '$lib/components/app/CopyButton.svelte';
	import CopyChip from '$lib/components/app/CopyChip.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { SCOPES } from '$lib/scopes';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const TOOLS = [
		{ name: 'get_timer_status', scope: 'hours:read', description: 'Timer state and today’s total' },
		{
			name: 'get_day',
			scope: 'hours:read',
			description: 'One day’s tracked time and office status'
		},
		{ name: 'get_week', scope: 'hours:read', description: 'A Monday–Sunday week with its balance' },
		{ name: 'get_month', scope: 'hours:read', description: 'A month’s tracked days and balance' },
		{ name: 'get_year', scope: 'hours:read', description: 'Yearly totals and office days' },
		{ name: 'start_timer', scope: 'timer:start', description: 'Start the live timer' },
		{ name: 'stop_timer', scope: 'timer:stop', description: 'Stop the timer and book its time' },
		{ name: 'set_day_hours', scope: 'hours:write', description: 'Replace a day’s booked total' },
		{ name: 'set_office_day', scope: 'office:write', description: 'Mark or unmark an office day' }
	];
</script>

<svelte:head>
	<title>Connect · Time Tracker</title>
</svelte:head>

{#snippet field(label: string, value: string)}
	<div class="flex flex-col gap-1.5">
		<span class="text-xs font-medium text-muted-foreground">{label}</span>
		<div class="flex items-center gap-2 rounded-xl border bg-muted/40 py-1 pr-1 pl-3">
			<code class="field-value min-w-0 flex-1 truncate font-mono text-sm text-foreground"
				>{value}</code
			>
			<CopyButton {value} label={`Copy ${label.toLowerCase()}`} />
		</div>
	</div>
{/snippet}

{#snippet step(n: number, body: Snippet)}
	<li class="flex gap-3">
		<span
			class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular"
			aria-hidden="true">{n}</span
		>
		<div
			class="min-w-0 flex-1 pt-0.5 text-sm text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:decoration-foreground/60 [&_code:not(.field-value)]:rounded [&_code:not(.field-value)]:bg-muted [&_code:not(.field-value)]:px-1 [&_code:not(.field-value)]:py-0.5 [&_code:not(.field-value)]:font-mono [&_code:not(.field-value)]:text-xs [&_code:not(.field-value)]:text-foreground [&_strong]:font-medium [&_strong]:text-foreground"
		>
			{@render body()}
		</div>
	</li>
{/snippet}

{#snippet keyStep1()}
	Create an <strong>API key</strong> with the permissions the assistant should have.
{/snippet}
{#snippet keyStep2()}
	In Chatty, open <strong>Settings → MCP servers</strong> and add an <strong>HTTP</strong> server
	with the <strong>Server URL</strong>.
{/snippet}
{#snippet keyStep3()}
	Paste the key as the server’s <strong>token</strong>. Chatty sends it in the
	<code>Authorization</code> header.
{/snippet}

{#snippet oauthStep1()}
	In Pocket ID, open <strong>Administration → APIs</strong> and create an API with this resource:
	{#if data.oauth}
		<div class="mt-2">
			{@render field(
				data.oauth.resource === data.mcpUrl ? 'Resource (same as the server URL)' : 'Resource',
				data.oauth.resource
			)}
		</div>
	{/if}
	<p class="mt-2 text-xs">
		Don’t see <strong>APIs</strong>? Turn it on under
		<strong>Administration → Configuration → Features</strong>.
	</p>
{/snippet}
{#snippet oauthStep2()}
	On its <strong>Permissions</strong> tab, add each of these keys (click one to copy it):
	<span class="mt-2 flex flex-wrap items-center gap-1.5">
		{#each SCOPES as scope (scope.key)}<CopyChip value={scope.key} />{/each}
	</span>
{/snippet}
{#snippet oauthStep3()}
	Let clients in, in one of two ways:
	<div class="mt-2 flex flex-col gap-2">
		<div class="rounded-xl border p-3">
			<p class="font-medium text-foreground">
				Clients that register themselves (e.g. Claude, VS Code)
			</p>
			<ol class="mt-1 list-[lower-alpha] space-y-0.5 pl-5">
				<li>
					Under <strong>Administration → Configuration → Features</strong>, switch on
					<strong>Client ID metadata documents</strong>.
				</li>
				<li>
					Under <strong>Administration → Configuration → OIDC</strong>, add the client’s metadata
					URL (listed in the client’s docs) to <strong>Allowed metadata document URLs</strong>.
				</li>
				<li>On the API, enable <strong>Allow all metadata document clients</strong>.</li>
			</ol>
		</div>
		<div class="rounded-xl border p-3">
			<p class="font-medium text-foreground">Any other client</p>
			<p class="mt-1">
				Create an OIDC client with the MCP client’s callback URL and grant it this API under
				<strong>Access an API on your behalf</strong>.
			</p>
		</div>
	</div>
{/snippet}
{#snippet oauthStep4()}
	Add the server URL to the client. It finds your Pocket ID automatically and asks you to sign in.
	{#if data.oauth}
		<div class="mt-2">{@render field('Pocket ID (issuer)', data.oauth.issuer)}</div>
	{/if}
{/snippet}

<div class="flex flex-col gap-6">
	<PageHeader
		title="Connect an AI client"
		description="Time Tracker is an MCP server. Let Chatty or any other MCP client read your hours and run the timer."
	/>

	<Card.Root>
		<Card.Header>
			<Card.Title>MCP endpoint</Card.Title>
			<Card.Description>Use this URL in every client (Streamable HTTP).</Card.Description>
		</Card.Header>
		<Card.Content>
			{@render field('Server URL', data.mcpUrl)}
		</Card.Content>
	</Card.Root>

	<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<KeyRoundIcon class="size-4" />With an API key
				</Card.Title>
				<Card.Description>
					Works with any client that can send a bearer token, including Chatty.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<ol class="flex flex-col gap-4">
					{@render step(1, keyStep1)}
					{@render step(2, keyStep2)}
					{@render step(3, keyStep3)}
				</ol>
			</Card.Content>
			<Card.Footer>
				<Button href={resolve('/keys')}>
					Create an API key<ArrowRightIcon data-icon="inline-end" />
				</Button>
			</Card.Footer>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<ShieldCheckIcon class="size-4" />With OAuth
				</Card.Title>
				<Card.Description>Sign in through your identity provider. No keys needed.</Card.Description>
				<Card.Action>
					{#if data.oauth}
						<Badge class="bg-success/10 text-success-foreground">Enabled</Badge>
					{:else}
						<Badge variant="outline">Off</Badge>
					{/if}
				</Card.Action>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				{#if data.oauth}
					<div
						class="flex gap-2.5 rounded-xl bg-info/10 px-3 py-2.5 text-sm text-info-foreground"
						role="note"
					>
						<InfoIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
						<p>
							Everyone who connects must have signed in to Time Tracker once, so their Pocket ID
							account is linked to their hours.
						</p>
					</div>
					<ol class="flex flex-col gap-4">
						{@render step(1, oauthStep1)}
						{@render step(2, oauthStep2)}
						{@render step(3, oauthStep3)}
						{@render step(4, oauthStep4)}
					</ol>
				{:else}
					<p class="text-sm text-muted-foreground">
						Sign-in with an identity provider isn’t set up on this server yet. OAuth needs an OIDC
						provider (<code class="font-mono text-xs">OIDC_ISSUER</code>). It is off while none is
						configured, or when
						<code class="font-mono text-xs">MCP_OAUTH=false</code>. See the
						<a
							href="https://github.com/Kellojo/time-tracker#option-b-oauth-via-pocket-id"
							target="_blank"
							rel="noreferrer"
							class="font-medium text-foreground underline underline-offset-4">setup guide</a
						>.
					</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2"><WrenchIcon class="size-4" />Tools</Card.Title>
			<Card.Description>
				A client only sees the tools its key or token has permission for.
			</Card.Description>
		</Card.Header>
		<Card.Content class="px-0">
			<ul class="divide-y">
				{#each TOOLS as tool (tool.name)}
					<li class="flex flex-col gap-0.5 px-(--card-spacing) py-2.5">
						<span class="flex flex-wrap items-center gap-2">
							<code class="font-mono text-sm">{tool.name}</code>
							<span class="sr-only">requires</span>
							<Badge variant="outline" class="font-mono">{tool.scope}</Badge>
						</span>
						<span class="text-xs text-muted-foreground">{tool.description}</span>
					</li>
				{/each}
			</ul>
		</Card.Content>
	</Card.Root>
</div>
