// ── Archive ──
document.addEventListener("DOMContentLoaded", () => {
  const { copy, fetchJSON, pageTask, yieldTask } = window.HFG;
  const archiveStatus = document.getElementById("archiveStatus");
  const posts = document.getElementById("archivePosts");
  const known = new Map();
  let active = null;
  let widgetAPI;
  function loadWidgetAPI() {
    if (window.SC?.Widget) return Promise.resolve(window.SC);
    if (widgetAPI) return widgetAPI;
    widgetAPI = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://w.soundcloud.com/player/api.js";
      script.onload = () => resolve(window.SC);
      script.onerror = () => {
        widgetAPI = null;
        script.remove();
        reject(Error("Widget unavailable"));
      };
      document.head.append(script);
    });
    return widgetAPI;
  }
  function buildPost(sound) {
    const post = document.createElement("article");
    post.className = "post";
    const anchor = "recording-" + String(sound.id).replace(/[^a-z0-9]/gi, "-");
    post.id = anchor;
    // Readable deep-link target derived from the SoundCloud recording name.
    const slug = sound.slug || anchor;
    post.dataset.slug = slug;
    const time = document.createElement("time");
    const date = new Date(sound.created_at);
    time.dateTime = date.toISOString();
    time.textContent = date.toLocaleDateString("de-DE");
    const titleText =
      sound.title || copy("archive.untitled", "Untitled recording");
    const title = document.createElement("h2");
    const titleToggle = document.createElement("button");
    titleToggle.type = "button";
    titleToggle.className = "title-toggle";
    titleToggle.textContent = titleText;
    titleToggle.setAttribute("aria-expanded", "false");
    title.append(titleToggle);
    const artist = document.createElement("span");
    artist.className = "artist";
    artist.textContent = sound.artist || "";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = copy("player.play", "PLAY");
    button.setAttribute(
      "aria-label",
      copy("archive.play.label", "Play {title}", { title: titleText }),
    );
    button.setAttribute("aria-expanded", "false");
    const panel = document.createElement("div");
    panel.className = "archive-reveal";
    panel.id = "track-" + sound.id.replace(/[^a-z0-9]/gi, "-");
    button.setAttribute("aria-controls", panel.id);
    titleToggle.setAttribute("aria-controls", panel.id);
    const inner = document.createElement("div");
    panel.append(inner);
    let claimed = false;
    const close = () => {
      post.classList.remove("is-open");
      button.textContent = copy("player.play", "PLAY");
      button.setAttribute(
        "aria-label",
        copy("archive.play.label", "Play {title}", { title: titleText }),
      );
      button.setAttribute("aria-expanded", "false");
      titleToggle.setAttribute("aria-expanded", "false");
      inner.replaceChildren();
      // Drop the deep link once the recording is no longer open.
      if (location.hash === "#" + slug)
        history.replaceState(
          history.state,
          "",
          location.pathname + location.search,
        );
      if (active === close) {
        active = null;
        if (claimed) document.dispatchEvent(new Event("archive-close"));
        claimed = false;
      }
    };
    const open = (autoplay) => {
      if (active === close) return;
      if (active) active();
      active = close;
      claimed = autoplay;
      if (autoplay)
        document.dispatchEvent(
          new CustomEvent("archive-play", { detail: sound }),
        );
      const iframe = document.createElement("iframe");
      iframe.title = copy("archive.frame.label", "SoundCloud: {title}", {
        title: sound.title,
      });
      iframe.allow = "autoplay";
      iframe.src =
        "https://w.soundcloud.com/player/?" +
        new URLSearchParams({
          url: sound.permalink_url,
          auto_play: "false",
          visual: "true",
          show_artwork: "true",
          show_comments: "false",
          show_reposts: "false",
          hide_related: "true",
          color: "#000000",
        });
      inner.append(iframe);
      post.classList.add("is-open");
      button.textContent = copy("archive.stop", "STOP");
      button.setAttribute(
        "aria-label",
        copy("archive.stop.label", "Stop {title}", { title: titleText }),
      );
      button.setAttribute("aria-expanded", "true");
      titleToggle.setAttribute("aria-expanded", "true");
      // Opening a recording makes its slug the shareable, reloadable URL.
      history.replaceState(history.state, "", "#" + slug);
      loadWidgetAPI()
        .then((SC) => {
          if (active !== close || !iframe.isConnected) return;
          const widget = SC.Widget(iframe);
          const report = (state) => {
            if (active === close && iframe.isConnected && claimed)
              document.dispatchEvent(
                new CustomEvent("archive-state", {
                  detail: { state, widget },
                }),
              );
          };
          let duration = 0;
          const reportProgress = (position) => {
            if (active === close && iframe.isConnected && claimed)
              document.dispatchEvent(
                new CustomEvent("archive-progress", {
                  detail: { widget, duration, position },
                }),
              );
          };
          const syncProgress = () =>
            widget.getDuration((value) => {
              duration = value;
              widget.getPosition(reportProgress);
            });
          widget.bind(SC.Widget.Events.READY, () => {
            if (autoplay) report("ready");
            syncProgress();
          });
          widget.bind(SC.Widget.Events.PLAY_PROGRESS, (event) =>
            reportProgress(event.currentPosition),
          );
          widget.bind(SC.Widget.Events.SEEK, (event) =>
            reportProgress(event.currentPosition),
          );
          widget.bind(SC.Widget.Events.PLAY, () => {
            if (!claimed && active === close) {
              claimed = true;
              document.dispatchEvent(
                new CustomEvent("archive-play", { detail: sound }),
              );
            }
            report("playing");
            syncProgress();
          });
          widget.bind(SC.Widget.Events.PAUSE, () => {
            report("paused");
            syncProgress();
          });
          widget.bind(SC.Widget.Events.FINISH, () => {
            report("finished");
            reportProgress(duration);
          });
          widget.bind(SC.Widget.Events.ERROR, () => report("error"));
        })
        .catch(() => {
          if (active === close && iframe.isConnected)
            document.dispatchEvent(
              new CustomEvent("archive-state", {
                detail: { state: "unavailable" },
              }),
            );
        });
    };
    button.addEventListener("click", () => {
      if (active === close) close();
      else open(true);
    });
    // The title reveals the recording without starting playback.
    titleToggle.addEventListener("click", () => {
      if (active === close) close();
      else open(false);
    });
    post.addEventListener("archive-reveal", () => open(false));
    post.append(time, title, button, artist, panel);
    if (sound.artwork_url) {
      const img = document.createElement("img");
      img.className = "archive-preview";
      img.src = sound.artwork_url;
      img.alt = "";
      img.loading = "lazy";
      post.append(img);
    }
    return post;
  }
  async function loadArchive() {
    try {
      const data = await fetchJSON("archive");
      archiveStatus.textContent = data.stale
        ? copy(
            "archive.stale",
            "Showing saved recordings. SoundCloud is temporarily unavailable.",
          )
        : data.posts.length
          ? ""
          : copy("archive.empty", "No public recordings yet.");
      const ids = new Set(data.posts.map((p) => p.id));
      for (const [id, node] of known) {
        if (!ids.has(id)) {
          node.remove();
          known.delete(id);
        }
      }
      let rendered = 0;
      for (const sound of data.posts) {
        if (!known.has(sound.id)) {
          const node = buildPost(sound);
          known.set(sound.id, node);
          posts.append(node);
          if (++rendered % 20 === 0) await yieldTask();
        }
      }
    } catch (error) {
      console.error("archive load failed:", error);
      // A missing feed must not surface an alarming error; the archive stays empty.
      archiveStatus.textContent = "";
    }
  }
  pageTask("archive", async () => {
    await loadArchive();
    document.dispatchEvent(new Event("archive-loaded"));
  });

  document.addEventListener("radio-play", () => {
    if (active) active();
  });
});
