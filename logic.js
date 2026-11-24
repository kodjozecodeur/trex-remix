// Game rules for T-Rex Remix. step(state, input, dt) -> new state.
// No DOM, canvas, audio or timers here; the page in index.html is the shell.
// World units: x grows to the right, y is height above the ground (bottom edge).

const W = 800;
const RUNNER_X = 60;
const R = {
  LIVES: 3, INV: 1.5, RETRY: 0.5,
  SPEED0: 300, ACCEL: 8, SPEED_MAX: 700,
  GRAVITY: 2000, JUMP_V: 640, DROP: 4000,
  AMMO_PER: 5, AMMO_CAP: 10, COOLDOWN: 0.3, FB_SPEED: 600, KILL: 50,
  POWER_MIN: 15, POWER_SPREAD: 5, UNLOCK: 500,
};
// Fixed sprite boxes [w, h]; sprites must fill exactly these.
const SIZE = {
  runner: [44, 48], duck: [56, 26],
  boulder: [30, 28], vent: [26, 52], beetle: [34, 20], lowBat: [34, 18], highBat: [34, 18],
  fireball: [14, 10], power: [22, 22],
};
const POWER_Y = 64; // jump height
const SPAWN_Y = { lowBat: 32, highBat: 84 }; // Low Bat at head height, High Bat above the Runner
// Fireball height by stance: ducking flies at Beetle level, otherwise from head height.
const THROW_Y = { duck: 6, stand: 36 };
const EXTRA = { beetle: 60, lowBat: 40, highBat: 40 }; // speed on top of the scroll
const ENEMY = new Set(['beetle', 'lowBat', 'highBat']);
const OBSTACLE = new Set(['boulder', 'vent']);
const HAZARD = new Set([...OBSTACLE, ...ENEMY]);

// mulberry32, seed kept in state so runs are reproducible.
function rand(s) {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function ent(kind, x, y = 0) {
  const [w, h] = SIZE[kind];
  return { kind, x, y, w, h };
}

function init(seed = 1) {
  const s = {
    phase: 'title', seed,
    runner: { y: 0, vy: 0, duck: false },
    lives: R.LIVES, inv: 0, ammo: 0, cooldown: 0,
    ents: [], dist: 0, score: 0, speed: R.SPEED0,
    nextSpawn: 1.5, nextPower: 0,
    bonus: 0, overT: 0, events: [],
  };
  s.nextPower = R.POWER_MIN + R.POWER_SPREAD * rand(s);
  return s;
}

const overlap = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function runnerBox(s) {
  const [w, h] = SIZE[s.runner.duck ? 'duck' : 'runner'];
  return { x: RUNNER_X, y: s.runner.y, w, h };
}

function jump(s) {
  s.runner.vy = R.JUMP_V;
  s.runner.duck = false;
  s.events.push('jump');
}

function step(prev, input, dt) {
  const s = structuredClone(prev);
  s.events = [];

  if (s.phase === 'title') {
    if (input.jump) { s.phase = 'running'; jump(s); move(s, dt); }
    return s;
  }
  if (s.phase === 'over') {
    s.overT += dt;
    // Retry needs a fresh press after the guard, so a held jump never restarts by accident.
    if (s.overT >= R.RETRY && !input.jump) s.retryArmed = true;
    if (!s.retryArmed || !input.jump) return s;
    const fresh = init(s.seed);
    fresh.phase = 'running';
    jump(fresh);
    move(fresh, dt);
    return fresh;
  }
  if (input.pause) {
    s.phase = s.phase === 'paused' ? 'running' : 'paused';
    return s;
  }
  if (s.phase === 'paused') return s;

  const r = s.runner;
  s.speed = Math.min(R.SPEED_MAX, s.speed + R.ACCEL * dt);
  s.dist += s.speed * dt;
  s.inv = Math.max(0, s.inv - dt);
  s.cooldown = Math.max(0, s.cooldown - dt);

  if (r.y === 0 && input.jump) jump(s);
  r.duck = !!input.duck && r.y === 0;
  if (input.duck && r.y > 0) r.vy -= R.DROP * dt;
  move(s, dt);

  if (input.throw && s.ammo > 0 && s.cooldown === 0) {
    s.ammo--;
    s.cooldown = R.COOLDOWN;
    const y = r.duck ? THROW_Y.duck : r.y + THROW_Y.stand;
    s.ents.push(ent('fireball', RUNNER_X + runnerBox(s).w, y));
    s.events.push('throw');
  }

  for (const e of s.ents) {
    e.x += e.kind === 'fireball' ? R.FB_SPEED * dt : -(s.speed + (EXTRA[e.kind] || 0)) * dt;
  }
  for (const f of s.ents) {
    if (f.kind !== 'fireball') continue;
    const hit = s.ents.find((e) => ENEMY.has(e.kind) && !e.dead && overlap(f, e));
    if (hit) {
      hit.dead = f.dead = true;
      s.bonus += R.KILL;
      s.events.push('kill');
    }
  }

  const rb = runnerBox(s);
  for (const e of s.ents) {
    if (e.dead || !overlap(rb, e)) continue;
    if (e.kind === 'power') {
      e.dead = true;
      s.ammo = Math.min(R.AMMO_CAP, s.ammo + R.AMMO_PER);
      s.events.push('power');
    } else if (HAZARD.has(e.kind) && s.inv === 0 && s.lives > 0) {
      s.lives--;
      s.inv = R.INV;
      s.events.push('hit');
      if (s.lives === 0) { s.phase = 'over'; s.events.push('over'); }
    }
  }
  s.ents = s.ents.filter((e) => !e.dead && e.x > -100 && !(e.kind === 'fireball' && e.x > W));

  s.nextSpawn -= dt;
  s.nextPower -= dt;
  if (s.nextSpawn <= 0) {
    const kinds = s.score < R.UNLOCK ? ['boulder', 'beetle']
      : ['boulder', 'beetle', 'vent', 'lowBat', 'highBat'];
    const k = kinds[Math.floor(rand(s) * kinds.length)];
    s.ents.push(ent(k, W, SPAWN_Y[k]));
    s.nextSpawn = 0.9 + rand(s) * 0.9;
    // Power-ups ride on hazard spawns: right above this Obstacle, or alone mid-gap.
    if (s.nextPower <= 0) {
      const x = OBSTACLE.has(k) && rand(s) < 0.5 ? W : W + (s.speed * s.nextSpawn) / 2;
      s.ents.push(ent('power', x, POWER_Y));
      s.nextPower = R.POWER_MIN + R.POWER_SPREAD * rand(s);
    }
  }

  s.score = Math.floor(s.dist / 10) + s.bonus;
  return s;
}

function move(s, dt) {
  const r = s.runner;
  r.vy -= R.GRAVITY * dt;
  r.y = Math.max(0, r.y + r.vy * dt);
  if (r.y === 0) r.vy = 0;
}

if (typeof module !== 'undefined') module.exports = { init, step, ent, R, SIZE, W, RUNNER_X, POWER_Y, SPAWN_Y };
