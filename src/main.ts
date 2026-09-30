import './style.css';
import { DreamModel, DreamRenderer, type DreamStyle, type DreamEvent } from './dream';

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = get<HTMLCanvasElement>('dream-canvas');
const stage = get<HTMLElement>('dream-stage');
const toggle = get<HTMLButtonElement>('toggle-dream');
const next = get<HTMLButtonElement>('next-thought');
const intensity = get<HTMLInputElement>('intensity');
const input = get<HTMLInputElement>('thought-input');
const send = get<HTMLButtonElement>('send-thought');
const hint = get<HTMLParagraphElement>('thought-hint');
const dialog = get<HTMLDialogElement>('about-dialog');
const soundButton = get<HTMLButtonElement>('sound-toggle');
const media = matchMedia('(prefers-reduced-motion: reduce)');
const model = new DreamModel();
let renderer: DreamRenderer | undefined;
let started = false, running = false, reduced = media.matches;
let frame = 0, previous = 0, lastUISecond = -1, nextEventAt = 5;
let elapsed = 0;
let audio: AudioContext | undefined;
let volume: GainNode | undefined;
let soundEnabled = false;
const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const announce = (message: string) => { get('announcement').textContent = message; };

try { renderer = new DreamRenderer(canvas); renderer.reducedMotion = reduced; }
catch { canvas.hidden = true; announce('Canvas is unavailable. You can still follow the dream in the thought stream.'); }

function refresh() {
  stage.classList.toggle('running', running);
  stage.dataset.state = !started ? 'idle' : running ? reduced ? 'manual' : 'running' : 'paused';
  stage.dataset.style = renderer?.style ?? 'ethereal';
  stage.dataset.intensity = intensity.value;
  get('idle-content').hidden = started;
  get('dream-caption').hidden = !started;
  get('transport-label').textContent = !started ? 'Start dreaming' : running ? 'Pause dream' : 'Resume dream';
  get('transport-icon').innerHTML = running ? '<path d="M5 4h3v12H5zm7 0h3v12h-3z"/>' : '<path d="m6 4 10 6-10 6z"/>';
  get('dream-status').textContent = !started ? 'Waiting to dream' : !running ? 'Dream paused' : reduced ? 'Still dream · manual' : 'Dreaming';
  next.disabled = !running; input.disabled = !running; send.disabled = !running;
  get<HTMLButtonElement>('save-frame').disabled = !started || !renderer;
  hint.textContent = !started ? 'Start a dream to add your own thought.' : !running ? 'Resume the dream to add your thought.' : reduced ? 'Reduced motion is on. Use the next-thought button to explore.' : 'Press Enter to send your thought into the dream.';
  get('motion-note').textContent = reduced ? 'Reduced motion is on. The world stays still, and new thoughts appear only when you add one or choose Generate next thought.' : 'Pause any time, or change the intensity to find your pace.';
  const fullscreenPause = get<HTMLButtonElement>('fullscreen-pause');
  fullscreenPause.hidden = false;
  fullscreenPause.textContent = !started ? 'Start dreaming' : running ? 'Pause dream' : 'Resume dream';
  get<HTMLButtonElement>('fullscreen-next').disabled = !running;
  stage.dataset.thoughts = String(model.count);
}

function addThought(text?: string) {
  if (!running) return;
  const event = model.add(elapsed, text);
  get('caption-kind').textContent = event.kind === 'your thought' ? 'A thought from you' : event.kind === 'memory' ? 'A memory takes shape' : event.kind === 'connection' ? 'An unexpected connection' : 'Inside the dream';
  get('caption-text').textContent = event.text;
  get('thought-count').textContent = `${model.count} ${model.count === 1 ? 'thought' : 'thoughts'}`;
  get('world-detail').textContent = `${event.emotion} / ${event.repeats > 1 ? 'a memory grows' : 'a new possibility'}`;
  canvas.setAttribute('aria-label', `${renderer?.style ?? 'Ethereal'} dream, ${event.emotion}. ${model.count} thoughts have shaped this world. Latest: ${event.text}`);
  stage.dataset.thoughts = String(model.count);
  const stream = get('thought-stream'); stream.replaceChildren();
  model.events.slice(-3).reverse().forEach((thought: DreamEvent) => {
    const item = document.createElement('li'); item.className = 'thought-item';
    const time = document.createElement('time'); time.textContent = clock(thought.at); time.dateTime = `PT${Math.floor(thought.at)}S`;
    const line = document.createElement('p'); line.textContent = thought.text;
    const tag = document.createElement('span'); tag.className = 'thought-tag'; tag.textContent = thought.kind;
    line.append(tag); item.append(time, line); stream.append(item);
  });
  if (text || reduced) announce(`${event.kind === 'your thought' ? 'Your thought joined the dream.' : event.text} ${event.word} takes shape.`);
  renderer?.draw(model.events);
}

