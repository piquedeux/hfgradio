let archiveWidget = null,
  archiveWidgetPlaying = false;
const banner = document.getElementById("liveBanner"),
  audio = document.getElementById("radioAudio"),
  play = document.getElementById("playButton"),
  next = document.getElementById("nextButton"),
  message = document.getElementById("playerMessage");
const offlineRecording = document.getElementById("offlineRecording");
let currentRecording = null;
let airtimeStream = "", airtimeTitle = "", airtimeFallback = false;
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
  twitchPlaying = false,
  twitchCommand = null,
  twitchCommandTime = 0;

function archive() {
  return (
    archivePromise ||
    (archivePromise = fetch("/index.php?api=archive")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data.posts) || !data.posts.length) throw Error("Empty archive");
        return data.posts;
      })
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
      twitch.setMuted(mode !== "twitch" || value === 0);
    } catch {}
  }
  audio.volume = value;
  audio.muted = value === 0;
  document.documentElement.classList.toggle("radio-muted", value === 0);
  document.getElementById("volume").value = String(value);
  if (value > 0) lastVolume = value;
  const b = document.getElementById("muteButton");
  b.textContent = value === 0 ? copy("player.unmute", "UNMUTE") : copy("player.mute", "MUTE");
  b.setAttribute("aria-pressed", String(value === 0));
}
function hasLiveSource() {
  return twitchLive || Boolean(stream) || Boolean(airtimeStream);
}
function twitchIsPlaying() {
  if (!twitchInitialized || !twitch) return false;
  try {
    return !twitch.isPaused();
  } catch {
    return twitchPlaying;
  }
}
function commandTwitch(playing) {
  operation++;
  const attempt = operation;
  if (playing) {
    audio.pause();
    if (archiveWidget) archiveWidget.pause();
    document.dispatchEvent(new Event("radio-play"));
    archiveWidgetPlaying = false;
    mode = "twitch";
    offlineRecording.hidden = true;
  }
  wantsPlayback = playing;
  twitchCommand = playing;
  pending = playing;
  renderStatus();
  // Send the actual transport command synchronously from the user's click.
  if (playing) {
    twitch.setVolume(audio.volume);
    twitch.setMuted(audio.muted);
    twitch.play();
  } else {
    twitch.pause();
    twitchPlaying = false;
  }
  playbackUI();
  setTimeout(() => {
    if (attempt !== operation || mode !== "twitch" || twitchCommand === null) return;
    twitchPlaying = twitchIsPlaying();
    twitchCommand = null;
    pending = false;
    wantsPlayback = twitchPlaying;
    if (playing && !twitchPlaying) message.textContent = copy("player.twitch.permission", "Press PLAY in the Twitch player below to allow playback.");
    playbackUI();
  }, 4000);
}
function toggleTwitch() {
  commandTwitch(!(twitchCommand === null ? twitchIsPlaying() : twitchCommand));
}
function playbackUI() {
  const active =
    mode === "embed"
      ? archiveWidgetPlaying
      : mode === "twitch"
        ? twitchCommand === null
          ? twitchPlaying
          : twitchCommand
        : !audio.paused;
  play.textContent = pending || active ? copy("player.stop", "STOP") : copy("player.play", "PLAY");
  play.setAttribute("aria-pressed", String(active));
  if (next) next.hidden = !["archive", "ident", "embed"].includes(mode);
  updateTwitchVisibility();
}
function renderStatus() {
  document.body.classList.toggle("twitch-live", twitchLive);
  updateTwitchVisibility();
  const archived = ["archive", "ident", "embed"].includes(mode);
  const live = hasLiveSource();
  const archiveBanner = archived && !live;
  banner.dataset.state = live ? "live" : archiveBanner ? "archive" : stationState;
  banner.hidden = !archived && !live;
  const recordingTitle = currentRecording?.title || copy("player.archive.label", "Archive recording");
  banner.setAttribute("aria-label", live ? copy("player.live.aria", "Live on air") : recordingTitle);
  const bannerKey = JSON.stringify([archiveBanner, recordingTitle, currentRecording?.artwork_url]);
  if (banner.dataset.content !== bannerKey) {
    banner.dataset.content = bannerKey;
    banner.querySelectorAll(".marquee > span").forEach((el) => {
      el.replaceChildren();
      if (archiveBanner && currentRecording?.artwork_url) {
        const image = document.createElement("img");
        image.src = currentRecording.artwork_url;
        image.alt = "";
        image.draggable = false;
        el.append(image);
      }
      el.append(document.createTextNode(archiveBanner ? recordingTitle : copy("player.live", "LIVE")));
    });
  }
  const airtimeSelected = mode === "airtime" || (!stream && !twitchLive && Boolean(airtimeStream));
  message.textContent = !live ? copy("player.offair", "Currently off air") : airtimeSelected ? "" : copy("player.live.location", "Live from Offenbach");
  document.getElementById("currentShowTitle").textContent = !live ? "" : airtimeSelected ? airtimeTitle : stream ? stationTitle : twitchLive ? twitchTitle : airtimeTitle;
  const headerLive = document.getElementById("headerListenLive");
  if (headerLive) headerLive.hidden = !hasLiveSource() || !archived;
  const back = document.getElementById("returnLive");
  if (back) back.hidden = !hasLiveSource();
}
function clearAirtimeWidget() {
  airtimeFallback = false;
  document.getElementById("airtimeWidget")?.remove();
  document.body.classList.remove("airtime-widget");
}
function showAirtimeWidget() {
  if (airtimeFallback || mode !== "airtime") return;
  audio.pause();
  pending = false;
  airtimeFallback = true;
  const crop = document.createElement("div");
  crop.id = "airtimeWidget";
  const frame = document.createElement("iframe");
  frame.title = copy("player.airtime.title", "Airtime radio player");
  frame.src = "https://hfgradio.airtime.pro/embed/player?stream=auto&skin=2";
  frame.width = "350";
  frame.height = "396";
  frame.allow = "autoplay";
  crop.append(frame);
  document.querySelector(".dial").append(crop);
  document.body.classList.add("airtime-widget");
  message.textContent = copy("player.airtime.hint", "Press play in the Airtime widget.");
  playbackUI();
}
function stopOtherSources() {
  clearAirtimeWidget();
  updateTwitchVisibility();
  audio.pause();
  twitchCommand = false;
  if (twitchInitialized && twitch) twitch.pause();
  twitchPlaying = false;
  if (archiveWidget) archiveWidget.pause();
  archiveWidgetPlaying = false;
}
function placeNextButton() {
  if (!next) return;
  const host = document.body.classList.contains("home") && currentRecording
    ? offlineRecording : document.querySelector(".station-caption");
  if (host && next.parentElement !== host) host.append(next);
}
document.addEventListener("page-change", placeNextButton);
function showRecording(track, label) {
  currentRecording = track;
  offlineRecording.replaceChildren();
  if (track.artwork_url) {
    const image = document.createElement("img");
    image.src = track.artwork_url;
    image.alt = "";
    offlineRecording.append(image);
  }
  const state = document.createElement("p");
  state.id = "recordingStatus";
  state.textContent = label;
  const heading = document.createElement("h2");
  const titleLink = document.createElement("a");
  titleLink.textContent = track.title || copy("archive.untitled", "Untitled recording");
  titleLink.href = track.id ? "/archive/#recording-" + String(track.id).replace(/[^a-z0-9]/gi, "-") : "/archive/";
  heading.append(titleLink);
  const link = document.createElement("a");
  link.href = track.permalink_url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = copy("archive.open", "OPEN ON SOUNDCLOUD");
  const back = document.createElement("button");
  back.type = "button";
  back.id = "returnLive";
  back.textContent = copy("player.listen.live", "LISTEN LIVE");
  back.hidden = !hasLiveSource();
  back.addEventListener("click", () => {
    stopOtherSources();
    document.dispatchEvent(new Event("radio-play"));
    mode = "idle";
    startPlayback(true);
  });
  offlineRecording.append(state, heading, link, back);

  offlineRecording.hidden = false;
  placeNextButton();
}
function recordingStatus(text) {
  const el = document.getElementById("recordingStatus");
  if (el) el.textContent = text;
}
async function status() {
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
        twitchLive = d.live === true;
        if (twitchLive) initTwitch().catch(() => {});
        twitchTitle = d.title || twitchTitle;
      } catch {
        /* Embed events remain available when metadata service fails. */
      }
    })(),
    (async () => {
      try {
        const r = await fetch("/index.php?api=airtime", {cache: "no-store", signal: AbortSignal.timeout(8000)});
        if (!r.ok) throw Error();
        const d = await r.json();
        airtimeStream = d.live === true ? d.stream || "" : "";
        airtimeTitle = d.title || "";
      } catch { airtimeStream = ""; airtimeTitle = ""; }
    })(),
  ]);
  source = stream ? "azura" : twitchLive ? "twitch" : airtimeStream ? "airtime" : "archive";
  if (airtimeFallback && source !== "airtime") clearAirtimeWidget();
  if (!wantsPlayback && ((mode === "airtime" && source !== "airtime") || (mode === "twitch" && !twitchLive))) mode = "idle";
  renderStatus();
  if (
    (mode === "live" || mode === "twitch" || mode === "airtime") &&
    (mode === "twitch"
      ? source !== "twitch"
      : mode === "airtime" ? source !== "airtime" || audio.src !== airtimeStream
      : source !== "azura" || audio.src !== stream) &&
    wantsPlayback
  ) {
    clearAirtimeWidget();
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
    document.getElementById("twitchDock").append(holder);
    const script = document.createElement("script");
    script.src = "https://player.twitch.tv/js/embed/v1.js";
    let failed = false;
    const fail = () => {
      failed = true;
      clearTimeout(timer);
      holder.remove();
      script.remove();
      twitch = null;
      twitchInitialized = false;
      twitchReady = null;
      updateTwitchVisibility();
      reject(Error("Twitch unavailable"));
    };
    const timer = setTimeout(fail, 25000);
    script.onerror = fail;
    script.onload = () => {
      if (failed) return;
      try {
        twitch = new Twitch.Player(holder.id, {
          channel: "hfgradio",
          width: "100%",
          height: 360,
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
        // Native Twitch controls and our controls share the same confirmed state.
        twitch.addEventListener(Twitch.Player.PLAY, () => {
          twitch.setVolume(audio.volume);
          twitch.setMuted(audio.muted);
          if (mode !== "twitch") {
            operation++;
            audio.pause();
            if (archiveWidget) archiveWidget.pause();
            document.dispatchEvent(new Event("radio-play"));
            archiveWidgetPlaying = false;
            mode = "twitch";
            offlineRecording.hidden = true;
          }
          wantsPlayback = true;
          twitchCommand = null;
          twitchPlaying = true;
          pending = false;
          renderStatus();
          playbackUI();
        });
        twitch.addEventListener(Twitch.Player.PLAYING, () => {
          if (mode !== "twitch") return;
          twitchCommand = null;
          twitchPlaying = true;
          wantsPlayback = true;
          pending = false;
          playbackUI();
        });
        twitch.addEventListener(Twitch.Player.PAUSE, () => {
          // PAUSE is a real pause, never a buffering signal.
          twitchPlaying = false;
          twitchCommand = null;
          if (mode === "twitch") {
            pending = false;
            wantsPlayback = false;
          }
          playbackUI();
        });
        twitch.addEventListener(Twitch.Player.PLAYBACK_BLOCKED, () => {
          twitchCommand = null;
          twitchPlaying = false;
          pending = false;
          wantsPlayback = false;
          updateTwitchVisibility();
          message.textContent =
            copy("player.twitch.start", "Start live audio in the Twitch player below the page.");
          playbackUI();
        });
        twitch.addEventListener(Twitch.Player.ONLINE, () => {
          twitchObservedLive = true;
          twitchLive = true;
          renderStatus();
        });
        twitch.addEventListener(Twitch.Player.OFFLINE, () => {
          twitchObservedLive = false;
          twitchLive = false;
          renderStatus();
          if (mode === "twitch" && wantsPlayback) {
            stopOtherSources();
            mode = "idle";
            startPlayback(true);
          }
        });
      } catch {
        fail();
      }
    };
    document.head.append(script);
  });
  return twitchReady;
}
async function startPlayback(userClick = true) {
  clearAirtimeWidget();
  const attempt = ++operation;
  wantsPlayback = true;
  pending = true;
  playbackUI();
  try {
    if (!statusLoaded) await initialStatus;
    if (attempt !== operation) return;
    audio.pause();
    if (archiveWidget) archiveWidget.pause();
    archiveWidgetPlaying = false;
    if (!twitchLive && twitchInitialized && twitch) twitch.pause();
    if (stream) {
      if (twitchInitialized && twitch) twitch.pause();
      mode = "live";
      offlineRecording.hidden = true;
      renderStatus();
      if (audio.src !== stream) audio.src = stream;
      await audio.play();
    } else if (twitchLive) {
      mode = "twitch";
      offlineRecording.hidden = true;
      renderStatus();
      const player = twitchInitialized ? twitch : await initTwitch();
      if (attempt !== operation) return;
      commandTwitch(true);
    } else if (airtimeStream) {
      if (twitchInitialized && twitch) twitch.pause();
      mode = "airtime";
      offlineRecording.hidden = true;
      renderStatus();
      if (audio.src !== airtimeStream) audio.src = airtimeStream;
      await audio.play();
    } else {
      mode = "ident";
      showRecording(
        {
          title: copy("site.name", "HFG RADIO"),
          permalink_url: "https://soundcloud.com/hfg-radio",
        },
        copy("archive.ident", "ARCHIVE \u00b7 Station ident"),
      );
      renderStatus();
      audio.src = "/assets/audio/station-ident.mp3";
      await audio.play();
    }
  } catch (error) {
    if (attempt === operation) {
      pending = false;
      if (mode === "airtime" && error.name !== "AbortError" && error.name !== "NotAllowedError") showAirtimeWidget();
      else message.textContent = copy("player.retry", "Playback could not start. Press PLAY to retry.");
    }
  } finally {
    if (attempt === operation) {
      if (mode !== "twitch") pending = false;
      playbackUI();
    }
  }
}
async function nextRecording() {
  const attempt = ++operation;
  stopOtherSources();
  document.dispatchEvent(new Event("radio-play"));
  mode = "archive";
  wantsPlayback = true;
  pending = true;
  playbackUI();
  try {
    if (!queue.length) {
      queue = (await archive()).filter((p) => p.audio_url).slice();
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue[i], queue[j]] = [queue[j], queue[i]];
      }
    }
    if (attempt !== operation) return;
    const track = queue.pop();
    if (!track) throw Error("empty");
    showRecording(track, copy("archive.shuffle", "ARCHIVE \u00b7 Shuffled recording"));
    audio.src = track.audio_url;
    renderStatus();
    await audio.play();
  } catch {
    if (attempt === operation) {
      archivePromise = null;
      recordingStatus(copy("archive.retry", "Archive unavailable. Press NEXT to retry."));
    }
  } finally {
    if (attempt === operation) {
      pending = false;
      playbackUI();
    }
  }
}
if (audio) {
  play.addEventListener("click", () => {
    if (twitchInitialized && (mode === "twitch" || (mode === "idle" && twitchLive && !stream))) {
      toggleTwitch();
      return;
    }
    if (mode === "embed") {
      if (archiveWidget) archiveWidget.toggle();
      else recordingStatus(copy("archive.widget.hint", "Use PLAY in the SoundCloud player below."));
      return;
    }
    const active = mode === "twitch" ? twitchIsPlaying() : !audio.paused;
    if (active || pending) {
      operation++;
      wantsPlayback = false;
      pending = false;
      stopOtherSources();
      playbackUI();
      return;
    }
    if ((mode === "archive" || mode === "ident") && audio.src) {
      wantsPlayback = true;
      audio.play().catch(() => recordingStatus(copy("player.retry.short", "Press PLAY to retry.")));
      return;
    }
    document.dispatchEvent(new Event("radio-play"));
    startPlayback(true);
  });
  if (next)
    next.addEventListener("click", () => {
      if (["archive", "ident", "embed"].includes(mode)) nextRecording();
    });
  audio.addEventListener("ended", () => {
    if (mode === "archive" || mode === "ident") nextRecording();
    else playbackUI();
  });
  for (const event of ["playing", "pause"])
    audio.addEventListener(event, playbackUI);
  audio.addEventListener("error", () => {
    pending = false;
    if (mode === "archive" || mode === "ident")
      recordingStatus(
        copy("archive.audio.error", "Audio unavailable. Press NEXT to try another recording."),
      );
    else if (mode === "airtime") showAirtimeWidget();
    else if (mode === "live")
      message.textContent = copy("player.live.error", "Live audio unavailable. Press PLAY to retry.");
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
if (marquee) {
  const strip = marquee.parentElement;
  strip.tabIndex = 0;
  strip.setAttribute("aria-label", copy("archive.strip", "Archive artwork. Drag or scroll left and right."));
  archive().then((items) => {
    const artworks = items.filter((p) => p.artwork_url);
    if (!artworks.length) { strip.hidden = true; return; }
    // Two complete copies keep the strip continuous in either direction.
    for (let repeat = 0; repeat < 2; repeat++) {
      for (const track of artworks) {
        const image = document.createElement("img");
        image.src = track.artwork_url;
        image.alt = repeat ? "" : track.title || copy("archive.artwork", "Archive artwork");
        image.draggable = false;
        image.loading = "lazy";
        if (repeat) image.setAttribute("aria-hidden", "true");
        marquee.append(image);
      }
    }
    const cycleWidth = () => (marquee.scrollWidth + 12) / 2;
    strip.scrollLeft = cycleWidth() / 2;
    let dragging = false, pointer = null, lastX = 0, resumeAt = 0, previousTime = 0;
    const normalize = () => {
      const cycle = cycleWidth();
      if (cycle <= strip.clientWidth) return;
      if (strip.scrollLeft < 1) strip.scrollLeft += cycle;
      else if (strip.scrollLeft >= cycle) strip.scrollLeft -= cycle;
    };
    strip.addEventListener("pointerdown", (event) => {
      resumeAt = Infinity;
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      pointer = event.pointerId;
      dragging = true;
      lastX = event.clientX;
      strip.setPointerCapture(pointer);
      strip.classList.add("is-dragging");
    });
    strip.addEventListener("pointermove", (event) => {
      if (!dragging || event.pointerId !== pointer) return;
      strip.scrollLeft += lastX - event.clientX;
      lastX = event.clientX;
      normalize();
    });
    const endDrag = () => {
      dragging = false;
      pointer = null;
      resumeAt = performance.now() + 2500;
      strip.classList.remove("is-dragging");
    };
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) strip.addEventListener(event, endDrag);
    strip.addEventListener("touchend", endDrag, {passive:true});
    strip.addEventListener("touchcancel", endDrag, {passive:true});
    strip.addEventListener("scroll", normalize, {passive:true});
    strip.addEventListener("wheel", () => { resumeAt = performance.now() + 2500; }, {passive:true});
    strip.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      strip.scrollLeft += event.key === "ArrowRight" ? 150 : -150;
      resumeAt = performance.now() + 2500;
    });
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    function drift(time) {
      const elapsed = previousTime ? Math.min(time - previousTime, 50) : 0;
      previousTime = time;
      if (!reducedMotion.matches && !document.hidden && strip.getClientRects().length &&
          time > resumeAt && !dragging) {
        strip.scrollLeft += elapsed * 0.025;
        normalize();
      }
      requestAnimationFrame(drift);
    }
    requestAnimationFrame(drift);
  }).catch(() => { strip.hidden = true; });
}
function clock() {
  const text = document.getElementById("clockText");
  if (text)
    text.textContent = new Date().toLocaleTimeString("de-DE", {
      timeZone: "Europe/Berlin",
    });
}
clock();
setInterval(clock, 1000);
let statusLoaded = false;
const initialStatus = status().finally(() => {
  statusLoaded = true;
});
for (const a of document.querySelectorAll("nav a"))
  if (a.pathname === location.pathname) a.setAttribute("aria-current", "page");

