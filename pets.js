/* ===================================================
   PETS FROM HELL V2 — pets.js
   Better scoring · localStorage · combos · more chaos
=================================================== */
'use strict';

// ── CONFIG ──────────────────────────────────────────
const MAX_PETS           = 6;
const HUNGER_DRAIN_MS    = 3500;
const NEGLECT_THRESHOLD  = 18;
const OVERFEED_LIMIT     = 10;
const CHAOS_ESCALATION   = 8000;
const COMBO_WINDOW_MS    = 2500;
const SCORE_KEY          = 'pfh_scores_v2';
const STATS_KEY          = 'pfh_stats_v2';

const PET_NAMES = [
  'Glurp','Morbex','Snarlz','Fleshy','Bogg','Drool',
  'Wretchen','Krzzt','Vomblor','Scabz','Hexlet','Bligg',
  'Slurk','Fetid','Grublor','Snarl','Oozelm','Creepus',
  'Phlegmar','Retch','Squelch','Dredge'
];

const MOODS = {
  happy:   { faces:['😁','🤩','🥰','😸','🤪','😜'], color:'#e8a020', glow:'rgba(232,160,32,0.4)' },
  neutral: { faces:['😶','🙂','😑','🫤','🤔','😐'], color:'#b8a898', glow:'rgba(184,168,152,0.2)' },
  hungry:  { faces:['😤','😠','🤬','💢','😾','👿'], color:'#c8102e', glow:'rgba(200,16,46,0.4)' },
  angry:   { faces:['👿','😡','🤮','🔥','😈','💀'], color:'#8a0a1e', glow:'rgba(138,10,30,0.5)' },
  ecstatic:{ faces:['🤯','😵','🫠','🥴','😈','🌀'], color:'#7b00c8', glow:'rgba(123,0,200,0.5)' },
  dead:    { faces:['💀','☠️','👻','🕯️'], color:'#3a2a3a', glow:'rgba(0,0,0,0.8)' },
  petted:  { faces:['😻','🫦','🫠','😍','🤩','😽'], color:'#c8102e', glow:'rgba(200,16,46,0.35)' },
  stuffed: { faces:['🤢','🤮','😵','🫃','💥'], color:'#6e0018', glow:'rgba(110,0,24,0.5)' },
  scared:  { faces:['😱','😨','🙀','😰','👀'], color:'#00d4c8', glow:'rgba(0,212,200,0.3)' },
};

const SPEECHES = {
  happy:   ['FEED ME MORE','I LIVE','hehehe','I AM ETERNAL','...blegh','YUMMY','SUFFERING IS BLISS'],
  hungry:  ['FEED ME NOW','I WILL DESTROY','hunger...pain...','YOU WILL REGRET THIS','...my insides...','PAIN'],
  petted:  ['ohhh yes','dont stop','M O R E','I feel... things','*purrs violently*','heheheh','do that again'],
  poked:   ['OW','stop that','I know where you sleep','...noted','PAIN IS LOVE','rude','you dare?'],
  zapped:  ['AAAAGH','ZZZT!','POWER SURGE','I FEEL ALIVE','more...','tingly','MY MOLECULES'],
  angry:   ['CHAOS BEGINS','MINE','DESTROY','END TIMES','YOUR SOUL IS MINE','RUIN','I DESCEND'],
  fed:     ['YUM','DELICIOUS PAIN','more more more','nom nom nom','*gulp*','FEED ME','ALWAYS MORE'],
  explode: ['TOO MUCH','OVERSTIMULATED','I CANT','CRITICAL MASS','AAAAAH','EXPANDING','OH NO'],
  scared:  ['AAAH','WHAT IS THAT','NO NO NO','I smell danger','RUN'],
  ambient: ['...','*sniffs air*','where am I','...hungry','watching you','heh','do not sleep','*vibrates*',
            'you smell','..!','am i real','*leaks*','tick tock','still here','your wifi password','exists'],
  fight:   ['GET AWAY','MINE','BACK OFF','MINE MINE MINE','I SAW IT FIRST','TERRITORY'],
  love:    ['frend?','you smell nice','mine now','*sniffs*','together forever','comrade'],
  born:    ['I AM BORN','EXISTENCE HURTS','HELLO MORTAL','...already hungry','who summoned me'],
};

// ── STATE ───────────────────────────────────────────
let pets          = [];
let chaosLevel    = 0;
let score         = 0;
let comboCount    = 0;
let lastActionTime= 0;
let soundEnabled  = true;
let petIdCounter  = 0;

const stats = loadStats();

const audioCtx = (window.AudioContext || window.webkitAudioContext)
  ? new (window.AudioContext || window.webkitAudioContext)() : null;

// ── STORAGE ─────────────────────────────────────────
function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || makeStats();
  } catch { return makeStats(); }
}
function makeStats() {
  return { fed:0, exploded:0, demons:0, zapped:0, sessions:0, highScore:0 };
}
function saveStats() {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
}
function loadScores() {
  try {
    return JSON.parse(localStorage.getItem(SCORE_KEY)) || [];
  } catch { return []; }
}
function persistScores(scores) {
  try { localStorage.setItem(SCORE_KEY, JSON.stringify(scores)); } catch {}
}

