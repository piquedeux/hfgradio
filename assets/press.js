// ── Press ──
document.addEventListener("DOMContentLoaded", () => {
  const { copy, fetchJSON, pageTask } = window.HFG;
  async function loadPress() {
    const target = document.getElementById("linksEntries"),
      status = document.getElementById("linksStatus");
    if (!target || !status) return;
    try {
      const data = await fetchJSON("press");

      target.replaceChildren();
      status.textContent = data.stale
        ? copy("links.stale", "Showing saved links.")
        : data.entries.length
          ? ""
          : copy("links.empty", "Links will appear here soon.");
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
      status.textContent = copy(
        "links.error",
        "Links could not load. Please try again later.",
      );
    }
  }
  pageTask("links", loadPress);
});
