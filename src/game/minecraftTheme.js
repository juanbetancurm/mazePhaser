/**
 * minecraftTheme.js — Image-based Minecraft theme for AngleMaze.
 *
 * WHAT: Loads external PNG assets and provides themed rendering functions.
 *   All images are loaded from public/assets/ during preload().
 *   If any image fails to load, the game falls back to flat-color rendering.
 *
 * WHY external images instead of procedural textures?
 *   Phaser's textures.generate() only supports 16 fixed colors — the output
 *   looks crude and nothing like real Minecraft graphics. Real PNG assets with
 *   proper shading, noise, and color variation are required for the look.
 *
 * HOW it works:
 *   1. preloadThemeAssets(scene) — call from MazeScene.preload().
 *      Queues all PNGs for loading. Phaser downloads them in parallel.
 *   2. isThemeLoaded(scene) — check in create() whether all assets loaded.
 *      Returns true only if every texture exists in the Texture Manager.
 *   3. Helper functions — drawThemedBackground(), drawThemedWalls(), etc.
 *      Each checks isThemeLoaded() and falls back to flat colors if false.
 *
 * PERFORMANCE NOTES:
 *   - TileSprite uses GL_REPEAT internally — the GPU tiles the texture.
 *     Zero CPU cost per frame for the grass background.
 *   - Wall textures are drawn ONCE to a RenderTexture (offscreen canvas),
 *     then displayed as a single image. No per-frame re-drawing.
 *   - Sprites (player, enemies, exit) are standard Phaser sprites —
 *     one draw call each per frame. Total: ~8 draw calls for sprites.
 *   - All textures are 32×32 or 48×48 — tiny GPU memory footprint.
 */

// ── Asset keys and paths ────────────────────────────────────────────────────
//
// WHAT: Mapping of texture keys (used in Phaser code) to file paths.
// WHY: Centralizes all asset references. To swap an image, change the path
//   here — no hunting through MazeScene.js for hardcoded strings.
// HOW: Paths are relative to the Vite `public/` folder.
//   `public/assets/grass.png` → served at `/assets/grass.png`.

const ASSETS = {
  grass:  '/assets/grass.png',
  dirt:   '/assets/dirt.png',
  border: '/assets/border.png',
  player: '/assets/player.png',
  enemy:  '/assets/enemy.png',
  exit:   '/assets/exit.png',
  checkpoint: '/assets/checkpoint.png',
};


/**
 * preloadThemeAssets(scene)
 *
 * WHAT: Queues all Minecraft theme images for loading.
 *   Must be called from MazeScene.preload() — Phaser's loader only
 *   auto-starts during the preload lifecycle phase.
 *
 * WHY in preload() and not create()?
 *   Phaser guarantees that all assets queued in preload() are fully
 *   downloaded before create() runs. If you queue images in create(),
 *   they won't be available immediately — you'd need to manually start
 *   the loader and wait for completion events. preload() handles this
 *   automatically.
 *
 * HOW: this.load.image(key, path) adds the image to the download queue.
 *   Phaser downloads all queued files in parallel, shows a loading state
 *   if configured, and only calls create() when everything is ready.
 *
 * @param {Phaser.Scene} scene  The MazeScene instance (pass `this`).
 */
export function preloadThemeAssets(scene) {
  Object.entries(ASSETS).forEach(([key, path]) => {
    // WHAT: Skip if this texture is already in the manager.
    // WHY: On scene.restart(), preload() runs again but the textures from
    //   the first load are still in memory (they live on the Game object,
    //   not the scene). Loading them again would trigger a warning.
    if (!scene.textures.exists(key)) {
      scene.load.image(key, path);
    }
  });
}


