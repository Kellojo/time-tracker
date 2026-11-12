<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import CopyButton from '$lib/components/app/CopyButton.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { api } from '$lib/api';
	import { ALL_SCOPES, SCOPES, type Scope } from '$lib/scopes';
	import { cn } from '$lib/utils.js';

	type ApiKey = {
		id: string;
		name: string;
		scopes: string[];
		createdAt: string;
		lastUsedAt: string | null;
	};

	let keys = $state<ApiKey[] | null>(null);
	let name = $state('');
	let scopes = $state<Scope[]>([...ALL_SCOPES]);
	let creating = $state(false);
	let created = $state<{ apiKey: string; name: string } | null>(null);
	let pendingDelete = $state<ApiKey | null>(null);
	let deleting = $state(false);
	/** The key created last, highlighted in the list. */
	let newKeyId = $state<string | null>(null);
	let revealEl: HTMLDivElement | undefined = $state();

	const nameValid = $derived(name.trim().length > 0);
	/** Set once a submit was tried without a name; cleared as soon as one is typed. */
	let nameTouched = $state(false);
	const nameError = $derived(nameTouched && !nameValid);
	let nameInput = $state<HTMLInputElement | null>(null);
	/** Scopes in their canonical order, whatever order they were stored in. */
	const orderedScopes = (keyScopes: string[]) => SCOPES.filter((s) => keyScopes.includes(s.key));

	/** Tried to create without any permission; the message shows until one is picked. */
	let scopesTouched = $state(false);
	const scopesError = $derived(scopesTouched && scopes.length === 0);
	let listHeading = $state<HTMLElement | null>(null);

	const formatDate = (iso: string) => {
		const date = new Date(iso);
		return Number.isNaN(date.getTime())
			? 'unknown'
			: date.toLocaleDateString(undefined, { dateStyle: 'medium' });
	};
	const formatFull = (iso: string) =>
		new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

	const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	/** "5 minutes ago", "yesterday", … for the last-used time. */
	function formatRelative(iso: string) {
		const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
		const units: [Intl.RelativeTimeFormatUnit, number][] = [
			['year', 31536000],
			['month', 2592000],
			['week', 604800],
			['day', 86400],
			['hour', 3600],
			['minute', 60]
		];
		for (const [unit, size] of units) {
			if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
		}
		return 'just now';
	}

	async function load() {
		try {
			keys = (await api<{ keys: ApiKey[] }>('/api/keys')).keys;
		} catch (err) {
			keys = [];
			toast.error(err instanceof Error ? err.message : 'Could not load API keys.');
		}
	}

	function dismissReveal() {
		created = null;
		nameInput?.focus();
	}

	function toggleScope(scope: Scope, on: boolean) {
		scopes = on ? [...new Set([...scopes, scope])] : scopes.filter((s) => s !== scope);
	}

	async function create(event: SubmitEvent) {
		event.preventDefault();
		if (creating) return;
		if (!nameValid || scopes.length === 0) {
			nameTouched = !nameValid;
			scopesTouched = scopes.length === 0;
			if (!nameValid) nameInput?.focus();
			else document.querySelector<HTMLButtonElement>('#key-scopes [role=switch]')?.focus();
			return;
		}
		creating = true;
		try {
			created = await api<{ apiKey: string; name: string }>('/api/keys', {
				method: 'POST',
				json: { name: name.trim(), scopes }
			});
			name = '';
			nameTouched = false;
			scopesTouched = false;
			await load();
			// Keys are listed newest first.
			newKeyId = keys?.[0]?.id ?? null;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not create the API key.');
		} finally {
			creating = false;
		}
	}

	async function confirmDelete() {
		if (!pendingDelete) return;
		deleting = true;
		try {
			await api(`/api/keys/${pendingDelete.id}`, { method: 'DELETE' });
			toast.success(`Revoked “${pendingDelete.name}”.`);
			// A one-time key that was just revoked is useless: stop showing it.
			if (pendingDelete.id === newKeyId) {
				created = null;
				newKeyId = null;
			}
			pendingDelete = null;
			await load();
			// The revoke button that opened the dialog is gone; keep focus in the list.
			listHeading?.focus();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not revoke the API key.');
		} finally {
			deleting = false;
		}
	}

	// Move focus to the one-time key's copy button as soon as it is revealed.
	$effect(() => {
		if (!revealEl) return;
		revealEl.querySelector('button')?.focus();
		revealEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
	});

	onMount(load);
