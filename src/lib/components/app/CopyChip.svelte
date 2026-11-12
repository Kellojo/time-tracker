<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import { toast } from 'svelte-sonner';

	/** An inline code value that copies itself when clicked. */
	let { value }: { value: string } = $props();

	let copied = $state(false);
	let timeout: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			clearTimeout(timeout);
			timeout = setTimeout(() => (copied = false), 1500);
		} catch {
			toast.error('Could not copy to the clipboard.');
		}
	}
</script>

<button
	type="button"
	onclick={copy}
	aria-label={`Copy ${value}`}
	title="Copy"
	class="group/chip inline-flex h-6 items-center gap-1 rounded-md border bg-muted/60 px-1.5 font-mono text-xs text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
>
	{value}
	{#if copied}
		<CheckIcon class="size-3 text-success-foreground" aria-hidden="true" />
	{:else}
		<CopyIcon
			class="size-3 text-muted-foreground opacity-60 group-hover/chip:opacity-100"
			aria-hidden="true"
		/>
	{/if}
	<span class="sr-only" aria-live="polite">{copied ? 'Copied' : ''}</span>
</button>