document.addEventListener("archive-play", (event) => {
  operation++;
  wantsPlayback = false;
  pending = false;
  stopOtherSources();
  mode = "embed";
  archiveWidget = null;
  archiveWidgetPlaying = false;
  showRecording(event.detail, copy("archive.loading", "ARCHIVE \u00b7 Loading recording"));
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
  recordingStatus(
    {
      playing: copy("archive.playing", "Now playing \u00b7 Archive"),
      paused: copy("archive.paused", "Paused \u00b7 Archive"),
      finished: copy("archive.finished", "Finished \u00b7 Archive"),
      error: copy("archive.error", "Archive unavailable \u00b7 Try another recording"),
      unavailable: copy("archive.selected", "Archive selected \u00b7 Use the SoundCloud player"),
    }[state] || copy("archive.title", "Archive"),
  );
  playbackUI();
});
document.addEventListener("archive-close", () => {
  if (mode !== "embed") return;
  archiveWidget = null;
  archiveWidgetPlaying = false;
  mode = "idle";
  offlineRecording.hidden = true;
  renderStatus();
  playbackUI();
});



// Load the Twitch embed only after a positive live-status response.

function updateTwitchVisibility() {
  const dock = document.querySelector(".twitch-dock");
  const nativeTwitch = twitchLive && (mode === "twitch" || (!stream && mode === "idle"));
  const inCircle = document.body.classList.contains("home") && nativeTwitch;
  const playingTwitch = mode === "twitch" && twitchPlaying;
  const disableStart = nativeTwitch && !playingTwitch && !pending;
  play.disabled = disableStart;
  play.setAttribute("aria-disabled", String(disableStart));
  play.title = disableStart ? copy("player.twitch.hint", "Use the Twitch player to start live audio") : "";
  const cover = document.getElementById("twitchWeatherCover");
  if (cover) cover.hidden = !playingTwitch;
  document.body.classList.toggle("twitch-in-circle", inCircle);
  const hint = document.getElementById("twitchPlayHint");
  if (hint) hint.hidden = airtimeFallback ? false : !inCircle || (mode === "twitch" && twitchPlaying);
  if (dock) {
    dock.hidden = !twitchLive;
    dock.classList.toggle("in-circle", inCircle);
    if (inCircle) {
      const rect = document.getElementById("weatherPlay").getBoundingClientRect();
      dock.style.left = (rect.left + window.scrollX) + "px";
      dock.style.top = (rect.top + window.scrollY) + "px";
      dock.style.width = rect.width + "px";
      dock.style.height = rect.height + "px";
    } else {
      dock.style.left = dock.style.top = dock.style.width = dock.style.height = "";
    }
  }
  const holder = document.getElementById("twitchAudioEngine");
  if (holder) {
    holder.removeAttribute("aria-hidden");
    const frame = holder.querySelector("iframe");
    if (frame) frame.tabIndex = 0;
  }
}