function animate(now: number) {
  if (!running || reduced || document.hidden) return;
  const delta = previous ? Math.min((now - previous) / 1000, .08) : 0;
  previous = now; elapsed += delta;
  if (renderer) { renderer.time = elapsed; renderer.draw(model.events); }
  if (elapsed >= nextEventAt) { addThought(); nextEventAt = elapsed + 5 + Math.random() * 3; }
  if (Math.floor(elapsed) !== lastUISecond) { lastUISecond = Math.floor(elapsed); get('session-timer').textContent = clock(elapsed); }
  frame = requestAnimationFrame(animate);
}
function schedule() {
  cancelAnimationFrame(frame); previous = 0;
  if (running && !reduced && !document.hidden) frame = requestAnimationFrame(animate);
}
async function syncSound() {
  if (!audio || !volume) return;
  const audible = soundEnabled && running && !document.hidden;
  if (audible) {
    try { await audio.resume(); volume.gain.setTargetAtTime(.035, audio.currentTime, .6); }
    catch { soundEnabled = false; paintSound(); announce('Sound could not start. Try the sound button again.'); }
  } else { await audio.suspend(); }
}
function toggleDream() {
  running = !running;
  if (!started) { started = true; if (renderer) renderer.started = true; addThought(); }
  refresh(); schedule(); void syncSound();
  announce(running ? reduced ? 'Dream started in still mode. Generate a thought to continue.' : 'The dream is unfolding.' : 'Dream paused.');
}
toggle.addEventListener('click', toggleDream);
get('fullscreen-pause').addEventListener('click', toggleDream);
get('fullscreen-next').addEventListener('click', () => { addThought(); nextEventAt = elapsed + 6; });
next.addEventListener('click', () => { addThought(); nextEventAt = elapsed + 6; });
intensity.addEventListener('input', () => {
  const value = Number(intensity.value);
  get('intensity-value').textContent = `${value}%`;
  intensity.setAttribute('aria-valuetext', `${value} percent`);
  intensity.style.setProperty('--range-progress', `${(value - 10) / .9}%`);
  if (renderer) { renderer.intensity = value / 100; renderer.draw(model.events); }
  stage.dataset.intensity = String(value);
});
document.querySelectorAll<HTMLInputElement>('input[name=dream-style]').forEach(radio => {
  radio.addEventListener('change', () => {
    if (renderer) { renderer.style = radio.value as DreamStyle; renderer.draw(model.events); }
    stage.dataset.style = radio.value;
    if (started) canvas.setAttribute('aria-label', `${radio.value} dream with ${model.count} thoughts. Latest: ${model.events.at(-1)?.text ?? ''}`);
    announce(`Dream style changed to ${radio.value}.`);
  });
});
get<HTMLFormElement>('thought-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!running) return;
  if (!input.value.trim()) {
    input.setAttribute('aria-invalid', 'true'); hint.textContent = 'Add a word or an idea first.'; announce('Add a word or an idea first.'); input.focus(); return;
  }
  input.removeAttribute('aria-invalid'); addThought(input.value); input.value = ''; hint.textContent = 'Your thought is part of the dream now.'; input.focus();
});
input.addEventListener('input', () => { if (input.hasAttribute('aria-invalid')) { input.removeAttribute('aria-invalid'); hint.textContent = 'Press Enter to send your thought into the dream.'; } });
function paintSound() {
  soundButton.setAttribute('aria-pressed', String(soundEnabled));
  soundButton.setAttribute('aria-label', `Ambient sound: ${soundEnabled ? 'Sound on' : 'Sound off'}`);
  get('sound-label').textContent = soundEnabled ? 'Sound on' : 'Sound off';
  get('sound-waves').setAttribute('d', soundEnabled ? 'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14' : 'm16 9 6 6m0-6-6 6');
}
soundButton.addEventListener('click', async () => {
  try {
    if (!audio) {
      audio = new AudioContext(); volume = audio.createGain(); volume.gain.value = 0; volume.connect(audio.destination);
      [110, 164.81, 220, 277.18].forEach((frequency, i) => {
        const oscillator = audio!.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        const layer = audio!.createGain(); layer.gain.value = .28 / (i + 1);
        oscillator.connect(layer); layer.connect(volume!); oscillator.start();
      });
    }
    soundEnabled = !soundEnabled; paintSound(); await syncSound();
    announce(soundEnabled ? running ? 'Ambient sound is on.' : 'Ambient sound will play when the dream runs.' : 'Ambient sound is off.');
  } catch { soundEnabled = false; paintSound(); announce('Ambient sound is unavailable in this browser. The dream can continue silently.'); }
});
get('about-open').addEventListener('click', () => dialog.showModal());
get('about-close').addEventListener('click', () => dialog.close());
get('about-done').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const b = dialog.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) dialog.close(); } });
dialog.addEventListener('close', () => get('about-open').focus());
// Keep sequential keyboard navigation inside the explanation, including the wrap.
dialog.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const first = get('about-close'), last = get('about-done');
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
get('fullscreen').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.requestFullscreen(); }
  catch { announce('Fullscreen is unavailable here. You can keep watching in this window.'); }
});
document.addEventListener('fullscreenchange', () => {
  const label = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen';
  get('fullscreen').setAttribute('aria-label', label); get('fullscreen').title = label;
});
get('save-frame').addEventListener('click', () => {
  canvas.toBlob(blob => {
    if (!blob) { announce('The image could not be saved. Please try again.'); return; }
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `dream-${renderer?.style ?? 'ethereal'}-${model.count}.png`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); announce('Your dream image is ready to save.');
  }, 'image/png');
});
media.addEventListener('change', () => {
  reduced = media.matches; if (renderer) { renderer.reducedMotion = reduced; renderer.draw(model.events); }
  refresh(); schedule(); announce(reduced ? 'Reduced motion enabled. Use Generate next thought to explore a still dream.' : 'Dream animation enabled.');
});
document.addEventListener('visibilitychange', () => { schedule(); void syncSound(); });
window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); void audio?.close(); });
refresh();
