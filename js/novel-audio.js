/* Chapter audio queue: keep the same <audio> element so iOS Safari can
   auto-advance after the reader taps play once. Full page loads kill playback. */
(function (root) {
  "use strict";

  function findIndex(queue, n) {
    var i, nn = Number(n);
    for (i = 0; i < queue.length; i++) {
      if (Number(queue[i].n) === nn) return i;
    }
    return -1;
  }

  function nextIndex(i, len, autonext) {
    if (!autonext) return -1;
    if (i < 0) return -1;
    var n = i + 1;
    return n < len ? n : -1;
  }

  function prevIndex(i) {
    if (i <= 0) return -1;
    return i - 1;
  }

  function parseQueue(raw) {
    if (!raw) return [];
    try {
      var q = JSON.parse(raw);
      return Array.isArray(q) ? q : [];
    } catch (e) {
      return [];
    }
  }

  function pathOf(u, origin) {
    try {
      var href = new URL(u, origin || "https://hoang.tech").pathname;
      return href.replace(/\/+$/, "") || "/";
    } catch (e) {
      return String(u || "").replace(/\/+$/, "") || "/";
    }
  }

  function absUrl(u) {
    try {
      return new URL(u, root.location ? root.location.href : "https://hoang.tech/").href;
    } catch (e) {
      return u;
    }
  }

  var KEY = "hoang.tech:audio-autonext";

  function readAutonext() {
    try {
      var v = root.localStorage && root.localStorage.getItem(KEY);
      if (v === "0") return false;
      if (v === "1") return true;
    } catch (e) {}
    return true;
  }

  function writeAutonext(on) {
    try {
      if (root.localStorage) root.localStorage.setItem(KEY, on ? "1" : "0");
    } catch (e) {}
  }

  function init(opts) {
    opts = opts || {};
    var doc = root.document;
    if (!doc) return;

    var audio = doc.querySelector(".chapter-audio");
    var wrap = doc.querySelector(".chapter-audio-wrap");
    var jsonEl = doc.getElementById("novel-audio-queue");
    if (!audio || !wrap || !jsonEl) return;

    var queue = parseQueue(jsonEl.textContent);
    if (!queue.length) return;

    var idx = findIndex(queue, opts.chapter);
    if (idx < 0) idx = 0;

    var label = wrap.querySelector(".chapter-audio-label");
    var dl = wrap.querySelector(".chapter-audio-dl");
    var box = wrap.querySelector("#chapter-autonext");
    var art = doc.getElementById("novel-chapter");
    var gen = 0;
    var pendingSwap = null;
    var prefetchEl = doc.createElement("audio");
    prefetchEl.preload = "auto";

    audio.setAttribute("playsinline", "");
    audio.setAttribute("webkit-playsinline", "");

    if (box) {
      box.checked = readAutonext();
      box.addEventListener("change", function () {
        writeAutonext(box.checked);
      });
    }

    function autonextOn() {
      return box ? box.checked : true;
    }

    function applyChrome(item) {
      if (!item) return;
      if (label) label.textContent = item.title;
      if (dl) dl.setAttribute("href", item.src);
      if (art) {
        art.setAttribute("data-chapter", String(item.n));
        art.setAttribute("data-chapter-title", item.title);
        art.setAttribute("data-chapter-url", item.url);
      }
      var idxEl = doc.querySelector(".reading-idx");
      if (idxEl && opts.total) {
        idxEl.textContent = "Chương " + item.n + " / " + opts.total;
      }
      if (doc.title && item.title) doc.title = item.title;
      try {
        if (root.history && root.history.replaceState) {
          /* keep URL in sync without a navigation that would stop audio */
        }
      } catch (e) {}
      applyMediaSession(item);
      if (typeof root.CustomEvent === "function") {
        doc.dispatchEvent(new root.CustomEvent("novel:chapter", { detail: item }));
      }
    }

    function applyMediaSession(item) {
      var ms = root.navigator && root.navigator.mediaSession;
      if (!ms || typeof root.MediaMetadata !== "function") return;
      var artwork = [];
      if (opts.cover) {
        artwork.push({ src: absUrl(opts.cover), sizes: "512x512", type: "image/webp" });
      }
      ms.metadata = new root.MediaMetadata({
        title: item.title,
        artist: opts.novelTitle || "",
        album: opts.novelTitle || "",
        artwork: artwork
      });
      try {
        if (audio.duration && isFinite(audio.duration)) {
          ms.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate || 1,
            position: audio.currentTime || 0
          });
        }
      } catch (e) {}
    }

    function bindMediaActions() {
      var ms = root.navigator && root.navigator.mediaSession;
      if (!ms || !ms.setActionHandler) return;
      try {
        ms.setActionHandler("nexttrack", function () {
          var n = idx + 1;
          if (n < queue.length) playAt(n, { keepPlaying: true, history: "replace" });
        });
        ms.setActionHandler("previoustrack", function () {
          var p = prevIndex(idx);
          if (p >= 0) playAt(p, { keepPlaying: true, history: "replace" });
        });
        ms.setActionHandler("seekto", function (d) {
          if (d && isFinite(d.seekTime)) audio.currentTime = d.seekTime;
        });
      } catch (e) {}
    }

    function prefetchNext() {
      var n = idx + 1;
      if (n >= queue.length) return;
      try {
        prefetchEl.src = queue[n].src;
      } catch (e) {}
    }

    function playAt(i, why) {
      var item = queue[i];
      if (!item) return;
      idx = i;
      why = why || {};
      var nextSrc = absUrl(item.src);
      if (audio.src !== nextSrc) {
        audio.src = item.src;
      }
      if (why.keepPlaying) {
        var p = audio.play();
        if (p && typeof p.catch === "function") p.catch(function () {});
      }
      applyChrome(item);
      if (why.swap !== false) {
        swapChapter(item, {
          push: why.history === "push",
          replace: why.history === "replace"
        });
      }
      prefetchNext();
    }

    function swapChapter(item, hist) {
      hist = hist || {};
      if (!item || !item.url) return;
      var here = pathOf(root.location.pathname, root.location.origin);
      if (here === pathOf(item.url, root.location.origin)) {
        pendingSwap = null;
        return;
      }
      /* iOS may pause background audio if we rewrite the page while locked */
      if (doc.visibilityState === "hidden") {
        pendingSwap = { item: item, hist: hist };
        return;
      }
      pendingSwap = null;
      var my = ++gen;
      fetch(item.url, { credentials: "same-origin" })
        .then(function (r) {
          if (!r.ok) throw new Error("fetch " + r.status);
          return r.text();
        })
        .then(function (html) {
          if (my !== gen) return;
          var parsed = new root.DOMParser().parseFromString(html, "text/html");
          var nextRoot = parsed.getElementById("novel-chapter");
          if (!nextRoot) return;

          var titleEl = doc.querySelector(".chapter-title");
          var nextTitle = nextRoot.querySelector(".chapter-title");
          if (titleEl && nextTitle) titleEl.textContent = nextTitle.textContent;

          var prose = doc.querySelector("#novel-chapter .prose");
          var nextProse = nextRoot.querySelector(".prose");
          if (prose && nextProse) prose.innerHTML = nextProse.innerHTML;

          var nav = doc.querySelector(".chapter-nav");
          var nextNav = nextRoot.querySelector(".chapter-nav");
          if (nav && nextNav) nav.innerHTML = nextNav.innerHTML;

          var curFig = doc.querySelector("#novel-chapter .chapter-art");
          var nextFig = nextRoot.querySelector(".chapter-art");
          if (nextFig) {
            if (curFig) {
              curFig.innerHTML = nextFig.innerHTML;
              curFig.removeAttribute("hidden");
            } else if (titleEl && titleEl.parentNode) {
              titleEl.parentNode.insertBefore(nextFig.cloneNode(true), titleEl.nextSibling);
            }
          } else if (curFig) {
            curFig.parentNode.removeChild(curFig);
          }

          var thread = doc.getElementById("cusdis_thread");
          var nextThread = nextRoot.querySelector("#cusdis_thread");
          if (thread && nextThread) {
            thread.setAttribute("data-page-id", nextThread.getAttribute("data-page-id") || "");
            thread.setAttribute("data-page-url", nextThread.getAttribute("data-page-url") || "");
            thread.setAttribute("data-page-title", nextThread.getAttribute("data-page-title") || "");
            thread.innerHTML = "";
            if (root.CUSDIS && typeof root.CUSDIS.render === "function") {
              try { root.CUSDIS.render(); } catch (e) {}
            }
          }

          if (root.history) {
            if (hist.replace && root.history.replaceState) {
              root.history.replaceState({ n: item.n }, item.title, item.url);
            } else if (hist.push && root.history.pushState) {
              root.history.pushState({ n: item.n }, item.title, item.url);
            }
          }

          if (root.document.visibilityState !== "hidden") {
            var topEl = doc.querySelector(".chapter-title") || art;
            if (topEl && topEl.scrollIntoView) {
              topEl.scrollIntoView({ block: "start" });
            }
          }
        })
        .catch(function () {});
    }

    audio.addEventListener("ended", function () {
      var n = nextIndex(idx, queue.length, autonextOn());
      if (n < 0) return;
      /* play() must run in this turn or iOS drops the user-gesture chain */
      playAt(n, { keepPlaying: true, history: "replace" });
    });

    audio.addEventListener("playing", prefetchNext);
    audio.addEventListener("play", function () {
      applyMediaSession(queue[idx]);
    });
    audio.addEventListener("timeupdate", function () {
      var ms = root.navigator && root.navigator.mediaSession;
      if (!ms || !ms.setPositionState) return;
      if (!audio.duration || !isFinite(audio.duration)) return;
      if (audio.currentTime % 5 > 0.4) return;
      try {
        ms.setPositionState({
          duration: audio.duration,
          playbackRate: audio.playbackRate || 1,
          position: audio.currentTime
        });
      } catch (e) {}
    });

    var nav = doc.querySelector(".chapter-nav");
    if (nav) {
      nav.addEventListener("click", function (e) {
        var a = e.target && e.target.closest ? e.target.closest("a.cn-link") : null;
        if (!a || !a.getAttribute("href")) return;
        if (audio.paused) return;
        var targetPath = pathOf(a.getAttribute("href"), root.location.origin);
        var i;
        for (i = 0; i < queue.length; i++) {
          if (pathOf(queue[i].url, root.location.origin) === targetPath) {
            e.preventDefault();
            playAt(i, { keepPlaying: true, history: "push" });
            return;
          }
        }
      });
    }

    doc.addEventListener("visibilitychange", function () {
      if (doc.visibilityState !== "visible" || !pendingSwap) return;
      var held = pendingSwap;
      pendingSwap = null;
      swapChapter(held.item, held.hist);
    });

    root.addEventListener("popstate", function () {
      var here = pathOf(root.location.pathname, root.location.origin);
      var i;
      for (i = 0; i < queue.length; i++) {
        if (pathOf(queue[i].url, root.location.origin) === here) {
          playAt(i, { keepPlaying: !audio.paused, history: "none" });
          return;
        }
      }
    });

    bindMediaActions();
    applyChrome(queue[idx]);
    prefetchNext();
  }

  var api = {
    findIndex: findIndex,
    nextIndex: nextIndex,
    prevIndex: prevIndex,
    parseQueue: parseQueue,
    pathOf: pathOf,
    init: init
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.hoangNovelAudio = api;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
