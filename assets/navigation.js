(() => {
  const routes = {
    "/": "home",
    "/archive/": "archive",
    "/live-in-real-life/": "gallery",
    "/links/": "links",
    "/imprint/": "imprint",
    "/colophon/": "colophon",
  };
  const titles = {
    home: "Radio",
    archive: "Archive",
    gallery: "Live in real life",
    links: "Links",
    imprint: "Imprint",
    colophon: "Colophon",
  };
  const normalize = (path) =>
    path === "/index.php"
      ? "/"
      : "/" +
        path.split("/").filter(Boolean).join("/") +
        (path.split("/").filter(Boolean).length ? "/" : "");
  function show(path, push = false) {
    const route = normalize(path),
      page = routes[route];
    if (!page) return false;
    for (const panel of document.querySelectorAll("[data-page]"))
      panel.hidden = panel.dataset.page !== page;
    document.body.classList.toggle("home", page === "home");
    document.body.classList.toggle("subpage", page !== "home");
    for (const name of Object.keys(titles))
      document.body.classList.toggle(
        name + "-page",
        name === page && page !== "home",
      );
    for (const link of document.querySelectorAll("nav a")) {
      if (normalize(link.pathname) === route)
        link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    document.title = titles[page] + " — HFG RADIO";
    if (push) history.pushState({ page }, "", route);
    const chat = document.getElementById("radioChat");
    if (page !== "home" && chat.open) chat.close();
    window.scrollTo({ top: 0, behavior: "instant" });
    document.dispatchEvent(
      new CustomEvent("page-change", { detail: { page } }),
    );
    return true;
  }
  document.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = event.target.closest("a[href]");
    if (!link || link.target || link.hasAttribute("download")) return;
    const url = new URL(link.href, location.href);
    if (
      url.origin !== location.origin ||
      url.search ||
      url.hash ||
      !routes[normalize(url.pathname)]
    )
      return;
    event.preventDefault();
    show(
      url.pathname,
      normalize(location.pathname) !== normalize(url.pathname),
    );
  });
  window.addEventListener("popstate", () => show(location.pathname));
  show(location.pathname);
})();
