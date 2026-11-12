<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import { toast } from 'svelte-sonner';
	import { Button, type ButtonSize, type ButtonVariant } from '$lib/components/ui/button/index.js';

	let {
		value,
		label = 'Copy',
		variant = 'ghost',
		size = 'icon-sm',
		class: className
	}: {
		value: string;
		label?: string;
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
	} = $props();

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

<Button {variant} {size} class={className} onclick={copy} aria-label={label} title={label}>
	{#if copied}<CheckIcon />{:else}<CopyIcon />{/if}
	{#if !size?.startsWith('icon')}{copied ? 'Copied' : label}{/if}
</Button>
