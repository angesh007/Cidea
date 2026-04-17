'use strict';

// ==================== CONFIG ====================
const MAX_PETS = 6;
const HUNGER_DRAIN_MS = 4500;
const NEGLECT_THRESHOLD = 25;
const OVERFEED_LIMIT = 12;
const CHAOS_ESCALATION_MS = 8500;

const PET_NAMES = ['Glurp','Morbex','Snarlz','Fleshy','Bogg','Drool','Wretchen','Krzzt','Vomblor','Scabz','Hexlet','Bligg','Gorex'];

const MOODS = {
  happy:    { faces: ['😁','🤩','🥰','😻','🤪'], color: '#00ff88' },
  neutral:  { faces: ['🙂','😶','🫤','😑'], color: '#ffe000' },
  hungry:   { faces: ['😤','😠','🤬','💢'], color: '#ff6a00' },
  angry:    { faces: ['👿','😡','🤮','🔥'], color: '#ff2020' },
  ecstatic: { faces: ['🤯','😵','🫠','🥴','😈'], color: '#9b00ff' },
  dead:     { faces: ['💀','☠️','👻'], color: '#555' },
  petted:   { faces: ['😻','🫦','🫠','😍'], color: '#ff69b4' },
};

const SPEECHES = {
  happy: ['FEED ME MORE','I LIVE','hehehe','I AM ETERNAL','YUMMY'],
  hungry: ['FEED ME NOW','I WILL DESTROY','YOU WILL REGRET THIS'],
  petted: ['ohhh yes','dont stop','MORE','*purrs violently*'],
  poked: ['OW','stop that','I know where you sleep','PAIN IS LOVE'],
  zapped: ['AAAAGH','ZZZT!','POWER SURGE','tingly...'],
  angry: ['CHAOS BEGINS','MINE','DESTROY','YOUR SOUL IS MINE'],
  fed: ['YUM','DELICIOUS PAIN','nom nom nom','*gulp*'],
  explode: ['TOO MUCH','OVERSTIMULATED','CRITICAL MASS','AAAAAH']
};

// ==================== STATE ====================
let pets = [];
let chaosLevel = 0;
let soundEnabled = true;
let petIdCounter = 0;
const audioCtx = window.AudioContext || window.webkitAudioContext ? new (window.AudioContext || window.webkitAudioContext)() : null;

// ==================== AUDIO ====================
function playTone(freq, type = 'square', duration = 0.15, vol = 0.08) {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}

const sounds = {
  happy: () => { playTone(440,'sine',0.1); setTimeout(()=>playTone(660,'sine',0.1),100); },
  hungry: () => playTone(200, 'sawtooth', 0.35, 0.12),
  zap: () => { playTone(800,'square',0.05,0.2); setTimeout(()=>playTone(280,'square',0.18),70); },
  explode: () => { for(let i=0;i<9;i++) setTimeout(()=>playTone(80+Math.random()*450,'sawtooth',0.22,0.13), i*45); },
  poke: () => playTone(340, 'triangle', 0.12),
  chaos: () => playTone(60+Math.random()*180, 'sawtooth', 0.45, 0.07)
};

// ==================== UTILITIES ====================
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[randInt(0, arr.length-1)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function screenW() { return window.innerWidth; }
function screenH() { return window.innerHeight; }

// ==================== PARTICLES & EFFECTS ====================
function spawnParticles(x, y, count = 12, color = '#ff6a00') {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.background = color;
    p.style.setProperty('--dx', rand(-140,140)+'px');
    p.style.setProperty('--dy', rand(-200,-30)+'px');
    p.style.setProperty('--dur', rand(0.5,1.3)+'s');
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }
}

function showChaosWord(text, x, y) {
  const w = document.createElement('div');
  w.className = 'chaos-word';
  w.textContent = text;
  w.style.left = x + 'px';
  w.style.top = y + 'px';
  w.style.setProperty('--rot', rand(-40,40)+'deg');
  document.getElementById('chaos-layer').appendChild(w);
  setTimeout(() => w.remove(), 4500);
}

function flash(color = '#ff6a00') {
  const f = document.createElement('div');
  f.className = 'screen-flash';
  f.style.background = color;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 600);
}

