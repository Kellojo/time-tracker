<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount, tick } from "svelte";
  import TimerCard from "$lib/ui/TimerCard.svelte";

  type MonthPreviewDay = {
    dateIso: string;
    year: number;
    month: number;
    day: number;
    minutes: number;
    inCurrentMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
    isOfficeDay: boolean;
    weekdayShort: string;
  };

  const now = new Date();
  const weekdayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const previewHeaders = [...weekdayHeaders, "Week +/-"];
  let viewedYear = $state(now.getFullYear());
  let viewedMonth = $state(now.getMonth());

  const toDateIso = (year: number, month: number, day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const toMonthKey = (year: number, month: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}`;

  const currentMonthLabel = $derived(
    new Date(viewedYear, viewedMonth, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    }),
  );
  const daysInViewedMonth = $derived(
    new Date(viewedYear, viewedMonth + 1, 0).getDate(),
  );
  const currentMonthKey = $derived(toMonthKey(viewedYear, viewedMonth));

  const buildDayCell = (
    year: number,
    month: number,
    day: number,
    inCurrentMonth: boolean,
  ): MonthPreviewDay => {
    const weekday = new Date(year, month, day).getDay();
    return {
      dateIso: toDateIso(year, month, day),
      year,
      month,
      day,
      minutes: 0,
      inCurrentMonth,
      isToday:
        year === now.getFullYear() &&
        month === now.getMonth() &&
        day === now.getDate(),
      isWeekend: weekday === 0 || weekday === 6,
      isOfficeDay: false,
      weekdayShort: weekdayHeaders[(weekday + 6) % 7],
    };
  };

  const buildMonthPreviewDays = (year: number, month: number) => {
    const dayCount = new Date(year, month + 1, 0).getDate();
    const firstDayMondayIndex = (new Date(year, month, 1).getDay() + 6) % 7;

    const previousMonthDate = new Date(year, month, 0);
    const previousYear = previousMonthDate.getFullYear();
    const previousMonth = previousMonthDate.getMonth();
    const previousMonthDays = previousMonthDate.getDate();

    const days: MonthPreviewDay[] = [];

    for (let i = firstDayMondayIndex; i > 0; i -= 1) {
      const day = previousMonthDays - i + 1;
      days.push(buildDayCell(previousYear, previousMonth, day, false));
    }

    for (let day = 1; day <= dayCount; day += 1) {
      days.push(buildDayCell(year, month, day, true));
    }

    const trailingDays = (7 - (days.length % 7)) % 7;
    const nextMonthDate = new Date(year, month + 1, 1);
    const nextYear = nextMonthDate.getFullYear();
    const nextMonth = nextMonthDate.getMonth();

    for (let day = 1; day <= trailingDays; day += 1) {
      days.push(buildDayCell(nextYear, nextMonth, day, false));
    }

    return days;
  };

  let monthPreviewDays = $state<MonthPreviewDay[]>(
    buildMonthPreviewDays(now.getFullYear(), now.getMonth()),
  );

  let selectedDay = $state(now.getDate());
  let editValue = $state("");
  let inputError = $state("");
  let isTracking = $state(false);
  let activeRunSeconds = $state(0);
  let timerActionPending = $state(false);
  let apiMessage = $state("");
  let monthScrollEl: HTMLDivElement | null = null;
  let monthScrollInitialized = false;
  let theme = $state<"light" | "dark">(
    browser && document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light",
  );

  const scrollMonthToCurrentDay = async () => {
    if (!monthScrollEl || monthScrollInitialized) return;

    await tick();

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const currentDayCell =
      monthScrollEl.querySelector<HTMLButtonElement>(".month-cell.active");

    if (!currentDayCell) return;

    const containerRect = monthScrollEl.getBoundingClientRect();
    const dayRect = currentDayCell.getBoundingClientRect();
    const nextLeft =
      monthScrollEl.scrollLeft +
      (dayRect.left - containerRect.left) -
      containerRect.width / 2 +
      dayRect.width / 2;

    monthScrollEl.scrollLeft = Math.max(0, nextLeft);
    monthScrollInitialized = true;
  };

  const formatMinutes = (minutes: number) => {
    const safeMinutes = Math.max(0, Math.round(minutes));
    const hoursPart = Math.floor(safeMinutes / 60);
    const minutesPart = safeMinutes % 60;
    if (hoursPart === 0) {
      return `${minutesPart}m`;
    }
    if (minutesPart === 0) {
      return `${hoursPart}h`;
    }
    return `${hoursPart}h ${minutesPart}m`;
  };

  const formatSignedMinutes = (minutes: number) => {
    const rounded = Math.round(minutes);
    const sign = rounded < 0 ? "-" : "+";
    return `${sign}${formatMinutes(Math.abs(rounded))}`;
  };

  const formatWeekSummaryMinutes = (minutes: number) => {
    const rounded = Math.round(minutes);
    if (rounded === 0) {
      return "+ 0 hours";
    }
    return formatSignedMinutes(rounded);
  };

  const toCellDate = (day: MonthPreviewDay) =>
    new Date(day.year, day.month, day.day);

  const calculateWeekExtraMinutes = (weekEndDay: MonthPreviewDay) => {
    const weekEnd = toCellDate(weekEndDay);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);

    let totalExtraMinutes = 0;

    for (const day of monthPreviewDays) {
      const current = toCellDate(day);

      if (current < weekStart || current > weekEnd) {
        continue;
      }

      const dayOfWeek = current.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        totalExtraMinutes += day.minutes;
        continue;
      }

      if (day.minutes >= 1) {
        totalExtraMinutes += day.minutes - dailyTargetMinutes;
      }
    }

    return totalExtraMinutes;
  };

  const weekEndExtraMinutes = $derived(
    (() => {
      const summaries: Record<string, number> = {};

      for (const day of monthPreviewDays) {
        if (toCellDate(day).getDay() === 0) {
          summaries[day.dateIso] = calculateWeekExtraMinutes(day);
        }
      }

      return summaries;
    })(),
  );

  const monthRows = $derived(
    (() => {
      const rows: Array<MonthPreviewDay[]> = [];

      for (let i = 0; i < monthPreviewDays.length; i += 7) {
        rows.push(monthPreviewDays.slice(i, i + 7));
      }

      return rows;
    })(),
  );

  const selectedDayEntry = $derived(
    monthPreviewDays.find(
      (entry) => entry.inCurrentMonth && entry.day === selectedDay,
    ),
  );
  const selectedDayMinutes = $derived(selectedDayEntry?.minutes ?? 0);
  const isSelectedDayToday = $derived(
    viewedYear === now.getFullYear() &&
      viewedMonth === now.getMonth() &&
      selectedDay === now.getDate(),
  );
  const selectedDayLiveMinutes = $derived(
    selectedDayMinutes +
      (isTracking && isSelectedDayToday ? activeRunSeconds / 60 : 0),
  );
  const dailyTargetMinutes = 8 * 60;
  const selectedDayDisplayMinutes = $derived(
    Math.floor(selectedDayLiveMinutes),
  );
  const selectedDayProgressPercentRaw = $derived(
    Math.max(0, (selectedDayLiveMinutes / dailyTargetMinutes) * 100),
  );
  const selectedDayProgressPercent = $derived(
    Math.min(100, selectedDayProgressPercentRaw),
  );
  const selectedDayOvertimePercent = $derived(
    Math.min(100, Math.max(0, selectedDayProgressPercentRaw - 100)),
  );
  const selectedDayOvertimeMinutes = $derived(
    Math.max(0, Math.floor(selectedDayLiveMinutes - dailyTargetMinutes)),
  );
  const selectedDayLabel = $derived(
    new Date(viewedYear, viewedMonth, selectedDay).toLocaleDateString(
      undefined,
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      },
    ),
  );
  const remainingToTargetMinutes = $derived(
    Math.max(0, 8 * 60 - selectedDayDisplayMinutes),
  );
  const selectedDayIsOffice = $derived(
    selectedDayEntry?.isOfficeDay ?? false,
  );

  $effect(() => {
    if (!selectedDayEntry) return;
    editValue =
      selectedDayEntry.minutes > 0
        ? formatMinutes(selectedDayEntry.minutes)
        : "";
  });

  const parseDurationInput = (value: string) => {
    const input = value.trim();

    const hoursAndMinutes = input.match(/^(\d+)\s*h\s*([0-5]?\d)\s*m$/i);
    if (hoursAndMinutes) {
      return Number(hoursAndMinutes[1]) * 60 + Number(hoursAndMinutes[2]);
    }

    const hoursOnly = input.match(/^(\d+)\s*h$/i);
    if (hoursOnly) {
      return Number(hoursOnly[1]) * 60;
    }

    const minutesOnly = input.match(/^([0-5]?\d)\s*m$/i);
    if (minutesOnly) {
      return Number(minutesOnly[1]);
    }

    return null;
  };

  const setSelectedDay = (dayNumber: number) => {
    selectedDay = dayNumber;
    inputError = "";
    apiMessage = "";
  };

  const selectCalendarCell = (day: MonthPreviewDay) => {
    if (day.inCurrentMonth) {
      setSelectedDay(day.day);
      return;
    }

    viewedYear = day.year;
    viewedMonth = day.month;
    selectedDay = day.day;
    inputError = "";
    apiMessage = "";
  };

  const goToPreviousMonth = () => {
    if (viewedMonth === 0) {
      viewedMonth = 11;
      viewedYear -= 1;
      return;
    }
    viewedMonth -= 1;
  };

  const goToNextMonth = () => {
    if (viewedMonth === 11) {
      viewedMonth = 0;
      viewedYear += 1;
      return;
    }
    viewedMonth += 1;
  };

  const goToCurrentMonth = () => {
    viewedYear = now.getFullYear();
    viewedMonth = now.getMonth();
    selectedDay = Math.min(now.getDate(), daysInViewedMonth);
  };

  const selectedDateIso = (dayNumber: number) =>
    toDateIso(viewedYear, viewedMonth, dayNumber);

  async function loadMonthData() {
    const previous = new Date(viewedYear, viewedMonth - 1, 1);
    const next = new Date(viewedYear, viewedMonth + 1, 1);
    const monthKeys = [
      currentMonthKey,
      toMonthKey(previous.getFullYear(), previous.getMonth()),
      toMonthKey(next.getFullYear(), next.getMonth()),
    ];

    const results = await Promise.all(
      monthKeys.map(async (monthKey) => {
        const res = await fetch(`/api/days?month=${monthKey}`);
        const payload = await res.json();

        if (!res.ok || !payload?.data?.days) {
          return {
            ok: false,
            error: payload?.error?.message ?? `Could not load ${monthKey}.`,
            days: {} as Record<string, number>,
          };
        }

        return {
          ok: true,
          error: "",
          days: payload.data.days as Record<string, number>,
        };
      }),
    );

    const officeResults = await Promise.all(
      monthKeys.map(async (monthKey) => {
        const res = await fetch(`/api/office?month=${monthKey}`);
        const payload = await res.json();

        return {
          officeDays: (payload?.data?.officeDays ?? []) as string[],
        };
      }),
    );

    const dayMap: Record<string, number> = {};
    let firstError = "";

    for (const result of results) {
      Object.assign(dayMap, result.days);
      if (!result.ok && !firstError) {
        firstError = result.error;
      }
    }

    const officeSet = new Set<string>();
    for (const result of officeResults) {
      for (const officeDay of result.officeDays) {
        officeSet.add(officeDay);
      }
    }

    monthPreviewDays = monthPreviewDays.map((entry) => {
      return {
        ...entry,
        minutes: Number(dayMap[entry.dateIso] ?? 0),
        isOfficeDay: officeSet.has(entry.dateIso),
      };
    });

    if (firstError) {
      apiMessage = firstError;
    }
  }

  async function loadTimerStatus() {
    const res = await fetch("/api/timer/status");
    const payload = await res.json();
    if (!res.ok || !payload?.data) {
      apiMessage = payload?.error?.message ?? "Could not load timer status.";
      return;
    }

    isTracking = Boolean(payload.data.isRunning);
    activeRunSeconds = Number(payload.data.elapsedSeconds ?? 0);
  }

  const refreshFromBackend = async () => {
    await Promise.all([loadMonthData(), loadTimerStatus()]);
  };

  const applyTheme = (value: "light" | "dark") => {
    theme = value;
    if (!browser) return;
    document.documentElement.setAttribute("data-theme", value);
    localStorage.setItem("theme", value);
  };

  const toggleTheme = () => {
    applyTheme(theme === "light" ? "dark" : "light");
  };

  const applyHoursToSelectedDay = () => {
    void applyHoursToSelectedDayAsync();
  };

  const applyHoursToSelectedDayAsync = async () => {
    const parsed = parseDurationInput(editValue);
    if (parsed === null) {
      inputError = "Use 5h 30m, 5h, or 50m.";
      return;
    }

    const day = selectedDateIso(selectedDay);
    const res = await fetch(`/api/days/${day}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ minutes: parsed }),
    });
    const payload = await res.json();

    if (!res.ok) {
      inputError = payload?.error?.message ?? "Could not save daily total.";
      return;
    }

    monthPreviewDays = monthPreviewDays.map((entry) =>
      entry.day === selectedDay
        ? { ...entry, minutes: Number(payload.data.totalMinutes) }
        : entry,
    );

    inputError = "";
    apiMessage = "";
  };

  const toggleOfficeDay = () => {
    void toggleOfficeDayAsync();
  };

  const toggleOfficeDayAsync = async () => {
    const day = selectedDateIso(selectedDay);
    const isOffice = selectedDayEntry?.isOfficeDay;
    const method = isOffice ? "DELETE" : "PUT";
    const res = await fetch(`/api/office/${day}`, { method });
    const payload = await res.json();

    if (!res.ok) {
      apiMessage = payload?.error?.message ?? "Could not toggle office day.";
      return;
    }

    monthPreviewDays = monthPreviewDays.map((entry) =>
      entry.day === selectedDay && entry.inCurrentMonth
        ? { ...entry, isOfficeDay: !isOffice }
        : entry,
    );

    apiMessage = "";
  };

  $effect(() => {
    if (!isTracking) return;

    const id = setInterval(() => {
      activeRunSeconds += 1;
    }, 1000);

    return () => clearInterval(id);
  });

  const toggleTracking = () => {
    void toggleTrackingAsync();
  };

  const toggleTrackingAsync = async () => {
    if (timerActionPending) return;
    timerActionPending = true;

    if (!isTracking) {
      const startRes = await fetch("/api/timer/start", { method: "POST" });
      const startPayload = await startRes.json();
      if (!startRes.ok) {
        apiMessage = startPayload?.error?.message ?? "Could not start timer.";
        timerActionPending = false;
        return;
      }

      isTracking = true;
      activeRunSeconds = 0;
      apiMessage = "";
      timerActionPending = false;
      return;
    }

    const stopRes = await fetch("/api/timer/stop", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ day: selectedDateIso(selectedDay) }),
    });
    const stopPayload = await stopRes.json();

    if (!stopRes.ok) {
      apiMessage = stopPayload?.error?.message ?? "Could not stop timer.";
      timerActionPending = false;
      return;
    }

    monthPreviewDays = monthPreviewDays.map((entry) =>
      entry.day === selectedDay
        ? { ...entry, minutes: Number(stopPayload.data.totalMinutes) }
        : entry,
    );

    activeRunSeconds = 0;
    isTracking = false;
    apiMessage = "";
    timerActionPending = false;
  };

  const intensityClass = (hours: number) => {
    if (hours < 1) return "lvl-0";
    if (hours < 3) return "lvl-1";
    if (hours < 5) return "lvl-2";
    if (hours < 7) return "lvl-3";
    return "lvl-4";
  };

  const monthCellOvertimeStyle = (minutes: number) => {
    const overtimeMinutes = Math.max(0, minutes - dailyTargetMinutes);
    const overtimeMix = Math.min(100, (overtimeMinutes / (2 * 60)) * 100);
    return `--overtime-red-mix: ${overtimeMix.toFixed(1)}%;`;
  };

  $effect(() => {
    monthPreviewDays = buildMonthPreviewDays(viewedYear, viewedMonth);

    selectedDay = Math.min(Math.max(1, selectedDay), daysInViewedMonth);
    inputError = "";
    apiMessage = "";

    if (browser) {
      void loadMonthData();
    }
  });

  onMount(() => {
    void refreshFromBackend();
    void scrollMonthToCurrentDay();

    const handleVisibilityRefresh = () => {
      if (document.visibilityState !== "visible") return;
      void refreshFromBackend();
    };

    const handleWindowRefresh = () => {
      void refreshFromBackend();
    };

    document.addEventListener("visibilitychange", handleVisibilityRefresh);
    window.addEventListener("focus", handleWindowRefresh);
    window.addEventListener("pageshow", handleWindowRefresh);

    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const initialTheme =
      stored === "light" || stored === "dark"
        ? stored
        : prefersDark
          ? "dark"
          : "light";
    applyTheme(initialTheme);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
      window.removeEventListener("focus", handleWindowRefresh);
      window.removeEventListener("pageshow", handleWindowRefresh);
    };
  });