// ── AUDIO ────────────────────────────────────────────
function playTone(freq, type='square', duration=0.15, vol=0.07) {
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
  } catch(e) {}
}
function playHappy()   { playTone(440,'sine',0.1); setTimeout(()=>playTone(660,'sine',0.1),120); }
function playHungry()  { playTone(180,'sawtooth',0.3,0.09); }
function playZap()     { playTone(900,'square',0.05,0.14); setTimeout(()=>playTone(280,'square',0.2,0.09),55); }
function playExplode() { for(let i=0;i<10;i++) setTimeout(()=>playTone(80+Math.random()*450,'sawtooth',0.22,0.11),i*55); }
function playPoke()    { playTone(320,'triangle',0.12); }
function playChaos()   { playTone(40+Math.random()*180,'sawtooth',0.45,0.05); }
function playScore()   { playTone(523,'sine',0.08,0.05); setTimeout(()=>playTone(659,'sine',0.08,0.05),90); }
function playCombo()   { playTone(700,'sine',0.06); setTimeout(()=>playTone(880,'sine',0.06),80); setTimeout(()=>playTone(1046,'sine',0.1),160); }

// ── UTILS ────────────────────────────────────────────
function rand(a,b)    { return Math.random()*(b-a)+a; }
function randInt(a,b) { return Math.floor(rand(a,b+1)); }
function pick(arr)    { return arr[randInt(0,arr.length-1)]; }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }
function sw()         { return window.innerWidth; }
function sh()         { return window.innerHeight; }

function setPos(el, x, y) {
  el.style.left = x+'px';
  el.style.top  = y+'px';
}
function safePos(pet) {
  return {
    x: clamp(pet.x, 0, sw()-160),
    y: clamp(pet.y, 64, sh()-260)
  };
}

function flash(color='#ffffff') {
  const f = document.createElement('div');
  f.className = 'screen-flash';
  f.style.setProperty('--flash-color', color);
  document.body.appendChild(f);
  setTimeout(()=>f.remove(), 500);
}

function spawnParticles(x, y, count=12, color='#c8102e') {
  for (let i=0; i<count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = x+'px'; p.style.top = y+'px';
    p.style.background = color;
    p.style.setProperty('--dx', rand(-130,130)+'px');
    p.style.setProperty('--dy', rand(-190,-15)+'px');
    p.style.setProperty('--dur', rand(0.45,1.3)+'s');
    document.body.appendChild(p);
    setTimeout(()=>p.remove(), 1400);
  }
}

function ripple(x, y, color) {
  const r = document.createElement('div');
  r.className = 'ripple';
  if (color) r.style.borderColor = color;
  r.style.left = x+'px'; r.style.top = y+'px';
  document.body.appendChild(r);
  setTimeout(()=>r.remove(), 600);
}

function showChaosWord(text, x, y, color) {
  const w = document.createElement('div');
  w.className = 'chaos-word';
  w.textContent = text;
  w.style.left = x+'px'; w.style.top = y+'px';
  w.style.setProperty('--rot', rand(-28,28)+'deg');
  if (color) w.style.color = color;
  document.getElementById('chaos-layer').appendChild(w);
  setTimeout(()=>w.remove(), 4000);
}

function showComboText(text, x, y) {
  const w = document.createElement('div');
  w.className = 'combo-pop';
  w.textContent = text;
  w.style.left = x+'px'; w.style.top = y+'px';
  document.body.appendChild(w);
  setTimeout(()=>w.remove(), 1600);
}

function showLevelUp(msg) {
  const b = document.createElement('div');
  b.className = 'level-up-banner';
  b.textContent = msg;
  document.body.appendChild(b);
  setTimeout(()=>b.remove(), 2700);
}

// ── SCORING ──────────────────────────────────────────
function addScore(base, x, y) {
  const now = Date.now();
  if (now - lastActionTime < COMBO_WINDOW_MS) {
    comboCount = clamp(comboCount+1, 1, 16);
  } else {
    comboCount = 1;
  }
  lastActionTime = now;

  const multiplied = Math.round(base * comboCount);
  score += multiplied;
  stats.highScore = Math.max(stats.highScore, score);
  saveStats();

  // Update UI
  document.getElementById('score-val').textContent = score;
  updateComboPill();
  playScore();

  // Floating score pop
  const pop = document.createElement('div');
  pop.className = 'score-pop';
  pop.textContent = '+'+multiplied + (comboCount > 1 ? ` ×${comboCount}` : '');
  pop.style.left = (x||sw()/2) + 'px';
  pop.style.top  = (y||sh()/2) + 'px';
  pop.style.color = comboCount >= 4 ? '#00d4c8' : comboCount >= 2 ? '#e8a020' : '#f0e6d0';
  document.body.appendChild(pop);
  setTimeout(()=>pop.remove(), 1300);

  // Combo announcements
  if (comboCount === 3) { playCombo(); showComboText('🔥 TRIPLE!', sw()/2-60, sh()/2); }
  if (comboCount === 5) { playCombo(); showComboText('⚡ PENTAKILL!', sw()/2-70, sh()/2); flash('rgba(0,212,200,0.1)'); }
  if (comboCount === 8) { playCombo(); showComboText('☠ MASSACRE ×8', sw()/2-80, sh()/2); flash('rgba(123,0,200,0.15)'); }
  if (comboCount >= 10 && comboCount % 2 === 0) { playCombo(); showComboText(`👿 ×${comboCount} CHAOS GOD`, sw()/2-100, sh()/2); }

  updateLeaderboardCurrent();
}