// ==================== PET CREATION ====================
function createPet(x, y) {
  if (pets.length >= MAX_PETS) {
    alert("Too many demons already! The void is full.");
    return;
  }

  const template = document.getElementById('pet-template');
  const el = template.content.cloneNode(true).querySelector('.pet-container');

  const id = ++petIdCounter;
  const name = pick(PET_NAMES) + (id > 3 ? id : '');

  const hues = [[255,40,40],[255,110,0],[200,0,255],[0,220,255],[255,0,200]];
  const [r,g,b] = pick(hues);
  const bodyColor1 = `rgb(${r},${g},${b})`;
  const bodyColor2 = `rgb(${Math.min(255,r+70)},${Math.min(255,g+70)},${Math.min(255,b+70)})`;

  const pet = {
    id, name, el,
    x, y,
    vx: rand(-0.6, 0.6), vy: rand(-0.4, 0.4),
    size: 1.0,
    feedCount: 0,
    hunger: 100,
    mood: 'happy',
    blobSeed: rand(0, Math.PI*2),
    wobble: 0,
    bodyColor1, bodyColor2,
    glowColor: bodyColor1,
    isDead: false,
    lastInteract: Date.now(),
    chaos: 0,
    miniSpawned: 0
  };

  el.querySelector('.pet-name-tag').textContent = name;
  el.style.left = x + 'px';
  el.style.top = y + 'px';

  // Button listeners
  el.querySelector('.btn-feed').addEventListener('click', e => { e.stopPropagation(); feedPet(pet); });
  el.querySelector('.btn-poke').addEventListener('click', e => { e.stopPropagation(); pokePet(pet); });
  el.querySelector('.btn-zap').addEventListener('click', e => { e.stopPropagation(); zapPet(pet); });

  // Dragging
  const body = el.querySelector('.pet-body');
  body.addEventListener('mousedown', e => startDrag(e, pet));
  body.addEventListener('touchstart', e => startDrag(e, pet), {passive: false});

  document.body.appendChild(el);
  pets.push(pet);

  // Draw loop
  pet.drawInterval = setInterval(() => {
    if (!pet.isDead) drawPet(pet);
  }, 70);

  pet.hungerInterval = setInterval(() => drainHunger(pet), HUNGER_DRAIN_MS);

  // Initial spawn effect
  triggerAnim(pet, 'wiggle');
  speak(pet, pick(SPEECHES.happy));
  sounds.happy();
  spawnParticles(x + 65, y + 65, 10, bodyColor1);

  updateChaosUI();
  return pet;
}

