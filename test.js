// Rule checks for the pure step() seam. Run: node test.js
const test = require('node:test');
const assert = require('node:assert');
const { init, step, ent, RUNNER_X, POWER_Y, SPAWN_Y } = require('./logic.js');

const DT = 1 / 60;
function run(s, input, secs) {
  for (let t = 0; t < secs; t += DT) s = step(s, input, DT);
  return s;
}
// A running state with no random spawns, Runner on the ground.
function started() {
  let s = init(1);
  s = step(s, { jump: true }, DT);
  s.nextSpawn = s.nextPower = Infinity;
  return run(s, {}, 1);
}
const at = (s, kind, dx = 0, y) => { s.ents.push(ent(kind, RUNNER_X + dx, y)); return s; };

test('title waits for the first jump, which starts the Run', () => {
  let s = run(init(1), {}, 2);
  assert.equal(s.phase, 'title');
  s = step(s, { jump: true }, DT);
  assert.equal(s.phase, 'running');
  assert.ok(s.runner.y > 0);
});

test('Score grows with distance', () => {
  const s = started();
  assert.ok(run(s, {}, 2).score > s.score);
});

test('jump lands back on the ground; Down in mid-air lands sooner', () => {
  const s = started();
  const plain = run(step(s, { jump: true }, DT), {}, 0.4);
  const dropped = run(step(s, { jump: true }, DT), { duck: true }, 0.4);
  assert.ok(plain.runner.y > 0 && dropped.runner.y === 0);
  assert.equal(run(plain, {}, 1).runner.y, 0);
});

test('touching a Boulder costs one Life and starts Invincibility', () => {
  const s = step(at(started(), 'boulder'), {}, DT);
  assert.equal(s.lives, 2);
  assert.ok(s.inv > 1.4);
  assert.ok(s.events.includes('hit'));
});

test('a Runner in the air above a Boulder is not hit', () => {
  const s = at(started(), 'boulder');
  s.runner.y = 60;
  assert.equal(step(s, {}, DT).lives, 3);
});

test('no Life is lost during Invincibility, and it wears off after ~1.5 s', () => {
  let s = step(at(started(), 'boulder'), {}, DT);
  s = step(at(s, 'beetle'), {}, DT);
  assert.equal(s.lives, 2);
  s = run(s, {}, 1.5);
  s.ents = [];
  assert.equal(step(at(s, 'beetle'), {}, DT).lives, 1);
});

test('touching a Beetle is a hit; the third hit ends the Run', () => {
  let s = started();
  for (let i = 0; i < 3; i++) { s.inv = 0; s.ents = []; s = step(at(s, 'beetle'), {}, DT); }
  assert.equal(s.lives, 0);
  assert.equal(s.phase, 'over');
  assert.ok(s.events.includes('over'));
});

// --- Power-ups, Ammo and Fireballs ---
function grab(s) { s.runner.y = 50; s.runner.vy = 0; return step(at(s, 'power', 0, POWER_Y), {}, DT); }
const armed = (n = 5) => Object.assign(started(), { ammo: n });
const fireballs = (s) => s.ents.filter((e) => e.kind === 'fireball');

test('Ammo starts at 0; each Power-up adds 5, capped at 10', () => {
  let s = started();
  assert.equal(s.ammo, 0);
  const counts = [];
  for (let i = 0; i < 3; i++) { s = grab(s); counts.push(s.ammo); s = run(s, {}, 1); }
  assert.deepEqual(counts, [5, 10, 10]);
});

test('a standing Runner passes under a Power-up without collecting it', () => {
  assert.equal(step(at(started(), 'power', 0, POWER_Y), {}, DT).ammo, 0);
});

test('throwing with 0 Ammo does nothing', () => {
  const s = step(started(), { throw: true }, DT);
  assert.equal(fireballs(s).length, 0);
  assert.ok(!s.events.includes('throw'));
});