function updateComboPill() {
  const pill = document.getElementById('combo-pill');
  const val  = document.getElementById('combo-val');
  if (comboCount >= 2) {
    pill.style.display = 'flex';
    val.textContent = '×'+comboCount;
  } else {
    pill.style.display = 'none';
  }
}

function getGrade(s) {
  if (s >= 10000) return 'S+';
  if (s >= 5000)  return 'S';
  if (s >= 2000)  return 'A';
  if (s >= 1000)  return 'B';
  if (s >= 400)   return 'C';
  if (s >= 100)   return 'D';
  return 'F';
}

// ── CANVAS DRAWING ────────────────────────────────────
function drawPet(pet) {
  const canvas = pet.el.querySelector('.pet-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w/2, cy = h/2;
  ctx.clearRect(0,0,w,h);

  const sz = pet.size;
  const r  = Math.min(56, 26+sz*12);

  // Outer glow ring
  const ringGrad = ctx.createRadialGradient(cx,cy,r*0.8,cx,cy,r*1.3);
  ringGrad.addColorStop(0, 'transparent');
  ringGrad.addColorStop(1, pet.glowColor+'44');
  ctx.beginPath();
  ctx.arc(cx, cy, r*1.28, 0, Math.PI*2);
  ctx.fillStyle = ringGrad;
  ctx.fill();

  // Body blob
  const grad = ctx.createRadialGradient(cx-10,cy-10,3, cx,cy,r);
  grad.addColorStop(0, pet.bodyColor2);
  grad.addColorStop(0.6, pet.bodyColor1);
  grad.addColorStop(1, pet.bodyColorDark);
  ctx.beginPath();
  blobPath(ctx, cx, cy, r, pet.blobSeed, pet.wobble);
  ctx.fillStyle = grad;
  ctx.fill();

  // Glow stroke
  ctx.shadowBlur = 18;
  ctx.shadowColor = pet.glowColor;
  ctx.strokeStyle = pet.glowColor+'aa';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Patterns / extras
  if (sz > 1.1) drawExtras(ctx, pet, cx, cy, r);
  if (sz > 1.6) drawTentacle(ctx, pet, cx, cy, r);
  if (sz > 2.1) drawEvilEyes(ctx, pet, cx, cy, r);

  // Face
  const moodData = MOODS[pet.mood] || MOODS.neutral;
  const faceEl = pet.el.querySelector('.pet-emoji-face');
  if (!pet._lastFaceUpdate || Date.now()-pet._lastFaceUpdate > 900) {
    faceEl.textContent = pick(moodData.faces);
    pet._lastFaceUpdate = Date.now();
  }
  faceEl.style.fontSize = (26+sz*7)+'px';

  // Halo color
  pet.el.querySelector('.pet-halo').style.background = moodData.color;
  pet.el.querySelector('.pet-halo').style.opacity = '0.45';
}

function blobPath(ctx, cx, cy, r, seed, wobble=0) {
  const pts = 9;
  ctx.beginPath();
  for (let i=0; i<=pts; i++) {
    const a = (i/pts)*Math.PI*2;
    const n = 0.72 + 0.28*Math.sin(seed+i*2.1) + wobble*0.12*Math.sin(Date.now()/220+i*1.4);
    const x = cx + Math.cos(a)*r*n;
    const y = cy + Math.sin(a)*r*n;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.closePath();
}

function drawExtras(ctx, pet, cx, cy, r) {
  const ea = pet.blobSeed % (Math.PI*2);
  const ex = cx + Math.cos(ea)*r*0.45;
  const ey = cy + Math.sin(ea)*r*0.45;
  // Glowing extra eye
  ctx.shadowBlur = 8; ctx.shadowColor = '#ff2020';
  ctx.beginPath(); ctx.arc(ex,ey,5.5,0,Math.PI*2);
  ctx.fillStyle = '#ff1a2a'; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(ex+0.5,ey+0.5,2.2,0,Math.PI*2);
  ctx.fillStyle = '#000'; ctx.fill();
  // Pupil gleam
  ctx.beginPath(); ctx.arc(ex-0.8,ey-0.8,0.7,0,Math.PI*2);
  ctx.fillStyle = '#fff'; ctx.fill();
}

function drawTentacle(ctx, pet, cx, cy, r) {
  const ta = pet.blobSeed + Math.PI;
  const wobT = Math.sin(Date.now()/350)*0.3;
  ctx.beginPath();
  ctx.moveTo(cx+Math.cos(ta)*r, cy+Math.sin(ta)*r);
  const cpx = cx+Math.cos(ta+0.5)*r*1.4+wobT*20;
  const cpy = cy+Math.sin(ta+0.5)*r*1.4;
  ctx.quadraticCurveTo(cpx,cpy,
    cx+Math.cos(ta)*r*1.75, cy+Math.sin(ta)*r*1.75);
  ctx.strokeStyle = pet.bodyColor1+'cc';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawEvilEyes(ctx, pet, cx, cy, r) {
  const offsets = [0.8, -0.8];
  offsets.forEach(ox => {
    const ex = cx + ox*r*0.6;
    const ey = cy - r*0.3;
    ctx.shadowBlur = 12; ctx.shadowColor = '#ff0000';
    ctx.beginPath(); ctx.arc(ex,ey,7,0,Math.PI*2);
    ctx.fillStyle = '#cc0022'; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(ex,ey,3.5,0,Math.PI*2);
    ctx.fillStyle = '#000'; ctx.fill();
  });
}

// ── PET FACTORY ───────────────────────────────────────
function createPet(x, y) {
  if (pets.length >= MAX_PETS) { say('Too many demons!'); return; }

  const tmpl = document.getElementById('pet-template');
  const el   = tmpl.content.cloneNode(true).querySelector('.pet-container');
  const id   = ++petIdCounter;
  const name = pick(PET_NAMES) + (id>1 ? id : '');

  // Color scheme
  const palettes = [
    { c1:[200,16,46],  c2:[255,60,80],  cd:[80,5,15],  glow:'#c8102e' },  // crimson
    { c1:[110,0,180],  c2:[170,50,240], cd:[40,0,80],  glow:'#7b00c8' },  // void purple
    { c1:[180,80,0],   c2:[240,140,20], cd:[80,30,0],  glow:'#e8a020' },  // amber
    { c1:[0,160,140],  c2:[0,220,200],  cd:[0,60,50],  glow:'#00d4c8' },  // teal
    { c1:[140,0,20],   c2:[200,20,50],  cd:[60,0,10],  glow:'#8a0a1e' },  // blood
    { c1:[50,0,100],   c2:[100,20,180], cd:[20,0,40],  glow:'#5000a0' },  // deep violet
  ];
  const pal = pick(palettes);
  const rgb = (r,g,b,a=1)=>`rgba(${r},${g},${b},${a})`;

  const pet = {
    id, name, el,
    x, y,
    vx: rand(-0.6,0.6), vy: rand(-0.4,0.4),
    size: 1,
    feedCount: 0,
    hunger: 100,
    mood: 'happy',
    blobSeed: rand(0, Math.PI*2),
    wobble: 0,
    bodyColor1:   rgb(...pal.c1),
    bodyColor2:   rgb(...pal.c2),
    bodyColorDark:rgb(...pal.cd),
    glowColor:    pal.glow,
    xp:           0,
    level:        1,
    isDead:       false,
    lastInteract: Date.now(),
    speechTimer:  null,
    drawInterval: null,
    dragging:     false,
    dragOffX:0, dragOffY:0,
    chaos:        0,
    miniSpawned:  0,
    personality:  pick(['glutton','neurotic','violent','chill','chaos']),
  };

  el.querySelector('.pet-name-tag').textContent = name;
  setPos(el, x, y);

  el.querySelector('.btn-feed').addEventListener('click', e=>{e.stopPropagation();feedPet(pet);});
  el.querySelector('.btn-poke').addEventListener('click', e=>{e.stopPropagation();pokePet(pet);});
  el.querySelector('.btn-zap' ).addEventListener('click', e=>{e.stopPropagation();zapPet(pet);});
  el.querySelector('.btn-pet' ).addEventListener('click', e=>{e.stopPropagation();petThePet(pet);});

  const body = el.querySelector('.pet-body');
  body.addEventListener('mousedown', e=>startDrag(e,pet));
  body.addEventListener('touchstart', e=>startDrag(e,pet), {passive:false});

  document.body.appendChild(el);
  pets.push(pet);

  pet.drawInterval   = setInterval(()=>{ if(!pet.isDead){pet.blobSeed+=0.045;pet.wobble=Math.sin(Date.now()/280);drawPet(pet);}}, 75);
  pet.hungerInterval = setInterval(()=>drainHunger(pet), HUNGER_DRAIN_MS);

  triggerAnim(pet,'wiggle');
  speak(pet, pick(SPEECHES.born));
  playHappy();
  spawnParticles(x+65, y+65, 10, pal.glow);
  updateChaosUI();
  stats.sessions++;
  saveStats();

  return pet;
}

// ── XP / LEVELS ──────────────────────────────────────
function addXP(pet, amt) {
  if (pet.isDead) return;
  pet.xp += amt;
  const needed = pet.level * 60;
  if (pet.xp >= needed) {
    pet.xp -= needed;
    pet.level++;
    const bar = pet.el.querySelector('.pet-xp-bar');
    bar.style.width = '0%';
    showLevelUp(`⛧ ${pet.name} LVL ${pet.level} ⛧`);
    flash('rgba(123,0,200,0.15)');
    addScore(pet.level * 50);
  }
  const pct = (pet.xp / (pet.level*60))*100;
  pet.el.querySelector('.pet-xp-bar').style.width = pct+'%';
}

// ── INTERACTIONS ──────────────────────────────────────
function feedPet(pet) {
  if (pet.isDead) return;
  pet.lastInteract = Date.now();
  pet.feedCount++;
  pet.hunger = Math.min(100, pet.hunger+25);
  stats.fed++;
  saveStats();

  if (pet.feedCount >= OVERFEED_LIMIT) { explodePet(pet); return; }

  const rect = pet.el.getBoundingClientRect();
  const cx = rect.left+65, cy = rect.top+50;

  if (pet.feedCount > OVERFEED_LIMIT*0.6) {
    pet.size  = clamp(pet.size+0.28, 0.5, 2.8);
    pet.mood  = 'stuffed';
    speak(pet, pick(SPEECHES.explode));
    triggerAnim(pet,'bloat');
    playChaos();
    addScore(20, cx, cy);
    addChaos(5);
  } else {
    pet.size  = clamp(pet.size+0.13, 0.5, 2.8);
    pet.mood  = 'happy';
    speak(pet, pick(SPEECHES.fed));
    triggerAnim(pet,'wiggle');
    playHappy();
    addScore(10, cx, cy);
  }

  spawnParticles(cx, cy, 7, pet.glowColor);
  addXP(pet, 8);
  updateHungerBar(pet);
}

function pokePet(pet) {
  if (pet.isDead) return;
  pet.lastInteract = Date.now();
  pet.mood = pet.personality === 'violent' ? 'angry' : 'neutral';
  speak(pet, pick(SPEECHES.poked));
  triggerAnim(pet,'wiggle');
  playPoke();
  const rect = pet.el.getBoundingClientRect();
  ripple(rect.left+65, rect.top+65, '#e8a020');
  addScore(5, rect.left+65, rect.top+40);
  addXP(pet, 3);
}

function zapPet(pet) {
  if (pet.isDead) return;
  pet.lastInteract = Date.now();
  pet.hunger = Math.min(100, pet.hunger+10);
  pet.mood   = pick(['ecstatic','angry','petted','scared']);
  speak(pet, pick(SPEECHES.zapped));
  triggerAnim(pet,'zap');
  playZap();
  flash('rgba(123,0,200,0.18)');
  addChaos(6);
  stats.zapped++;
  saveStats();
  const rect = pet.el.getBoundingClientRect();
  spawnParticles(rect.left+65, rect.top+45, 12, '#7b00c8');
  addScore(15, rect.left+65, rect.top+30);
  addXP(pet, 10);
  updateHungerBar(pet);
}

function petThePet(pet) {
  if (pet.isDead) return;
  pet.lastInteract = Date.now();
  pet.mood = 'petted';
  pet.hunger = Math.min(100, pet.hunger+5);
  speak(pet, pick(SPEECHES.petted));
  triggerAnim(pet,'wiggle');
  playHappy();
  const rect = pet.el.getBoundingClientRect();
  spawnParticles(rect.left+65, rect.top+50, 6, '#c8102e');
  ripple(rect.left+65, rect.top+65, '#c8102e');
  addScore(8, rect.left+65, rect.top+35);
  addXP(pet, 5);
  updateHungerBar(pet);
}

// ── DRAG ─────────────────────────────────────────────
function startDrag(e, pet) {
  if (pet.isDead) return;
  e.preventDefault();
  const pt = e.touches ? e.touches[0] : e;
  pet.dragging = true;
  pet.dragOffX = pt.clientX - pet.x;
  pet.dragOffY = pt.clientY - pet.y;
  pet.el.classList.add('dragging');
  pet.lastInteract = Date.now();
  pet.mood = 'petted';
  triggerAnim(pet,'wiggle');
  speak(pet, pick(SPEECHES.petted));
  playHappy();
}
document.addEventListener('mousemove', onMove);
document.addEventListener('touchmove', onMove, {passive:false});
document.addEventListener('mouseup',   onEnd);
document.addEventListener('touchend',  onEnd);

function onMove(e) {
  const pt = e.touches ? e.touches[0] : e;
  pets.forEach(pet=>{
    if (!pet.dragging) return;
    e.preventDefault();
    pet.x = pt.clientX - pet.dragOffX;
    pet.y = pt.clientY - pet.dragOffY;
    const sp = safePos(pet);
    setPos(pet.el, sp.x, sp.y);
    ripple(pt.clientX, pt.clientY, pet.glowColor);
  });
}
function onEnd() {
  pets.forEach(pet=>{
    if (!pet.dragging) return;
    pet.dragging = false;
    pet.el.classList.remove('dragging');
  });
}

// ── HUNGER ────────────────────────────────────────────
function drainHunger(pet) {
  if (pet.isDead) return;
  const drain = randInt(5,13) + (pet.personality==='glutton' ? 4 : 0);
  pet.hunger = clamp(pet.hunger-drain, 0, 100);
  updateHungerBar(pet);

  if      (pet.hunger > 70) { pet.mood = 'happy'; }
  else if (pet.hunger > 40) { pet.mood = 'neutral'; }
  else if (pet.hunger > NEGLECT_THRESHOLD) {
    pet.mood = 'hungry';
    speak(pet, pick(SPEECHES.hungry));
    playHungry();
  } else {
    pet.mood = 'angry';
    addChaos(9);
    onNeglect(pet);
  }
}

function updateHungerBar(pet) {
  const bar = pet.el.querySelector('.hunger-bar');
  bar.style.width = pet.hunger+'%';
  const pct = pet.hunger;
  if (pct > 60)      bar.style.background = 'linear-gradient(90deg,#2a8a4a,#e8a020)';
  else if (pct > 30) bar.style.background = 'linear-gradient(90deg,#e8a020,#c8102e)';
  else               bar.style.background = 'linear-gradient(90deg,#8a0a1e,#ff1a3a)';
}

// ── NEGLECT / CHAOS BEHAVIORS ─────────────────────────
function onNeglect(pet) {
  const since = Date.now() - pet.lastInteract;
  if (since < 12000) return;
  pet.chaos = clamp(pet.chaos+11, 0, 100);

  if (pet.chaos > 18) {
    if (pet.miniSpawned < 4) { spawnMiniDemon(pet); }
    triggerAnim(pet,'panic');
    speak(pet, pick(SPEECHES.angry));
  }
  if (pet.chaos > 38) {
    pet.x = rand(20, sw()-180);
    pet.y = rand(70, sh()-260);
    setPos(pet.el, pet.x, pet.y);
    playChaos();
    showChaosWord(pick(SPEECHES.angry), rand(50,sw()-160), rand(100,sh()-110));
  }
  if (pet.chaos > 55) {
    document.body.classList.add('tilt-mode');
    setTimeout(()=>document.body.classList.remove('tilt-mode'), 1200);
    showChaosWord('⛧', rand(50,sw()-100), rand(100,sh()-100), '#8a0a1e');
  }
  if (pet.chaos > 75) {
    document.body.classList.add('cursor-chaos');
    setTimeout(()=>document.body.classList.remove('cursor-chaos'), 3500);
    spawnCrack();
  }
  if (pet.chaos > 90) {
    spawnCrack(); spawnCrack();
    flash('rgba(200,16,46,0.15)');
    for (let i=0;i<4;i++) setTimeout(()=>
      showChaosWord(pick(['CHAOS','RUIN','DOOM','FEED','MINE','END']),
        rand(20,sw()-180), rand(80,sh()-100)), i*300);
  }
}

// ── MINI DEMONS ───────────────────────────────────────
const DEMON_EMOJIS = ['👿','😈','🦇','💀','🔥','🕷️','🐛','🦂','🧿','☠️','🫀','🩸','⛧'];
function spawnMiniDemon(pet) {
  pet.miniSpawned++;
  stats.demons++;
  saveStats();

  const mini = document.createElement('div');
  mini.className = 'mini-demon';
  mini.textContent = pick(DEMON_EMOJIS);
  let mx = rand(0, sw()-50);
  let my = rand(70, sh()-60);
  mini.style.left = mx+'px'; mini.style.top = my+'px';
  mini.style.animationDuration = rand(1.4,3.2)+'s';

  // Click for bonus score
  mini.style.pointerEvents = 'auto';
  mini.style.cursor = 'pointer';
  mini.addEventListener('click', ()=>{
    addScore(25, mx, my);
    speak(pets[0]||pets[pets.length-1], 'my child...');
    mini.style.animation='explode-out 0.4s forwards';
    setTimeout(()=>mini.remove(),400);
    spawnParticles(mx+12, my+12, 8, '#c8102e');
  });

  document.body.appendChild(mini);

  let dir = 1;
  const move = setInterval(()=>{
    if (!document.body.contains(mini)) { clearInterval(move); return; }
    mx += dir*rand(2,5);
    if (mx > sw()-50 || mx < 0) dir *= -1;
    my += Math.sin(Date.now()/450)*2.5;
    mini.style.left = mx+'px'; mini.style.top = my+'px';
  }, 50);

  setTimeout(()=>{
    clearInterval(move);
    mini.style.animation='explode-out 0.5s forwards';
    setTimeout(()=>mini.remove(),500);
    pet.miniSpawned = Math.max(0, pet.miniSpawned-1);
  }, rand(9000,19000));
}

// ── CRACKS ───────────────────────────────────────────
const CRACK_EMOJIS = ['💥','⚡','🔥','☠️','💢','🩸','⛧','💣'];
function spawnCrack() {
  const c = document.createElement('div');
  c.className = 'crack';
  c.textContent = pick(CRACK_EMOJIS);
  c.style.left = rand(5,85)+'%';
  c.style.top  = rand(10,85)+'%';
  document.getElementById('chaos-layer').appendChild(c);
  setTimeout(()=>c.remove(), 3500);
}

// ── EXPLOSION ─────────────────────────────────────────
function explodePet(pet) {
  pet.isDead = true;
  clearInterval(pet.drawInterval);
  clearInterval(pet.hungerInterval);
  stats.exploded++;
  saveStats();

  speak(pet,'💥 GONE 💥');
  const rect = pet.el.getBoundingClientRect();
  const cx = rect.left+75, cy = rect.top+65;
  flash('rgba(200,16,46,0.45)');
  playExplode();
  spawnParticles(cx, cy, 30, pet.glowColor);
  spawnParticles(cx, cy, 18, '#e8a020');
  spawnParticles(cx, cy, 10, '#f0e6d0');
  showChaosWord('💥 ANNIHILATED', cx-60, cy-60, '#e8a020');
  addChaos(18);
  addScore(100, cx, cy);

  pet.el.style.animation = 'explode-out 0.65s forwards';
  setTimeout(()=>{
    pet.el.remove();
    pets = pets.filter(p=>p.id!==pet.id);
    updateChaosUI();
    // Rebirth after delay
    setTimeout(()=>{
      const gx = rand(30, sw()-190);
      const gy = rand(80, sh()-260);
      const nb = createPet(gx,gy);
      if (nb) { nb.mood='ecstatic'; speak(nb,'I AM REBORN'); triggerAnim(nb,'ghost'); }
    }, 3200);
  }, 750);
}

// ── PET INTERACTIONS ──────────────────────────────────
setInterval(()=>{
  if (pets.length < 2) return;
  if (Math.random() > 0.28) return;
  const a = pick(pets), b = pick(pets);
  if (a.id===b.id || a.isDead || b.isDead) return;
  const dx=a.x-b.x, dy=a.y-b.y;
  const dist = Math.sqrt(dx*dx+dy*dy);
  if (dist < 210) {
    const react = pick(['fight','love','scared','dance']);
    if (react==='fight') {
      speak(a, pick(SPEECHES.fight));
      speak(b, pick(SPEECHES.fight));
      triggerAnim(a,'zap'); triggerAnim(b,'zap');
      addChaos(5); playZap();
    } else if (react==='love') {
      speak(a, pick(SPEECHES.love));
      speak(b, pick(SPEECHES.love));
      a.mood=b.mood='happy';
      spawnParticles(
        Math.min(a.x,b.x)+Math.abs(dx)/2+65,
        Math.min(a.y,b.y)+Math.abs(dy)/2+50,
        6, '#c8102e'
      );
    } else if (react==='scared') {
      speak(a,'AAAH'); speak(b,'AAAH');
      a.mood=b.mood='scared';
      const push = 32;
      a.x=clamp(a.x+(dx/dist)*push, 0,sw()-160);
      a.y=clamp(a.y+(dy/dist)*push,64,sh()-260);
      b.x=clamp(b.x-(dx/dist)*push, 0,sw()-160);
      b.y=clamp(b.y-(dy/dist)*push,64,sh()-260);
      setPos(a.el,a.x,a.y); setPos(b.el,b.x,b.y);
    } else {
      // dance — they wiggle together
      triggerAnim(a,'wiggle'); triggerAnim(b,'wiggle');
      a.mood=b.mood='ecstatic';
      speak(a,'DANCE'); speak(b,'DANCE');
      playHappy();
      addScore(12, (a.x+b.x)/2+65, (a.y+b.y)/2+50);
    }
  }
}, 2800);

// ── CHAOS SYSTEM ─────────────────────────────────────
function addChaos(amt) {
  chaosLevel = clamp(chaosLevel+amt, 0, 100);
  updateChaosUI();
  if (chaosLevel > 80) applyMaxChaos();
}

function updateChaosUI() {
  document.getElementById('chaos-val').textContent = Math.round(chaosLevel);
  const pill = document.getElementById('chaos-pill');
  if (chaosLevel < 30) {
    pill.style.borderColor = 'rgba(200,16,46,0.3)';
  } else if (chaosLevel < 60) {
    pill.style.borderColor = 'rgba(200,16,46,0.6)';
    pill.style.boxShadow   = '0 0 8px rgba(200,16,46,0.2)';
  } else {
    pill.style.borderColor = '#c8102e';
    pill.style.boxShadow   = '0 0 15px rgba(200,16,46,0.4)';
  }
  if (!chaosDecayRunning) startChaosDecay();
  updateLeaderboardCurrent();
}

let chaosDecayRunning = false;
function startChaosDecay() {
  chaosDecayRunning = true;
  const decay = setInterval(()=>{
    chaosLevel = clamp(chaosLevel-1, 0, 100);
    updateChaosUI();
    if (chaosLevel <= 0) { clearInterval(decay); chaosDecayRunning=false; }
  }, 600);
}

function applyMaxChaos() {
  document.body.classList.add('tilt-mode');
  setTimeout(()=>document.body.classList.remove('tilt-mode'), 1200);
  for (let i=0;i<6;i++) setTimeout(()=>
    showChaosWord(pick(['CHAOS','DOOM','MINE','PAIN','HELP','END','RUIN','⛧']),
      rand(10,sw()-200), rand(80,sh()-90)), i*180);
  flash('rgba(200,16,46,0.25)');
  playChaos();
  addScore(30);
}

// ── IDLE DRIFT ───────────────────────────────────────
setInterval(()=>{
  pets.forEach(pet=>{
    if (pet.isDead || pet.dragging) return;
    // Personality-based movement
    const speed = pet.personality==='chaos' ? 1.4 : 0.55;
    pet.x += pet.vx * speed;
    pet.y += pet.vy * (speed*0.6);
    if (pet.x < 0 || pet.x > sw()-160) pet.vx *= -1;
    if (pet.y < 64 || pet.y > sh()-260) pet.vy *= -1;
    pet.x = clamp(pet.x, 0, sw()-160);
    pet.y = clamp(pet.y, 64, sh()-260);
    if (Math.random() < 0.04) { pet.vx=rand(-1.2,1.2); pet.vy=rand(-0.8,0.8); }
    setPos(pet.el, pet.x, pet.y);
  });
}, 80);

// ── ANIMATIONS ────────────────────────────────────────
function triggerAnim(pet, name) {
  const el = pet.el;
  el.className = el.className.replace(/pet-anim-\w+/g,'').trim();
  if (name && name!=='none') {
    void el.offsetWidth;
    el.classList.add('pet-anim-'+name);
    if (['wiggle','bloat','zap'].includes(name))
      setTimeout(()=>el.classList.remove('pet-anim-'+name), 750);
  }
}

// ── SPEECH ────────────────────────────────────────────
function speak(pet, msg) {
  if (!pet.el) return;
  const bubble = pet.el.querySelector('.pet-speech-bubble');
  bubble.textContent = msg;
  bubble.classList.add('visible');
  clearTimeout(pet.speechTimer);
  pet.speechTimer = setTimeout(()=>bubble.classList.remove('visible'), 2400);
}

// ── AMBIENT ───────────────────────────────────────────
setInterval(()=>{
  if (pets.length===0) return;
  const live = pets.filter(p=>!p.isDead);
  if (!live.length) return;
  if (Math.random() < 0.3) speak(pick(live), pick(SPEECHES.ambient));
  if (chaosLevel>25 && Math.random()<0.14) {
    showChaosWord(pick(['cursed','🩸','help','why','MINE','eternal','pain','⛧']),
      rand(10,sw()-200), rand(100,sh()-100));
  }
}, 3800);

// ── LEADERBOARD ───────────────────────────────────────
function updateLeaderboardCurrent() {
  document.getElementById('lb-cur-score').textContent = score;
  document.getElementById('lb-cur-grade').textContent  = getGrade(score);
  // Also update stat displays
  document.getElementById('stat-fed').textContent      = stats.fed;
  document.getElementById('stat-exploded').textContent = stats.exploded;
  document.getElementById('stat-demons').textContent   = stats.demons;
  document.getElementById('stat-zapped').textContent   = stats.zapped;
  document.getElementById('stat-sessions').textContent = stats.sessions;
}

function renderLeaderboard() {
  const scores = loadScores();
  const list   = document.getElementById('lb-list');
  list.innerHTML = '';

  if (!scores.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--bone-dim);font-family:var(--font-mono);font-size:0.75rem;padding:20px;">No scores saved yet</div>';
    return;
  }

  const medals = ['🥇','🥈','🥉'];
  scores.slice(0,10).forEach((entry,i)=>{
    const row = document.createElement('div');
    row.className = 'lb-row';
    row.innerHTML = `
      <span class="rank">${medals[i]||'#'+(i+1)}</span>
      <span class="lb-name">${entry.name}</span>
      <span class="lb-pts">${entry.score}</span>
      <span class="lb-grade">${entry.grade}</span>
    `;
    list.appendChild(row);
  });
}

window.toggleLeaderboard = function() {
  const panel = document.getElementById('leaderboard-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    renderLeaderboard();
    updateLeaderboardCurrent();
  }
};

window.saveScore = function() {
  document.getElementById('name-modal').classList.remove('hidden');
  document.getElementById('name-input').value = '';
  document.getElementById('name-input').focus();
};

window.confirmSaveScore = function() {
  const name = document.getElementById('name-input').value.trim() || 'ANONYMOUS';
  const scores = loadScores();
  scores.push({ name: name.toUpperCase().slice(0,12), score, grade: getGrade(score), date: Date.now() });
  scores.sort((a,b)=>b.score-a.score);
  persistScores(scores.slice(0,20));
  cancelModal();
  renderLeaderboard();
  showLevelUp(`⛧ SCORE SAVED ⛧`);
};

window.cancelModal = function() {
  document.getElementById('name-modal').classList.add('hidden');
};

document.getElementById('name-input')?.addEventListener('keydown', e=>{
  if (e.key==='Enter') window.confirmSaveScore();
  if (e.key==='Escape') window.cancelModal();
});

// ── GLOBAL CONTROLS ───────────────────────────────────
window.spawnPet = function() {
  if (pets.length>=MAX_PETS) {
    if (pets[0]) speak(pets[0],'TOO MANY DEMONS');
    playHungry(); return;
  }
  createPet(rand(50,sw()-210), rand(80,sh()-260));
};

window.nukeAll = function() {
  flash('rgba(200,16,46,0.6)');
  playExplode();
  [...pets].forEach(p=>explodePet(p));
  document.querySelectorAll('.mini-demon').forEach(m=>m.remove());
  chaosLevel = 0; updateChaosUI();
  addScore(50);
  setTimeout(()=>createPet(rand(100,sw()-210),rand(100,sh()-260)), 2800);
};

window.toggleSound = function() {
  soundEnabled = !soundEnabled;
  document.getElementById('sound-toggle').textContent = soundEnabled ? '🔊' : '🔇';
};

// ── RESIZE ────────────────────────────────────────────
window.addEventListener('resize',()=>{
  pets.forEach(pet=>{
    pet.x = clamp(pet.x, 0, sw()-160);
    pet.y = clamp(pet.y, 64, sh()-260);
    setPos(pet.el, pet.x, pet.y);
  });
});

// ── INIT ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>createPet(sw()*0.22, sh()*0.42), 250);
  setTimeout(()=>createPet(sw()*0.62, sh()*0.46), 850);
  setTimeout(()=>createPet(sw()*0.42, sh()*0.36), 1500);

  // Hide tooltip
  setTimeout(()=>{
    const tt=document.getElementById('tooltip');
    if(tt) tt.style.opacity='0';
    setTimeout(()=>{if(tt)tt.style.display='none';},600);
  },7000);

  updateLeaderboardCurrent();
});
