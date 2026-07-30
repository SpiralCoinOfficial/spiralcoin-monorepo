/* ==========================================================================
 * SpiralCoin — live sponsor widget
 * --------------------------------------------------------------------------
 * Fetches /api/sponsors-list.php and patches the contributors section on
 * splc.html with live numbers + a sponsor grid.
 *
 * Markup hooks (data-* on existing nodes — added by the HTML patch):
 *   [data-splc-raised]   → "$X,XXX / $120,000"
 *   [data-splc-count]    → "N / 10 founding sponsors"
 *   [data-splc-bar]      → width % of goal
 *   [data-splc-grid]     → injected sponsor avatar grid
 *
 * Fails silently if the endpoint is unreachable (no error UI — the
 * existing placeholder text remains visible).
 * ========================================================================== */
(() => {
  const ENDPOINT = '/api/sponsors-list.php';

  const fmt = (n) => '$' + Number(n).toLocaleString('en-US');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  async function load() {
    const target = document.querySelector('[data-splc-grid]');
    if (!target && !document.querySelector('[data-splc-raised]')) return;
    let data;
    try {
      const res = await fetch(ENDPOINT, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      data = await res.json();
    } catch (e) { return; }

    const raisedEl = document.querySelector('[data-splc-raised]');
    const countEl  = document.querySelector('[data-splc-count]');
    const barEl    = document.querySelector('[data-splc-bar]');
    const gridEl   = document.querySelector('[data-splc-grid]');

    const raised   = Number(data.total_raised_usd || 0);
    const goalUsd  = Number(data.goal_usd || 120000);
    const count    = Number(data.one_time_count || 0);
    const goalCnt  = Number(data.goal_count || 10);
    const pct      = Math.min(100, Math.round((raised / goalUsd) * 100));

    if (raisedEl) raisedEl.textContent = fmt(raised) + ' / ' + fmt(goalUsd);
    if (countEl)  countEl.textContent  = count + ' / ' + goalCnt + ' founding sponsors';
    if (barEl)    barEl.style.width    = pct + '%';

    if (gridEl && Array.isArray(data.sponsors) && data.sponsors.length) {
      gridEl.innerHTML = data.sponsors.map((s) => `
        <a href="https://github.com/${esc(s.login)}" target="_blank" rel="noopener"
           style="display:flex;align-items:center;gap:.6rem;padding:.6rem .8rem;background:rgba(0,0,0,0.35);border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--text)">
          ${s.avatar_url ? `<img src="${esc(s.avatar_url)}" alt="" width="36" height="36" style="border-radius:50%;border:1px solid var(--gold)"/>` : ''}
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">@${esc(s.login)}</div>
            <div style="font-size:.75rem;color:var(--muted)">${esc(s.tier || 'Supporter')}${s.amount ? ' · ' + fmt(s.amount) : ''}</div>
          </div>
        </a>
      `).join('');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
