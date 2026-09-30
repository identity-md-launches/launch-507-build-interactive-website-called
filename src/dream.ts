export type DreamStyle = 'ethereal' | 'lucid' | 'cosmic';
export type Emotion = 'wonder' | 'calm' | 'longing' | 'curiosity';
export type DreamEvent = { id: number; text: string; word: string; emotion: Emotion; kind: 'thought' | 'memory' | 'connection' | 'your thought'; repeats: number; seed: number; at: number };
const concepts = ['ocean', 'memory', 'moon', 'garden', 'silence', 'light', 'time', 'doorway', 'cloud', 'echo', 'forest', 'star'];
const openings = ['Somewhere,', 'I wonder if', 'Perhaps', 'In the distance,', 'For a moment,', 'Beyond the horizon,'];
const scenes = ['is learning to float', 'remembers a color that does not exist', 'folds quietly into the sky', 'grows a thousand invisible wings', 'becomes a place I have never been', 'forgets which way is up', 'is made of all the things left unsaid', 'opens like a slow, impossible flower', 'dreams of being something else', 'turns the darkness into a soft geometry'];
const moods: Emotion[] = ['wonder', 'calm', 'longing', 'curiosity'];
const stopWords = new Set(['the', 'and', 'what', 'that', 'with', 'could', 'would', 'into', 'this', 'have', 'your', 'from', 'there', 'like', 'were', 'when', 'then', 'some', 'just']);
const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
export class DreamModel {
  count = 0;
  events: DreamEvent[] = [];
  memories = new Map<string, number>();
  add(at: number, input?: string): DreamEvent {
    this.count++;
    const clean = input?.trim().slice(0, 120);
    const tokens = clean?.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const word = clean ? (tokens.find(token => concepts.includes(token)) ?? tokens.find(token => token.length > 3 && !stopWords.has(token)) ?? tokens[0] ?? 'possibility') : this.count === 1 ? 'light' : pick(concepts);
    const repeats = (this.memories.get(word) ?? 0) + 1;
    if (!this.memories.has(word) && this.memories.size >= 64) this.memories.delete(this.memories.keys().next().value!);
    this.memories.set(word, repeats);
    const kind = clean ? 'your thought' : this.count % 7 === 0 ? 'connection' : repeats > 1 ? 'memory' : 'thought';
    let emotion = pick(moods);
    if (clean && /calm|peace|soft|quiet|ocean|gentle/i.test(clean)) emotion = 'calm';
    else if (clean && /sad|lost|miss|remember|longing/i.test(clean)) emotion = 'longing';
    else if (clean && /why|how|what|wonder/i.test(clean)) emotion = 'curiosity';
    const text = clean || (this.count === 1 ? 'Somewhere, a small light begins to remember.' : kind === 'connection' ? `What if ${word} and ${pick(concepts.filter(c => c !== word))} were the same thing?` : kind === 'memory' ? `The ${word} returns. This time, it ${pick(scenes)}.` : `${pick(openings)} ${word} ${pick(scenes)}.`);
    const event: DreamEvent = { id: this.count, text, word, emotion, kind, repeats, seed: Math.random(), at };
    this.events.push(event);
    if (this.events.length > 18) this.events.shift();
    return event;
  }
}
const palettes = { ethereal: [270, 310, 230], lucid: [155, 43, 180], cosmic: [220, 180, 280] };
const TAU = Math.PI * 2;
const hash = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const hsla = (h: number, s: number, l: number, a: number) => `hsla(${h},${s}%,${l}%,${a})`;
export class DreamRenderer {
  private ctx: CanvasRenderingContext2D;
  private width = 1;
  private height = 1;
  private observer: ResizeObserver;
  style: DreamStyle = 'ethereal';
  intensity = .5;
  time = 0;
  started = false;
  reducedMotion = false;
  private lastEvents: DreamEvent[] = [];
  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas is not available');
    this.ctx = ctx;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }
  private resize() {
    const bounds = this.canvas.getBoundingClientRect();
    this.width = bounds.width; this.height = bounds.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw(this.lastEvents);
  }
  draw(events: DreamEvent[]) {
    this.lastEvents = events;
    const c = this.ctx, w = this.width, h = this.height, t = this.time;
    const [base, accent, third] = palettes[this.style];
    const mood = events.at(-1)?.emotion;
    const hue = base + (mood === 'calm' ? -12 : mood === 'longing' ? 14 : 0);
    const growth = this.started ? Math.min(1, (this.reducedMotion ? events.length * 4 : t) / 13) : 0;
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.fillStyle = '#08080e'; c.fillRect(0, 0, w, h);
    const atmosphere = c.createRadialGradient(w * .5, h * .45, 0, w * .5, h * .45, w * .55);
    atmosphere.addColorStop(0, hsla(hue, 50, 18, .2 + growth * .55));
    atmosphere.addColorStop(.48, hsla(hue + 15, 45, 13, .15 + growth * .3));
    atmosphere.addColorStop(1, 'transparent');
    c.fillStyle = atmosphere; c.fillRect(0, 0, w, h);
    // Fixed star positions preserve a quiet, stable frame before Start and while paused.
    for (let i = 0; i < 130 + growth * this.intensity * 200; i++) {
      const x = hash(i * 3 + 1) * w, y = hash(i * 3 + 2) * h;
      const alpha = (.08 + hash(i * 3 + 3) * .38) * (.45 + growth * .55);
      c.fillStyle = hsla(third, 32, 84, alpha * (.85 + Math.sin(t * .3 + i) * .15));
      c.beginPath(); c.arc(x, y, hash(i) > .97 ? 1.25 : .55, 0, TAU); c.fill();
    }
    if (!this.started) { this.vignette(); return; }
    const size = Math.min(w * .27, h * .35) * (.45 + growth * .55) * (.82 + this.intensity * .36);
    const cx = w * .5, cy = h * .44;
    c.globalCompositeOperation = 'screen';
    // Soft nebula pockets surround a procedurally contoured, slowly breathing core.
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + t * .015;
      const x = cx + Math.cos(a) * size * .65, y = cy + Math.sin(a) * size * .65;
      const fog = c.createRadialGradient(x, y, 0, x, y, size * (1 + hash(i) * .5));
      fog.addColorStop(0, hsla(i % 3 ? hue : accent, 72, 47, growth * (.03 + this.intensity * .03)));
      fog.addColorStop(.5, hsla(hue, 60, 30, .025 * growth)); fog.addColorStop(1, 'transparent');
      c.fillStyle = fog; c.fillRect(0, 0, w, h);
    }
    const contourCount = Math.round(46 + this.intensity * 35);
    for (let j = 0; j < contourCount; j++) {
      const layer = j / contourCount;
      const r = size * (.35 + layer * .65);
      c.beginPath();
      for (let k = 0; k <= 150; k++) {
        const a = k / 150 * TAU;
        const freq = this.style === 'lucid' ? 6 : this.style === 'cosmic' ? 3 : 4;
        const ripple = Math.sin(a * freq + layer * 5 + t * .16) * .14 + Math.cos(a * 3 - layer * 6 - t * .1) * .11;
        const rad = r * (1 + ripple);
        const tilt = Math.sin(t * .045) * .2;
        const x = cx + Math.cos(a + tilt) * rad * (this.style === 'cosmic' ? 1.25 : 1.1);
        const y = cy + Math.sin(a) * rad * (this.style === 'lucid' ? .87 : 1) + Math.sin(a * 2 + layer * 5 + t * .09) * size * .09;
        if (k === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
      c.strokeStyle = hsla(hue + Math.sin(layer * 4 + t * .02) * 27, 65, 61 + layer * 16, growth * (.1 + layer * .29));
      c.lineWidth = j % 9 === 0 ? 1.1 : .55; c.stroke();
    }
    // Orbiting dust is a 3D torus projected onto the 2D canvas.
    const dustCount = Math.round(650 + this.intensity * 1000);
    for (let i = 0; i < dustCount; i++) {
      const a = hash(i + 51) * TAU + t * .012 * (hash(i + 21) > .5 ? 1 : -1);
      const b = hash(i + 5000) * TAU;
      const radius = size * (1.06 + Math.cos(b) * .31 + hash(i + 311) * .2);
      const px = Math.cos(a) * radius;
      const py = Math.sin(a) * radius * .68 + Math.sin(b) * size * .25;
      const x = cx + px * .94 - py * .3, y = cy + px * .3 + py * .94;
      const alpha = growth * (.07 + hash(i + 82) * .5) * (.65 + this.intensity * .6);
      c.fillStyle = hsla(hash(i) > .73 ? accent : hue, 62, 66 + hash(i + 61) * 24, alpha);
      c.beginPath(); c.arc(x, y, hash(i + 72) * .95 + .25, 0, TAU); c.fill();
    }
    if (events.length > 3) this.landscape(events, hue, growth);
    this.fragments(events, hue, accent, growth);
    if (this.style === 'cosmic') {
      c.save(); c.translate(cx, cy); c.rotate(-.4 + t * .007);
      c.strokeStyle = hsla(accent, 70, 70, .22 * growth); c.lineWidth = .75;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, 0, size * (1.45 + i * .14), size * (.31 + i * .08), 0, 0, TAU); c.stroke(); } c.restore();
    }
    c.globalCompositeOperation = 'source-over'; this.vignette();
  }
  private landscape(events: DreamEvent[], hue: number, growth: number) {
    const c = this.ctx, w = this.width, h = this.height, t = this.time;
    const strength = Math.min(1, (events.length - 3) / 7) * growth;
    for (let row = 0; row < 14; row++) {
      c.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const nx = x / w;
        const wave = Math.sin(nx * 12 + row * .14 + t * .07) * 14 + Math.sin(nx * 24 - row * .2) * 6;
        const y = h * .76 + row * 7 + wave * Math.sin(nx * Math.PI);
        if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.strokeStyle = hsla(hue, 42, 55, (1 - row / 17) * .15 * strength); c.lineWidth = .65; c.stroke();
    }
  }
  private fragments(events: DreamEvent[], hue: number, accent: number, growth: number) {
    const c = this.ctx, w = this.width, h = this.height, t = this.time;
    const visible = events.slice(-8);
    visible.forEach((event, i) => {
      const a = event.seed * TAU + event.id * 2.4;
      const side = i % 2 ? 1 : -1;
      const x = w * .5 + side * (w * .24 + Math.sin(a + t * .025) * w * .08);
      const y = h * (.22 + hash(event.seed * 819) * .38) + Math.sin(t * .12 + a) * 9;
      const appear = this.reducedMotion ? 1 : Math.min(1, Math.max(0, (t - event.at) / 2));
      const opacity = appear * growth * (.4 + i / visible.length * .5);
      const r = (9 + hash(event.id) * 15) * (1 + Math.min(4, event.repeats - 1) * .25);
      c.save(); c.translate(x, y); c.rotate(Math.sin(t * .035 + a) * .35);
      c.strokeStyle = hsla(i % 2 ? accent : hue, 53, 74, opacity * .6); c.lineWidth = .7;
      if (this.style === 'lucid' || event.repeats > 1) {
        for (let j = 0; j < Math.min(7, event.repeats + 2); j++) {
          const s = r + j * 4; c.beginPath(); c.moveTo(-s, s * .55); c.lineTo(-s, -s * .4); c.bezierCurveTo(-s, -s * 1.5, s, -s * 1.5, s, -s * .4); c.lineTo(s, s * .55); c.stroke();
        }
      } else if (event.kind === 'connection') {
        for (let j = 0; j < 4; j++) { c.beginPath(); c.ellipse(0, 0, r * 1.8, r * .5, j / 4 * Math.PI + t * .03, 0, TAU); c.stroke(); }
      } else {
        for (let j = 0; j < 4; j++) { c.beginPath(); c.ellipse(0, 0, r, r * (.3 + j * .16), j * .6 + t * .02, 0, TAU); c.stroke(); }
      }
      c.restore();
      c.font = '10px Manrope, sans-serif'; c.textAlign = 'center'; c.fillStyle = hsla(hue, 25, 82, opacity);
      const label = Array.from(event.word).slice(0, 18).join('');
      c.fillText(label, x, y + r + 20);
      if (event.kind === 'connection' && i > 0) {
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(w * .5, h * .15, w - x, h * .52);
        c.strokeStyle = hsla(accent, 55, 72, opacity * .23); c.stroke();
      }
    });
  }
  private vignette() {
    const c = this.ctx, w = this.width, h = this.height;
    const vignette = c.createRadialGradient(w * .5, h * .45, h * .23, w * .5, h * .45, Math.max(w * .6, h * .65));
    vignette.addColorStop(0, 'transparent'); vignette.addColorStop(1, '#05050bb3');
    c.fillStyle = vignette; c.fillRect(0, 0, w, h);
    // A quiet lower edge keeps captions legible even when bright contours pass behind them.
    const captionShade = c.createLinearGradient(0, h * .54, 0, h);
    captionShade.addColorStop(0, 'transparent');
    captionShade.addColorStop(.3, '#08080ed1');
    captionShade.addColorStop(1, '#08080ef5');
    c.fillStyle = captionShade; c.fillRect(0, h * .54, w, h * .46);
  }
}
