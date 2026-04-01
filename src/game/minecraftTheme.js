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
      .setDisplaySize(50, 50)
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
 * updatePlayerRotation(player, facingAngle, themed)
 *
 * WHAT: Rotates the player sprite to match the current facing direction.
 *   Only applies to Sprite objects (themed mode). Rectangle objects
 *   (fallback mode) don't rotate — the arrow indicator handles direction.
 *
 * HOW the angle conversion works:
 *   Game angles:  0° = right, 90° = up (CCW positive, math convention)
 *   Phaser angles: 0° = right (but we want up as default, CW positive)
 *
 *   If the player image faces UP in the PNG file:
 *     Phaser rotation = -(facingAngle - 90) = 90 - facingAngle
 *
 *   Examples:
 *     facingAngle = 0°  (right)  → phaserAngle = 90°  (rotated 90° CW from up)
 *     facingAngle = 90° (up)     → phaserAngle = 0°   (no rotation = up)
 *     facingAngle = 180° (left)  → phaserAngle = -90° (rotated 90° CCW)
 *     facingAngle = 270° (down)  → phaserAngle = -180° (flipped)
 *
 * @param {Phaser.GameObjects.Sprite|Phaser.GameObjects.Rectangle} player
 * @param {number} facingAngle  The game's facing angle in degrees.
 * @param {boolean} themed  Whether the theme is active.
 */
export function updatePlayerRotation(player, facingAngle, themed) {
  if (themed && player.setAngle) {
    player.setAngle(90 - facingAngle);
  }
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
export function flashPlayerCrash(player, themed) {
  if (themed && player.setTint) {
    player.setTint(0xff4444);
  } else if (player.setFillStyle) {
    player.setFillStyle(0xff4444);
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