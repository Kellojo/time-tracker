<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		actions
	}: { title: string; description?: Snippet | string; actions?: Snippet } = $props();
</script>

<header class="grid gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
	<div class="min-w-0">
		<h1 class="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
		{#if description}
			<p class="mt-1 max-w-3xl text-sm text-pretty text-muted-foreground">
				{#if typeof description === 'string'}{description}{:else}{@render description()}{/if}
			</p>
		{/if}
	</div>
	{#if actions}
		<div class="mt-3 flex flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">
			{@render actions()}
		</div>
	{/if}
</header>
