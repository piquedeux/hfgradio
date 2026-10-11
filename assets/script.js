// One deferred first-party entry point. Rendering never waits for a remote service.
(() => {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      "use strict";

      const { copy, archiveHref } = window.HFG;

      // Shared lifecycle: paint the shell first; fetch only the visible page.
      const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
      const requests = new Map();
      function fetchJSON(api, ttl = 300000) {
        const cached = requests.get(api);
        if (cached && Date.now() - cached.at < ttl) return cached.promise;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const promise = fetch(`/index.php?api=${api}`, {
          signal: controller.signal,
        })
          .then((response) => {
            if (!response.ok) throw Error(api);
            return response.json();
          })
          .catch((error) => {
            requests.delete(api);
            throw error;
          })
          .finally(() => clearTimeout(timer));
        requests.set(api, { at: Date.now(), promise });
        return promise;
      }
      const nextPaint = () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      const yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0));
      function pageTask(name, load, interval = 300000) {
        let busy = false,
          updated = 0;
        const run = async (force = false) => {
          if (
            document.hidden ||
            (!force &&
              !document.querySelector(`[data-page="${name}"]:not([hidden])`)) ||
            busy ||
            Date.now() - updated < interval
          )
            return;
          busy = true;
          try {
            await load();
            updated = Date.now();
            document.dispatchEvent(new Event("page-data-ready"));
          } finally {
            busy = false;
          }
        };
        introReady.then(run);
        document.addEventListener("page-change", () => introReady.then(run));
        document.addEventListener("visibilitychange", () => run());
        if (name !== "archive")
          document.addEventListener("search-open", () =>
            introReady.then(() => run(true)),
          );
        setInterval(run, interval);
      }

      // Navigation entries appear only while their source has content.
      const setNavAvailable = (name, available) => {
        const link = document.querySelector(`[data-content-nav="${name}"]`);
        if (link) link.hidden = !available;
      };
      window.HFG.setNavAvailable = setNavAvailable;

      // ── Intro: rasterize once, then move an ordinary canvas texture ──
      const introReady = (async () => {
        const overlay = document.getElementById("weatherIntro");
        const target = document.querySelector(".home-logo .logo-fill");
        if (!overlay || !target) return;
        if (!document.body.classList.contains("home")) {
          overlay.remove();
          const loadHome = async () => {
            if (!document.body.classList.contains("home")) return;
            document.removeEventListener("page-change", loadHome);
            const image = new Image();
            image.decoding = "async";
            image.src = target.dataset.image;
            try {
              await image.decode();
              const logo = target.querySelector("img");
              await logo.decode();
              const canvas = target.querySelector("canvas");
              canvas.width = Math.min(
                1400,
                Math.round(
                  target.clientWidth * Math.min(devicePixelRatio || 1, 1.5),
                ),
              );
              canvas.height = Math.round((canvas.width * 852) / 1348);
              const ctx = canvas.getContext("2d");
              ctx.drawImage(logo, 0, 0, canvas.width, canvas.height);
              ctx.globalCompositeOperation = "source-in";
              const scale =
                Math.max(
                  canvas.width / image.naturalWidth,
                  canvas.height / image.naturalHeight,
                ) * 1.4;
              ctx.drawImage(
                image,
                (canvas.width - image.naturalWidth * scale) / 2,
                (canvas.height - image.naturalHeight * scale) / 2,
                image.naturalWidth * scale,
                image.naturalHeight * scale,
              );
              canvas.hidden = false;
              logo.hidden = true;
            } catch {
              /* Keep the local logo. */
            }
          };
          document.addEventListener("page-change", loadHome);
          return;
        }
        const mark = overlay.querySelector("canvas");
        const homeCanvas = target.querySelector("canvas");
        const logo = target.querySelector("img");
        const photo = overlay.querySelector(".intro-photo");
        const backdrop = overlay.querySelector(".intro-backdrop");
        let stopped = false;
        const finish = () => {
          if (stopped) return;
          stopped = true;
          overlay.remove();
          target.classList.remove("intro-target");
        };
        const safety = setTimeout(finish, 2800);
        const interrupt = () => finish();
        window.addEventListener("pointerdown", interrupt, {
          once: true,
          passive: true,
        });
        window.addEventListener("pagehide", interrupt, { once: true });
        try {
          await Promise.race([
            logo.decode().catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 250)),
          ]);
          if (!logo.naturalWidth || stopped) return;
          const bounds = target.getBoundingClientRect();
          const ratio = Math.min(devicePixelRatio || 1, 1.5);
          const width = Math.min(1400, Math.round(bounds.width * ratio));
          const height = Math.round((width * 852) / 1348);
          function raster(canvas, image) {
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(logo, 0, 0, width, height);
            if (image?.naturalWidth) {
              ctx.globalCompositeOperation = "source-in";
              const scale =
                Math.max(
                  width / image.naturalWidth,
                  height / image.naturalHeight,
                ) * 1.4;
              const w = image.naturalWidth * scale,
                h = image.naturalHeight * scale;
              ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
              ctx.globalCompositeOperation = "source-over";
            }
          }
          // A cached webcam may be used immediately; a slow image never holds the page.
          const weather = new Image();
          weather.decoding = "async";
          weather.fetchPriority = "low";
          weather.src = target.dataset.image;
          const weatherReady = weather
            .decode()
            .then(() => true)
            .catch(() => false);
          const loaded = await Promise.race([
            weatherReady,
            new Promise((resolve) => setTimeout(() => resolve(false), 120)),
          ]);
          if (stopped) return;
          raster(homeCanvas, loaded ? weather : null);
          homeCanvas.hidden = false;
          logo.hidden = true;
          // Update the static hero only after the intro, using the already decoded image.
          weatherReady.then(async (ok) => {
            await introReady;
            if (ok && !loaded) {
              raster(homeCanvas, weather);
              if (!reducedMotion.matches && typeof homeCanvas.animate === "function")
                homeCanvas.animate([{ opacity: 0 }, { opacity: 1 }], {
                  duration: 300,
                });
            }
          });
          raster(mark, loaded ? weather : null);
          if (loaded) photo.src = weather.src;
          photo.hidden = !loaded;
          Object.assign(mark.style, {
            left: `${bounds.left}px`,
            top: `${bounds.top}px`,
            width: `${bounds.width}px`,
            height: `${bounds.height}px`,
          });
          const scale = Math.min(
            innerWidth / bounds.width,
            innerHeight / bounds.height,
          );
          const x = (innerWidth - bounds.width * scale) / 2 - bounds.left;
          const y = (innerHeight - bounds.height * scale) / 2 - bounds.top;
          const from = `translate3d(${x}px,${y}px,0) scale(${scale})`;
          // Start state without transitions, then settle with pure CSS transitions
          // so the intro runs on any engine, including older mobile WebKit.
          for (const el of [mark, backdrop, photo])
            el.style.transition = "none";
          mark.style.transform = from;
          backdrop.style.opacity = "1";
          photo.style.opacity = "1";
          void mark.offsetWidth; // commit the start state synchronously
          for (const el of [mark, backdrop, photo]) el.style.transition = "";
          target.classList.add("intro-target");
          overlay.hidden = false;
          await nextPaint();
          if (stopped) return;
          const settled = new Promise((resolve) =>
            mark.addEventListener("transitionend", resolve, { once: true }),
          );
          mark.style.transform = "translate3d(0,0,0) scale(1)";
          backdrop.style.opacity = "0";
          if (loaded) photo.style.opacity = "0";
          await Promise.race([
            settled,
            new Promise((resolve) => setTimeout(resolve, 1350)),
          ]);
        } catch {
          /* The server-rendered page and logo remain usable. */
        } finally {
          clearTimeout(safety);
          finish();
          window.removeEventListener("pointerdown", interrupt);
          window.removeEventListener("pagehide", interrupt);
        }
      })();

      introReady.then(() =>
        setTimeout(() => {
          if (!document.hidden)
            fetch("/index.php?api=content-refresh", { priority: "low" }).catch(
              () => {},
            );
        }, 1500),
      );
      // The first HTML answer knows only local files and caches, so ask once after
      // paint when the server could not tell whether a section has content.
      const availability = JSON.parse(
        document.getElementById("siteAvailability")?.textContent || "{}",
      );
      if (Object.values(availability).includes(null))
        introReady.then(() =>
          fetch("/index.php?api=availability", { priority: "low" })
            .then((response) => (response.ok ? response.json() : null))
            .then((data) => {
              if (!data) return;
              setNavAvailable("gallery", Boolean(data.gallery));
              setNavAvailable("links", Boolean(data.links));
            })
            .catch(() => {}),
        );
      const pauseHiddenMotion = () =>
        document.documentElement.classList.toggle(
          "motion-paused",
          document.hidden,
        );
      document.addEventListener("visibilitychange", pauseHiddenMotion);
      pauseHiddenMotion();
      new IntersectionObserver((entries) => {
        for (const entry of entries)
          entry.target.classList.toggle("is-offscreen", !entry.isIntersecting);
      }).observe(document.getElementById("liveBanner"));

      // ── Player and interactions ──
      let archiveWidget = null,
        archiveWidgetPlaying = false;
      let archiveWidgetDuration = 0,
        archiveWidgetPosition = 0;
      const banner = document.getElementById("liveBanner"),
        audio = document.getElementById("radioAudio"),
        play = document.getElementById("playButton"),
        shuffle = document.getElementById("shuffleButton"),
        next = document.getElementById("nextButton"),
        message = document.getElementById("playerMessage"),
        progress = document.getElementById("playerProgress");
      let currentRecording = null;
      let airtimeStream = "",
        airtimeTitle = "",
        airtimeFallback = false;
      let stream = "",
        stationTitle = "",
        mode = "idle",
        pending = false,
        operation = 0,
        archivePromise = null,
        queue = [],
        twitch = null,
        twitchReady = null,
        twitchLive = false,
        twitchTitle = "",
        source = "azura",
        wantsPlayback = false;
      // The visible Twitch embed acts as a tuner: it streams muted while live and the
      // site player only mutes/unmutes it. twitchPlaying marks the audible selection.
      let twitchInitialized = false,
        twitchPlaying = false,
        twitchApiLive = null,
        twitchEmbedLive = null,
        twitchDockEnabled = false,
        twitchVideoVisible = false,
        twitchStatusResolve = null;
      // Resolves as soon as either the API or the embed reports a live status.
      const twitchStatusKnown = new Promise((resolve) => {
        twitchStatusResolve = resolve;
      });

      function archive() {
        return (
          archivePromise ||
          (archivePromise = fetchJSON("archive")
            .then((data) => {
              if (!Array.isArray(data.posts) || !data.posts.length)
                throw Error("Empty archive");
              return data.posts;
            })
            .catch((e) => {
              archivePromise = null;
              throw e;
            }))
        );
      }
      function hasLiveSource() {
        return twitchLive || Boolean(stream) || Boolean(airtimeStream);
      }
      // Live is true when the metadata API or the embed reports it, so a single flaky
      // source can never switch a live broadcast back to the off-air ident.
      function applyTwitchLive() {
        if (twitchStatusResolve) {
          twitchStatusResolve();
          twitchStatusResolve = null;
        }
        const live = twitchApiLive === true || twitchEmbedLive === true;
        if (live === twitchLive) return;
        twitchLive = live;
        renderStatus();
        if (!live && mode === "twitch") {
          const resume = wantsPlayback;
          stopOtherSources();
          mode = "idle";
          if (resume) startPlayback(true);
        }
      }
      function twitchIsPlaying() {
        return mode === "twitch" && twitchPlaying;
      }
      // Pause the live player when another source takes over.
      function silenceTwitch() {
        twitchPlaying = false;
        clearInterval(twitchUnmuteTimer);
        if (!twitchInitialized || !twitch) return;
        try {
          twitch.setMuted(true);
          twitch.pause();
        } catch {}
      }
      // The player keeps streaming muted; the site player only toggles its sound.
      // Unmuting stays inside the click so the browser's gesture requirement holds.
      function unmuteTwitch() {
        if (!twitchInitialized || !twitch) return;
        try {
          twitch.setVolume(1);
          twitch.play();
          twitch.setMuted(false);
        } catch {}
      }
      function twitchAudible() {
        if (!twitchInitialized || !twitch) return false;
        try {
          return twitch.getMuted() !== true && !twitch.isPaused();
        } catch {
          return false;
        }
      }
      // The embed needs a moment to buffer, so keep re-asserting the sound after the
      // click until the player confirms it. That removes the old stop/play retry.
      let twitchUnmuteTimer = null;
      function ensureTwitchAudio() {
        clearInterval(twitchUnmuteTimer);
        let tries = 0;
        const attempt = () => {
          if (mode !== "twitch" || !twitchPlaying || twitchAudible()) {
            clearInterval(twitchUnmuteTimer);
            return;
          }
          unmuteTwitch();
          if (++tries >= 10) clearInterval(twitchUnmuteTimer);
        };
        attempt();
        twitchUnmuteTimer = setInterval(attempt, 500);
      }
      function commandTwitch(playing) {
        operation++;
        wantsPlayback = playing;
        pending = false;
        if (playing) {
          if (cancelIntro) cancelIntro();
          audio.pause();
          if (archiveWidget) archiveWidget.pause();
          document.dispatchEvent(new Event("radio-play"));
          archiveWidgetPlaying = false;
          mode = "twitch";
          twitchPlaying = true;
        } else {
          twitchPlaying = false;
          if (mode === "twitch") mode = "idle";
          wantsPlayback = false;
        }
        renderStatus();
        if (playing) {
          unmuteTwitch();
          ensureTwitchAudio();
          // If the embed was still loading, unmute as soon as it reports ready.
          if (!twitchInitialized) {
            initTwitch()
              .then(() => {
                if (mode === "twitch" && twitchPlaying) {
                  unmuteTwitch();
                  ensureTwitchAudio();
                }
              })
              .catch(() => {
                if (mode === "twitch" && wantsPlayback) nextRecording(true);
              });
          }
          setTimeout(verifyTwitchAudible, 4000);
        } else {
          clearInterval(twitchUnmuteTimer);
          if (twitchInitialized && twitch) {
            try {
              twitch.setMuted(true);
              twitch.pause();
            } catch {}
          }
        }
        playbackUI();
      }
      function revealTwitchControls() {
        const dock = document.querySelector(".twitch-dock");
        if (!dock) return;
        twitchVideoVisible = true;
        updateTwitchVisibility();
      }
      function verifyTwitchAudible() {
        if (mode !== "twitch" || twitchAudible()) return;
        revealTwitchControls();
        message.textContent = copy(
          "player.twitch.retry",
          "Press play in the Twitch player to start live audio.",
        );
      }

      function toggleTwitch() {
        commandTwitch(!twitchIsPlaying());
      }
      // SHUFFLE stays available; LISTEN LIVE is only useful while an archive item
      // is actively playing.
      function updateControls() {
        const playingRecording = ["archive", "ident", "embed"].includes(mode);
        const live = hasLiveSource();
        const archivePlaying =
          mode === "embed"
            ? archiveWidgetPlaying
            : mode === "archive" && !audio.paused;
        if (shuffle) shuffle.hidden = false;
        const headerLive = document.getElementById("headerListenLive");
        if (headerLive) headerLive.hidden = !live || !archivePlaying;
        if (next) next.hidden = !introPlaying && !playingRecording;
        const thumb = document.getElementById("recordingThumb");
        // A playing recording keeps its artwork even while a live show is available.
        if (thumb)
          thumb.hidden =
            introPlaying || !playingRecording || !currentRecording?.artwork_url;
        const back = document.getElementById("returnLive");
        if (back) back.hidden = !live;
      }
      function playbackUI() {
        const active =
          mode === "embed"
            ? archiveWidgetPlaying
            : mode === "twitch"
              ? twitchPlaying
              : !audio.paused;
        play.textContent =
          pending || active
            ? mode === "twitch"
              ? copy("player.pause", "PAUSE")
              : copy("player.stop", "STOP")
            : copy("player.play", "PLAY");
        play.setAttribute("aria-pressed", String(active));
        updateControls();
        updateTwitchVisibility();
      }
      function updateProgress() {
        if (!progress) return;
        const embedded = mode === "embed" && !introPlaying;
        const duration = embedded ? archiveWidgetDuration : audio.duration;
        const position = embedded ? archiveWidgetPosition : audio.currentTime;
        const available =
          (introPlaying || ["archive", "ident", "embed"].includes(mode)) &&
          Number.isFinite(duration) &&
          duration > 0;
        progress.hidden = !available;
        const timeline = document.getElementById("playerTimeline");
        const remainingLabel = document.getElementById("playerTimeRemaining");
        if (timeline) timeline.hidden = !available;
        if (remainingLabel) remainingLabel.hidden = introPlaying || !available;
        if (available) {
          const ratio = Math.max(0, Math.min(1, position / duration));
          progress.value = ratio;
          const seconds = Math.max(0, Math.ceil(duration - position));
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const time =
            (hours
              ? hours + ":" + String(minutes).padStart(2, "0")
              : String(minutes)) +
            ":" +
            String(seconds % 60).padStart(2, "0");
          if (remainingLabel) {
            remainingLabel.textContent = "−" + time;
            remainingLabel.setAttribute("aria-label", time + " remaining");
            remainingLabel.style.left = `${ratio * 100}%`;
            remainingLabel.style.transform = `translateX(-${ratio * 100}%)`;
          }
        }
      }
      function updateTitleMarquee() {
        if (!message) return;
        let title = message.querySelector(":scope > .player-title");
        if (!title) {
          title = document.createElement("span");
          title.className = "player-title";
          title.append(...message.childNodes);
          message.append(title);
        }
        const distance = Math.max(0, title.scrollWidth - message.clientWidth);
        message.classList.toggle("is-marquee", distance > 1);
        const value = `${distance}px`;
        if (message.style.getPropertyValue("--player-title-distance") !== value)
          message.style.setProperty("--player-title-distance", value);
      }
      function renderStatus() {
        document.body.classList.toggle("twitch-live", twitchLive);
        updateTwitchVisibility();
        const live = hasLiveSource();
        const playingRecording = ["archive", "ident", "embed"].includes(mode);
        const recordingTitle = playingRecording
          ? currentRecording?.title || ""
          : "";
        // The banner exists only to mark a live broadcast; the CSS marquee animation
        // starts on its own when the element becomes displayed.
        banner.dataset.state = "live";
        banner.hidden = !live;
        banner.setAttribute(
          "aria-label",
          copy("player.live.aria", "Live on air"),
        );
        updateControls();
        const airtimeSelected =
          mode === "airtime" ||
          (!stream && !twitchLive && Boolean(airtimeStream));
        message.replaceChildren();
        if (introPlaying) {
          message.textContent = "hfgradio jingle";
          document.getElementById("currentShowTitle").textContent = "";
          updateTitleMarquee();
          updateProgress();
          return;
        }
        if (recordingTitle) {
          // Titles of recordings stay visible while they play, even during a live show.
          const titleLink = document.createElement("a");
          titleLink.href = archiveHref(currentRecording);
          titleLink.textContent = recordingTitle;
          message.append(titleLink);
        } else if (live) {
          message.append(
            document.createTextNode(
              (airtimeSelected
                ? airtimeTitle
                : stream
                  ? stationTitle
                  : twitchLive
                    ? twitchTitle
                    : airtimeTitle) || copy("player.live.location", "LIVE"),
            ),
          );
        } else {
          message.append(
            document.createTextNode(copy("player.offline", "OFF AIR")),
          );
        }
        document.getElementById("currentShowTitle").textContent =
          playingRecording
            ? copy("player.archive.playing", "PLAYING ARCHIVE RECORDING")
            : live
              ? copy("player.live.location", "LIVE")
              : copy("player.offline.archive", "SHUFFLE ARCHIVE RECORDINGS");
        updateTitleMarquee();
        updateProgress();
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
        frame.src =
          "https://hfgradio.airtime.pro/embed/player?stream=auto&skin=2";
        frame.width = "350";
        frame.height = "396";
        frame.allow = "autoplay";
        crop.append(frame);
        document.body.append(crop);
        document.body.classList.add("airtime-widget");
        message.textContent = copy(
          "player.airtime.hint",
          "Press play in the Airtime widget.",
        );
        playbackUI();
      }
      function stopOtherSources() {
        if (cancelIntro) cancelIntro();
        clearAirtimeWidget();
        updateTwitchVisibility();
        audio.pause();
        silenceTwitch();
        if (archiveWidget) archiveWidget.pause();
        archiveWidgetPlaying = false;
      }
      function showRecording(track) {
        currentRecording = track;
        const thumb = document.getElementById("recordingThumb");
        if (thumb) {
          const image = thumb.querySelector("img");
          if (track.artwork_url) {
            image.src = track.artwork_url;
            thumb.href = archiveHref(track);
            thumb.setAttribute(
              "aria-label",
              track.title || copy("player.archive.label", "Archive recording"),
            );
            thumb.hidden = false;
          } else {
            image.removeAttribute("src");
            thumb.hidden = true;
          }
        }
      }
      function recordingStatus(text) {
        if (["archive", "embed", "ident"].includes(mode)) {
          const status = document.getElementById("currentShowTitle");
          if (status) status.textContent = text;
        }
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
              stream =
                d.is_online || d.live?.is_live
                  ? d.station?.listen_url || ""
                  : "";
              stationTitle =
                d.now_playing?.song?.text || d.live?.streamer_name || "";
            } catch {
              stream = "";
              stationTitle = "";
            }
          })().finally(renderStatus),
          (async () => {
            try {
              const r = await fetch("/index.php?api=twitch", {
                cache: "no-store",
                signal: AbortSignal.timeout(11000),
              });
              if (!r.ok) throw Error();
              const d = await r.json();
              if (typeof d.live === "boolean") {
                twitchApiLive = d.live;
                applyTwitchLive();
              }
              twitchTitle = d.title || twitchTitle;
            } catch {
              /* Embed events remain available when metadata service fails. */
            }
          })().finally(renderStatus),
          (async () => {
            try {
              const r = await fetch("/index.php?api=airtime", {
                cache: "no-store",
                signal: AbortSignal.timeout(8000),
              });
              if (!r.ok) throw Error();
              const d = await r.json();
              airtimeStream = d.live === true ? d.stream || "" : "";
              airtimeTitle = d.title || "";
            } catch {
              airtimeStream = "";
              airtimeTitle = "";
            }
          })().finally(renderStatus),
        ]);
        // Offer the video control when availability is unknown, but do not
        // load a video decoder until the user requests playback or video.
        twitchDockEnabled = twitchApiLive !== false;
        updateTwitchVisibility();
        // The video decoder is started only by an explicit playback/video action.
        source = stream
          ? "azura"
          : twitchLive
            ? "twitch"
            : airtimeStream
              ? "airtime"
              : "archive";
        if (airtimeFallback && source !== "airtime") clearAirtimeWidget();
        if (
          !wantsPlayback &&
          ((mode === "airtime" && source !== "airtime") ||
            (mode === "twitch" && !twitchLive))
        )
          mode = "idle";
        renderStatus();
        if (
          (mode === "live" || mode === "twitch" || mode === "airtime") &&
          (mode === "twitch"
            ? source !== "twitch"
            : mode === "airtime"
              ? source !== "airtime" || audio.src !== airtimeStream
              : source !== "azura" || audio.src !== stream) &&
          wantsPlayback &&
          !introPlaying
        ) {
          clearAirtimeWidget();
          audio.pause();
          silenceTwitch();
          mode = "idle";
          startPlayback(false);
        }
        setTimeout(() => {
          if (!document.hidden || wantsPlayback) status();
          else
            document.addEventListener("visibilitychange", () => status(), {
              once: true,
            });
        }, 30000);
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
                height: "100%",
                parent: [location.hostname],
                autoplay: true,
                muted: true,
              });
              twitch.addEventListener(Twitch.Player.READY, () => {
                clearTimeout(timer);
                twitchInitialized = true;
                updateTwitchVisibility();
                // Muted autoplay needs no gesture, so the player starts buffering the
                // live stream right away and unmuting later stays instant.
                try {
                  twitch.play();
                } catch {}
                // A PLAY press that arrived while the embed was still loading.
                if (mode === "twitch" && twitchPlaying) {
                  unmuteTwitch();
                  ensureTwitchAudio();
                }
                resolve(twitch);
              });
              // Reflect playback the user starts from the small player itself.
              twitch.addEventListener(Twitch.Player.PLAYING, () => {
                // Muted autoplay is buffering, not a request to select live audio.
                if (!twitchLive || !twitchAudible()) return;
                if (mode !== "twitch") {
                  operation++;
                  audio.pause();
                  if (archiveWidget) archiveWidget.pause();
                  archiveWidgetPlaying = false;
                  document.dispatchEvent(new Event("radio-play"));
                  mode = "twitch";
                }
                twitchPlaying = true;
                wantsPlayback = true;
                pending = false;
                renderStatus();
                playbackUI();
              });
              twitch.addEventListener(Twitch.Player.PAUSE, () => {
                // PAUSE is a real pause, never a buffering signal.
                if (mode !== "twitch") return;
                twitchPlaying = false;
                wantsPlayback = false;
                message.textContent = copy(
                  "player.twitch.paused",
                  "Live audio paused. Press PLAY to resume.",
                );
                playbackUI();
              });
              twitch.addEventListener(Twitch.Player.PLAYBACK_BLOCKED, () => {
                if (mode === "twitch" && wantsPlayback) {
                  revealTwitchControls();
                  message.textContent = copy(
                    "player.twitch.retry",
                    "Press play in the Twitch player to start live audio.",
                  );
                }
              });
              twitch.addEventListener(Twitch.Player.ONLINE, () => {
                twitchEmbedLive = true;
                applyTwitchLive();
              });
              twitch.addEventListener(Twitch.Player.OFFLINE, () => {
                twitchEmbedLive = false;
                applyTwitchLive();
              });
            } catch {
              fail();
            }
          };
          document.head.append(script);
        });
        return twitchReady;
      }
      let introPlaying = false;
      let introStarted = false;
      let cancelIntro = null;
      let skipIntro = null;
      function playIntro(attempt) {
        if (cancelIntro) cancelIntro();
        if (attempt !== operation) return Promise.resolve(false);
        if (introStarted) return Promise.resolve(true);
        introStarted = true;
        introPlaying = true;
        audio.src = "/assets/audio/hfg%20radio%20jingle.mp3";
        renderStatus();
        return new Promise((resolve) => {
          let settled = false;
          const finish = (ok) => {
            if (settled) return;
            settled = true;
            audio.removeEventListener("ended", ended);
            audio.removeEventListener("error", failed);
            introPlaying = false;
            cancelIntro = null;
            skipIntro = null;
            renderStatus();
            resolve(ok && attempt === operation);
          };
          const ended = () => finish(true);
          // A missing intro must not prevent the selected recording from starting.
          const failed = () => finish(true);
          cancelIntro = () => finish(false);
          skipIntro = () => {
            audio.pause();
            finish(true);
          };
          audio.addEventListener("ended", ended);
          audio.addEventListener("error", failed);
          audio.play().catch(failed);
        });
      }
      async function playWithIntro(url, attempt) {
        if (!(await playIntro(attempt))) return;
        audio.src = url;
        await audio.play();
      }
      async function startPlayback(userClick = true) {
        clearAirtimeWidget();
        const attempt = ++operation;
        wantsPlayback = true;
        pending = true;
        playbackUI();
        try {
          if (!statusLoaded && !hasLiveSource()) await initialStatus;
          if (attempt !== operation) return;
          // If neither source has reported yet, give the embed a moment so a live
          // broadcast is not mistaken for the off-air ident.
          if (twitchApiLive === null && twitchEmbedLive === null) {
            await Promise.race([
              twitchStatusKnown,
              new Promise((resolve) => setTimeout(resolve, 3000)),
            ]);
            if (attempt !== operation) return;
          }
          audio.pause();
          if (archiveWidget) archiveWidget.pause();
          archiveWidgetPlaying = false;
          if (!twitchLive) silenceTwitch();
          if (stream) {
            silenceTwitch();
            mode = "live";
            renderStatus();
            await playWithIntro(stream, attempt);
          } else if (twitchLive) {
            mode = "twitch";
            renderStatus();
            const player = twitchInitialized ? twitch : await initTwitch();
            if (attempt !== operation) return;
            commandTwitch(true);
          } else if (airtimeStream) {
            silenceTwitch();
            mode = "airtime";
            renderStatus();
            await playWithIntro(airtimeStream, attempt);
          } else if (twitchApiLive === null && twitchEmbedLive === null) {
            throw Error("Live status is still unknown");
          } else {
            await nextRecording(true);
          }
        } catch (error) {
          if (attempt === operation) {
            pending = false;
            await nextRecording(true);
          }
        } finally {
          if (attempt === operation) {
            if (mode !== "twitch") pending = false;
            playbackUI();
          }
        }
      }
      async function nextRecording(latest = false, shuffleTracks = false) {
        const attempt = ++operation;
        stopOtherSources();
        // Leave embed mode before closing its panel, so archive-close cannot cancel
        // this new playback operation while the feed is loading.
        mode = "archive";
        archiveWidget = null;
        document.dispatchEvent(new Event("radio-play"));
        wantsPlayback = true;
        pending = true;
        playbackUI();
        try {
          let track;
          if (latest === true) {
            // The archive endpoint returns recordings newest first.
            track = (await archive()).find((post) => post.audio_url);
          } else if (shuffleTracks) {
            if (!queue.length) {
              queue = (await archive()).filter((p) => p.audio_url).slice();
              for (let i = queue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [queue[i], queue[j]] = [queue[j], queue[i]];
              }
            }
            if (attempt !== operation) return;
            track = queue.pop();
          } else {
            const recordings = (await archive()).filter(
              (post) => post.audio_url,
            );
            const index = recordings.findIndex(
              (post) =>
                (currentRecording?.id && post.id === currentRecording.id) ||
                (currentRecording?.audio_url &&
                  post.audio_url === currentRecording.audio_url) ||
                (currentRecording?.permalink_url &&
                  post.permalink_url === currentRecording.permalink_url),
            );
            track = recordings[(index + 1) % recordings.length];
          }
          if (attempt !== operation) return;
          if (!track) throw Error("empty");
          showRecording(track);
          renderStatus();
          await playWithIntro(track.audio_url, attempt);
        } catch {
          if (attempt === operation) {
            archivePromise = null;
            recordingStatus(
              copy(
                "archive.retry",
                "Archive unavailable. Press PLAY to retry.",
              ),
            );
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
          if (introPlaying) {
            operation++;
            wantsPlayback = false;
            pending = false;
            stopOtherSources();
            if (mode !== "embed") mode = "idle";
            renderStatus();
            playbackUI();
            return;
          }
          if (mode === "embed" && archiveWidget) {
            wantsPlayback = !archiveWidgetPlaying;
            if (archiveWidgetPlaying) archiveWidget.pause();
            else archiveWidget.play();
            return;
          }
          if (
            twitchInitialized &&
            (mode === "twitch" || (mode === "idle" && twitchLive && !stream))
          ) {
            toggleTwitch();
            return;
          }
          // A paused recording must not take priority over an available live show.
          if (
            hasLiveSource() &&
            !pending &&
            ((["archive", "ident"].includes(mode) && audio.paused) ||
              (mode === "embed" && !archiveWidgetPlaying))
          ) {
            if (twitchLive && !stream && twitchInitialized) commandTwitch(true);
            else startPlayback(true);
            return;
          }
          if (mode === "embed") {
            if (archiveWidget) archiveWidget.toggle();
            else
              recordingStatus(
                copy(
                  "archive.widget.hint",
                  "Use PLAY in the SoundCloud player below.",
                ),
              );
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
            audio
              .play()
              .catch(() =>
                recordingStatus(
                  copy("player.retry.short", "Press PLAY to retry."),
                ),
              );
            return;
          }
          document.dispatchEvent(new Event("radio-play"));
          startPlayback(true);
        });
        audio.addEventListener("ended", () => {
          if (introPlaying) return;
          if (mode === "archive" || mode === "ident") nextRecording();
          else playbackUI();
        });
        if (next)
          next.addEventListener("click", () => {
            if (introPlaying && skipIntro) {
              skipIntro();
              return;
            }
            if (["archive", "ident", "embed"].includes(mode)) nextRecording();
          });
        for (const event of ["playing", "pause"])
          audio.addEventListener(event, playbackUI);
        for (const event of [
          "timeupdate",
          "loadedmetadata",
          "durationchange",
          "emptied",
        ])
          audio.addEventListener(event, updateProgress);
        audio.addEventListener("error", () => {
          if (introPlaying) return;
          pending = false;
          if (mode === "archive" || mode === "ident")
            recordingStatus(
              copy(
                "archive.audio.error",
                "Audio unavailable. Press PLAY to retry.",
              ),
            );
          else if ((mode === "airtime" || mode === "live") && wantsPlayback)
            nextRecording(true);
          playbackUI();
        });
        shuffle.addEventListener("click", () => nextRecording(false, true));
        const chat = document.getElementById("radioChat");
        if (chat) {
          let pendingChatOpen = false;
          const chatButton = document.getElementById("chatButton");
          const openChat = (forceInternal = false) => {
            if (!forceInternal && window.innerWidth <= 700) {
              window.open(
                "https://hfgstation.chatango.com/",
                "_blank",
                "noopener",
              );
              return;
            }
            const frame = chat.querySelector("iframe");
            if (!frame.getAttribute("src")) frame.src = frame.dataset.src;
            if (chat.open) {
              chat.close();
              return;
            }
            chat.show();
            chatButton.setAttribute("aria-expanded", "true");
            chat.scrollIntoView({
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
              block: "start",
            });
          };
          chatButton.addEventListener("click", () => {
            if (!document.body.classList.contains("home")) {
              pendingChatOpen = true;
              document.querySelector('nav a[href="/"]')?.click();
              return;
            }
            openChat();
          });
          document.addEventListener("page-change", () => {
            if (!pendingChatOpen || !document.body.classList.contains("home"))
              return;
            pendingChatOpen = false;
            openChat(true);
          });
          document
            .getElementById("closeChat")
            .addEventListener("click", () => chat.close());
          chat.addEventListener("close", () =>
            chatButton.setAttribute("aria-expanded", "false"),
          );
        }
      }
      // ── Artwork carousel: bounded textures, compositor animation, no frame loop ──
      const marquee = document.getElementById("archiveMarquee");
      let carouselStarted = false;
      const startCarousel = async () => {
        if (
          !marquee ||
          carouselStarted ||
          !document.body.classList.contains("home")
        )
          return;
        carouselStarted = true;
        const strip = marquee.parentElement;
        strip.tabIndex = 0;
        let cycle = 0,
          duration = 1,
          styleTag = null,
          pointer = null,
          startX = 0,
          startTranslate = 0,
          resumeTimer;
        let visible = false,
          interacting = false,
          running = false;
        const currentX = () => {
          const value = getComputedStyle(marquee).transform;
          const match = value === "none" ? null : /matrix\(([^)]+)\)/.exec(value);
          return match ? parseFloat(match[1].split(",")[4]) || 0 : 0;
        };
        const phaseDelay = () => {
          const px = (((-currentX() % cycle) + cycle) % cycle);
          return (px / cycle) * duration;
        };
        // One generated CSS animation per measured loop keeps the moving surface
        // engine-agnostic: no Web Animations API, no per-frame JavaScript.
        const ensureAnimation = () => {
          const delay = phaseDelay();
          if (styleTag) styleTag.remove();
          styleTag = document.createElement("style");
          styleTag.textContent =
            `@keyframes archive-scroll-${cycle} { to { transform: translate3d(${-cycle}px,0,0); } }`;
          document.head.append(styleTag);
          marquee.style.transform = "";
          marquee.style.animation = `archive-scroll-${cycle} ${duration}ms linear ${-delay}ms infinite`;
          marquee.style.animationPlayState = running ? "running" : "paused";
        };
        const sync = () => {
          running =
            !document.hidden &&
            visible &&
            document.body.classList.contains("home") &&
            !interacting;
          if (marquee.style.animation && marquee.style.animation !== "none")
            marquee.style.animationPlayState = running ? "running" : "paused";
        };
        const hold = (translateX) => {
          marquee.style.animation = "none";
          marquee.style.transform = `translate3d(${translateX}px,0,0)`;
        };
        try {
          const items = (await archive())
            .filter((item) => item.artwork_url)
            .slice(0, 12);
          if (!items.length) return;
          const available = items.slice();
          while (items.length < 12)
            items.push(available[items.length % available.length]);
          const fragment = document.createDocumentFragment();
          // Keep the moving surface bounded regardless of archive size.
          for (let repeat = 0; repeat < 2; repeat++)
            for (const item of items) {
              const image = document.createElement("img");
              image.src = item.artwork_url.replace(
                /-(?:large|t500x500|original)(?=\.)/,
                "-t200x200",
              );
              image.alt = repeat ? "" : item.title;
              image.width = image.height = 130;
              image.decoding = "async";
              image.draggable = false;
              image.fetchPriority = "low";
              if (repeat) image.setAttribute("aria-hidden", "true");
              fragment.append(image);
            }
          marquee.append(fragment);
          const measure = () => {
            const first = marquee.firstElementChild,
              second = marquee.children[items.length];
            const nextCycle = second.offsetLeft - first.offsetLeft;
            if (!nextCycle || nextCycle === cycle) return;
            cycle = nextCycle;
            duration = (cycle / 32) * 1000;
            ensureAnimation();
            sync();
          };
          new ResizeObserver(measure).observe(strip);
          new IntersectionObserver((entries) => {
            visible = entries[0].isIntersecting;
            sync();
          }).observe(strip);
          document.addEventListener("visibilitychange", sync);
          document.addEventListener("page-change", () => {
            measure();
            sync();
          });
          const resume = () => {
            pointer = null;
            strip.classList.remove("is-dragging");
            clearTimeout(resumeTimer);
            resumeTimer = setTimeout(() => {
              interacting = false;
              ensureAnimation();
              sync();
            }, 1800);
          };
          strip.addEventListener("pointerdown", (event) => {
            if (!cycle || (event.pointerType === "mouse" && event.button !== 0))
              return;
            clearTimeout(resumeTimer);
            interacting = true;
            sync();
            pointer = event.pointerId;
            startX = event.clientX;
            startTranslate = currentX();
            hold(startTranslate);
            if (event.isTrusted) strip.setPointerCapture(pointer);
            strip.classList.add("is-dragging");
          });
          strip.addEventListener("pointermove", (event) => {
            if (event.pointerId !== pointer) return;
            hold(startTranslate - (startX - event.clientX));
          });
          for (const event of [
            "pointerup",
            "pointercancel",
            "lostpointercapture",
          ])
            strip.addEventListener(event, resume);
          strip.addEventListener("keydown", (event) => {
            if (!["ArrowLeft", "ArrowRight"].includes(event.key) || !cycle)
              return;
            event.preventDefault();
            clearTimeout(resumeTimer);
            interacting = true;
            sync();
            hold(currentX() - (event.key === "ArrowRight" ? 140 : -140));
            resume();
          });
          strip.addEventListener(
            "wheel",
            (event) => {
              if (!cycle || Math.abs(event.deltaX) <= Math.abs(event.deltaY))
                return;
              clearTimeout(resumeTimer);
              interacting = true;
              sync();
              hold(currentX() - event.deltaX);
              resume();
            },
            { passive: true },
          );
          measure();
        } catch {
          /* Keep the reserved strip height to avoid a layout jump. */
        }
      };
      introReady.then(startCarousel);
      document.addEventListener("page-change", () =>
        introReady.then(startCarousel),
      );

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
      const initialStatus = introReady.then(status).finally(() => {
        statusLoaded = true;
        document.dispatchEvent(new Event("radio-status-ready"));
      });
      for (const a of document.querySelectorAll("nav a"))
        if (a.pathname === location.pathname)
          a.setAttribute("aria-current", "page");
      window.addEventListener("resize", updateTitleMarquee, { passive: true });
      document.fonts?.ready.then(updateTitleMarquee);
      if (message && typeof ResizeObserver === "function") {
        let titleMeasureFrame = 0;
        new ResizeObserver(() => {
          cancelAnimationFrame(titleMeasureFrame);
          titleMeasureFrame = requestAnimationFrame(updateTitleMarquee);
        }).observe(message);
      }

      document.addEventListener("archive-play", (event) => {
        operation++;
        wantsPlayback = false;
        pending = false;
        stopOtherSources();
        // Selecting an archive recording starts the programme directly. Do not
        // insert the station jingle now or on a later shuffle in this session.
        introStarted = true;
        mode = "embed";
        archiveWidgetDuration = archiveWidgetPosition = 0;
        archiveWidget = null;
        archiveWidgetPlaying = false;
        showRecording(event.detail);
        renderStatus();
        playbackUI();
      });
      document.addEventListener("archive-state", (event) => {
        if (mode !== "embed") return;
        const { state, widget } = event.detail;
        if (widget) archiveWidget = widget;
        if (state === "ready") {
          widget.setVolume(100);
          wantsPlayback = true;
          pending = false;
          widget.play();
          playbackUI();
          return;
        }
        if (state === "playing") {
          // The embedded player's own PLAY must never overlap the native audio.
          if (cancelIntro) cancelIntro();
          audio.pause();
          silenceTwitch();
        }
        archiveWidgetPlaying = state === "playing";
        if (!introPlaying) wantsPlayback = archiveWidgetPlaying;
        recordingStatus(
          {
            playing: copy(
              "player.archive.playing",
              "PLAYING ARCHIVE RECORDING",
            ),
            paused: copy("archive.paused", "Paused \u00b7 Archive"),
            finished: copy("archive.finished", "Finished \u00b7 Archive"),
            error: copy(
              "archive.error",
              "Archive unavailable \u00b7 Try another recording",
            ),
            unavailable: copy(
              "archive.selected",
              "Archive selected \u00b7 Use the SoundCloud player",
            ),
          }[state] || copy("archive.title", "Archive"),
        );
        playbackUI();
      });
      document.addEventListener("archive-progress", (event) => {
        if (mode !== "embed" || event.detail.widget !== archiveWidget) return;
        const { duration, position } = event.detail;
        if (Number.isFinite(duration) && duration > 0)
          archiveWidgetDuration = duration / 1000;
        if (Number.isFinite(position))
          archiveWidgetPosition = Math.max(0, position / 1000);
        updateProgress();
      });
      document.addEventListener("archive-close", () => {
        if (mode !== "embed") return;
        operation++;
        if (cancelIntro) cancelIntro();
        audio.pause();
        archiveWidget = null;
        archiveWidgetPlaying = false;
        mode = "idle";
        renderStatus();
        playbackUI();
      });

      // Keep the video collapsed unless requested or needed to unlock playback.
      function updateTwitchVisibility() {
        const dock = document.querySelector(".twitch-dock");
        if (dock) dock.hidden = !twitchDockEnabled || !twitchVideoVisible;
        const toggle = document.getElementById("toggleTwitchVideo");
        if (toggle) {
          toggle.hidden = !twitchDockEnabled;
          toggle.textContent = twitchVideoVisible ? "HIDE VIDEO" : "SHOW VIDEO";
          toggle.setAttribute(
            "aria-expanded",
            String(twitchDockEnabled && twitchVideoVisible),
          );
        }
      }

      document
        .getElementById("headerListenLive")
        ?.addEventListener("click", () => {
          if (twitchLive && !stream && twitchInitialized) commandTwitch(true);
          else {
            stopOtherSources();
            document.dispatchEvent(new Event("radio-play"));
            mode = "idle";
            startPlayback(true);
          }
        });
      document.addEventListener("page-change", updateTwitchVisibility);

      // Text wrappers survive changing PLAY/STOP labels and asynchronously loaded links.
      function prepareHoverLabels(root) {
        if (root.nodeType === Node.TEXT_NODE) {
          if (
            !root.textContent.trim() ||
            !root.parentElement?.closest("a, button") ||
            root.parentElement.closest(
              ".hover-label, .chat-label, svg, script, style",
            )
          )
            return;
          const label = document.createElement("span");
          label.className = "hover-label";
          root.replaceWith(label);
          label.append(root);
          return;
        }
        if (
          root.nodeType !== Node.ELEMENT_NODE ||
          root.closest(".hover-label, .chat-label, svg, script, style")
        )
          return;
        for (const child of [...root.childNodes]) prepareHoverLabels(child);
      }
      for (const control of document.querySelectorAll("a,button"))
        prepareHoverLabels(control);
      document.addEventListener(
        "pointerover",
        (event) => {
          const control = event.target.closest("a,button");
          if (control) prepareHoverLabels(control);
        },
        { passive: true },
      );
      document.addEventListener("focusin", (event) => {
        const control = event.target.closest("a,button");
        if (control) prepareHoverLabels(control);
      });

      // Animate once per trusted click, after synchronous label replacements.
      // Navigation and media keep their original user activation; no replayed clicks.
      const tapAnimations = new WeakMap();
      document.addEventListener(
        "click",
        (event) => {
          if (
            !matchMedia("(hover: none), (pointer: coarse)").matches ||
            matchMedia("(prefers-reduced-motion: reduce)").matches
          )
            return;
          const control = event.target.closest("a, button");
          if (!control || control.disabled) return;
          requestAnimationFrame(() => {
            if (!control.isConnected) return;
            prepareHoverLabels(control);
            for (const label of control.querySelectorAll(
              ".hover-label, .chat-label, text",
            )) {
              tapAnimations.get(label)?.cancel();
              if (typeof label.animate !== "function") continue;
              tapAnimations.set(
                label,
                label.animate(
                  [
                    { transform: "scaleX(1)" },
                    { transform: "scaleX(1.3)", offset: 0.5 },
                    { transform: "scaleX(1)" },
                  ],
                  { duration: 360, easing: "ease-in-out" },
                ),
              );
            }
          });
        },
        true,
      );

      document
        .getElementById("toggleTwitchVideo")
        ?.addEventListener("click", () => {
          twitchVideoVisible = !twitchVideoVisible;
          if (twitchVideoVisible) initTwitch().catch(() => {});
          updateTwitchVisibility();
        });

      Object.assign(window.HFG, { fetchJSON, pageTask, archive, yieldTask });
    },
    { once: true },
  );
})();

