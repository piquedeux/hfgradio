(() => {
  async function loadPress() {
    const target = document.getElementById("linksEntries"),
      status = document.getElementById("linksStatus");
    if (!target || !status) return;
    try {
      const response = await fetch("/index.php?api=press");
      if (!response.ok) throw Error();
      const data = await response.json();
      document.querySelector('[data-content-nav="links"]').hidden =
        data.entries.length === 0;
      target.replaceChildren();
      status.textContent = data.stale
        ? "Showing saved links."
        : data.entries.length
          ? ""
          : "Links will appear here soon.";
      for (const entry of data.entries) {
        const article = document.createElement("article");
        article.className = "press-entry";
        const date = document.createElement("span");
        date.textContent = entry.date;
        const link = document.createElement("a");
        link.href = entry.url;
        link.textContent = entry.title;
        link.target = "_blank";
        link.rel = "noopener";
        article.append(date, link);
        target.append(article);
      }
    } catch {
      status.textContent = "Links could not load. Please try again later.";
    }
  }
  loadPress();
  setInterval(loadPress, 300000);
})();
