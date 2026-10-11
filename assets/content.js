// One dictionary for PHP-rendered copy and changing client-side labels.
window.HFG = window.HFG || {};
(() => {
  const siteContent = JSON.parse(
    document.getElementById("siteContent").textContent,
  );
  window.HFG.copy = (key, fallback = "", values = {}) => {
    let text = siteContent[key] ?? fallback;
    for (const [name, value] of Object.entries(values))
      text = text.replaceAll("{" + name + "}", String(value));
    return text;
  };
})();
