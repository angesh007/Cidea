/* ===== VIRTUAL PET FROM HELL — pets.js ===== */

'use strict';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const MAX_PETS = 6;
const HUNGER_DRAIN_MS = 4000;       // how often hunger ticks down
const NEGLECT_THRESHOLD = 20;       // hunger % below which chaos begins
const OVERFEED_LIMIT = 10;          // feed clicks before explosion
const CHAOS_ESCALATION_MS = 8000;   // how often chaos level escalates

const PET_NAMES = ['Glurp','Morbex','Snarlz','Fleshy','Bogg','Drool','Wretchen','Krzzt','Vomblor','Scabz','Hexlet','Bligg'];
const MOODS = {
  happy:    { faces: ['😁','🤩','🥰','😻','🤪'], color: '#00ff88' },
  neutral:  { faces: ['😶','🙂','😑','🫤'],        color: '#ffe000' },
  hungry:   { faces: ['😤','😠','🤬','💢'],         color: '#ff6a00' },
  angry:    { faces: ['👿','😡','🤮','🔥'],          color: '#ff2020' },
  ecstatic: { faces: ['🤯','😵','🫠','🥴','😈'],     color: '#9b00ff' },
  dead:     { faces: ['💀','☠️','👻'],               color: '#555' },
  petted:   { faces: ['😻','🫦','🫠','😍','🤩'],     color: '#ff69b4' },
};

const SPEECHES = {
  happy:   ['FEED ME MORE','I LIVE','hehehe','I AM ETERNAL','...blegh','YUMMY'],
  hungry:  ['FEED ME NOW','I WILL DESTROY','hunger...pain...','YOU WILL REGRET THIS','...'],
  petted:  ['ohhh yes','dont stop','MORE','I feel... things','*purrs violently*','heheheh'],
  poked:   ['OW','stop that','I know where you sleep','...noted','PAIN IS LOVE'],
  zapped:  ['AAAAGH','ZZZT!','POWER SURGE','I FEEL ALIVE','more...','tingly'],
  angry:   ['CHAOS BEGINS','MINE','DESTROY','END TIMES','YOUR SOUL IS MINE'],
  fed:     ['YUM','DELICIOUS PAIN','more more more','nom nom nom','*gulp*'],
  explode: ['TOO MUCH','OVERSTIMULATED','I CANT','CRITICAL MASS','AAAAAH'],
};

// ─── STATE ────────────────────────────────────────────────────────────────────
let pets = [];
let chaosLevel = 0;          // 0-100
let soundEnabled = true;
let miniDemonInterval = null;
let chaosInterval = null;
let petIdCounter = 0;
const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;

// ─── AUDIO ────────────────────────────────────────────────────────────────────
function playTone(freq, type = 'square', duration = 0.15, vol = 0.08) {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch(e){}
}
function playHappy()   { playTone(440, 'sine', 0.1); setTimeout(()=>playTone(660,'sine',0.1),120); }
function playHungry()  { playTone(200, 'sawtooth', 0.3, 0.1); }
function playZap()     { playTone(800, 'square', 0.05, 0.15); setTimeout(()=>playTone(300,'square',0.15,0.1),60); }
function playExplode() { for(let i=0;i<8;i++) setTimeout(()=>playTone(100+Math.random()*400,'sawtooth',0.2,0.12),i*50); }
function playPoke()    { playTone(350, 'triangle', 0.1); }
function playChaos()   { playTone(50+Math.random()*200,'sawtooth',0.4,0.06); }

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function screenW() { return window.innerWidth; }
function screenH() { return window.innerHeight; }

function safePos(el) {
  const w = 180, h = 250;
  const x = clamp(el.x, 0, screenW() - w);
  const y = clamp(el.y, 60, screenH() - h);
  return { x, y };
}

function setPos(el, x, y) {
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
}

function flash(color = '#ffffff') {
  const f = document.createElement('div');
  f.className = 'screen-flash';
  f.style.setProperty('--flash-color', color);
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 500);
}

