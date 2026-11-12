/* Local filtering; no tracking, network calls, or external dependencies. */
const input = document.querySelector('#archive-search');
if (input) {
  const rows = [...document.querySelectorAll('.archive-row[data-search]')];
  const years = [...document.querySelectorAll('.archive-year')];
  input.addEventListener('input', () => {
    const terms = input.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    let count = 0;
    rows.forEach(row => {
      row.hidden = !terms.every(term => row.dataset.search.includes(term));
      if (!row.hidden) count++;
    });
    years.forEach(year => { year.hidden = ![...year.querySelectorAll('.archive-row')].some(row => !row.hidden); });
    document.querySelector('#search-count').textContent = `${count} ${count === 1 ? 'story' : 'stories'}${count ? '' : ' — try another search'}`;
  });
}
// Legacy article metadata sometimes points to a removed image: omit failed
// decorative thumbnails rather than leave a broken image in the story list.
document.querySelectorAll('.story-image img').forEach(img => {
  const hide = () => { img.closest('.story-image').hidden = true; };
  img.addEventListener('error', hide);
  if (img.complete && img.naturalWidth === 0) hide();
});

// Cycle through System → Light → Dark; System follows live OS changes.
(() => {
  const root = document.documentElement;
  const button = document.querySelector('.theme-toggle');
  const system = matchMedia('(prefers-color-scheme: dark)');
  const modes = ['system', 'light', 'dark'];
  const labels = {system: 'Auto', light: 'Light', dark: 'Dark'};
  if (!button) return;
  function apply(mode) {
    root.dataset.themePreference = mode;
    root.dataset.theme = mode === 'system' ? (system.matches ? 'dark' : 'light') : mode;
    const next = modes[(modes.indexOf(mode) + 1) % modes.length];
    button.querySelector('span').textContent = labels[mode];
    button.setAttribute('aria-label', `Color theme: ${mode === 'system' ? 'System' : labels[mode]}. Switch to ${next} mode.`);
    button.title = `Theme: ${labels[mode]} — click for ${labels[next]}`;
  }
  apply(root.dataset.themePreference || 'system');
  button.hidden = false;
  button.addEventListener('click', () => {
    const next = modes[(modes.indexOf(root.dataset.themePreference) + 1) % modes.length];
    apply(next);
    try { localStorage.setItem('editorial-theme', next); } catch (_) {}
  });
  system.addEventListener('change', () => {
    if (root.dataset.themePreference === 'system') apply('system');
  });
  window.addEventListener('storage', event => {
    if (event.key === 'editorial-theme') apply(modes.includes(event.newValue) ? event.newValue : 'system');
  });
})();

// Load the existing Disqus forum only on request. Canonical URLs reconnect
// discussions by URL; retain an explicit historical identifier if supplied.
(() => {
  const section = document.querySelector('[data-comments]');
  if (!section) return;
  const button = section.querySelector('.comments-load');
  const status = section.querySelector('.comments-status');
  button.addEventListener('click', () => {
    button.disabled = true;
    status.textContent = 'Loading responses…';
    window.disqus_config = function () {
      this.page.url = section.dataset.url;
      this.page.title = section.dataset.title;
      if (section.dataset.identifier) this.page.identifier = section.dataset.identifier;
      this.callbacks.onReady = [() => {
        status.textContent = '';
        button.hidden = true;
      }];
    };
    const script = document.createElement('script');
    script.src = `https://${section.dataset.shortname}.disqus.com/embed.js`;
    script.async = true;
    script.dataset.timestamp = String(Date.now());
    script.onerror = () => {
      status.textContent = 'Comments could not be loaded. Check your connection or content blocker and try again.';
      button.disabled = false;
      script.remove();
    };
    document.head.appendChild(script);
  });
})();
