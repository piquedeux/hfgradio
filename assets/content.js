// One dictionary for PHP-rendered copy and changing client-side labels.
const siteContent = JSON.parse(document.getElementById('siteContent').textContent);
function copy(key, fallback = '', values = {}) {
  let text = siteContent[key] ?? fallback;
  for (const [name, value] of Object.entries(values)) text = text.replaceAll('{' + name + '}', String(value));
  return text;
}