function spawnParticles(x, y, count = 12, color = '#ff6a00') {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = x + 'px'; p.style.top = y + 'px';
    p.style.background = color;
    p.style.setProperty('--dx', (rand(-120, 120)) + 'px');
    p.style.setProperty('--dy', (rand(-180, -20)) + 'px');
    p.style.setProperty('--dur', rand(0.4, 1.2) + 's');
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1300);
  }
}

function ripple(x, y) {
  const r = document.createElement('div');
  r.className = 'ripple';
  r.style.left = x + 'px'; r.style.top = y + 'px';
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 600);
}

function showChaosWord(text, x, y) {
  const w = document.createElement('div');
  w.className = 'chaos-word';
  w.textContent = text;
  w.style.left = x + 'px'; w.style.top = y + 'px';
  w.style.setProperty('--rot', rand(-30, 30) + 'deg');
  document.getElementById('chaos-layer').appendChild(w);
  setTimeout(() => w.remove(), 4200);
}

// ─── CANVAS DRAWING ───────────────────────────────────────────────────────────
function drawPet(pet) {
  const canvas = pet.el.querySelector('.pet-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;
  ctx.clearRect(0, 0, w, h);

  const sz = pet.size;         // 0.5 – 2.5
  const r  = Math.min(50, 30 + sz * 10);

  // Body blob
  const grad = ctx.createRadialGradient(cx - 8, cy - 8, 4, cx, cy, r);
  grad.addColorStop(0, pet.bodyColor2);
  grad.addColorStop(1, pet.bodyColor1);
  ctx.beginPath();
  blobPath(ctx, cx, cy, r, pet.blobSeed, pet.wobble);
  ctx.fillStyle = grad;
  ctx.fill();

  // Glow outline
  ctx.shadowBlur = 20;
  ctx.shadowColor = pet.glowColor;
  ctx.strokeStyle = pet.glowColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Extra eyes/tentacles at higher sizes
  if (sz > 1.2) drawExtras(ctx, pet, cx, cy, r);

  // Update face emoji
  const moodData = MOODS[pet.mood] || MOODS.neutral;
  const faceEl = pet.el.querySelector('.pet-emoji-face');
  faceEl.textContent = pick(moodData.faces);
  faceEl.style.fontSize = (28 + sz * 6) + 'px';

  // Shadow size
  pet.el.querySelector('.pet-shadow').style.width = (60 + sz * 15) + 'px';
}

function blobPath(ctx, cx, cy, r, seed, wobble = 0) {
  const points = 8;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const noise  = 0.75 + 0.25 * Math.sin(seed + i * 2.3) + wobble * 0.1 * Math.sin(Date.now() / 200 + i);
    const x = cx + Math.cos(angle) * r * noise;
    const y = cy + Math.sin(angle) * r * noise;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawExtras(ctx, pet, cx, cy, r) {
  // Extra eye
  const eyeAngle = pet.blobSeed % (Math.PI * 2);
  const ex = cx + Math.cos(eyeAngle) * r * 0.5;
  const ey = cy + Math.sin(eyeAngle) * r * 0.5;
  ctx.beginPath();
  ctx.arc(ex, ey, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#ff2020';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex + 1, ey + 1, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();

  // Tentacle / spike if very big
  if (pet.size > 1.8) {
    const ta = eyeAngle + Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ta) * r, cy + Math.sin(ta) * r);
    ctx.lineTo(cx + Math.cos(ta) * r * 1.6, cy + Math.sin(ta) * r * 1.6);
    ctx.strokeStyle = pet.bodyColor1;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

// ─── PET CLASS / FACTORY ──────────────────────────────────────────────────────
function createPet(x, y) {
  if (pets.length >= MAX_PETS) { say('Max demons reached!'); return; }

  const template = document.getElementById('pet-template');
  const el = template.content.cloneNode(true).querySelector('.pet-container');

  const id = ++petIdCounter;
  const name = pick(PET_NAMES) + (id > 1 ? id : '');

  // Random personality
  const hues = [[255,30,30],[255,100,0],[180,0,255],[0,200,255],[255,0,180]];
  const [r1,g1,b1] = pick(hues);
  const bodyColor1 = `rgb(${r1},${g1},${b1})`;
  const bodyColor2 = `rgb(${clamp(r1+60,0,255)},${clamp(g1+60,0,255)},${clamp(b1+60,0,255)})`;

  const pet = {
    id, name, el,
    x, y,
    vx: rand(-0.5, 0.5), vy: rand(-0.5, 0.5), // idle drift
    size: 1,
    feedCount: 0,
    hunger: 100,
    mood: 'happy',
    blobSeed: rand(0, Math.PI * 2),
    wobble: 0,
    bodyColor1, bodyColor2,
    glowColor: bodyColor1,
    isDead: false,
    lastInteract: Date.now(),
    speechTimer: null,
    drawInterval: null,
    dragging: false,
    dragOffX: 0, dragOffY: 0,
    animClass: '',
    chaos: 0,        // individual chaos (0-100)
    miniSpawned: 0,  // how many minis this pet spawned
  };

  el.querySelector('.pet-name-tag').textContent = name;
  el.style.left = x + 'px'; el.style.top = y + 'px';

  // Buttons
  el.querySelector('.btn-feed').addEventListener('click', (e) => { e.stopPropagation(); feedPet(pet); });
  el.querySelector('.btn-poke').addEventListener('click', (e) => { e.stopPropagation(); pokePet(pet); });
  el.querySelector('.btn-zap').addEventListener('click',  (e) => { e.stopPropagation(); zapPet(pet); });

  // Dragging
  const body = el.querySelector('.pet-body');
  body.addEventListener('mousedown',  (e) => startDrag(e, pet));
  body.addEventListener('touchstart', (e) => startDrag(e, pet), { passive: false });

  document.body.appendChild(el);
  pets.push(pet);

  // Draw loop
  pet.drawInterval = setInterval(() => {
    if (!pet.isDead) { pet.blobSeed += 0.04; pet.wobble = Math.sin(Date.now() / 300); drawPet(pet); }
  }, 80);

  // Hunger drain
  pet.hungerInterval = setInterval(() => drainHunger(pet), HUNGER_DRAIN_MS);

  // Initial animation
  triggerAnim(pet, 'wiggle');
  speak(pet, pick(SPEECHES.happy));
  playHappy();
  spawnParticles(x + 60, y + 60, 8, bodyColor1);

  updateChaosUI();
  return pet;
}

// ─── INTERACTIONS ─────────────────────────────────────────────────────────────
function feedPet(pet) {
  if (pet.isDead) return;
  pet.lastInteract = Date.now();
  pet.feedCount++;
  pet.hunger = Math.min(100, pet.hunger + 25);

  if (pet.feedCount >= OVERFEED_LIMIT) {
    explodePet(pet);
    return;
  }

  if (pet.feedCount > OVERFEED_LIMIT * 0.6) {
    pet.size = clamp(pet.size + 0.25, 0.5, 2.5);
    pet.mood = 'ecstatic';
    speak(pet, pick(SPEECHES.explode));
    triggerAnim(pet, 'bloat');
    playChaos();
  } else {
    pet.size = clamp(pet.size + 0.12, 0.5, 2.5);
    pet.mood = 'happy';
    speak(pet, pick(SPEECHES.fed));
    triggerAnim(pet, 'wiggle');
    playHappy();
  }

  const rect = pet.el.getBoundingClientRect();
  spawnParticles(rect.left + 60, rect.top + 40, 6, '#00ff88');
  addChaos(3);
}

function pokePet(pet) {
  if (pet.isDead) return;
  pet.lastInteract = Date.now();
  pet.mood = 'neutral';
  speak(pet, pick(SPEECHES.poked));
  triggerAnim(pet, 'wiggle');
  playPoke();
  const rect = pet.el.getBoundingClientRect();
  ripple(rect.left + 60, rect.top + 60);
}

function zapPet(pet) {
  if (pet.isDead) return;
  pet.lastInteract = Date.now();
  pet.hunger = Math.min(100, pet.hunger + 10);
  pet.mood = pick(['ecstatic', 'angry', 'petted']);
  speak(pet, pick(SPEECHES.zapped));
  triggerAnim(pet, 'zap');
  playZap();
  flash('rgba(150,0,255,0.3)');
  addChaos(5);
  const rect = pet.el.getBoundingClientRect();
  spawnParticles(rect.left + 60, rect.top + 40, 10, '#9b00ff');
}

// ─── DRAG / PET ───────────────────────────────────────────────────────────────
function startDrag(e, pet) {
  if (pet.isDead) return;
  e.preventDefault();
  const point = e.touches ? e.touches[0] : e;
  pet.dragging = true;
  pet.dragOffX = point.clientX - pet.x;
  pet.dragOffY = point.clientY - pet.y;
  pet.el.classList.add('dragging');
  pet.lastInteract = Date.now();
  pet.mood = 'petted';
  triggerAnim(pet, 'wiggle');
  speak(pet, pick(SPEECHES.petted));
  playHappy();
}

document.addEventListener('mousemove',  onMove);
document.addEventListener('touchmove',  onMove, { passive: false });
document.addEventListener('mouseup',    onEnd);
document.addEventListener('touchend',   onEnd);

function onMove(e) {
  const point = e.touches ? e.touches[0] : e;
  pets.forEach(pet => {
    if (!pet.dragging) return;
    e.preventDefault();
    pet.x = point.clientX - pet.dragOffX;
    pet.y = point.clientY - pet.dragOffY;
    const sp = safePos(pet);
    setPos(pet.el, sp.x, sp.y);
    ripple(point.clientX, point.clientY);
  });
}

function onEnd() {
  pets.forEach(pet => {
    if (!pet.dragging) return;
    pet.dragging = false;
    pet.el.classList.remove('dragging');
  });
}

// ─── HUNGER & NEGLECT ─────────────────────────────────────────────────────────
function drainHunger(pet) {
  if (pet.isDead) return;
  pet.hunger = clamp(pet.hunger - randInt(5, 12), 0, 100);
  pet.el.querySelector('.hunger-bar').style.width = pet.hunger + '%';

  if (pet.hunger > 70) {
    pet.mood = 'happy';
  } else if (pet.hunger > 40) {
    pet.mood = 'neutral';
    playHungry();
  } else if (pet.hunger > NEGLECT_THRESHOLD) {
    pet.mood = 'hungry';
    speak(pet, pick(SPEECHES.hungry));
    playHungry();
  } else {
    pet.mood = 'angry';
    addChaos(8);
    onNeglect(pet);
  }

  updateHungerBarColor(pet);
}

function updateHungerBarColor(pet) {
  const pct = pet.hunger;
  const bar = pet.el.querySelector('.hunger-bar');
  if (pct > 60) bar.style.background = 'linear-gradient(to right,#00ff88,#ffe000)';
  else if (pct > 30) bar.style.background = 'linear-gradient(to right,#ffe000,#ff6a00)';
  else bar.style.background = 'linear-gradient(to right,#ff6a00,#ff2020)';
}

function onNeglect(pet) {
  const timeSince = Date.now() - pet.lastInteract;
  if (timeSince < 15000) return; // grace period

  pet.chaos = clamp(pet.chaos + 10, 0, 100);
  const chaos = pet.chaos;

  if (chaos > 20) {
    // Spawn mini demon
    if (pet.miniSpawned < 3) spawnMiniDemon(pet);
    triggerAnim(pet, 'panic');
    speak(pet, pick(SPEECHES.angry));
  }
  if (chaos > 40) {
    // Random move
    pet.x = rand(20, screenW() - 180);
    pet.y = rand(70, screenH() - 250);
    setPos(pet.el, pet.x, pet.y);
    playChaos();
    showChaosWord(pick(SPEECHES.angry), rand(50, screenW()-150), rand(100, screenH()-100));
  }
  if (chaos > 60) {
    // Tilt page
    document.body.classList.add('tilt-mode');
    setTimeout(() => document.body.classList.remove('tilt-mode'), 1000);
  }
  if (chaos > 80) {
    // Cursor chaos
    document.body.classList.add('cursor-chaos');
    setTimeout(() => document.body.classList.remove('cursor-chaos'), 3000);
    spawnCrack();
  }
}

// ─── MINI DEMONS ──────────────────────────────────────────────────────────────
const DEMON_EMOJIS = ['👿','😈','🦇','💀','🔥','🕷️','🐛','🦂'];

function spawnMiniDemon(pet) {
  pet.miniSpawned++;
  const mini = document.createElement('div');
  mini.className = 'mini-demon';
  mini.textContent = pick(DEMON_EMOJIS);

  let mx = rand(0, screenW() - 50);
  let my = rand(60, screenH() - 60);
  mini.style.left = mx + 'px';
  mini.style.top  = my + 'px';

  const duration = rand(1.5, 3.5);
  mini.style.animationDuration = duration + 's';
  document.body.appendChild(mini);

  // Mini demon scurries around
  let dir = 1;
  const move = setInterval(() => {
    if (!document.body.contains(mini)) { clearInterval(move); return; }
    mx += dir * rand(2, 5);
    if (mx > screenW() - 50 || mx < 0) dir *= -1;
    my += Math.sin(Date.now() / 500) * 2;
    mini.style.left = mx + 'px';
    mini.style.top  = my + 'px';
  }, 50);

  // Mini demon exists for 10-20 seconds
  setTimeout(() => {
    clearInterval(move);
    mini.style.animation = 'explode-out 0.4s forwards';
    setTimeout(() => mini.remove(), 400);
    pet.miniSpawned = Math.max(0, pet.miniSpawned - 1);
  }, rand(10000, 20000));
}

// ─── CRACK EFFECT ─────────────────────────────────────────────────────────────
function spawnCrack() {
  const c = document.createElement('div');
  c.className = 'crack';
  c.textContent = pick(['💥','⚡','🔥','☠️','💢']);
  c.style.left = rand(5, 85) + '%';
  c.style.top  = rand(10, 85) + '%';
  document.getElementById('chaos-layer').appendChild(c);
  setTimeout(() => c.remove(), 3200);
}

// ─── EXPLOSION ────────────────────────────────────────────────────────────────
function explodePet(pet) {
  pet.isDead = true;
  clearInterval(pet.drawInterval);
  clearInterval(pet.hungerInterval);

  speak(pet, '💥 BOOM 💥');
  triggerAnim(pet, 'none');

  const rect = pet.el.getBoundingClientRect();
  const cx = rect.left + 80, cy = rect.top + 60;

  flash('#ff6a00');
  playExplode();
  spawnParticles(cx, cy, 25, pet.bodyColor1);
  spawnParticles(cx, cy, 15, '#ffe000');
  showChaosWord('💥 GONE 💥', cx - 40, cy - 60);
  addChaos(15);

  // Animate out
  pet.el.style.animation = 'explode-out 0.6s forwards';
  setTimeout(() => {
    pet.el.remove();
    pets = pets.filter(p => p.id !== pet.id);
    updateChaosUI();
    // Respawn after delay as ghost
    setTimeout(() => {
      const gx = rand(20, screenW() - 180);
      const gy = rand(70, screenH() - 250);
      const newPet = createPet(gx, gy);
      if (newPet) {
        newPet.mood = 'ecstatic';
        speak(newPet, 'I AM REBORN');
        triggerAnim(newPet, 'ghost');
      }
    }, 3000);
  }, 700);
}

// ─── PET INTERACTIONS (pets attack/sniff each other) ──────────────────────────
setInterval(() => {
  if (pets.length < 2) return;
  if (Math.random() > 0.3) return;

  const a = pick(pets), b = pick(pets);
  if (a.id === b.id || a.isDead || b.isDead) return;

  // Check proximity
  const dx = a.x - b.x, dy = a.y - b.y;
  const dist = Math.sqrt(dx*dx + dy*dy);

  if (dist < 200) {
    // React to each other
    const react = pick(['fight','love','scared']);
    if (react === 'fight') {
      speak(a, pick(['GET AWAY','MINE','BACK OFF','MINE MINE MINE']));
      speak(b, pick(['OW','NO U','FIGHT ME','RUDE']));
      triggerAnim(a, 'zap'); triggerAnim(b, 'zap');
      addChaos(4);
      playZap();
    } else if (react === 'love') {
      speak(a, pick(['frend?','you smell nice','mine now','*sniffs*']));
      speak(b, pick(['o hi','*wiggles*','also frend','...ok']));
      a.mood = b.mood = 'happy';
    } else {
      speak(a, 'AAAH');
      speak(b, 'AAAH');
      // Push apart
      const pushX = (dx / dist) * 30, pushY = (dy / dist) * 30;
      a.x = clamp(a.x + pushX, 0, screenW() - 180);
      a.y = clamp(a.y + pushY, 70, screenH() - 250);
      b.x = clamp(b.x - pushX, 0, screenW() - 180);
      b.y = clamp(b.y - pushY, 70, screenH() - 250);
      setPos(a.el, a.x, a.y);
      setPos(b.el, b.x, b.y);
    }
  }
}, 2500);

// ─── CHAOS SYSTEM ─────────────────────────────────────────────────────────────
function addChaos(amount) {
  chaosLevel = clamp(chaosLevel + amount, 0, 100);
  updateChaosUI();
  if (chaosLevel > 80) applyMaxChaos();
}

function updateChaosUI() {
  document.getElementById('chaos-val').textContent = Math.round(chaosLevel);
  const cm = document.getElementById('chaos-meter');
  if (chaosLevel < 30) cm.style.color = '#ffe000';
  else if (chaosLevel < 60) cm.style.color = '#ff6a00';
  else cm.style.color = '#ff2020';

  // Slowly decay chaos
  if (!chaosDecayRunning) startChaosDecay();
}

let chaosDecayRunning = false;
function startChaosDecay() {
  chaosDecayRunning = true;
  const decay = setInterval(() => {
    chaosLevel = clamp(chaosLevel - 1, 0, 100);
    updateChaosUI();
    if (chaosLevel <= 0) { clearInterval(decay); chaosDecayRunning = false; }
  }, 500);
}

function applyMaxChaos() {
  // Shake the whole page
  document.body.classList.add('tilt-mode');
  setTimeout(() => document.body.classList.remove('tilt-mode'), 1000);

  // Random chaos words
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      showChaosWord(pick(['CHAOS','DOOM','MINE','PAIN','HELP','WHY','END','FEED']),
        rand(10, screenW() - 200), rand(80, screenH() - 80));
    }, i * 200);
  }

  flash('rgba(255,0,0,0.2)');
  playChaos();
}

