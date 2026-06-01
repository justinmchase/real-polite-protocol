import {
  Controller,
  type GroveApp,
  type IContext,
  type IState,
} from "@justinmchase/grove";

const DEV_INSPECTOR_HTML = `
    <div class="spec-box" id="kv-inspector" style="margin-top:1rem;">
      <h3>Dev: KV inspector</h3>
      <p>Local development only — visible because <code>RPP_DEV_MODE</code> is enabled.</p>
      <div id="kv-toolbar" style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-top:1rem;">
        <button id="kv-back" class="btn btn-secondary" style="display:none;">← prefixes</button>
        <span id="kv-breadcrumb" style="font-family:ui-monospace,monospace;font-size:0.85rem;color:var(--muted);"></span>
        <input id="kv-filter" placeholder="filter (substring of key/value JSON)" style="flex:1;min-width:200px;padding:0.4rem 0.6rem;border-radius:6px;background:var(--bg);color:var(--text);border:1px solid var(--border);font-family:ui-monospace,monospace;font-size:0.85rem;display:none;" />
        <button id="kv-reload" class="btn btn-secondary">reload</button>
      </div>
      <div id="kv-content" style="margin-top:1rem;font-family:ui-monospace,monospace;font-size:0.8rem;"></div>
      <div id="kv-sentinel" style="height:1px;"></div>
    </div>
    <script>
    (() => {
      const root = document.getElementById("kv-inspector");
      if (!root) return;
      const back = document.getElementById("kv-back");
      const crumb = document.getElementById("kv-breadcrumb");
      const filter = document.getElementById("kv-filter");
      const reload = document.getElementById("kv-reload");
      const content = document.getElementById("kv-content");
      const sentinel = document.getElementById("kv-sentinel");

      const state = { mode: "prefixes", prefix: [], cursor: null, q: "", loading: false, done: false };
      let observer = null;

      const escape = (s) => String(s).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

      async function loadPrefixes() {
        state.mode = "prefixes";
        state.prefix = [];
        back.style.display = "none";
        filter.style.display = "none";
        crumb.textContent = "indexes";
        content.innerHTML = '<div style="color:var(--muted);">loading…</div>';
        try {
          const res = await fetch("/_dev/kv/prefixes");
          if (!res.ok) throw new Error("HTTP " + res.status);
          const data = await res.json();
          const rows = data.prefixes.map((p) =>
            '<div class="kv-row" data-prefix="' + escape(p.prefix) + '" style="display:flex;justify-content:space-between;padding:0.5rem 0.75rem;border:1px solid var(--border);border-radius:6px;margin-bottom:0.25rem;cursor:pointer;background:var(--bg);">'
            + '<span style="color:var(--accent);">' + escape(p.prefix) + '</span>'
            + '<span style="color:var(--muted);">' + p.count + '</span></div>'
          ).join("");
          content.innerHTML = (rows || '<div style="color:var(--muted);">empty</div>')
            + '<div style="margin-top:0.75rem;color:var(--muted);">total: ' + data.total + '</div>';
          content.querySelectorAll(".kv-row").forEach((el) => {
            el.addEventListener("click", () => loadList([el.dataset.prefix]));
          });
        } catch (err) {
          content.innerHTML = '<div style="color:#f88;">error: ' + escape(err.message) + '</div>';
        }
      }

      async function loadList(prefix, append = false) {
        if (!append) {
          state.mode = "list";
          state.prefix = prefix;
          state.cursor = null;
          state.done = false;
          state.q = filter.value || "";
          back.style.display = "";
          filter.style.display = "";
          crumb.textContent = "prefix: " + JSON.stringify(prefix);
          content.innerHTML = "";
          attachObserver();
        }
        if (state.loading || state.done) return;
        state.loading = true;
        const params = new URLSearchParams({
          prefix: JSON.stringify(prefix),
          limit: "50",
        });
        if (state.cursor) params.set("cursor", state.cursor);
        if (state.q) params.set("q", state.q);
        try {
          const res = await fetch("/_dev/kv/list?" + params.toString());
          if (!res.ok) throw new Error("HTTP " + res.status);
          const data = await res.json();
          for (const entry of data.entries) {
            const div = document.createElement("div");
            div.style.cssText = "padding:0.5rem 0.75rem;border:1px solid var(--border);border-radius:6px;margin-bottom:0.25rem;background:var(--bg);";
            div.innerHTML = '<div style="color:var(--accent);word-break:break-all;">'
              + escape(JSON.stringify(entry.key)) + '</div>'
              + '<pre style="margin-top:0.25rem;color:var(--text);white-space:pre-wrap;word-break:break-all;font-size:0.75rem;">'
              + escape(JSON.stringify(entry.value, null, 2)) + '</pre>';
            content.appendChild(div);
          }
          state.cursor = data.cursor;
          if (!data.cursor) {
            state.done = true;
            const note = document.createElement("div");
            note.style.cssText = "color:var(--muted);padding:0.5rem 0;text-align:center;";
            note.textContent = data.entries.length === 0
              ? (data.truncated ? "no matches in first " + data.scanned + " records" : "no entries")
              : "end of results";
            content.appendChild(note);
          }
        } catch (err) {
          const div = document.createElement("div");
          div.style.cssText = "color:#f88;padding:0.5rem 0;";
          div.textContent = "error: " + err.message;
          content.appendChild(div);
        } finally {
          state.loading = false;
        }
      }

      function attachObserver() {
        if (observer) observer.disconnect();
        observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting && state.mode === "list") {
            loadList(state.prefix, true);
          }
        }, { rootMargin: "200px" });
        observer.observe(sentinel);
      }

      back.addEventListener("click", () => loadPrefixes());
      reload.addEventListener("click", () => {
        if (state.mode === "prefixes") loadPrefixes();
        else loadList(state.prefix);
      });
      let filterTimer;
      filter.addEventListener("input", () => {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(() => {
          if (state.mode === "list") loadList(state.prefix);
        }, 250);
      });

      loadPrefixes();
    })();
    </script>`;