/**
 * isThemeLoaded(scene)
 *
 * WHAT: Returns true if ALL theme textures loaded successfully.
 *
 * WHY: If the user hasn't placed the PNG files yet (or a file path is wrong),
 *   we need to know so we can fall back to flat-color rendering instead of
 *   crashing with "Texture not found" errors.
 *
 * HOW: Checks scene.textures.exists() for every key in ASSETS.
 *   ALL must exist — a partially loaded theme would look broken.
 *
 * @param {Phaser.Scene} scene
 * @returns {boolean}
 */
export function isThemeLoaded(scene) {
  return Object.keys(ASSETS).every(key => scene.textures.exists(key));
}


/**
 * WALL_DRAW_THICKNESS — visual width of themed walls in pixels.
 *
 * WHAT: How thick the dirt-block walls appear on screen.
 * WHY: Must be wide enough to look like chunky Minecraft dirt blocks.
 *   16px matches the physics body WALL_THICKNESS (8) × 2, giving a
 *   visually accurate collision boundary.
 * HOW: Used as lineWidth in drawThemedWalls().
 */
export const WALL_DRAW_THICKNESS = 16;


/**
 * drawThemedBackground(scene)
 *
 * WHAT: Tiles the grass texture across the entire 800×600 canvas.
 *   If the grass texture didn't load, falls back to a solid green color.
 *
 * WHY TileSprite?
 *   Phaser's TileSprite uses GL_REPEAT in WebGL — the GPU repeats the
 *   texture with essentially zero CPU cost per frame. A 32×32 grass tile
 *   is repeated ~625 times to fill 800×600, but the GPU handles it in
 *   a single draw call.
 *
 * WHY setOrigin(0)?
 *   By default, Phaser positions sprites by their CENTER. setOrigin(0)
 *   changes the anchor to the TOP-LEFT corner, so (0, 0) means the
 *   sprite's top-left corner is at the canvas's top-left corner.
 *
 * @param {Phaser.Scene} scene
 */
export function drawThemedBackground(scene) {
  if (isThemeLoaded(scene)) {
    scene.add.tileSprite(0, 0, 800, 600, 'grass')
      .setOrigin(0)
      .setDepth(-10);
  } else {
    // Fallback: solid green approximating grass
    scene.cameras.main.setBackgroundColor('#2d5a1e');
  }
}


/**
 * drawThemedBorder(scene)
 *
 * WHAT: Draws a wood/log textured border around the maze edges.
 *   Four TileSprite strips placed along the top, bottom, left, right edges.
 *
 * WHY separate from the background?
 *   The grass fills the interior. The border frames it visually, matching
 *   the brown wooden frame in the Minecraft goal image.
 *
 * @param {Phaser.Scene} scene
 */
export function drawThemedBorder(scene) {
  if (!isThemeLoaded(scene)) return;

  const T = 12; // border thickness in pixels

  // Top border
  scene.add.tileSprite(400, T / 2, 800, T, 'border').setDepth(10);
  // Bottom border
  scene.add.tileSprite(400, 600 - T / 2, 800, T, 'border').setDepth(10);
  // Left border
  scene.add.tileSprite(T / 2, 300, T, 600, 'border').setDepth(10);
  // Right border
  scene.add.tileSprite(800 - T / 2, 300, T, 600, 'border').setDepth(10);
}