// ─── IDLE MOVEMENT (pets slowly drift) ───────────────────────────────────────
setInterval(() => {
  pets.forEach(pet => {
    if (pet.isDead || pet.dragging) return;
    // Drift
    pet.x += pet.vx * 0.5;
    pet.y += pet.vy * 0.3;
    // Bounce off edges
    if (pet.x < 0 || pet.x > screenW() - 180) pet.vx *= -1;
    if (pet.y < 60 || pet.y > screenH() - 250) pet.vy *= -1;
    pet.x = clamp(pet.x, 0, screenW() - 180);
    pet.y = clamp(pet.y, 60, screenH() - 250);
    // Add random nudge
    if (Math.random() < 0.05) { pet.vx = rand(-1, 1); pet.vy = rand(-0.5, 0.5); }
    setPos(pet.el, pet.x, pet.y);
  });
}, 100);

// ─── ANIMATION HELPERS ────────────────────────────────────────────────────────
function triggerAnim(pet, name) {
  const body = pet.el;
  // Remove all anim classes
  body.className = body.className.replace(/pet-anim-\w+/g, '').trim();
  if (name && name !== 'none') {
    void body.offsetWidth; // reflow
    body.classList.add('pet-anim-' + name);
    // One-shot anims
    if (['wiggle','bloat','zap'].includes(name)) {
      setTimeout(() => body.classList.remove('pet-anim-' + name), 700);
    }
  }
}

