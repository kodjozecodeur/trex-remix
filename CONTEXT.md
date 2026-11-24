# T-Rex Remix

An endless side-scrolling runner through a prehistoric volcano jungle, where a pixel dinosaur collects powers on the run and uses them against what it meets.

## Language

### The run

**Run**:
One attempt, from start until the Runner loses its last Life.
_Avoid_: Game, round, session

**Score**:
Points earned in a Run: distance covered plus a bonus for each Enemy destroyed by a Fireball.
_Avoid_: Points, distance

**High Score**:
The best Score ever reached on this device, kept between visits.
_Avoid_: Best, record, HI

**Life**:
One of the Runner's 3 chances in a Run; touching an Obstacle or Enemy costs one, and lost Lives never come back within that Run.
_Avoid_: Heart, HP, health

**Invincibility**:
The roughly 1.5-second window after losing a Life in which the Runner blinks and passes through Obstacles and Enemies unharmed.
_Avoid_: I-frames, grace period, shield

**Runner**:
The dinosaur the player controls.
_Avoid_: Player, hero, dino, character

**Obstacle**:
Lifeless terrain hazard the Runner must jump over or duck under; fireballs do not affect it.
_Avoid_: Cactus, block, barrier

**Boulder**:
A short Obstacle on the ground.

**Lava Vent**:
A tall Obstacle on the ground that needs a well-timed jump.

**Enemy**:
A creature on the ground or in the air that the Runner can dodge or kill with a Fireball.
_Avoid_: Monster, mob, bird

**Beetle**:
An Enemy that crawls along the ground; jump it or shoot it with a duck-throw.

**Bat**:
An Enemy that flies at one of two heights: a **Low Bat** at head height (duck under it or shoot it standing) or a **High Bat** above the Runner (harmless unless jumped into, reachable only with a jump-throw).

### Powers

**Power-up**:
A pickup that floats at jump height and appears roughly every 15–20 seconds; touching it adds 5 to the Runner's Ammo, up to a cap of 10. Fire is the only power for now.

**Ammo**:
The number of Fireballs the Runner can still throw, shown on screen; every Run starts at 0.
_Avoid_: Charges, shots, fireball count
_Avoid_: Item, pickup, bonus

**Fireball**:
A projectile the Runner throws straight ahead from its current height, at most one every ~0.3 seconds; it flies until it destroys the first Enemy it hits or leaves the screen.
_Avoid_: Shot, bullet, projectile

**Duck-throw / Standing throw / Jump-throw**:
A Fireball thrown while ducking, standing or airborne; it flies at that stance's height and so reaches Beetles, Low Bats or High Bats respectively.