/**
 * drawThemedWalls(scene, walls)
 *
 * WHAT: Draws all wall segments using the dirt texture image.
 *   Each wall is rendered as a series of dirt.png sprites stamped along
 *   the wall's path, like laying bricks in a line.
 *   Falls back to colored lines if the dirt texture didn't load.
 *
 * WHY stamp sprites instead of drawing textured lines?
 *   Phaser's Graphics API (lineStyle + strokePath) only draws SOLID COLORS.
 *   It cannot fill a line with an image pattern. To show the actual dirt.png
 *   texture on walls, we must place image-based game objects along the path.
 *
 * HOW it works:
 *   For each wall segment (x1,y1) → (x2,y2):
 *     1. Calculate the angle: atan2(dy, dx)
 *     2. Calculate the length: sqrt(dx² + dy²)
 *     3. Place sprites every STAMP_SPACING pixels along the line.
 *     4. Each sprite is rotated to match the wall's angle.
 *     5. Each sprite is scaled to WALL_DRAW_THICKNESS height
 *        and STAMP_SPACING width, so they butt up against each other
 *        with no gaps.
 *
 * PERFORMANCE:
 *   A typical maze has ~40 wall segments averaging ~150px each.
 *   At STAMP_SPACING=20, that's ~300 sprites total. Phaser handles
 *   this easily — all share the same texture so WebGL batches them
 *   into very few draw calls.
 *
 * COLLISION NOTE:
 *   This function only changes VISUALS. The invisible physics bodies
 *   (created separately by createWallBodies) are unchanged.
 *   The visual wall thickness (WALL_DRAW_THICKNESS) can differ from
 *   the physics thickness (WALL_THICKNESS) — the visual is just decoration.
 *
 * @param {Phaser.Scene} scene
 * @param {Array} walls  Array of { x1, y1, x2, y2 } wall objects.
 */
export function drawThemedWalls(scene, walls) {
  const themed = isThemeLoaded(scene);

  if (!themed) {
    // Fallback: original thin gray lines
    const gfx = scene.add.graphics();
    gfx.lineStyle(4, 0xcccccc, 1);
    walls.forEach(({ x1, y1, x2, y2 }) => {
      gfx.beginPath();
      gfx.moveTo(x1, y1);
      gfx.lineTo(x2, y2);
      gfx.strokePath();
    });
    return gfx;
  }

  // ── Themed rendering: stamp dirt sprites along each wall ──────────────

  // STAMP_SPACING: distance between dirt sprite centers along the wall.
  // Smaller = smoother walls but more sprites. 18px is a good balance
  // for 64×64 source images rendered at ~20px wide.
  const STAMP_SPACING = 18;

  // VISUAL_THICKNESS: how tall (perpendicular to the wall direction)
  // each dirt stamp appears. This controls the visual wall width.
  // 20px matches the WALL_DRAW_THICKNESS and makes walls chunky/blocky.
  const VISUAL_THICKNESS = 20;

  walls.forEach(({ x1, y1, x2, y2 }) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    // Wall angle in DEGREES — Phaser's setAngle() uses degrees.
    // atan2 returns radians, so we convert: degrees = radians × (180 / π).
    // NOTE: This is the screen angle (Y-down), not the game's facing angle.
    const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

    const numStamps = Math.ceil(length / STAMP_SPACING);

    for (let i = 0; i <= numStamps; i++) {
      // Position along the line: 0.0 = start, 1.0 = end
      const t = numStamps > 0 ? i / numStamps : 0;
      const sx = x1 + t * dx;
      const sy = y1 + t * dy;

      // Place a dirt sprite at this position, rotated to match the wall.
      // setDisplaySize(STAMP_SPACING, VISUAL_THICKNESS):
      //   Width = STAMP_SPACING (along the wall direction)
      //   Height = VISUAL_THICKNESS (perpendicular to the wall)
      // The sprite is rotated by angleDeg so width runs along the wall.
      scene.add.sprite(sx, sy, 'dirt')
        .setDisplaySize(STAMP_SPACING + 2, VISUAL_THICKNESS)
        .setAngle(angleDeg)
        .setDepth(1);
    }
  });

  // Return null — no single Graphics object to reference (sprites are
  // added directly to the scene's display list).
  return null;
}


/**
 * createThemedPlayer(scene, x, y)
 *
 * WHAT: Creates the player game object using the player sprite image.
 *   Falls back to the original blue rectangle if the image didn't load.
 *
 * WHY return the game object?
 *   MazeScene needs a reference to the player for physics, collision,
 *   movement, and rendering. The caller assigns it to `this.player`.
 *
 * IMAGE ORIENTATION:
 *   The player.png should be drawn FACING UP (toward the top of the image).
 *   Phaser's setAngle() rotates clockwise from this "up" position.
 *   Our game's facingAngle uses: 0° = right, 90° = up, 180° = left.
 *   Conversion: phaserAngle = 90 - facingAngle
 *   (See updatePlayerRotation() below.)
 *
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @returns {Phaser.GameObjects.Sprite|Phaser.GameObjects.Rectangle}
 */