// ─── SPEECH BUBBLE ────────────────────────────────────────────────────────────
function speak(pet, msg) {
  if (!pet.el) return;
  const bubble = pet.el.querySelector('.pet-speech-bubble');
  bubble.textContent = msg;
  bubble.classList.add('visible');
  clearTimeout(pet.speechTimer);
  pet.speechTimer = setTimeout(() => bubble.classList.remove('visible'), 2200);
}

// ─── GLOBAL CONTROLS ──────────────────────────────────────────────────────────
window.spawnPet = function() {
  const x = rand(50, screenW() - 200);
  const y = rand(80, screenH() - 250);
  if (pets.length >= MAX_PETS) {
    speak(pets[0], 'TOO MANY DEMONS');
    playHungry();
    return;
  }
  createPet(x, y);
};

window.nukeAll = function() {
  flash('#ff0000');
  playExplode();
  [...pets].forEach(p => explodePet(p));
  chaosLevel = 0;
  updateChaosUI();
  // Clean up mini demons
  document.querySelectorAll('.mini-demon').forEach(m => m.remove());
  setTimeout(() => {
    createPet(rand(100, screenW()-200), rand(100, screenH()-250));
  }, 2500);
};

window.toggleSound = function() {
  soundEnabled = !soundEnabled;
  document.getElementById('sound-toggle').textContent = soundEnabled ? '🔊' : '🔇';
};

