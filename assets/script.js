let archiveWidget = null,
  archiveWidgetPlaying = false;
const banner = document.getElementById("liveBanner"),
  audio = document.getElementById("radioAudio"),
  play = document.getElementById("playButton"),
  next = document.getElementById("nextButton"),
  message = document.getElementById("playerMessage");
let stream = "",
  stationState = "unknown",
  stationTitle = "",
  mode = "idle",
  pending = false,
  operation = 0,
  lastVolume = 1,
  archivePromise = null,
  queue = [],
  twitch = null,
  twitchReady = null,
  twitchLive = false,
  twitchTitle = "",
  source = "azura",
  wantsPlayback = false;
let twitchObservedLive = null,
  twitchInitialized = false,
  twitchAudioQualitySet = false,
  twitchPlaying = false;
function archive() {
  return (
    archivePromise ||
    (archivePromise = fetch("/index.php?api=archive")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => d.posts)
      .catch((e) => {
        archivePromise = null;
        throw e;
      }))
  );
}
function setVolume(value) {
  if (archiveWidget) archiveWidget.setVolume(value * 100);
  if (twitch) {
    try {
      twitch.setVolume(value);
      twitch.setMuted(value === 0);
    } catch {}
  }
  audio.volume = value;
  audio.muted = value === 0;
  if (value > 0) lastVolume = value;
  document.getElementById("volume").value = String(value);
  const b = document.getElementById("muteButton");
  b.textContent = value === 0 ? "UNMUTE" : "MUTE";
  b.setAttribute("aria-pressed", String(value === 0));
}
function playbackUI() {
  if (!audio) return;
  const active =
    mode === "embed"
      ? archiveWidgetPlaying
      : mode === "twitch"
        ? twitchPlaying
        : !audio.paused;
  play.textContent = pending ? "STOP" : active ? "STOP" : "PLAY";
  play.setAttribute("aria-pressed", String(!!active));
  if (next) next.hidden = mode !== "archive" && mode !== "ident";
  const weather = document.getElementById("weatherPlay");
  weather.setAttribute("aria-pressed", String(!!active));
  weather.setAttribute("aria-label", active ? "Pause radio" : "Play radio");
}
function renderStatus() {
  document.body.classList.toggle("twitch-live", twitchLive);
  updateTwitchVisibility();
  const archived = mode === "ident" || mode === "archive" || mode === "embed";
  const state = archived ? "archive" : twitchLive ? "live" : stationState;
  banner.dataset.state = state;
  banner.hidden = !archived && state !== "live";
  banner.setAttribute(
    "aria-label",
    archived ? "Offline — archive playback" : "Live on air",
  );
  for (const text of banner.querySelectorAll(".marquee span"))
    text.textContent = archived ? "OFFLINE" : "LIVE";
  if (mode === "idle" || mode === "live" || mode === "twitch") {
    message.textContent = twitchLive
      ? "Live from Offenbach"
      : stationState === "live"
        ? "Live from Offenbach"
        : stationState === "autodj"
          ? "On air"
          : stationState === "unknown"
            ? ""
            : "Currently offline · PLAY for a shuffled archive recording";
    document.getElementById("currentShowTitle").textContent = twitchLive
      ? twitchTitle
      : stationTitle;
  }
}
async function status() {
  const previous = source;
  await Promise.allSettled([
    (async () => {
      try {
        const r = await fetch("/index.php?api=nowplaying", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) throw Error();
        const d = await r.json();
        stationState = d.live?.is_live
          ? "live"
          : d.is_online
            ? "autodj"
            : "offline";
        stream =
          d.is_online || d.live?.is_live ? d.station?.listen_url || "" : "";
        stationTitle = d.now_playing?.song?.text || d.live?.streamer_name || "";
      } catch {
        stationState = "unknown";
        stream = "";
        stationTitle = "";
      }
    })(),
    (async () => {
      try {
        const r = await fetch("/index.php?api=twitch", {
          cache: "no-store",
          signal: AbortSignal.timeout(11000),
        });
        if (!r.ok) throw Error();
        const d = await r.json();
        twitchLive =
          twitchObservedLive === null ? d.live === true : twitchObservedLive;
        twitchTitle = d.title || twitchTitle;
      } catch {
        /* Embed events remain available when metadata service fails. */
      }
    })(),
  ]);
  source = twitchLive ? "twitch" : stream ? "azura" : "archive";
  renderStatus();
  if (
    (mode === "live" || mode === "twitch") &&
    previous !== source &&
    wantsPlayback
  ) {
    audio.pause();
    if (twitch) twitch.pause();
    mode = "idle";
    startPlayback(false);
  }
  setTimeout(status, 30000);
}
function initTwitch() {
  if (twitchReady) return twitchReady;
  twitchReady = new Promise((resolve, reject) => {
    const holder = document.createElement("div");
    holder.id = "twitchAudioEngine";
    holder.className = "twitch-audio-engine";
    holder.setAttribute("aria-hidden", "true");
    document.getElementById("twitchCircle").append(holder);
    const script = document.createElement("script");
    script.src = "https://player.twitch.tv/js/embed/v1.js";
    const fail = () => {
      clearTimeout(timer);
      holder.remove();
      script.remove();
      twitch = null;
      twitchInitialized = false;
      twitchReady = null;
      updateTwitchVisibility();
      reject(Error("Twitch unavailable"));
    };
    const timer = setTimeout(fail, 15000);
    script.onerror = fail;
    script.onload = () => {
      twitch = new Twitch.Player(holder.id, {
        channel: "hfgradio",
        width: 400,
        height: 300,
        parent: [location.hostname],
        autoplay: false,
        muted: true,
      });
      twitch.addEventListener(Twitch.Player.READY, () => {
        clearTimeout(timer);
        twitchInitialized = true;
        updateTwitchVisibility();
        resolve(twitch);
      });
      twitch.addEventListener(Twitch.Player.PLAYING, () => {
        if (!wantsPlayback || mode !== "twitch") {
          twitch.pause();
          twitchPlaying = false;
          playbackUI();
          return;
        }
        twitchPlaying = true;
        pending = false;
        if (!twitchAudioQualitySet) {
          const qualities = twitch.getQualities();
          if (
            qualities.some(
              (q) => (typeof q === "string" ? q : q.group) === "audio_only",
            )
          ) {
            twitchAudioQualitySet = true;
            twitch.setQuality("audio_only");
          }
        }
        playbackUI();
      });
      twitch.addEventListener(Twitch.Player.PAUSE, () => {
        twitchPlaying = false;
        playbackUI();
      });
      twitch.addEventListener(Twitch.Player.PLAYBACK_BLOCKED, () => {
        pending = false;
        message.textContent = "Press PLAY to enable live audio.";
        playbackUI();
      });
      twitch.addEventListener(Twitch.Player.ONLINE, () => {
        twitchObservedLive = true;
        twitchLive = true;
        source = "twitch";
        renderStatus();
        if (mode === "twitch" && wantsPlayback) startPlayback(false);
      });
      twitch.addEventListener(Twitch.Player.OFFLINE, () => {
        twitchObservedLive = false;
        twitchLive = false;
        renderStatus();
        if (mode === "twitch" && wantsPlayback) {
          twitchPlaying = false;
          mode = "idle";
          startPlayback(false);
        }
      });
    };
    document.head.append(script);
  });
  return twitchReady;
}
async function startPlayback(userClick = true) {
  const attempt = ++operation;
  wantsPlayback = true;
  pending = true;
  playbackUI();
  try {
    if (twitchLive && !twitchInitialized) await initTwitch();
    if (attempt !== operation) return;
    if (twitchLive) {
      audio.pause();
      mode = "twitch";
      twitchPlaying = false;
      const player = twitchInitialized ? twitch : await initTwitch();
      if (attempt !== operation) return;
      player.setVolume(audio.volume);
      player.setMuted(audio.muted);
      player.play();
      message.textContent = "Live from Offenbach";
      renderStatus();
    } else if (stream) {
      if (twitch) twitch.pause();
      mode = "live";
      audio.src = stream;
      await audio.play();
      renderStatus();
    } else if (userClick || mode !== "idle") {
      await nextRecording();
    }
  } catch {
    if (attempt === operation) {
      message.textContent = userClick
        ? "Playback could not start. Press PLAY to retry."
        : "";
    }
  } finally {
    if (attempt === operation) {
      pending = false;
      playbackUI();
    }
  }
}
async function nextRecording() {
  const attempt = operation;
  pending = true;
  playbackUI();
  try {
    if (!queue.length) {
      queue = (await archive()).filter((p) => p.audio_url);
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
    }
    if (attempt !== operation) return;
    const track = queue.pop();
    if (!track) throw Error("empty");
    mode = "archive";
    const panel = document.getElementById("offlineRecording");
    panel.replaceChildren();
    if (track.artwork_url) {
      const img = document.createElement("img");
      img.src = track.artwork_url;
      img.alt = "";
      panel.append(img);
    }
    const label = document.createElement("p");
    label.textContent = "OFFLINE · SHUFFLED ARCHIVE";
    const heading = document.createElement("h2");
    heading.textContent = track.title;
    const link = document.createElement("a");
    link.textContent = "OPEN ON SOUNDCLOUD";
    link.href = track.permalink_url;
    link.target = "_blank";
    link.rel = "noopener";
    panel.append(label, heading, link);
    panel.hidden = false;
    audio.src = track.audio_url;
    message.textContent = "Now playing a shuffled archive recording";
    document.getElementById("currentShowTitle").textContent = track.title;
    renderStatus();
    await audio.play();
  } catch {
    if (attempt === operation)
      message.textContent =
        "Archive playback could not start. Press PLAY to retry.";
  } finally {
    if (attempt === operation) {
      pending = false;
      playbackUI();
    }
  }
}
if (audio) {
  play.addEventListener("click", async () => {
    if (mode === "embed") {
      if (archiveWidget) archiveWidget.toggle();
      return;
    }
    document.dispatchEvent(new Event("radio-play"));
    const active =
      mode === "embed"
        ? archiveWidgetPlaying
        : mode === "twitch"
          ? twitchPlaying
          : !audio.paused;
    if (active || pending) {
      operation++;
      wantsPlayback = false;
      pending = false;
      twitchPlaying = false;
      audio.pause();
      if (twitch) twitch.pause();
      if (mode === "archive" || mode === "ident") {
        audio.removeAttribute("src");
        audio.load();
        mode = "idle";
        document.getElementById("offlineRecording").hidden = true;
        document.getElementById("currentShowTitle").textContent = "";
        renderStatus();
      }
      playbackUI();
      return;
    }
    await startPlayback(true);
  });
  next.addEventListener("click", () => {
    if (mode !== "archive" && !mode !== "ident") return;
    operation++;
    wantsPlayback = true;
    pending = false;
    twitchPlaying = false;
    audio.pause();
    nextRecording();
  });
  audio.addEventListener("ended", () => {
    if (mode === "ident" || mode === "archive") nextRecording();
    else playbackUI();
  });
  for (const event of ["playing", "pause"])
    audio.addEventListener(event, playbackUI);
  audio.addEventListener("error", () => {
    pending = false;
    message.textContent = "Audio unavailable. Press PLAY to retry.";
    playbackUI();
  });
  document
    .getElementById("volume")
    .addEventListener("input", (e) => setVolume(Number(e.target.value)));
  document
    .getElementById("muteButton")
    .addEventListener("click", () =>
      setVolume(audio.muted || audio.volume === 0 ? lastVolume : 0),
    );
  const chat = document.getElementById("radioChat");
  if (chat) {
    document.getElementById("chatButton").addEventListener("click", () => {
      if (window.innerWidth <= 700) {
        window.open("https://hfgstation.chatango.com/", "_blank", "noopener");
        return;
      }
      const frame = chat.querySelector("iframe");
      if (!frame.getAttribute("src")) frame.src = frame.dataset.src;
      if (chat.open) {
        chat.close();
        return;
      }
      chat.show();
      document
        .getElementById("chatButton")
        .setAttribute("aria-expanded", "true");
      chat.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    });
    document
      .getElementById("closeChat")
      .addEventListener("click", () => chat.close());
    chat.addEventListener("close", () =>
      document
        .getElementById("chatButton")
        .setAttribute("aria-expanded", "false"),
    );
  }
}
const marquee = document.getElementById("archiveMarquee");
if (marquee)
  archive()
    .then((items) => {
      const artworks = items.filter((p) => p.artwork_url).slice(0, 24);
      for (let repeat = 0; repeat < 2; repeat++)
        for (const track of artworks) {
          const link = document.createElement("a");
          link.href = "/archive/";
          link.setAttribute("aria-label", track.title);
          if (repeat) {
            link.tabIndex = -1;
            link.setAttribute("aria-hidden", "true");
          }
          const img = document.createElement("img");
          img.src = track.artwork_url;
          img.alt = track.title;
          img.loading = "lazy";
          link.append(img);
          marquee.append(link);
        }
    })
    .catch(() => {
      marquee.parentElement.hidden = true;
    });