export function createThemedPlayer(scene, x, y) {
  if (isThemeLoaded(scene)) {
    return scene.add.sprite(x, y, 'player')
      .setDisplaySize(64, 64)
      .setDepth(5);
  } else {
    return scene.add.rectangle(x, y, 20, 20, 0x4499ff);
  }
}


/**
 * createThemedExit(scene, x, y)
 *
 * WHAT: Creates the exit zone using the exit sprite image.
 *   Falls back to a gold rectangle if the image didn't load.
 *
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @returns {Phaser.GameObjects.Sprite|Phaser.GameObjects.Rectangle}
 */
export function createThemedExit(scene, x, y) {
  if (isThemeLoaded(scene)) {
    return scene.add.sprite(x, y, 'exit')
      .setDisplaySize(64, 64)
      .setDepth(2);
  } else {
    return scene.add.rectangle(x, y, 40, 40, 0xffd700, 0.8);
  }
}


/**
 * createThemedStart(scene, x, y)
 *
 * WHAT: Creates the start zone visual indicator.
 *   Themed: subtle green glow. Fallback: green rectangle.
 *
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 */
export function createThemedStart(scene, x, y) {
  if (isThemeLoaded(scene)) {
    scene.add.rectangle(x, y, 40, 40, 0x00ff44, 0.2).setDepth(1);
  } else {
    scene.add.rectangle(x, y, 40, 40, 0x00cc55, 0.5);
  }
}


/**
 * placeThemedEnemies(scene, positions)
 *
 * WHAT: Places enemy mob sprites at specified positions.
 *   These are purely visual — no physics bodies.
 *   Falls back to doing nothing if the enemy texture didn't load.
 *
 * @param {Phaser.Scene} scene
 * @param {Array<{x: number, y: number}>} positions
 */
export function placeThemedEnemies(scene, positions) {
  if (!isThemeLoaded(scene) || !positions?.length) return;

  positions.forEach(({ x, y }) => {
    scene.add.sprite(x, y, 'enemy')
      .setDisplaySize(100, 100)
      .setDepth(4)
      .setAngle(Math.random() * 360);
  });
}


/**
 * updatePlayerRotation(player, facingAngle, themed, scene)
 *
 * WHAT: Smoothly rotates the player sprite to match the new facing direction
 *   using a Phaser tween instead of an instant snap.
 *
 * WHY animate instead of instant?
 *   Instant rotation (setAngle) jumps from 0° to 90° in one frame — it looks
 *   robotic and disorienting, especially with a character sprite. A short
 *   tween (200ms) shows the character physically turning, which:
 *     - Feels natural and alive
 *     - Gives the kid visual confirmation that the turn happened
 *     - Makes large turns (180°) feel appropriately dramatic
 *
 * HOW the tween works:
 *   Phaser's tween system interpolates a property from its current value
 *   to a target value over a duration. We tween `player.angle` (Phaser's
 *   internal rotation in degrees).
 *
 *   The tricky part is DIRECTION. We want the sprite to take the SHORTEST
 *   path around the circle. Without correction:
 *     0° → 350° would rotate 350° clockwise instead of 10° counterclockwise.
 *
 *   We fix this by computing the shortest angular difference (always between
 *   -180° and +180°) and tweening by that delta from the current angle.
 *
 * WHY `scene` parameter?
 *   Phaser tweens are created via `scene.tweens.add()`. The previous version
 *   didn't need the scene because setAngle() is a direct property setter.
 *   Tweens require the scene's tween manager.
 *
 * @param {Phaser.GameObjects.Sprite|Phaser.GameObjects.Rectangle} player
 * @param {number} facingAngle  The game's facing angle (0°=right, 90°=up, CCW positive).
 * @param {boolean} themed      Whether the theme is active (sprites vs rectangles).
 * @param {Phaser.Scene} scene  The active scene (needed for scene.tweens.add).
 */
