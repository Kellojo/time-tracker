<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";

  type ApiKeyItem = {
    id: string;
    name: string;
    scopes: string[];
    createdAt: string;
    lastUsedAt: string | null;
  };

  let theme = $state<"light" | "dark">(
    browser && document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light",
  );
  let apiKeys = $state<ApiKeyItem[]>([]);
  let keysBusy = $state(false);
  let keyName = $state("");
  let keyCreateScopes = $state<string[]>([
    "timer:start",
    "timer:stop",
    "hours:read",
  ]);
  let keyMessage = $state("");
  let keyError = $state("");
  let newApiKey = $state("");

  const keyScopeOptions = ["timer:start", "timer:stop", "hours:read", "office:write"];

  const applyTheme = (value: "light" | "dark") => {
    theme = value;
    if (!browser) return;
    document.documentElement.setAttribute("data-theme", value);
    localStorage.setItem("theme", value);
  };

  const toggleTheme = () => {
    applyTheme(theme === "light" ? "dark" : "light");
  };

  const toggleScope = (scope: string) => {
    if (keyCreateScopes.includes(scope)) {
      keyCreateScopes = keyCreateScopes.filter((item) => item !== scope);
      return;
    }

    keyCreateScopes = [...keyCreateScopes, scope];
  };

  const formatDateTime = (isoDate: string | null) => {
    if (!isoDate) return "Never";
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) return "Unknown";
    return parsed.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  async function loadApiKeys() {
    const res = await fetch("/api/keys");
    const payload = await res.json();

    if (!res.ok || !payload?.data?.keys) {
      keyError = payload?.error?.message ?? "Could not load API keys.";
      return;
    }

    apiKeys = payload.data.keys as ApiKeyItem[];
    keyError = "";
  }

  const createApiKey = () => {
    void createApiKeyAsync();
  };

  async function createApiKeyAsync() {
    if (keysBusy) return;
    keysBusy = true;
    keyError = "";
    keyMessage = "";
    newApiKey = "";

    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: keyName,
        scopes: keyCreateScopes,
      }),
    });
    const payload = await res.json();

    if (!res.ok || !payload?.data?.apiKey) {
      keyError = payload?.error?.message ?? "Could not create API key.";
      keysBusy = false;
      return;
    }

    newApiKey = String(payload.data.apiKey);
    keyMessage = "API key created. Copy it now, it is shown only once.";
    keyName = "";
    await loadApiKeys();
    keysBusy = false;
  }

  const deleteKey = (id: string) => {
    void deleteKeyAsync(id);
  };

  async function deleteKeyAsync(id: string) {
    if (keysBusy) return;
    keysBusy = true;
    keyError = "";
    keyMessage = "";

    const res = await fetch(`/api/keys/${id}`, {
      method: "DELETE",
    });
    const payload = await res.json();

    if (!res.ok) {
      keyError = payload?.error?.message ?? "Could not delete API key.";
      keysBusy = false;
      return;
    }

    keyMessage = "API key deleted.";
    await loadApiKeys();
    keysBusy = false;
  }

  const copyNewApiKey = () => {
    void copyNewApiKeyAsync();
  };

  async function copyNewApiKeyAsync() {
    if (!newApiKey || !browser) return;

    try {
      await navigator.clipboard.writeText(newApiKey);
      keyMessage = "API key copied to clipboard.";
    } catch {
      keyMessage = "Copy failed. Please select and copy it manually.";
    }
  }

  onMount(() => {
    void loadApiKeys();

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
  });
</script>

<svelte:head>
  <title>API Keys | Time Tracker</title>
  <meta
    name="description"
    content="Create and revoke personal API keys for timer automation and reading work times."
  />
</svelte:head>