test('a throw spends one Ammo; cooldown blocks another within ~0.3 s', () => {
  let s = step(armed(), { throw: true }, DT);
  s = run(s, { throw: true }, 0.2);
  assert.equal(s.ammo, 4);
  s = run(s, { throw: true }, 0.15);
  assert.equal(s.ammo, 3);
});

test('a Duck-throw destroys a Beetle and adds the kill bonus', () => {
  let s = step(armed(), { duck: true, throw: true }, DT);
  s = at(s, 'beetle', 200);
  const before = s.score;
  s = run(s, { duck: true }, 0.3);
  assert.ok(!s.ents.some((e) => e.kind === 'beetle'));
  assert.equal(fireballs(s).length, 0);
  assert.ok(s.score - before >= 50);
});

test('a Standing throw flies over a Beetle', () => {
  let s = step(armed(), { throw: true }, DT);
  s = run(at(s, 'beetle', 200), {}, 0.3);
  assert.ok(s.ents.some((e) => e.kind === 'beetle'));
});

test('a Fireball destroys only the first Enemy it hits', () => {
  let s = step(armed(), { duck: true, throw: true }, DT);
  s = at(at(s, 'beetle', 150), 'beetle', 400);
  s = run(s, { duck: true }, 0.25);
  assert.equal(s.ents.filter((e) => e.kind === 'beetle').length, 1);
});

test('a Fireball passes through a Boulder and is gone once off-screen', () => {
  let s = step(armed(), { duck: true, throw: true }, DT);
  s = at(s, 'boulder', 150);
  s = run(s, { duck: true }, 0.25);
  assert.ok(s.ents.some((e) => e.kind === 'boulder'));
  assert.equal(fireballs(s).length, 1);
  s.ents = s.ents.filter((e) => e.kind === 'fireball');
  assert.equal(fireballs(run(s, {}, 2)).length, 0);
});

test('Power-ups appear roughly every 15-20 s, floating at jump height', () => {
  let s = step(init(7), { jump: true }, DT);
  s.lives = 1e9;
  const times = [];
  let prev = 0, visibleFrames = 0;
  for (let t = 0; t < 60; t += DT) {
    s = step(s, {}, DT);
    const powers = s.ents.filter((e) => e.kind === 'power');
    if (powers.length > prev) times.push(t);
    powers.forEach((e) => assert.equal(e.y, POWER_Y));
    visibleFrames += powers.length;
    prev = powers.length;
  }
  assert.ok(visibleFrames > times.length * 60, 'each Power-up stays on screen at least 1 s');
  assert.ok(times[0] >= 15 && times[0] <= 22, `first at ${times[0]}`);
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    assert.ok(gap >= 14 && gap <= 23, `gap ${gap}`);
  }
  assert.ok(times.length >= 2);
});

// --- Bats, Lava Vents and difficulty ---
const { lowBat: LOW_BAT_Y, highBat: HIGH_BAT_Y } = SPAWN_Y;

test('a Low Bat hits a standing Runner but a ducking Runner passes under it', () => {
  assert.equal(step(at(started(), 'lowBat', 0, LOW_BAT_Y), {}, DT).lives, 2);
  assert.equal(step(at(started(), 'lowBat', 0, LOW_BAT_Y), { duck: true }, DT).lives, 3);
});

test('a High Bat is harmless to a standing Runner but hits one that jumps into it', () => {
  assert.equal(step(at(started(), 'highBat', 0, HIGH_BAT_Y), {}, DT).lives, 3);
  const s = at(started(), 'highBat', 0, HIGH_BAT_Y);
  s.runner.y = 50;
  assert.equal(step(s, {}, DT).lives, 2);
});

test('a Standing throw destroys a Low Bat', () => {
  let s = step(armed(), { throw: true }, DT);
  s = run(at(s, 'lowBat', 200, LOW_BAT_Y), {}, 0.3);
  assert.ok(!s.ents.some((e) => e.kind === 'lowBat'));
});