// ─── RANDOM AMBIENT CHAOS ─────────────────────────────────────────────────────
setInterval(() => {
  if (pets.length === 0) return;
  const livePets = pets.filter(p => !p.isDead);
  if (livePets.length === 0) return;
  if (Math.random() < 0.25) {
    const pet = pick(livePets);
    const phrases = ['...','*sniffs air*','where am I','...hungry','watching you','heh','do not sleep','*vibrates*','you smell','..!'];
    speak(pet, pick(phrases));
  }
  // Ambient chaos word occasionally
  if (chaosLevel > 30 && Math.random() < 0.15) {
    showChaosWord(pick(['cursed','🩸','help','why','MINE','eternal','pain']),
      rand(10, screenW() - 200), rand(100, screenH() - 100));
  }
}, 3500);

// ─── WINDOW RESIZE ────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  pets.forEach(pet => {
    pet.x = clamp(pet.x, 0, screenW() - 180);
    pet.y = clamp(pet.y, 60, screenH() - 250);
    setPos(pet.el, pet.x, pet.y);
  });
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Spawn initial pets
  setTimeout(() => createPet(screenW() * 0.25, screenH() * 0.4), 300);
  setTimeout(() => createPet(screenW() * 0.65, screenH() * 0.45), 900);
  setTimeout(() => createPet(screenW() * 0.45, screenH() * 0.35), 1600);

  // Tooltip auto-hide
  setTimeout(() => {
    const tt = document.getElementById('tooltip');
    if (tt) tt.style.display = 'none';
  }, 7000);
});
