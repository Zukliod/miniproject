// Frontend logic for uploading media, displaying captions, and animating mascot
const API_BASE = window.API_BASE_URL || 'http://localhost:8000';
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const videoPlayer = document.getElementById('videoPlayer');
const audioPlayer = document.getElementById('audioPlayer');
const statusEl = document.getElementById('status');
const captionsEl = document.getElementById('captions');
const handMascot = document.getElementById('handMascot');
const wordSpan = document.getElementById('wordSpan');

let wordData = [];
let wordTimings = [];
let mediaDuration = 0;
let lastActiveIndex = -1;

function resetState() {
  captionsEl.innerHTML = '';
  wordSpan.textContent = '-';
  wordData = [];
  wordTimings = [];
  lastActiveIndex = -1;
  document.querySelectorAll('.word').forEach(w => w.classList.remove('active'));
}

function showMedia(file) {
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video');
  if (isVideo) {
    videoPlayer.src = url;
    videoPlayer.classList.remove('hidden');
    audioPlayer.classList.add('hidden');
  } else {
    audioPlayer.src = url;
    audioPlayer.classList.remove('hidden');
    videoPlayer.classList.add('hidden');
  }
}

function buildCaptions(words) {
  captionsEl.innerHTML = '';
  words.forEach(obj => {
    const span = document.createElement('span');
    span.textContent = obj.w;
    span.dataset.index = obj.i;
    span.className = 'word';
    captionsEl.appendChild(span);
    captionsEl.appendChild(document.createTextNode(' '));
  });
}

function mapWordToPose(word) {
  // Simplistic mapping: choose a finger to highlight based on first character a-e else random
  const first = word[0] || 'a';
  const map = { a: 'finger1', b: 'finger2', c: 'finger3', d: 'finger4', e: 'thumb' };
  return map[first] || ['finger1','finger2','finger3','finger4','thumb'][Math.floor(Math.random()*5)];
}

function clearPose() {
  handMascot.querySelectorAll('.part').forEach(p => p.classList.remove('highlight'));
}

function applyPose(partId) {
  clearPose();
  const el = document.getElementById(partId);
  if (el) el.classList.add('highlight');
}

function updateCurrentWord(index) {
  document.querySelectorAll('.word').forEach(w => w.classList.remove('active'));
  const span = captionsEl.querySelector(`.word[data-index="${index}"]`);
  if (span) span.classList.add('active');
  const data = wordData[index];
  if (data) {
    wordSpan.textContent = data.w;
    const posePart = mapWordToPose(data.w);
    applyPose(posePart);
  }
}

function extractDuration() {
  const el = !videoPlayer.classList.contains('hidden') ? videoPlayer : audioPlayer;
  mediaDuration = el.duration || 0;
}

function computeWordTimings() {
  // Compute even timings across mediaDuration; fallback if unknown
  const fallbackWordSpan = 0.6;
  const total = (isFinite(mediaDuration) && mediaDuration > 0)
    ? mediaDuration
    : (wordData.length * fallbackWordSpan);
  const perWord = total / Math.max(wordData.length, 1);
  wordTimings = wordData.map((obj, i) => ({
    i,
    w: obj.w,
    start: i * perWord,
    end: (i + 1) * perWord
  }));
}

function wordIndexForTime(t) {
  if (!wordTimings.length) return -1;
  if (t <= 0) return 0;
  // Since timings are uniform, compute directly
  const perWord = wordTimings[0].end - wordTimings[0].start;
  const idx = Math.min(Math.floor(t / Math.max(perWord, 0.0001)), wordTimings.length - 1);
  return idx;
}

function onMediaTimeUpdate() {
  const el = !videoPlayer.classList.contains('hidden') ? videoPlayer : audioPlayer;
  const t = el.currentTime || 0;
  const idx = wordIndexForTime(t);
  if (idx !== lastActiveIndex && idx >= 0) {
    lastActiveIndex = idx;
    updateCurrentWord(idx);
  }
}

function attachMediaSyncEvents() {
  const el = !videoPlayer.classList.contains('hidden') ? videoPlayer : audioPlayer;
  el.removeEventListener('timeupdate', onMediaTimeUpdate);
  el.removeEventListener('seeking', onMediaTimeUpdate);
  el.removeEventListener('ratechange', onMediaTimeUpdate);
  el.removeEventListener('play', onMediaTimeUpdate);
  el.removeEventListener('loadedmetadata', onMediaTimeUpdate);

  el.addEventListener('timeupdate', onMediaTimeUpdate);
  el.addEventListener('seeking', onMediaTimeUpdate);
  el.addEventListener('ratechange', onMediaTimeUpdate);
  el.addEventListener('play', onMediaTimeUpdate);
  el.addEventListener('loadedmetadata', () => {
    extractDuration();
    computeWordTimings();
    onMediaTimeUpdate();
  });
  el.addEventListener('ended', () => {
    lastActiveIndex = -1;
    clearPose();
    wordSpan.textContent = '-';
    document.querySelectorAll('.word').forEach(w => w.classList.remove('active'));
  });
}

uploadBtn.addEventListener('click', async () => {
  resetState();
  const file = fileInput.files[0];
  if (!file) { statusEl.textContent = 'Please select a file.'; return; }
  showMedia(file);
  statusEl.textContent = 'Uploading & transcribing…';
  try {
    const form = new FormData();
    form.append('file', file, file.name);
    const resp = await fetch(`${API_BASE}/api/transcribe`, { method: 'POST', body: form });
    if (!resp.ok) {
      const detail = await resp.json().catch(() => ({}));
      throw new Error(detail.detail || 'Transcription failed');
    }
    const data = await resp.json();
    wordData = data.words || [];
    buildCaptions(wordData);
    statusEl.textContent = 'Transcription complete.';
    const mediaEl = !videoPlayer.classList.contains('hidden') ? videoPlayer : audioPlayer;
    // Ensure duration known or compute fallback timings, then attach sync events
    if (mediaEl.readyState >= 1) {
      extractDuration();
      computeWordTimings();
      onMediaTimeUpdate();
    }
    attachMediaSyncEvents();
  } catch (e) {
    statusEl.textContent = 'Error: ' + e.message;
  }
});

// Accessibility: allow clicking caption words to jump animation
captionsEl.addEventListener('click', e => {
  if (e.target.classList.contains('word')) {
    const idx = parseInt(e.target.dataset.index, 10);
    // Seek media to word start if we have timings; else just update highlight
    const el = !videoPlayer.classList.contains('hidden') ? videoPlayer : audioPlayer;
    if (wordTimings.length && wordTimings[idx]) {
      el.currentTime = Math.max(0, wordTimings[idx].start + 0.01);
    }
    lastActiveIndex = -1; // force refresh
    updateCurrentWord(idx);
  }
});