// ==================== DRAWING ====================
function drawPet(pet) {
  const canvas = pet.el.querySelector('.pet-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w/2, cy = h/2;

  ctx.clearRect(0, 0, w, h);

  const sz = pet.size;
  const r = Math.min(58, 32 + sz * 12);

  // Blob body
  const grad = ctx.createRadialGradient(cx-10, cy-10, 6, cx, cy, r);
  grad.addColorStop(0, pet.bodyColor2);
  grad.addColorStop(1, pet.bodyColor1);

  ctx.beginPath();
  blobPath(ctx, cx, cy, r, pet.blobSeed, pet.wobble);
  ctx.fillStyle = grad;
  ctx.fill();

  // Glow
  ctx.shadowBlur = 25;
  ctx.shadowColor = pet.glowColor;
  ctx.strokeStyle = pet.glowColor;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Face
  const moodData = MOODS[pet.mood] || MOODS.neutral;
  const faceEl = pet.el.querySelector('.pet-emoji-face');
  faceEl.textContent = pick(moodData.faces);
  faceEl.style.fontSize = (32 + sz*8) + 'px';
}

// Simple blob
function blobPath(ctx, cx, cy, r, seed, wobble = 0) {
  const points = 9;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const noise = 0.78 + 0.22 * Math.sin(seed + i*2.4) + wobble*0.12*Math.sin(Date.now()/180 + i);
    const x = cx + Math.cos(a) * r * noise;
    const y = cy + Math.sin(a) * r * noise;
    i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.closePath();
}

// ==================== INTERACTIONS ====================
function feedPet(pet) {
  if (pet.isDead) return;
  pet.lastInteract = Date.now();
  pet.feedCount++;
  pet.hunger = Math.min(100, pet.hunger + 28);

  if (pet.feedCount >= OVERFEED_LIMIT) {
    explodePet(pet);
    return;
  }

  if (pet.feedCount > OVERFEED_LIMIT * 0.65) {
    pet.size = clamp(pet.size + 0.28, 0.6, 2.8);
    pet.mood = 'ecstatic';
    speak(pet, pick(SPEECHES.explode));
    triggerAnim(pet, 'bloat');
    sounds.chaos();
  } else {
    pet.size = clamp(pet.size + 0.14, 0.6, 2.8);
    pet.mood = 'happy';
    speak(pet, pick(SPEECHES.fed));
    triggerAnim(pet, 'wiggle');
    sounds.happy();
  }

  const rect = pet.el.getBoundingClientRect();
  spawnParticles(rect.left + 65, rect.top + 45, 8, '#00ff88');
  addChaos(4);
}

function pokePet(pet) {
  if (pet.isDead) return;
  pet.lastInteract = Date.now();
  pet.mood = 'neutral';
  speak(pet, pick(SPEECHES.poked));
  triggerAnim(pet, 'wiggle');
  sounds.poke();
}

function zapPet(pet) {
  if (pet.isDead) return;
  pet.lastInteract = Date.now();
  pet.hunger = Math.min(100, pet.hunger + 12);
  pet.mood = pick(['ecstatic','angry','petted']);
  speak(pet, pick(SPEECHES.zapped));
  triggerAnim(pet, 'zap');
  sounds.zap();
  flash('rgba(180,0,255,0.25)');
  addChaos(6);
  const rect = pet.el.getBoundingClientRect();
  spawnParticles(rect.left + 65, rect.top + 45, 12, '#9b00ff');
}

// Dragging
let draggingPet = null;
function startDrag(e, pet) {
  if (pet.isDead) return;
  e.preventDefault();
  draggingPet = pet;
  pet.dragging = true;
  pet.lastInteract = Date.now();
  pet.mood = 'petted';
  const point = e.touches ? e.touches[0] : e;
  pet.dragOffX = point.clientX - pet.x;
  pet.dragOffY = point.clientY - pet.y;
  pet.el.classList.add('dragging');
  speak(pet, pick(SPEECHES.petted));
  sounds.happy();
  triggerAnim(pet, 'wiggle');
}

document.addEventListener('mousemove', e => {
  if (!draggingPet) return;
  draggingPet.x = e.clientX - draggingPet.dragOffX;
  draggingPet.y = e.clientY - draggingPet.dragOffY;
  const safe = { x: clamp(draggingPet.x, 0, screenW()-180), y: clamp(draggingPet.y, 60, screenH()-260) };
  draggingPet.el.style.left = safe.x + 'px';
  draggingPet.el.style.top = safe.y + 'px';
});

document.addEventListener('mouseup', () => { if(draggingPet) draggingPet.dragging = false; draggingPet = null; });
document.addEventListener('touchmove', e => {
  if (!draggingPet) return;
  const t = e.touches[0];
  draggingPet.x = t.clientX - draggingPet.dragOffX;
  draggingPet.y = t.clientY - draggingPet.dragOffY;
  const safe = { x: clamp(draggingPet.x, 0, screenW()-180), y: clamp(draggingPet.y, 60, screenH()-260) };
  draggingPet.el.style.left = safe.x + 'px';
  draggingPet.el.style.top = safe.y + 'px';
}, {passive: false});

document.addEventListener('touchend', () => { if(draggingPet) draggingPet.dragging = false; draggingPet = null; });

// Hunger
function drainHunger(pet) {
  if (pet.isDead) return;
  pet.hunger = clamp(pet.hunger - randInt(6,14), 0, 100);
  pet.el.querySelector('.hunger-bar').style.width = pet.hunger + '%';

  if (pet.hunger > 70) pet.mood = 'happy';
  else if (pet.hunger > 45) pet.mood = 'neutral';
  else if (pet.hunger > NEGLECT_THRESHOLD) {
    pet.mood = 'hungry';
    speak(pet, pick(SPEECHES.hungry));
    sounds.hungry();
  } else {
    pet.mood = 'angry';
    addChaos(9);
    onNeglect(pet);
  }
}

// Neglect → Chaos
function onNeglect(pet) {
  if (Date.now() - pet.lastInteract < 14000) return;
  pet.chaos = clamp(pet.chaos + 12, 0, 100);

  if (pet.chaos > 25 && pet.miniSpawned < 3) {
    spawnMiniDemon(pet);
  }
  if (pet.chaos > 45) {
    pet.x = rand(30, screenW()-200);
    pet.y = rand(80, screenH()-260);
    pet.el.style.left = pet.x + 'px';
    pet.el.style.top = pet.y + 'px';
    showChaosWord(pick(SPEECHES.angry), rand(40, screenW()-180), rand(100, screenH()-150));
  }
}

// Mini Demon
function spawnMiniDemon(pet) {
  pet.miniSpawned++;
  const mini = document.createElement('div');
  mini.className = 'mini-demon';
  mini.textContent = pick(['👿','😈','🦇','🔥','🕷️','💀']);
  mini.style.left = rand(0, screenW()-40) + 'px';
  mini.style.top = rand(80, screenH()-80) + 'px';
  document.body.appendChild(mini);

  let mx = parseFloat(mini.style.left);
  let dir = 1;

  const moveInt = setInterval(() => {
    mx += dir * rand(3,7);
    if (mx < 10 || mx > screenW()-50) dir *= -1;
    mini.style.left = mx + 'px';
    mini.style.top = (parseFloat(mini.style.top) + Math.sin(Date.now()/400)*1.5) + 'px';
  }, 40);

  setTimeout(() => {
    clearInterval(moveInt);
    mini.style.transition = 'all 0.5s';
    mini.style.transform = 'scale(0)';
    mini.style.opacity = '0';
    setTimeout(() => mini.remove(), 600);
    pet.miniSpawned = Math.max(0, pet.miniSpawned-1);
  }, rand(9000, 18000));
}

// Explosion
function explodePet(pet) {
  pet.isDead = true;
  clearInterval(pet.drawInterval);
  clearInterval(pet.hungerInterval);

  speak(pet, '💥 BOOM 💥');
  const rect = pet.el.getBoundingClientRect();
  const cx = rect.left + 70, cy = rect.top + 65;

  flash('#ff5500');
  sounds.explode();
  spawnParticles(cx, cy, 30, pet.bodyColor1);
  showChaosWord('💥 GONE 💥', cx-50, cy-70);

  addChaos(18);

  pet.el.style.animation = 'explode-out 0.7s forwards';
  setTimeout(() => {
    pet.el.remove();
    pets = pets.filter(p => p.id !== pet.id);
    updateChaosUI();

    // Rebirth as ghost
    setTimeout(() => {
      const newPet = createPet(rand(80, screenW()-200), rand(100, screenH()-260));
      if (newPet) {
        newPet.mood = 'ecstatic';
        speak(newPet, 'I... RETURN');
      }
    }, 2800);
  }, 800);
}

// Chaos System
function addChaos(amount) {
  chaosLevel = clamp(chaosLevel + amount, 0, 100);
  updateChaosUI();
  if (chaosLevel > 85) applyMaxChaos();
}

function updateChaosUI() {
  document.getElementById('chaos-val').textContent = Math.round(chaosLevel);
}

function applyMaxChaos() {
  document.body.classList.add('tilt-mode');
  setTimeout(() => document.body.classList.remove('tilt-mode'), 1200);
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      showChaosWord(pick(['CHAOS','DOOM','PAIN','MINE','END']), rand(20,screenW()-200), rand(80,screenH()-120));
    }, i*180);
  }
}