function clock() {
  const text = document.getElementById("clockText");
  if (text)
    text.textContent = new Date().toLocaleTimeString("de-DE", {
      timeZone: "Europe/Berlin",
    });
}
clock();
setInterval(clock, 1000);
status();
for (const a of document.querySelectorAll("nav a"))
  if (a.pathname === location.pathname) a.setAttribute("aria-current", "page");

document.addEventListener("archive-play", (event) => {
  operation++;
  wantsPlayback = false;
  pending = false;
  audio.pause();
  if (twitch) twitch.pause();
  mode = "embed";
  archiveWidget = null;
  archiveWidgetPlaying = false;
  document.getElementById("offlineRecording").hidden = true;
  document.getElementById("currentShowTitle").textContent =
    event.detail.title || "Untitled recording";
  message.textContent = "Archive · Loading recording";
  renderStatus();
  playbackUI();
});
document.addEventListener("archive-state", (event) => {
  if (mode !== "embed") return;
  const { state, widget } = event.detail;
  if (widget) archiveWidget = widget;
  if (state === "ready") {
    widget.setVolume(audio.muted ? 0 : audio.volume * 100);
    return;
  }
  archiveWidgetPlaying = state === "playing";
  message.textContent =
    {
      playing: "Now playing · Archive",
      paused: "Paused · Archive",
      finished: "Finished · Archive",
      error: "Archive unavailable · Try another recording",
      unavailable: "Archive selected · Use the SoundCloud player",
    }[state] || "Archive";
  playbackUI();
});
document.addEventListener("archive-close", () => {
  if (mode !== "embed") return;
  archiveWidget = null;
  archiveWidgetPlaying = false;
  mode = "idle";
  renderStatus();
  playbackUI();
});

document
  .getElementById("weatherPlay")
  .addEventListener("click", () => play.click());

// Probe the official player even when third-party metadata is delayed.
initTwitch().catch(() => {});

function updateTwitchVisibility() {
  document.body.classList.remove("twitch-revealed");
  const holder = document.getElementById("twitchAudioEngine");
  if (holder) {
    holder.setAttribute("aria-hidden", "true");
    const iframe = holder.querySelector("iframe");
    if (iframe) iframe.tabIndex = -1;
  }
  document.getElementById("weatherPlay").tabIndex = 0;
}
document.addEventListener("dots-change", updateTwitchVisibility);
document.addEventListener("page-change", updateTwitchVisibility);