function renderHtml(devMode: boolean): string {
  return BASE_HTML.replace(
    "<!--KV_INSPECTOR-->",
    devMode ? DEV_INSPECTOR_HTML : "",
  );
}

const BASE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Real Polite Protocol</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0f1117;
      --surface: #1a1d27;
      --border: #2a2d3a;
      --text: #e2e4ed;
      --muted: #8b8fa8;
      --accent: #6c8ef7;
      --accent-dark: #4a6ad4;
    }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      border-bottom: 1px solid var(--border);
      padding: 1.25rem 2rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    header svg { flex-shrink: 0; }
    header h1 { font-size: 1.1rem; font-weight: 600; letter-spacing: 0.01em; }
    header span { color: var(--muted); font-size: 0.875rem; }
    main {
      flex: 1;
      max-width: 760px;
      width: 100%;
      margin: 0 auto;
      padding: 4rem 2rem;
    }
    .hero { margin-bottom: 3.5rem; }
    .badge {
      display: inline-block;
      background: color-mix(in srgb, var(--accent) 15%, transparent);
      color: var(--accent);
      border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 0.25rem 0.75rem;
      margin-bottom: 1.25rem;
    }
    h2 { font-size: 2.25rem; font-weight: 700; line-height: 1.2; margin-bottom: 1rem; }
    .lead { font-size: 1.1rem; color: var(--muted); max-width: 560px; }
    .cta { margin-top: 2rem; display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.25rem;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 500;
      text-decoration: none;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.85; }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-secondary {
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 3rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
    }
    .card-icon { font-size: 1.5rem; margin-bottom: 0.75rem; }
    .card h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.4rem; }
    .card p { font-size: 0.875rem; color: var(--muted); }
    .spec-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem 2rem;
    }
    .spec-box h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; }
    .spec-box p { font-size: 0.9rem; color: var(--muted); margin-bottom: 1rem; }
    footer {
      border-top: 1px solid var(--border);
      padding: 1.5rem 2rem;
      text-align: center;
      font-size: 0.8rem;
      color: var(--muted);
    }
    footer a { color: var(--accent); text-decoration: none; }
    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <header>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <h1>Real Polite Protocol</h1>
    <span>v0.2.0-draft</span>
  </header>

  <main>
    <section class="hero">
      <div class="badge">Internet Draft</div>
      <h2>Messaging that requires<br/>permission first</h2>
      <p class="lead">
        RPP is an HTTP-based messaging protocol where unsolicited delivery is
        disallowed at the protocol layer. A sender must hold a receiver-issued
        receipt before any message is accepted.
      </p>
      <div class="cta">
        <a class="btn btn-primary" href="https://github.com/justinmchase/real-polite-protocol" target="_blank" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
          View on GitHub
        </a>
        <a class="btn btn-secondary" href="/.well-known/rpp-domain-identity" target="_blank" rel="noopener">
          Domain Identity
        </a>
      </div>
    </section>

    <div class="cards">
      <div class="card">
        <div class="card-icon">🔒</div>
        <h3>No unsolicited messages</h3>
        <p>Every message requires a receipt issued by the receiver. No receipt, no delivery.</p>
      </div>
      <div class="card">
        <div class="card-icon">🪪</div>
        <h3>No addresses</h3>
        <p>RPP routes by receipt ID, not email addresses. No harvesting, no typos, no uniqueness debates.</p>
      </div>
      <div class="card">
        <div class="card-icon">🤖</div>
        <h3>MCP-native</h3>
        <p>Authenticated listeners connect via the Model Context Protocol for agent-friendly workflows.</p>
      </div>
      <div class="card">
        <div class="card-icon">🌐</div>
        <h3>Plain HTTP</h3>
        <p>A single POST endpoint for server-to-server delivery. No special infrastructure required.</p>
      </div>
    </div>

    <div class="spec-box" style="margin-bottom:1rem;">
      <h3>Read the specification</h3>
      <p>The RPP core spec defines message delivery, receipt-based permissioning, invitation flows, and the MCP listener interface.</p>
      <a class="btn btn-secondary" href="https://github.com/justinmchase/real-polite-protocol/blob/main/spec/rpp-spec.md" target="_blank" rel="noopener">
        spec/rpp-spec.md →
      </a>
    </div>

    <div class="spec-box">
      <h3>Requirement-driven AI development</h3>
      <p>
        This project uses a structured requirement-testing workflow to keep AI-generated code honest.
        Each feature traces from a numbered requirement document in
        <code style="font-size:0.85em;background:color-mix(in srgb,var(--accent) 10%,transparent);padding:0.1em 0.4em;border-radius:4px;">.github/requirements/</code>
        down to a <code style="font-size:0.85em;background:color-mix(in srgb,var(--accent) 10%,transparent);padding:0.1em 0.4em;border-radius:4px;">.requirement.test.ts</code> file
        that exercises the exact behavior described.
      </p>
      <p style="margin-top:0.75rem;">
        The authority chain is strict: the RFC spec is ground truth, requirements interpret it,
        tests verify requirements, and implementation satisfies tests.
        An AI agent can generate code freely within that structure — but it cannot
        silently reinterpret a lower-authority artifact to contradict a higher one.
        Gap analysis runs periodically to catch specification drift before it becomes a bug.
      </p>
      <a class="btn btn-secondary" style="margin-top:1rem;" href="https://github.com/justinmchase/real-polite-protocol/tree/main/.github/requirements" target="_blank" rel="noopener">
        Browse requirements →
      </a>
    </div>
    <!--KV_INSPECTOR-->
  </main>

  <footer>
    Built with <a href="https://deno.com/deploy" target="_blank" rel="noopener">Deno Deploy</a> &middot;
    <a href="https://github.com/justinmchase/real-polite-protocol" target="_blank" rel="noopener">GitHub</a>
  </footer>
</body>
</html>`;

export class LandingController extends Controller {
  constructor(private readonly devMode: boolean) {
    super();
  }

  // deno-lint-ignore require-await
  async use<TContext extends IContext, TState extends IState<TContext>>(
    app: GroveApp<TContext, TState>,
  ): Promise<void> {
    const html = renderHtml(this.devMode);
    app.get("/", (ctx) => {
      return ctx.html(html);
    });

    // Disallow all crawlers. This server exposes machine-to-machine APIs and
    // a single human-readable landing page; there is nothing useful for
    // search engines to index, and serving an explicit robots.txt avoids
    // 404 noise from well-behaved crawlers.
    app.get("/robots.txt", (ctx) => {
      return ctx.text("User-agent: *\nDisallow: /\n");
    });
  }
}
