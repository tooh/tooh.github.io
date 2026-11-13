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

// A compact footer action opens Disqus in a Medium-style response drawer.
(() => {
  const section = document.querySelector('[data-comments]');
  const trigger = document.querySelector('.comments-trigger');
  if (!section || !trigger) return;
  const refreshCount = () => window.DISQUSWIDGETS?.getCount({reset: true});
  const likesButton = document.querySelector('.likes-trigger');
  const likesCount = document.querySelector('.disqus-like-count');
  let opener = trigger;
  let likesLoading = false;
  let lastLikesFetch = 0;
  async function refreshLikes(force = false) {
    if (!likesButton || !section.dataset.publicKey || likesLoading) return;
    if (!force && Date.now() - lastLikesFetch < 60000) return;
    likesLoading = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const url = new URL('https://disqus.com/api/3.0/threads/details.json');
      url.searchParams.set('api_key', section.dataset.publicKey);
      url.searchParams.set('forum', section.dataset.shortname);
      url.searchParams.set(section.dataset.identifier ? 'thread:ident' : 'thread:link', section.dataset.identifier || section.dataset.url);
      const response = await fetch(url, {signal: controller.signal, credentials: 'omit'});
      const data = await response.json();
      likesButton.dataset.state = `http-${response.status}-code-${data.code}`;
      if (response.ok && data.code === 0 && Number.isInteger(data.response?.likes)) {
        const total = data.response.likes;
        likesCount.textContent = String(total);
        likesButton.setAttribute('aria-label', `${total} article ${total === 1 ? 'like' : 'likes'} — open Disqus`);
        lastLikesFetch = Date.now();
      }
    } catch (error) {
      likesButton.dataset.state = error.name;
      // Keep an unavailable count as a dash, never invent a zero.
    } finally { clearTimeout(timeout); likesLoading = false; }
  }
  refreshLikes();
  // The lightweight count script loads separately from the discussion embed.
  const count = trigger.querySelector('.disqus-comment-count');
  if (count) {
    const updateLabel = () => {
      const text = count.textContent.trim();
      const match = text.match(/^(\d[\d,.]*)/);
      if (!match) return;
      trigger.setAttribute('aria-label', `${text} — read or write comments on Disqus`);
      if (text !== match[1]) count.textContent = match[1];
    };
    new MutationObserver(updateLabel).observe(count, {childList: true, subtree: true, characterData: true});
    const counter = document.createElement('script');
    counter.id = 'dsq-count-scr';
    counter.src = `https://${section.dataset.shortname}.disqus.com/count.js`;
    counter.async = true;
    // The initial count-data URL can be cached before a thread has comments.
    // Disqus reset adds a cache-busting timestamp to request the current count.
    counter.onload = () => {
      const widget = window.DISQUSWIDGETS;
      if (!widget) return;
      const displayCount = widget.displayCount;
      // Keep the numeric badge in sync with the response itself, independent
      // of Disqus's internal element registry and localized link text.
      widget.displayCount = function (data) {
        const key = count.dataset.disqusIdentifier || count.dataset.disqusUrl;
        const result = data.counts.find(item => item.id === key);
        displayCount.call(widget, data);
        if (result && Number.isInteger(result.comments)) {
          count.textContent = String(result.comments);
        }
      };
      refreshCount();
    };
    document.head.appendChild(counter);
  }
  const retry = section.querySelector('.comments-load');
  const status = section.querySelector('.comments-status');
  let state = 'idle';
  function loadComments() {
    if (state !== 'idle') return;
    state = 'loading';
    retry.hidden = true;
    status.textContent = 'Loading responses…';
    window.disqus_config = function () {
      this.page.url = section.dataset.url;
      this.page.title = section.dataset.title;
      if (section.dataset.identifier) this.page.identifier = section.dataset.identifier;
      this.callbacks.onReady = [() => { status.textContent = ''; state = 'ready'; }];
      this.callbacks.onNewComment = [() => {
        refreshCount();
        // Allow the separate counting endpoint time to index the new comment.
        [2000, 10000, 30000].forEach(delay => setTimeout(refreshCount, delay));
      }];
    };
    const script = document.createElement('script');
    script.src = `https://${section.dataset.shortname}.disqus.com/embed.js`;
    script.async = true;
    script.dataset.timestamp = String(Date.now());
    script.onerror = () => {
      status.textContent = 'Comments could not be loaded. Check your connection or content blocker and try again.';
      state = 'idle';
      retry.hidden = false;
      script.remove();
    };
    document.head.appendChild(script);
  }
  [trigger, likesButton].filter(Boolean).forEach(button => button.addEventListener('click', () => {
    opener = button;
    section.showModal();
    refreshCount();
    refreshLikes();
    loadComments();
  }));
  section.querySelector('.comments-close').addEventListener('click', () => section.close());
  section.addEventListener('click', event => {
    if (event.target === section) {
      const box = section.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) section.close();
    }
  });
  section.addEventListener('close', () => { refreshCount(); refreshLikes(true); opener.focus(); });
  retry.addEventListener('click', loadComments);
})();