</script>

<svelte:head>
	<title>API keys · Time Tracker</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader title="API keys">
		{#snippet description()}
			Personal keys for scripts, shortcuts and MCP clients like Chatty. Send one as
			<code class="rounded bg-muted px-1 py-0.5 font-mono text-xs whitespace-nowrap text-foreground"
				>Authorization: Bearer &lt;key&gt;</code
			>.
		{/snippet}
	</PageHeader>

	<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
		<Card.Root>
			<Card.Header>
				<Card.Title><h2>New key</h2></Card.Title>
				<Card.Description>Grant only what the integration needs.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form class="flex flex-col gap-5" onsubmit={create} novalidate>
					<div class="flex flex-col gap-2">
						<Label for="key-name">Name</Label>
						<Input
							id="key-name"
							bind:ref={nameInput}
							bind:value={name}
							placeholder="e.g. Chatty"
							maxlength={80}
							required
							aria-invalid={nameError ? true : undefined}
							aria-describedby={nameError ? 'key-name-error' : undefined}
						/>
						{#if nameError}
							<p id="key-name-error" class="text-xs text-destructive">Enter a name for the key.</p>
						{/if}
					</div>
					<fieldset
						id="key-scopes"
						class="flex flex-col gap-1"
						aria-describedby={scopesError ? 'scopes-error' : undefined}
					>
						<legend class="mb-2 text-sm font-medium">Permissions</legend>
						{#each SCOPES as scope (scope.key)}
							<label class="flex items-center justify-between gap-4 py-2">
								<span class="flex flex-col">
									<span class="text-sm">{scope.label}</span>
									<span class="text-xs text-muted-foreground">{scope.description}</span>
								</span>
								<Switch
									size="sm"
									checked={scopes.includes(scope.key)}
									onCheckedChange={(on) => toggleScope(scope.key, on)}
									aria-label={scope.label}
								/>
							</label>
						{/each}
						{#if scopesError}
							<p id="scopes-error" class="mt-1 text-xs text-destructive" role="alert">
								Pick at least one permission.
							</p>
						{/if}
					</fieldset>
					<Button type="submit" disabled={creating}>
						<PlusIcon />{creating ? 'Creating…' : 'Create key'}
					</Button>
				</form>
			</Card.Content>
		</Card.Root>

		<!-- On phones the reveal and the list come first; the form follows. -->
		<div class="order-first flex flex-col gap-6 lg:order-none">
			{#if created}
				<Card.Root class="ring-warning/40 dark:ring-warning/40">
					<Card.Header>
						<Card.Title>
							<h2 class="flex items-center gap-2">
								<TriangleAlertIcon class="size-4 text-warning-foreground" />Copy “{created.name}”
								now
							</h2>
						</Card.Title>
						<Card.Description>
							This key is shown only once. Store it somewhere safe, then add it to your client — see <a
								href={resolve('/connect')}
								class="text-foreground underline underline-offset-4">Connect</a
							>.
						</Card.Description>
						<Card.Action>
							<Button variant="ghost" size="sm" onclick={dismissReveal}>Done</Button>
						</Card.Action>
					</Card.Header>
					<Card.Content>
						<div
							bind:this={revealEl}
							class="flex items-center gap-2 rounded-xl bg-muted py-1 pr-1 pl-3"
						>
							<code class="min-w-0 flex-1 truncate font-mono text-sm">{created.apiKey}</code>
							<CopyButton value={created.apiKey} label="Copy key" variant="secondary" size="sm" />
						</div>
					</Card.Content>
				</Card.Root>
			{/if}

			<Card.Root class={cn(keys?.length !== 0 && 'pb-0')}>
				<Card.Header>
					<Card.Title>
						<h2 bind:this={listHeading} tabindex="-1" class="outline-none">Active keys</h2>
					</Card.Title>
					{#if keys && keys.length > 0}
						<Card.Action class="self-center">
							<Badge variant="secondary" class="tabular">{keys.length}</Badge>
						</Card.Action>
					{/if}
				</Card.Header>
				<Card.Content class={cn('px-0', keys?.length !== 0 && '-mt-2')}>
					{#if keys === null}
						<ul class="divide-y" aria-busy="true" aria-label="Loading API keys">
							{#each [0, 1] as row (row)}
								<li class="flex flex-col gap-2 px-(--card-spacing) py-3.5">
									<span class="h-4 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none"
									></span>
									<span
										class="h-3 w-64 max-w-full animate-pulse rounded bg-muted motion-reduce:animate-none"
									></span>
									<span class="flex gap-1">
										{#each [0, 1, 2] as pill (pill)}
											<span
												class="h-5 w-16 animate-pulse rounded-3xl bg-muted motion-reduce:animate-none"
											></span>
										{/each}
									</span>
								</li>
							{/each}
						</ul>
					{:else if keys.length === 0}
						<div class="flex flex-col items-center gap-2 px-6 py-10 text-center">
							<span
								class="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
							>
								<KeyRoundIcon class="size-5" />
							</span>
							<p class="text-sm font-medium">No API keys yet</p>
							<p class="max-w-xs text-sm text-muted-foreground">
								Create one to use the API or connect Chatty.
							</p>
						</div>
					{:else if keys}
						<ul class="divide-y">
							{#each keys as key (key.id)}
								<li
									class={cn(
										'flex items-start gap-3 px-(--card-spacing) py-3.5 transition-colors',
										key.id === newKeyId && 'bg-primary/5 dark:bg-primary/8'
									)}
								>
									<div class="flex min-w-0 flex-1 flex-col gap-2">
										<div class="flex flex-col">
											<span class="flex min-w-0 items-center gap-2">
												<span class="truncate text-sm font-medium">{key.name}</span>
												{#if key.id === newKeyId}
													<Badge variant="outline" class="shrink-0">New</Badge>
												{/if}
											</span>
											<span class="flex flex-wrap gap-x-1.5 text-xs text-muted-foreground">
												<span class="whitespace-nowrap" title={formatFull(key.createdAt)}
													>Created {formatDate(key.createdAt)}</span
												>
												<span aria-hidden="true">·</span>
												{#if key.lastUsedAt}
													<span class="whitespace-nowrap" title={formatFull(key.lastUsedAt)}
														>Used {formatRelative(key.lastUsedAt)}</span
													>
												{:else}
													<span class="whitespace-nowrap">Never used</span>
												{/if}
											</span>
										</div>
										<div class="flex flex-wrap gap-1">
											{#if key.scopes.length >= ALL_SCOPES.length}
												<Badge variant="secondary">All permissions</Badge>
											{:else}
												{#each orderedScopes(key.scopes) as scope (scope.key)}
													<Badge variant="secondary">{scope.label}</Badge>
												{/each}
											{/if}
										</div>
									</div>
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<Button
													{...props}
													variant="ghost"
													size="icon-sm"
													class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
													aria-label={`Revoke ${key.name}`}
													onclick={() => (pendingDelete = key)}
												>
													<Trash2Icon />
												</Button>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content>Revoke key</Tooltip.Content>
									</Tooltip.Root>
								</li>
							{/each}
						</ul>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>

<Dialog.Root open={pendingDelete !== null} onOpenChange={(open) => !open && (pendingDelete = null)}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Revoke “{pendingDelete?.name}”?</Dialog.Title>
			<Dialog.Description>
				Anything using this key stops working immediately. This can’t be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (pendingDelete = null)}>Cancel</Button>
			<Button variant="destructive" disabled={deleting} onclick={confirmDelete}>
				{deleting ? 'Revoking…' : 'Revoke key'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
