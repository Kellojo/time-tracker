<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/app/PageHeader.svelte';
	import TimerCard from '$lib/components/tracker/TimerCard.svelte';
	import DayCard from '$lib/components/tracker/DayCard.svelte';
	import MonthCalendar from '$lib/components/tracker/MonthCalendar.svelte';
	import { api } from '$lib/api';
	import type { PageData } from './$types';
	import {
		extraMinutesForDay,
		formatMinutes,
		formatSignedMinutes,
		parseIsoDate,
		toIsoDate,
		toMonthKey,
		weekDaysOf
	} from '$lib/time';

	let { data }: { data: PageData } = $props();

	// Ticks every second: drives the running clock and rolls "today" over at midnight.
	let now = $state(new Date());
	const today = $derived(toIsoDate(now));

	let viewYear = $state(new Date().getFullYear());
	let viewMonth = $state(new Date().getMonth());
	let selected = $state(toIsoDate(new Date()));

	/** Booked minutes per day and office days, filled month by month. */
	// Seeded from the server render, then kept up to date client-side.
	let booked = $state<Record<string, number>>(untrack(() => ({ ...data.booked })));
	let office = $state<Record<string, boolean>>(
		untrack(() => Object.fromEntries(data.officeDays.map((day) => [day, true])))
	);

	let timerStartedAt = $state<number | null>(
		untrack(() =>
			data.timerElapsedSeconds === null ? null : Date.now() - data.timerElapsedSeconds * 1000
		)
	);
	let timerPending = $state(false);
	let saving = $state(false);

	const running = $derived(timerStartedAt !== null);
	const elapsedSeconds = $derived(
		timerStartedAt === null ? 0 : Math.max(0, Math.floor((now.getTime() - timerStartedAt) / 1000))
	);

	/** Minutes for a day as shown: today includes the running timer. */
	const minutesFor = (day: string) =>
		(booked[day] ?? 0) + (running && day === today ? Math.floor(elapsedSeconds / 60) : 0);
	const isOffice = (day: string) => office[day] === true;

	const selectedDate = $derived(parseIsoDate(selected) ?? new Date());
	const selectedIsFuture = $derived(selected > today);
	/** Where a timer stop books its time: the selected day, but never a day that hasn't happened. */
	const bookingDay = $derived(selectedIsFuture ? today : selected);
	const bookingLabel = $derived(
		bookingDay === today
			? 'today'
			: selectedDate.toLocaleDateString(undefined, {
					weekday: 'short',
					day: 'numeric',
					month: 'short'
				})
	);

	/** A brand-new user: nothing booked in the loaded months and no timer. */
	const hasAnyData = $derived(running || Object.values(booked).some((m) => m > 0));

	const week = $derived.by(() => {
		const days = weekDaysOf(now);
		const total = days.reduce((sum, day) => sum + minutesFor(day), 0);
		const balance = days.reduce(
			(sum, day) => sum + extraMinutesForDay(parseIsoDate(day)!, minutesFor(day)),
			0
		);
		return { total, balance };
	});

	async function loadMonth(year: number, month: number) {
		const key = toMonthKey(year, month);
		const [days, officeData] = await Promise.all([
			api<{ days: Record<string, number> }>(`/api/days?month=${key}`),
			api<{ officeDays: string[] }>(`/api/office?month=${key}`)
		]);
		for (const day of Object.keys(booked)) if (day.startsWith(key)) delete booked[day];
		Object.assign(booked, days.days);
		for (const day of Object.keys(office)) if (day.startsWith(key)) delete office[day];
		for (const day of officeData.officeDays) office[day] = true;
	}

	/** The viewed month and its neighbours (the calendar shows spill-over days). */
	async function loadVisibleMonths() {
		try {
			await Promise.all(
				[-1, 0, 1].map((delta) => {
					const d = new Date(viewYear, viewMonth + delta, 1);
					return loadMonth(d.getFullYear(), d.getMonth());
				})
			);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not load tracked time.');
		}
	}

	async function loadTimer() {
		try {
			const status = await api<{ isRunning: boolean; elapsedSeconds: number }>('/api/timer/status');
			timerStartedAt = status.isRunning ? Date.now() - status.elapsedSeconds * 1000 : null;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not load the timer.');
		}
	}

	async function toggleTimer() {
		if (timerPending) return;
		timerPending = true;
		try {
			if (!running) {
				await api('/api/timer/start', { method: 'POST' });
				timerStartedAt = Date.now();
			} else {
				const result = await api<{ addedMinutes: number; totalMinutes: number }>(
					'/api/timer/stop',
					{ method: 'POST', json: { day: bookingDay } }
				);
				booked[bookingDay] = result.totalMinutes;
				timerStartedAt = null;
				toast.success(`Booked ${formatMinutes(result.addedMinutes)} on ${bookingLabel}.`);
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not update the timer.');
			await loadTimer();
		} finally {
			timerPending = false;
		}
	}

	async function saveDay(minutes: number) {
		const day = selected;
		saving = true;
		try {
			const result = await api<{ totalMinutes: number }>(`/api/days/${day}`, {
				method: 'PUT',
				json: { minutes }
			});
			booked[day] = result.totalMinutes;
			return true;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not save.');
			return false;
		} finally {
			saving = false;
		}
	}

	async function setOffice(value: boolean) {
		const day = selected;
		office[day] = value;
		try {
			await api(`/api/office/${day}`, { method: value ? 'PUT' : 'DELETE' });
		} catch (err) {
			office[day] = !value;
			toast.error(err instanceof Error ? err.message : 'Could not update the office day.');
		}
	}

	function selectDay(day: string) {
		selected = day;
		const date = parseIsoDate(day);
		if (date && (date.getFullYear() !== viewYear || date.getMonth() !== viewMonth)) {
			viewYear = date.getFullYear();
			viewMonth = date.getMonth();
		}
	}

	function changeMonth(year: number, month: number) {
		viewYear = year;
		viewMonth = month;
	}

	$effect(() => {
		void viewYear;
		void viewMonth;
		void loadVisibleMonths();
	});

	onMount(() => {
		void loadTimer();
		const tick = setInterval(() => (now = new Date()), 1000);
		const refresh = () => {
			if (document.visibilityState !== 'visible') return;
			void loadTimer();
			void loadVisibleMonths();
		};
		document.addEventListener('visibilitychange', refresh);
		window.addEventListener('focus', refresh);
		return () => {
			clearInterval(tick);
			document.removeEventListener('visibilitychange', refresh);
			window.removeEventListener('focus', refresh);
		};
	});
</script>

<svelte:head>
	<title>{running ? `${formatMinutes(Math.floor(elapsedSeconds / 60))} · ` : ''}Time Tracker</title>
</svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title={now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
	>
		{#snippet description()}
			{#if !hasAnyData}
				Start the timer or type today’s hours below to get going.
			{:else}
				This week <span class="font-medium text-foreground tabular"
					>{formatMinutes(week.total)}</span
				>
				· balance
				<span
					class="font-medium tabular {week.balance > 0
						? 'text-success-foreground'
						: week.balance < 0
							? 'text-destructive'
							: 'text-foreground'}">{formatSignedMinutes(week.balance)}</span
				>
			{/if}
		{/snippet}
	</PageHeader>

	<div
		class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:items-stretch"
	>
		<div class="flex flex-col gap-6">
			<TimerCard
				onbooktoday={() => selectDay(today)}
				{running}
				{elapsedSeconds}
				{bookingLabel}
				futureSelected={selectedIsFuture}
				pending={timerPending}
				ontoggle={toggleTimer}
			/>
			<DayCard
				date={selectedDate}
				isToday={selected === today}
				isFuture={selectedIsFuture}
				minutes={minutesFor(selected)}
				storedMinutes={booked[selected] ?? 0}
				officeDay={isOffice(selected)}
				{saving}
				onsave={saveDay}
				onofficechange={setOffice}
			/>
		</div>
		<MonthCalendar
			class="lg:h-full"
			year={viewYear}
			month={viewMonth}
			{today}
			{selected}
			{minutesFor}
			{isOffice}
			onselect={selectDay}
			onmonthchange={changeMonth}
		/>
	</div>
</div>
