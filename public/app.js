// SidelineReel — Reel Editor prototype
// Video sources are short soccer clips (Mixkit License — free for
// commercial/personal use, no attribution required) bundled locally in
// videos/, standing in for real per-play highlight clips.

const CLIPS = [
  {
    id: "c1",
    label: "Goal — 2nd Half",
    jersey: 14,
    src: "videos/soccer_43499.mp4",
    thumb: "⚽",
  },
  {
    id: "c2",
    label: "Assist to #9",
    jersey: 14,
    src: "videos/soccer_43481.mp4",
    thumb: "🎯",
  },
  {
    id: "c3",
    label: "Defensive Tackle",
    jersey: 14,
    src: "videos/soccer_43483.mp4",
    thumb: "🛡️",
  },
  {
    id: "c4",
    label: "Corner Kick Header",
    jersey: 14,
    src: "videos/soccer_43495.mp4",
    thumb: "🙌",
  },
  {
    id: "c5",
    label: "Breakaway Run",
    jersey: 4, // mismatch: this reel belongs to #14 — this clip is actually #4
    src: "videos/soccer_43484.mp4",
    thumb: "🏃",
  },
];

const STORAGE_KEY = "sidelinereel_reel_editor_v1";
const REEL_OWNER_JERSEY = 14;

function defaultState() {
  const clips = {};
  CLIPS.forEach((c) => {
    clips[c.id] = { included: true, trim: null, flagged: false };
  });
  return { clips };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed.clips) return defaultState();
    return parsed;
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let selectedClipId = null;
let flagConfirmId = null;
let reelPlaylist = [];
let reelIndex = -1;

const clipListEl = document.getElementById("clipList");
const clipCountEl = document.getElementById("clipCount");
const mainVideo = document.getElementById("mainVideo");
const videoLabel = document.getElementById("videoLabel");
const editorPanel = document.getElementById("editorPanel");
const editorClipLabel = document.getElementById("editorClipLabel");
const editorClipMeta = document.getElementById("editorClipMeta");
const trimStart = document.getElementById("trimStart");
const trimEnd = document.getElementById("trimEnd");
const trimStartVal = document.getElementById("trimStartVal");
const trimEndVal = document.getElementById("trimEndVal");
const flaggedSection = document.getElementById("flaggedSection");
const flaggedList = document.getElementById("flaggedList");
const toastEl = document.getElementById("toast");

function fmt(sec) {
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function showToast(msg, ms = 3200) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toastEl.hidden = true), ms);
}

function clipState(id) {
  return state.clips[id];
}

function renderClipList() {
  clipListEl.innerHTML = "";
  let includedCount = 0;

  CLIPS.forEach((clip) => {
    const cs = clipState(clip.id);
    if (cs.included) includedCount++;

    const card = document.createElement("div");
    card.className = "clip-card";
    if (clip.id === selectedClipId) card.classList.add("selected");
    if (!cs.included) card.classList.add("excluded");
    if (clip.jersey !== REEL_OWNER_JERSEY) card.classList.add("suspect");

    const top = document.createElement("div");
    top.className = "clip-card-top";

    const check = document.createElement("button");
    check.className = "check-toggle" + (cs.included ? " checked" : "");
    check.textContent = "✓";
    check.title = cs.included ? "Remove from reel" : "Add to reel";
    check.addEventListener("click", (e) => {
      e.stopPropagation();
      cs.included = !cs.included;
      saveState();
      renderClipList();
    });

    const thumb = document.createElement("span");
    thumb.className = "clip-thumb";
    thumb.textContent = clip.thumb;

    const label = document.createElement("span");
    label.className = "clip-label";
    label.textContent = clip.label;

    const flagBtn = document.createElement("button");
    flagBtn.className = "flag-btn" + (cs.flagged ? " active" : "");
    flagBtn.textContent = "⚑";
    flagBtn.title = "Flag as wrong player";
    flagBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      flagConfirmId = flagConfirmId === clip.id ? null : clip.id;
      renderClipList();
    });

    top.append(check, thumb, label, flagBtn);
    card.appendChild(top);

    const meta = document.createElement("div");
    meta.className = "clip-card-meta";
    meta.innerHTML = `<span>Jersey #${clip.jersey}</span>`;
    if (cs.trim) {
      const b = document.createElement("span");
      b.className = "badge badge-trimmed";
      b.textContent = `TRIMMED ${fmt(cs.trim.start)}–${fmt(cs.trim.end)}`;
      meta.appendChild(b);
    }
    if (cs.flagged) {
      const b = document.createElement("span");
      b.className = "badge badge-flagged";
      b.textContent = "FLAGGED";
      meta.appendChild(b);
    }
    card.appendChild(meta);

    if (flagConfirmId === clip.id) {
      const confirmBox = document.createElement("div");
      confirmBox.className = "flag-confirm";
      confirmBox.innerHTML = `<p>Flag this clip as showing the wrong player? This gets sent to our team to help fix future reels.</p>`;
      const actions = document.createElement("div");
      actions.className = "flag-confirm-actions";

      const yesBtn = document.createElement("button");
      yesBtn.className = "confirm-yes";
      yesBtn.textContent = "Flag it";
      yesBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        cs.flagged = true;
        flagConfirmId = null;
        saveState();
        renderClipList();
        renderFlaggedSection();
        showToast(`Flagged "${clip.label}" — sent for review.`);
      });

      const noBtn = document.createElement("button");
      noBtn.textContent = "Cancel";
      noBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        flagConfirmId = null;
        renderClipList();
      });

      actions.append(yesBtn, noBtn);
      confirmBox.appendChild(actions);
      card.appendChild(confirmBox);
    }

    card.addEventListener("click", () => selectClip(clip.id));
    clipListEl.appendChild(card);
  });

  clipCountEl.textContent = `${includedCount} of ${CLIPS.length} included`;
  renderFlaggedSection();
}