export function updatePlayerRotation(player, facingAngle, themed, scene) {
  if (!themed || !player.setAngle || !scene) return;

  // WHAT: Convert game angle to Phaser angle.
  //   Game:   0°=right, 90°=up, CCW positive (math convention)
  //   Phaser: 0°=right, 90°=down, CW positive (screen convention)
  //   If the player sprite faces UP in the PNG: phaserTarget = 90 - facingAngle
  const targetAngle = 90 - facingAngle;

  // WHAT: Calculate the shortest rotation path.
  //
  // WHY: Without this, going from 10° to 350° would rotate 340° the long way
  //   around. We want it to rotate -20° (the short way).
  //
  // HOW:
  //   1. Compute the raw difference: target - current.
  //   2. Normalize to [-180, +180] using the modulo trick.
  //      This guarantees the tween always takes the shortest path.
  //
  // Example:
  //   current = 80°, target = 350°
  //   raw diff = 350 - 80 = 270°
  //   normalized = ((270 + 180) % 360) - 180 = (450 % 360) - 180 = 90 - 180 = -90°
  //   → rotates 90° counterclockwise (short path) ✓
  const currentAngle = player.angle;
  const rawDiff = targetAngle - currentAngle;
  const shortestDiff = ((rawDiff + 180) % 360 + 360) % 360 - 180;

  // WHAT: The actual angle to tween TO (current + shortest difference).
  const tweenTarget = currentAngle + shortestDiff;

  // WHAT: Kill any existing rotation tween before starting a new one.
  // WHY: If the kid clicks Turn Left twice quickly, the first tween might
  //   still be running. Without stopping it, the two tweens would fight
  //   over the angle property, causing jittery flickering.
  // HOW: We store the tween reference on the player object itself (a
  //   convenient place that survives between calls). If a previous tween
  //   exists and is still running, stop() halts it immediately.
  if (player._rotationTween) {
    player._rotationTween.stop();
  }

  // WHAT: Create the smooth rotation tween.
  // HOW:
  //   targets: the game object whose property we're animating.
  //   angle: the target value for player.angle.
  //   duration: 200ms — fast enough to feel responsive, slow enough to see.
  //   ease: 'Sine.easeInOut' — starts slow, speeds up in the middle, slows
  //     down at the end. This mimics how a physical object turns — it
  //     accelerates then decelerates, not instant constant speed.
  player._rotationTween = scene.tweens.add({
    targets: player,
    angle: tweenTarget,
    duration: 200,
    ease: 'Sine.easeInOut',
  });
}

/**
 * startWalkAnimation(player, facingAngle, themed, scene)
 *
 * WHAT: Starts a subtle walking oscillation on the player sprite —
 *   a repeating side-to-side rock (±4°) combined with a small
 *   vertical bob (±1.5px) — that plays continuously while the
 *   player is moving forward.
 *
 * WHY two oscillations combined?
 *   Rotation alone looks like the character is drunk, not walking.
 *   Vertical bob alone looks like bouncing, not walking.
 *   Together they create a "waddle" — the natural motion of a
 *   Minecraft-style blocky character walking, viewed from above.
 *
 * HOW it handles facing angle:
 *   The rock oscillates RELATIVE to the current facing direction.
 *   If the player faces 90° (up), the Phaser angle is 0° (90 - 90).
 *   The tween rocks between -4° and +4° around that base angle.
 *   This works at any facing direction automatically because the
 *   tween target is baseAngle ± offset, not an absolute value.
 *
 * HOW it loops:
 *   yoyo: true makes the tween reverse after reaching the target.
 *   repeat: -1 makes it loop forever (until manually stopped).
 *   Together: the sprite rocks left → right → left → right... endlessly.
 *
 * PERFORMANCE:
 *   Two tweens (rotation + position) running at 60fps is trivial for
 *   Phaser's tween manager. Each tween is a single property interpolation
 *   — no texture swaps, no draw call changes, no GPU impact.
 *
 * @param {Phaser.GameObjects.Sprite} player  The player game object.
 * @param {number} facingAngle  The current game facing angle (0°=right, 90°=up).
 * @param {boolean} themed  Whether the Minecraft theme is active.
 * @param {Phaser.Scene} scene  The active scene (for scene.tweens.add).
 */
