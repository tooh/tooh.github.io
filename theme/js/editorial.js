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