// Animation helper
function triggerAnim(pet, name) {
  const body = pet.el;
  body.classList.remove('pet-anim-wiggle','pet-anim-bloat','pet-anim-zap','pet-anim-panic','pet-anim-ghost');
  if (name) {
    void body.offsetWidth;
    body.classList.add('pet-anim-' + name);
    if (['wiggle','bloat','zap'].includes(name)) {
      setTimeout(() => body.classList.remove('pet-anim-' + name), 800);
    }
  }
}

function speak(pet, msg) {
  const bubble = pet.el.querySelector('.pet-speech-bubble');
  bubble.textContent = msg;
  bubble.classList.add('visible');
  clearTimeout(pet.speechTimer);
  pet.speechTimer = setTimeout(() => bubble.classList.remove('visible'), 2400);
}

// Global controls
window.spawnPet = () => {
  const x = rand(60, screenW() - 220);
  const y = rand(100, screenH() - 280);
  createPet(x, y);
};

window.nukeAll = () => {
  flash('#ff0000');
  sounds.explode();
  [...pets].forEach(p => explodePet(p));
  chaosLevel = 0;
  updateChaosUI();
  document.querySelectorAll('.mini-demon').forEach(m => m.remove());
};

window.toggleSound = () => {
  soundEnabled = !soundEnabled;
  document.getElementById('sound-toggle').textContent = soundEnabled ? '🔊' : '🔇';
};

// Idle movement
setInterval(() => {
  pets.forEach(pet => {
    if (pet.isDead || pet.dragging) return;
    pet.x += pet.vx * 0.6;
    pet.y += pet.vy * 0.4;

    if (pet.x < 10 || pet.x > screenW() - 190) pet.vx *= -1;
    if (pet.y < 70 || pet.y > screenH() - 270) pet.vy *= -1;

    pet.x = clamp(pet.x, 10, screenW() - 190);
    pet.y = clamp(pet.y, 70, screenH() - 270);

    if (Math.random() < 0.06) {
      pet.vx = rand(-1.2, 1.2);
      pet.vy = rand(-0.8, 0.8);
    }

    pet.el.style.left = pet.x + 'px';
    pet.el.style.top = pet.y + 'px';
  });
}, 90);

// Ambient chaos
setInterval(() => {
  if (pets.length === 0 || Math.random() > 0.28) return;
  const pet = pick(pets.filter(p => !p.isDead));
  if (pet) speak(pet, pick(['...','watching you','*vibrates*','hungry...','heh']));
}, 4200);

// Init
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => createPet(screenW()*0.25, screenH()*0.38), 400);
  setTimeout(() => createPet(screenW()*0.68, screenH()*0.42), 1100);
  setTimeout(() => createPet(screenW()*0.45, screenH()*0.32), 1900);
});