export function startWalkAnimation(player, facingAngle, themed, scene) {
  if (!themed || !scene) return;

  // Stop any existing walk animation first (prevents stacking).
  stopWalkAnimation(player);

  // WHAT: Also kill the smooth turn tween from updatePlayerRotation().
  //
  // WHY: updatePlayerRotation() creates a 200ms tween on player.angle
  //   stored as player._rotationTween. If the kid clicks Turn then
  //   Forward quickly (within 200ms), that tween is still running.
  //   Our walk tween ALSO targets player.angle. Two tweens on the
  //   same property = they fight each frame = wild jerky rotation.
  //
  // HOW: Stop and clear _rotationTween before we create _walkTweenRotation.
  //   This guarantees only ONE tween controls angle at any time.
  if (player._rotationTween) {
    player._rotationTween.stop();
    player._rotationTween = null;
  }

  // ── Base Phaser angle ─────────────────────────────────────────────────
  //
  // WHAT: The "neutral" angle the sprite should rest at when not oscillating.
  // HOW: Same conversion as updatePlayerRotation: phaserAngle = 90 - facingAngle.
  const baseAngle = 90 - facingAngle;

  // ── Rotation rock (±4° oscillation) ───────────────────────────────────
  //
  // WHAT: Rocks the sprite between baseAngle-4 and baseAngle+4 degrees.
  //
  // WHY ±4°?
  //   At 32×32 px, ±4° moves the sprite corners by ~2 pixels — visible
  //   enough to read as motion, subtle enough to not look glitchy.
  //   ±2° is too subtle (invisible at this scale).
  //   ±8° is too much (looks like the character is falling over).
  //
  // TIMING: 150ms per half-cycle = 300ms full rock (left → right → left).
  //   At MOVE_SPEED=300 px/s and a typical move of 50px (167ms duration),
  //   the player sees about half a rock cycle per short move, or 2-3 full
  //   cycles for a 200px move. This feels natural — not frantic, not slow.
  //
  // WHY start at baseAngle - 4 (not baseAngle)?
  //   Starting from the offset means the first visible frame already shows
  //   movement. Starting from baseAngle would mean the first 75ms looks
  //   static (tweening toward the first offset) — a subtle delay that
  //   makes the animation feel laggy.

  // ±6° rotation — the sweet spot for a 40px sprite.
  //   ±4° was invisible (rounded away by pixel-art filtering).
  //   ±10° was too dramatic (looked like falling, not walking).
  //   ±6° moves the sprite corners by ~4px — clearly visible as a
  //   gentle waddle without looking broken.
  player.setAngle(baseAngle - 6);

  player._walkTweenRotation = scene.tweens.add({
    targets: player,
    angle: baseAngle + 6,       // 12° total swing
    duration: 130,              // slightly relaxed pace
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  });

  // ── Vertical bob (±1.5px oscillation) ─────────────────────────────────
  //
  // WHAT: Oscillates scaleX and scaleY slightly to create a "breathing"
  //   or "bouncing" effect that simulates the weight shift of walking.
  //
  // WHY scale instead of y position?
  //   The previous version tweened player.y directly. But Phaser's physics
  //   engine ALSO sets player.y every frame based on velocity. The two
  //   systems fought over the same property — the tween won, pinning the
  //   player in place and preventing all forward movement.
  //   Scale (scaleX, scaleY) is purely visual — physics never touches it.
  //   So there's no conflict.
  //
  // HOW it looks:
  //   The sprite slightly squishes horizontally and stretches vertically,
  //   then reverses. Combined with the rotation rock, it creates a
  //   convincing "waddle" at the Minecraft pixel-art scale.
  //
  // WHY store original scales?
  //   setDisplaySize changes scaleX/scaleY internally. We need to restore
  //   the exact values when the animation stops, not assume they're 1.0.
  
  // NOTE: No squash-stretch (scaleX/scaleY) tween.
  //
  // WHY it was removed:
  //   Oscillating scaleY interferes with Arcade Physics body bounds
  //   during downward movement. The body size fluctuates every frame,
  //   causing jittery collision resolution that makes the sprite bounce
  //   chaotically when moving in the +Y direction.
  //
  //   Left/right/up movement looked fine because the scale oscillation
  //   was perpendicular to travel (left/right) or dampened symmetrically (up).
  //   But downward movement amplified the jitter.
  //
  // The ±6° rotation rock alone is sufficient for a convincing walk
  // animation at this sprite scale. No scale changes needed.
}