test('a Jump-throw destroys a High Bat, a Standing throw misses it', () => {
  let miss = step(armed(), { throw: true }, DT);
  miss = run(at(miss, 'highBat', 200, HIGH_BAT_Y), {}, 0.3);
  assert.ok(miss.ents.some((e) => e.kind === 'highBat'));

  const s = armed();
  s.runner.y = 50; s.runner.vy = 0;
  let hit = step(s, { throw: true }, DT);
  hit = run(at(hit, 'highBat', 200, HIGH_BAT_Y), {}, 0.3);
  assert.ok(!hit.ents.some((e) => e.kind === 'highBat'));
});

test('a Lava Vent is a tall Obstacle that Fireballs pass through', () => {
  const s = at(started(), 'vent');
  s.runner.y = 40;
  assert.equal(step(s, {}, DT).lives, 2, 'a low jump still clips it');
  let f = step(armed(), { duck: true, throw: true }, DT);
  f = run(at(f, 'vent', 150), { duck: true }, 0.25);
  assert.ok(f.ents.some((e) => e.kind === 'vent'));
  assert.equal(fireballs(f).length, 1);
});

test('Bats and Lava Vents only appear after ~500 points; speed rises to a cap', () => {
  let s = step(init(3), { jump: true }, DT);
  s.lives = 1e9;
  const late = new Set(['vent', 'lowBat', 'highBat']);
  let seenLate = false, speedAt10 = 0;
  for (let t = 0; t < 120; t += DT) {
    s = step(s, {}, DT);
    const has = s.ents.some((e) => late.has(e.kind));
    if (s.score < 480) assert.ok(!has, `late hazard at score ${s.score}`);
    seenLate ||= has;
    if (!speedAt10 && t >= 10) speedAt10 = s.speed;
  }
  assert.ok(seenLate);
  assert.ok(speedAt10 > 300);
  assert.equal(s.speed, 700);
});

// --- Pause, retry and events ---
function gameOver() {
  let s = started();
  s.lives = 1; s.inv = 0;
  return step(at(s, 'boulder'), {}, DT);
}

test('pause freezes the Run until pause is pressed again', () => {
  const s = step(started(), { pause: true }, DT);
  assert.equal(s.phase, 'paused');
  const frozen = run(s, { jump: true }, 2);
  assert.equal(frozen.dist, s.dist);
  assert.equal(frozen.runner.y, 0);
  assert.equal(step(frozen, { pause: true }, DT).phase, 'running');
});

test('Space within ~0.5 s of game over does not restart; after that it starts a fresh Run', () => {
  let s = gameOver();
  assert.equal(s.phase, 'over');
  s = run(s, { jump: true }, 0.4);
  assert.equal(s.phase, 'over');
  s = run(s, {}, 0.2);
  s = step(s, { jump: true }, DT);
  assert.equal(s.phase, 'running');
  assert.equal(s.lives, 3);
  assert.equal(s.ammo, 0);
  assert.ok(s.score < 5);
});

test('step reports the frame events the sound reacts to', () => {
  const all = [];
  let s = step(armed(), { jump: true }, DT); all.push(...s.events);
  s = run(s, {}, 1);
  s.runner.y = 50; s = step(at(s, 'power', 0, POWER_Y), {}, DT); all.push(...s.events);
  s = run(s, {}, 1);
  s = step(at(s, 'beetle', 70), { duck: true, throw: true }, DT); all.push(...s.events);
  s = run(s, {}, 0.1);
  for (let i = 0; i < 2; i++) { s = step(at(s, 'boulder'), {}, DT); all.push(...s.events); s.inv = 0; }
  s.lives = 1; s.inv = 0; s.ents = [];
  s = step(at(s, 'boulder'), {}, DT); all.push(...s.events);
  for (const e of ['jump', 'power', 'throw', 'kill', 'hit', 'over']) assert.ok(all.includes(e), e);
});

test('holding Space through game over does not restart; a fresh press after ~0.5 s does', () => {
  let s = run(gameOver(), { jump: true }, 1.5);
  assert.equal(s.phase, 'over');
  s = step(s, {}, DT);
  assert.equal(step(s, { jump: true }, DT).phase, 'running');
});
