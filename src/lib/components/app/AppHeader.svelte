<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { setMode, userPrefersMode } from 'mode-watcher';
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import PlugIcon from '@lucide/svelte/icons/plug';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import LaptopIcon from '@lucide/svelte/icons/laptop';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import UserAvatar from './UserAvatar.svelte';
	import GithubIcon from './GithubIcon.svelte';
	import { cn } from '$lib/utils.js';

	type User = { name: string | null; email: string | null; image: string | null };
	let { user }: { user: User | null } = $props();

	const nav = [
		{ path: '/', href: resolve('/'), label: 'Tracker', icon: CalendarDaysIcon },
		{ path: '/keys', href: resolve('/keys'), label: 'API keys', icon: KeyRoundIcon },
		{ path: '/connect', href: resolve('/connect'), label: 'Connect', icon: PlugIcon }
	];

	const displayName = $derived(user?.name || user?.email || 'Account');

	async function signOut() {
		await fetch('/api/auth/sign-out', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{}'
		}).catch(() => undefined);
		window.location.href = '/';
	}
</script>

<header
	class="sticky top-0 z-40 border-b bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md supports-backdrop-filter:bg-background/70"
>
	<div class="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
		<a href={resolve('/')} class="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
			<!-- The app icon doubles as the brand mark. -->
			<img src="/favicon.svg" alt="" class="size-7 rounded-lg dark:ring-1 dark:ring-white/10" />
			<span class="hidden sm:inline">Time Tracker</span>
		</a>

		<nav aria-label="Main" class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
			{#each nav as item (item.href)}
				{@const active = page.url.pathname === item.path}
				<a
					href={item.href}
					aria-current={active ? 'page' : undefined}
					class={cn(
						'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
						active && 'bg-muted text-foreground'
					)}
				>
					<item.icon class="size-4" />
					<span class={cn(!active && 'max-sm:sr-only')}>{item.label}</span>
				</a>
			{/each}
		</nav>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="ghost" size="icon" class="rounded-full" aria-label="Account">
						<UserAvatar name={displayName} image={user?.image} />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-60">
				<DropdownMenu.Label class="flex flex-col gap-0.5 font-normal">
					<span class="truncate text-sm font-medium text-foreground">{displayName}</span>
					{#if user?.email && user.email !== displayName}
						<span class="truncate text-xs text-muted-foreground">{user.email}</span>
					{/if}
				</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.GroupHeading class="text-xs text-muted-foreground"
						>Theme</DropdownMenu.GroupHeading
					>
					<DropdownMenu.RadioGroup
						value={userPrefersMode.current}
						onValueChange={(value) => setMode(value as 'light' | 'dark' | 'system')}
					>
						<DropdownMenu.RadioItem value="light"><SunIcon />Light</DropdownMenu.RadioItem>
						<DropdownMenu.RadioItem value="dark"><MoonIcon />Dark</DropdownMenu.RadioItem>
						<DropdownMenu.RadioItem value="system"><LaptopIcon />System</DropdownMenu.RadioItem>
					</DropdownMenu.RadioGroup>
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<a
							{...props}
							href="https://github.com/Kellojo/time-tracker"
							target="_blank"
							rel="noreferrer"
						>
							<GithubIcon />Source on GitHub
						</a>
					{/snippet}
				</DropdownMenu.Item>
				<DropdownMenu.Item onSelect={signOut}><LogOutIcon />Sign out</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</header>