/**
 * stopWalkAnimation(player)
 *
 * WHAT: Stops the walking oscillation and returns the sprite to its
 *   neutral position — no tilt, original Y position.
 *
 * WHY not just let the tween finish naturally?
 *   Tweens with repeat: -1 loop forever. They must be explicitly stopped.
 *   Also, the tween might be stopped mid-cycle (e.g., player hits a wall
 *   at the peak of a rock). Without resetting, the sprite would freeze
 *   at a tilted angle — looking broken.
 *
 * HOW it cleans up:
 *   1. Stop both tweens (rotation and bob).
 *   2. Restore Y to the stored original value.
 *   3. Do NOT reset angle here — the caller (goForward callback or
 *      _onWallHit) will call setPreviewAngle() which resets the angle
 *      via updatePlayerRotation(). Setting it here too would cause a
 *      visible double-snap.
 *
 * @param {Phaser.GameObjects.Sprite} player  The player game object.
 */
export function stopWalkAnimation(player) {
  // Stop rotation tween
  if (player._walkTweenRotation) {
    player._walkTweenRotation.stop();
    player._walkTweenRotation = null;
  }

  // No squash-stretch tween to stop — it was removed because it
  // interfered with physics during downward movement.
  // Only the rotation tween (stopped above) needs cleanup.
  
}

/**
 * flashPlayerCrash(player, themed)
 *
 * WHAT: Visual feedback when the player hits a wall.
 *   Sprite: setTint (tints the texture red).
 *   Rectangle: setFillStyle (changes the fill color).
 *
 * WHY different methods?
 *   Phaser Sprites don't have setFillStyle (that's a Rectangle method).
 *   Phaser Rectangles don't respond to setTint the same way.
 *   This helper picks the right method based on the object type.
 *
 * @param {Phaser.GameObjects.Sprite|Phaser.GameObjects.Rectangle} player
 * @param {boolean} themed
 */
export function flashPlayerCrash(playerSprite, themed) {
  if (themed && playerSprite?.setTint) {
    playerSprite.setTint(0xff4444);
  }
}


/**
 * getTrailStyle(themed)
 *
 * WHAT: Returns the trail line color and width for the movement trail.
 *   Themed: thick golden yellow (matches Minecraft goal image).
 *   Fallback: thin blue semi-transparent (original style).
 *
 * @param {boolean} themed
 * @returns {{ width: number, color: number, alpha: number }}
 */
export function getTrailStyle(themed) {
  if (themed) {
    return { width: 3.5, color: 0xFFCC00, alpha: 0.8 };
  }
  return { width: 1.5, color: 0x88aaff, alpha: 0.45 };
}