function renderFlaggedSection() {
  const flagged = CLIPS.filter((c) => clipState(c.id).flagged);
  if (flagged.length === 0) {
    flaggedSection.hidden = true;
    return;
  }
  flaggedSection.hidden = false;
  flaggedList.innerHTML = "";
  flagged.forEach((clip) => {
    const li = document.createElement("li");
    li.innerHTML = `${clip.label}<span class="flagged-meta">Reel owner #${REEL_OWNER_JERSEY} · clip shows #${clip.jersey}</span>`;
    flaggedList.appendChild(li);
  });
}

function selectClip(id) {
  stopReelPlayback();
  selectedClipId = id;
  const clip = CLIPS.find((c) => c.id === id);
  const cs = clipState(id);

  editorPanel.hidden = false;
  videoLabel.classList.add("hidden");
  videoLabel.hidden = true;

  editorClipLabel.textContent = clip.label;
  editorClipMeta.textContent = "Loading…";

  mainVideo.src = clip.src;
  mainVideo.loop = false;
  mainVideo.onloadedmetadata = () => {
    const dur = mainVideo.duration;
    trimStart.max = dur;
    trimEnd.max = dur;
    const start = cs.trim ? cs.trim.start : 0;
    const end = cs.trim ? cs.trim.end : dur;
    trimStart.value = start;
    trimEnd.value = end;
    trimStartVal.textContent = fmt(start) + "s";
    trimEndVal.textContent = fmt(end) + "s";
    editorClipMeta.textContent = `${fmt(start)} – ${fmt(end)} of ${fmt(dur)}`;
    mainVideo.currentTime = start;
  };
  mainVideo.play().catch(() => {});

  renderClipList();
}

trimStart.addEventListener("input", () => {
  const s = parseFloat(trimStart.value);
  if (s >= parseFloat(trimEnd.value)) trimStart.value = trimEnd.value;
  trimStartVal.textContent = fmt(parseFloat(trimStart.value)) + "s";
  mainVideo.currentTime = parseFloat(trimStart.value);
});

trimEnd.addEventListener("input", () => {
  const e = parseFloat(trimEnd.value);
  if (e <= parseFloat(trimStart.value)) trimEnd.value = trimStart.value;
  trimEndVal.textContent = fmt(parseFloat(trimEnd.value)) + "s";
});

document.getElementById("saveTrimBtn").addEventListener("click", () => {
  if (!selectedClipId) return;
  const cs = clipState(selectedClipId);
  cs.trim = {
    start: parseFloat(trimStart.value),
    end: parseFloat(trimEnd.value),
  };
  saveState();
  renderClipList();
  showToast("Trim saved. You can untrim this clip anytime.");
});

document.getElementById("resetTrimBtn").addEventListener("click", () => {
  if (!selectedClipId) return;
  const cs = clipState(selectedClipId);
  cs.trim = null;
  saveState();
  const dur = mainVideo.duration || 100;
  trimStart.value = 0;
  trimEnd.value = dur;
  trimStartVal.textContent = "0.0s";
  trimEndVal.textContent = fmt(dur) + "s";
  mainVideo.currentTime = 0;
  renderClipList();
  showToast("Reverted to the original, untrimmed clip.");
});