<main class="shell api-keys-page">
  <header class="topbar">
    <div>
      <p class="eyebrow">API Access</p>
      <h1>API keys</h1>
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
      <a class="nav-link" href="/">Dashboard</a>

      <button
        class="theme-toggle"
        onclick={toggleTheme}
        aria-label="Toggle light and dark theme"
      >
        Theme: {theme === "dark" ? "Dark" : "Light"}
      </button>
    </div>
  </header>

  <section class="api-keys-layout">
    <article class="panel api-keys-panel compact-panel">
      <div class="section-head compact-head">
        <div>
          <p class="eyebrow">Keys</p>
          <h2>Your access tokens</h2>
        </div>
      </div>

      <div class="api-keys-create compact-create">
        <label class="api-keys-label" for="new-key-name">Name</label>
        <input
          id="new-key-name"
          type="text"
          bind:value={keyName}
          placeholder="Home Automation"
        />

        <p class="api-keys-label">Scopes</p>
        <div class="scope-row">
          {#each keyScopeOptions as scope}
            <label class="scope-pill">
              <input
                type="checkbox"
                checked={keyCreateScopes.includes(scope)}
                onchange={() => toggleScope(scope)}
              />
              <span>{scope}</span>
            </label>
          {/each}
        </div>

        <button class="primary" onclick={createApiKey} disabled={keysBusy}
          >{keysBusy ? "Working..." : "Create key"}</button
        >
      </div>

      {#if newApiKey}
        <div class="key-secret-box">
          <p class="api-keys-label">New key (shown once)</p>
          <textarea readonly value={newApiKey}></textarea>
          <button class="secondary" onclick={copyNewApiKey}>Copy key</button>
        </div>
      {/if}

      {#if keyError}
        <p class="form-error">{keyError}</p>
      {/if}
      {#if keyMessage}
        <p class="muted">{keyMessage}</p>
      {/if}

      <div class="key-list">
        {#if apiKeys.length === 0}
          <p class="muted">No API keys yet.</p>
        {:else}
          {#each apiKeys as key}
            <article class="key-item compact-item">
              <div>
                <strong>{key.name}</strong>
                <p class="muted">Scopes: {key.scopes.join(", ")}</p>
                <p class="muted">
                  Created: {formatDateTime(key.createdAt)} | Last used: {formatDateTime(
                    key.lastUsedAt,
                  )}
                </p>
              </div>

              <button
                class="ghost key-delete-btn"
                onclick={() => deleteKey(key.id)}
                disabled={keysBusy}
              >
                Delete
              </button>
            </article>
          {/each}
        {/if}
      </div>
    </article>

    <article class="panel api-docs-panel compact-panel">
      <div class="section-head compact-head">
        <div>
          <p class="eyebrow">Docs</p>
          <h2>API endpoints</h2>
        </div>
      </div>

      <div class="endpoint-list">
        <article class="endpoint-item">
          <p><span class="method-tag">POST</span> /api/timer/start</p>
          <p class="muted">Scope: timer:start</p>
        </article>
        <article class="endpoint-item">
          <p><span class="method-tag">POST</span> /api/timer/stop</p>
          <p class="muted">Scope: timer:stop</p>
        </article>
        <article class="endpoint-item">
          <p><span class="method-tag method-get">GET</span> /api/hours/today</p>
          <p class="muted">Scope: hours:read</p>
        </article>
        <article class="endpoint-item">
          <p>
            <span class="method-tag method-get">GET</span> /api/hours/&#123;date&#125;
          </p>
          <p class="muted">Scope: hours:read (date format: YYYY-MM-DD)</p>
        </article>
        <article class="endpoint-item">
          <p><span class="method-tag method-get">GET</span> /api/hours/week</p>
          <p class="muted">Scope: hours:read (current week Monday-Sunday)</p>
        </article>
        <article class="endpoint-item">
          <p><span class="method-tag method-get">GET</span> /api/hours/year</p>
          <p class="muted">Scope: hours:read (?year=YYYY optional)</p>
        </article>
        <article class="endpoint-item">
          <p><span class="method-tag">PUT</span> /api/office/&#123;date&#125;</p>
          <p class="muted">Scope: office:write (mark day as office day)</p>
        </article>
        <article class="endpoint-item">
          <p><span class="method-tag">DELETE</span> /api/office/&#123;date&#125;</p>
          <p class="muted">Scope: office:write (remove office day marker)</p>
        </article>
        <article class="endpoint-item">
          <p><span class="method-tag method-get">GET</span> /api/office?month=YYYY-MM</p>
          <p class="muted">Scope: hours:read (list office days for month)</p>
        </article>
      </div>

      <p class="api-keys-label">Authorization header</p>
      <pre class="api-snippet">Authorization: Bearer YOUR_API_KEY</pre>

      <p class="api-keys-label">Examples</p>
      <pre
        class="api-snippet">curl -X POST "$BASE_URL/api/timer/start" -H "Authorization: Bearer $API_KEY"</pre>
      <pre
        class="api-snippet">curl -X POST "$BASE_URL/api/timer/stop" -H "Authorization: Bearer $API_KEY" -H "content-type: application/json" -d '&#123;"day":"2026-04-03"&#125;'</pre>
      <pre
        class="api-snippet">curl "$BASE_URL/api/hours/today" -H "Authorization: Bearer $API_KEY"</pre>
      <pre
        class="api-snippet">curl "$BASE_URL/api/hours/2026-04-03" -H "Authorization: Bearer $API_KEY"</pre>
      <pre
        class="api-snippet">curl "$BASE_URL/api/hours/week" -H "Authorization: Bearer $API_KEY"</pre>
      <pre
        class="api-snippet">curl "$BASE_URL/api/hours/year" -H "Authorization: Bearer $API_KEY"</pre>
      <pre
        class="api-snippet">curl -X PUT "$BASE_URL/api/office/2026-04-03" -H "Authorization: Bearer $API_KEY"</pre>
    </article>
  </section>
</main>