document.getElementById("headerListenLive")?.addEventListener("click", () => {
  if (twitchLive && !stream && twitchInitialized) commandTwitch(true);
  else {
    stopOtherSources();
    document.dispatchEvent(new Event("radio-play"));
    mode = "idle";
    startPlayback(true);
  }
});
document.addEventListener("page-change", updateTwitchVisibility);
window.addEventListener("resize", updateTwitchVisibility);
// Document-relative positioning scrolls natively instead of chasing scroll events.
let twitchLayoutFrame = 0;
function scheduleTwitchLayout() {
  if (twitchLayoutFrame) return;
  twitchLayoutFrame = requestAnimationFrame(() => {
    twitchLayoutFrame = 0;
    updateTwitchVisibility();
  });
}
if (typeof ResizeObserver !== "undefined") {
  const layoutObserver = new ResizeObserver(scheduleTwitchLayout);
  layoutObserver.observe(document.body);
  layoutObserver.observe(document.querySelector(".player-shell"));
}
document.getElementById("twitchWeatherCover")?.addEventListener("click", () => {
  if (mode === "twitch" && twitchInitialized) commandTwitch(false);
});

// Text wrappers survive changing PLAY/STOP labels and asynchronously loaded links.
function prepareHoverLabels(root) {
  if (root.nodeType === Node.TEXT_NODE) {
    if (!root.textContent.trim() || !root.parentElement?.closest("a, button") ||
        root.parentElement.closest(".hover-label, svg, script, style")) return;
    const label = document.createElement("span");
    label.className = "hover-label";
    root.replaceWith(label);
    label.append(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE || root.closest(".hover-label, svg, script, style")) return;
  for (const child of [...root.childNodes]) prepareHoverLabels(child);
}
prepareHoverLabels(document.body);
new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) prepareHoverLabels(node);
  }
}).observe(document.body, {childList:true, subtree:true});

// Touch gets the same brief lettering stretch as mouse hover. Keep media
// commands in the trusted click so mobile browsers allow playback/popups.
const tapTimers = new WeakMap();
function showTapFeedback(control) {
  clearTimeout(tapTimers.get(control));
  control.classList.add("tap-feedback");
  tapTimers.set(control, setTimeout(() => control.classList.remove("tap-feedback"), 360));
}
document.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse") return;
  const control = event.target.closest("a, button");
  if (control && !control.disabled) showTapFeedback(control);
}, {passive:true});
const replayedTapLinks = new WeakSet();
document.addEventListener("click", (event) => {
  const control = event.target.closest("a, button");
  if (!control || control.disabled || replayedTapLinks.has(control) ||
      !matchMedia("(hover:none), (pointer:coarse)").matches ||
      event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  showTapFeedback(control);
  // Give same-tab links a short beat before navigation; new windows and
  // playback buttons retain the original user activation.
  if (!control.matches("a[href]") || control.target || control.hasAttribute("download")) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  setTimeout(() => {
    if (!control.isConnected) return;
    replayedTapLinks.add(control);
    try { control.click(); } finally { replayedTapLinks.delete(control); }
  }, 140);
}, true);