document.getElementById("closeEditorBtn").addEventListener("click", () => {
  selectedClipId = null;
  editorPanel.hidden = true;
  videoLabel.hidden = false;
  videoLabel.classList.remove("hidden");
  videoLabel.textContent = "Select a clip to preview, or press Play Reel";
  mainVideo.pause();
  mainVideo.removeAttribute("src");
  mainVideo.load();
  renderClipList();
});

const restoreModal = document.getElementById("restoreModal");

document.getElementById("resetAllBtn").addEventListener("click", () => {
  restoreModal.hidden = false;
});

document.getElementById("restoreCancelBtn").addEventListener("click", () => {
  restoreModal.hidden = true;
});

restoreModal.addEventListener("click", (e) => {
  if (e.target === restoreModal) restoreModal.hidden = true;
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !restoreModal.hidden) restoreModal.hidden = true;
});

document.getElementById("restoreConfirmBtn").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  selectedClipId = null;
  flagConfirmId = null;
  editorPanel.hidden = true;
  videoLabel.hidden = false;
  mainVideo.pause();
  mainVideo.removeAttribute("src");
  restoreModal.hidden = true;
  renderClipList();
  showToast("Restored to defaults — all clips included, no trims or flags.");
});

// --- Compiled reel playback ---

function stopReelPlayback() {
  reelPlaylist = [];
  reelIndex = -1;
  mainVideo.onended = null;
  mainVideo.ontimeupdate = null;
}

function playReel() {
  selectedClipId = null;
  editorPanel.hidden = true;
  renderClipList();

  reelPlaylist = CLIPS.filter((c) => clipState(c.id).included);
  reelIndex = -1;

  if (reelPlaylist.length === 0) {
    videoLabel.hidden = false;
    videoLabel.textContent = "No clips selected — turn at least one clip back on to play the reel.";
    showToast("Your reel is empty. Include at least one clip.");
    return;
  }

  videoLabel.hidden = true;
  playNextInReel();
}

function playNextInReel() {
  reelIndex++;
  if (reelIndex >= reelPlaylist.length) {
    videoLabel.hidden = false;
    videoLabel.textContent = "Reel finished. Press Play Reel to watch again.";
    stopReelPlayback();
    return;
  }

  const clip = reelPlaylist[reelIndex];
  const cs = clipState(clip.id);
  const start = cs.trim ? cs.trim.start : 0;
  const end = cs.trim ? cs.trim.end : null;

  mainVideo.src = clip.src;
  mainVideo.onloadedmetadata = () => {
    mainVideo.currentTime = start;
    mainVideo.play().catch(() => {});
  };
  mainVideo.ontimeupdate = () => {
    const effectiveEnd = end !== null ? end : mainVideo.duration;
    if (mainVideo.currentTime >= effectiveEnd - 0.05) {
      playNextInReel();
    }
  };
}

document.getElementById("playReelBtn").addEventListener("click", playReel);

// --- Share ---

document.getElementById("shareBtn").addEventListener("click", async () => {
  const included = CLIPS.filter((c) => clipState(c.id).included);
  if (included.length === 0) {
    showToast("Your reel is empty. Include at least one clip before sharing.");
    return;
  }

  const shareData = {
    title: "Maya Thompson — #14 Highlight Reel",
    text: "Check out Maya's Week 6 highlight reel from Ridgeline Youth Soccer!",
    url: window.location.href,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (e) {
      // user cancelled the share sheet — no toast needed
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(shareData.url);
    showToast("Link copied — paste it anywhere to share this reel.");
  } catch (e) {
    showToast("Couldn't copy the link automatically. Copy it from your browser's address bar.");
  }
});

// --- Download (manifest) ---

document.getElementById("downloadBtn").addEventListener("click", () => {
  const included = CLIPS.filter((c) => clipState(c.id).included);
  if (included.length === 0) {
    showToast("Your reel is empty. Include at least one clip before downloading.");
    return;
  }

  const manifest = {
    player: "Maya Thompson",
    jersey: REEL_OWNER_JERSEY,
    team: "Ridgeline Youth Soccer",
    generatedAt: new Date().toISOString(),
    clips: included.map((c) => {
      const cs = clipState(c.id);
      return {
        id: c.id,
        label: c.label,
        trim: cs.trim || "original",
      };
    }),
  };

  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "maya-thompson-14-reel-manifest.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  showToast("Reel edits saved. Full video export renders server-side and lands in the app shortly — this prototype downloads the edit manifest.");
});

renderClipList();