</script>

<svelte:head>
  <title>Time Tracker Preview</title>
  <meta
    name="description"
    content="SvelteKit preview for simple day-based time tracking with start/stop and editable hours/minutes."
  />
</svelte:head>

<main class="shell">
  <header class="topbar">
    <div>
      <p class="eyebrow">Time Tracker</p>
      <h1>Simple, focused work hour tracking</h1>
    </div>
    <div class="topbar-actions">
      <a
        class="mini-link"
        href="https://github.com/Kellojo/time-tracker"
        target="_blank"
        rel="noreferrer"
      >
        Open on GitHub
      </a>
      <a class="nav-link" href="/keys">API Keys</a>

      <button
        class="theme-toggle"
        onclick={toggleTheme}
        aria-label="Toggle light and dark theme"
      >
        Theme: {theme === "dark" ? "Dark" : "Light"}
      </button>
    </div>
  </header>

  <section class="dashboard-stack">
    <div class="grid">
      <TimerCard
        isRunning={isTracking}
        elapsedSeconds={activeRunSeconds}
        trackedDayLabel={selectedDayLabel}
        ontoggle={toggleTracking}
        pending={timerActionPending}
      />
      <article class="panel summary">
        <p class="eyebrow">Selected Day</p>
        <h2>{formatMinutes(selectedDayDisplayMinutes)}</h2>
        <p class="muted">Total tracked for {selectedDayLabel}</p>
        <div class="summary-list">
          <div>
            <div class="summary-indicators">
              <div
                class="summary-progress"
                role="progressbar"
                aria-label="Tracked progress for selected day"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={Math.round(selectedDayProgressPercent)}
                aria-valuetext={`${formatMinutes(selectedDayDisplayMinutes)} tracked${selectedDayOvertimeMinutes > 0 ? `, ${formatMinutes(selectedDayOvertimeMinutes)} overtime` : ""}`}
              >
                <span
                  class="summary-progress-fill"
                  style={`width: ${selectedDayProgressPercent}%`}
                ></span>
                <span class="summary-progress-label"
                  >Tracked {formatMinutes(selectedDayDisplayMinutes)} / {formatMinutes(
                    dailyTargetMinutes,
                  )}</span
                >
              </div>
              {#if selectedDayOvertimeMinutes > 0}
                <div class="summary-overtime" role="status">
                  <span
                    class="summary-overtime-fill"
                    style={`width: ${Math.max(18, selectedDayOvertimePercent)}%`}
                  ></span>
                  <span class="summary-progress-label"
                    >Overtime +{formatMinutes(selectedDayOvertimeMinutes)}</span
                  >
                </div>
              {/if}
            </div>
          </div>
        </div>
      </article>
    </div>

    <article class="panel month-preview">
      <div class="section-head">
        <div>
          <p class="eyebrow">Current Month Preview</p>
          <h2>{currentMonthLabel}</h2>
        </div>
        <div class="month-nav">
          <button
            class="secondary"
            onclick={goToPreviousMonth}
            aria-label="Previous month"
          >
            Prev
          </button>
          <button
            class="secondary"
            onclick={goToCurrentMonth}
            aria-label="Current month"
          >
            Today
          </button>
          <button
            class="secondary"
            onclick={goToNextMonth}
            aria-label="Next month"
          >
            Next
          </button>
        </div>
      </div>
      <div class="month-scroll" bind:this={monthScrollEl}>
        <div class="month-weekdays" aria-hidden="true">
          {#each previewHeaders as dayName}
            <span>{dayName}</span>
          {/each}
        </div>
        <div class="month-grid">
          {#each monthRows as week}
            <div class="month-week-row">
              <div class="month-week-days">
                {#each week as day}
                  <button
                    class={`month-cell ${intensityClass(day.minutes / 60)} ${day.isWeekend ? "weekend" : ""} ${day.isToday ? "active" : ""} ${day.isOfficeDay ? "office-day" : ""} ${day.inCurrentMonth ? "" : "outside-month"} ${selectedDay === day.day && day.inCurrentMonth ? "selected" : ""}`}
                    style={monthCellOvertimeStyle(day.minutes)}
                    onclick={() => selectCalendarCell(day)}
                    aria-label={`Set tracked hours for ${day.weekdayShort} day ${day.day}`}
                  >
                    <strong
                      >{day.day}
                      <span class="day-week">{day.weekdayShort}</span></strong
                    >
                    {#if day.minutes > 0}
                      <small>{formatMinutes(day.minutes)}</small>
                    {/if}
                  </button>
                {/each}
              </div>

              {#if week}
                {@const weekEndDay = week[6]}
                {@const weekExtraMinutes = weekEndDay
                  ? weekEndExtraMinutes[weekEndDay.dateIso]
                  : undefined}
                <div
                  class="month-week-summary"
                  aria-label="Weekly extra hours summary"
                >
                  {#if weekExtraMinutes !== undefined}
                    <small
                      class={`week-extra ${weekExtraMinutes === 0 ? "zero" : weekExtraMinutes > 0 ? "positive" : "negative"}`}
                      >{formatWeekSummaryMinutes(weekExtraMinutes)}</small
                    >
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="month-editor">
        <p class="muted">Selected day: {selectedDay}</p>
        <div class="month-editor-row">
          <input
            type="text"
            bind:value={editValue}
            placeholder="5h 30m"
            aria-label="Hours worked format"
          />
          <button class="primary" onclick={applyHoursToSelectedDay}
            >Set Hours</button
          >
        </div>
        <div class="month-editor-row">
          <button
            class="secondary"
            onclick={toggleOfficeDay}
            aria-label={`${selectedDayIsOffice ? "Remove" : "Mark"} as office day`}
          >
            {#if selectedDayIsOffice}
              🏢 Office Day (click to remove)
            {:else}
              🏠 Mark Office Day
            {/if}
          </button>
        </div>
        {#if inputError}
          <p class="form-error">{inputError}</p>
        {/if}
        {#if apiMessage}
          <p class="muted">{apiMessage}</p>
        {/if}
      </div>
    </article>
  </section>
</main>

<style>
  .summary-indicators {
    display: grid;
    gap: 0.55rem;
    width: 100%;
  }

  .summary-progress,
  .summary-overtime {
    position: relative;
    display: block;
    height: 1.15rem;
    min-height: 1.15rem;
    width: 100%;
    padding: 0;
    border-radius: 999px;
    background: #dde4eb;
    background: color-mix(in srgb, var(--line) 70%, var(--bg-soft));
    border: 1px solid #c4d0dc;
    border: 1px solid color-mix(in srgb, var(--line) 85%, transparent);
    overflow: hidden;
  }

  .summary-overtime {
    background: #f3debf;
    background: color-mix(in srgb, #f2c68e 38%, var(--bg-soft));
  }

  .summary-progress-fill,
  .summary-overtime-fill {
    position: absolute;
    inset: 0 auto 0 0;
    display: block;
    width: 0;
    height: auto;
    border-radius: 999px;
    min-width: 0;
    transition: width 260ms ease;
    z-index: 1;
  }

  .summary-progress-fill {
    background: var(--accent, #0f8f78);
    background-image: linear-gradient(
      90deg,
      color-mix(in srgb, var(--accent, #0f8f78) 80%, white),
      var(--accent, #0f8f78)
    );
    background: linear-gradient(90deg, #0f8f78, #0f8f78);
    animation: summary-progress-shimmer 1.4s linear infinite;
    background-size: 160% 100%;
  }

  .summary-overtime-fill {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--danger-red) 35%, black),
      var(--danger-red)
    );
    animation: summary-progress-shimmer 1.4s linear infinite;
    background-size: 160% 100%;
  }

  .summary-progress-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 0 0.55rem;
    margin-top: 1px;
    text-align: left;
    color: #143229;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    line-height: 1;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    pointer-events: none;
    z-index: 2;
  }

  .summary-overtime .summary-progress-label {
    color: #4a2200;
  }

  :global([data-theme="dark"]) .summary-progress-label {
    color: #e8f5ef;
  }

  :global([data-theme="dark"]) .summary-overtime .summary-progress-label {
    color: #fff2e3;
  }

  @keyframes summary-progress-shimmer {
    0% {
      background-position: 100% 0;
    }

    100% {
      background-position: 0 0;
    }
  }
</style>
