/**
 * MazeScene.js — The main (and only) Phaser scene for AngleMaze.
 *
 * HOW: Phaser scenes follow a strict lifecycle:
 *   1. preload()  — Runs once before the scene starts. Load images, audio, tilemaps here.
 *   2. create()   — Runs once after preload(). Set up game objects, physics bodies, input handlers.
 *   3. update()   — Runs every frame (~60fps by default). Handle per-frame logic like input polling.
 *
 * WHY this structure exists: Phaser needs to know assets are fully loaded before you try to
 * create game objects from them. The lifecycle guarantees that order automatically.
 */
import Phaser from 'phaser';
/**
 * WHAT: Import wall data for both levels.
 * WHY: Each level has its own maze layout in a separate file.
 *   Level 1 (mazeData.js) — horizontal and vertical walls only (90° turns).
 *   Level 2 (mazeDataLevel2.js) — diagonal walls mixed in (30°, 45°, 60° turns).
 * HOW: We import both and choose which to use in create() based on currentLevel.
 */
import wallsLevel1 from '../mazeData.js';
import wallsLevel2 from '../mazeDataLevel2.js';

// WHAT: Import checkpoint positions for each level.
// WHY: Checkpoints are level-specific — each maze has different save points.
import checkpointsByLevel from '../checkpointData.js';

import {
  preloadThemeAssets, isThemeLoaded,
  drawThemedBackground, drawThemedBorder, drawThemedWalls,
  createThemedPlayer, createThemedExit, createThemedStart,
  placeThemedEnemies,
  updatePlayerRotation, flashPlayerCrash, getTrailStyle,
} from '../minecraftTheme.js';

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * WALL_THICKNESS controls how wide (or tall) the invisible physics rectangle
 * is for each wall segment, measured perpendicular to the wall's direction.
 *
 * WHY we need thickness at all: Arcade Physics uses Axis-Aligned Bounding Boxes
 * (AABBs) — rectangles, not lines. A true zero-width line has no area, so the
 * engine would never detect a collision against it. We give each wall a small
 * but non-zero thickness so the physics engine has something to collide with.
 *
 * HOW to choose the value: it should be ≥ 1 px, but large enough that a fast-
 * moving player cannot "tunnel" through the wall in a single frame. 8 px is a
 * safe choice when the player is ~20 px wide.
 *
 * Tip: to see where all the physics rectangles are, temporarily set
 * `debug: true` in config.js — Phaser will draw green outlines around them.
 */
const WALL_THICKNESS = 8;

/**
 * MOVE_SPEED — how fast the player travels during a move, in pixels per second.
 *
 * Phaser's `body.setVelocity(vx, vy)` uses pixels per second as its unit.
 * At 300 px/s a 100-pixel move takes 333 ms — fast enough to feel responsive,
 * slow enough to watch the player navigate corridors.
 *
 * Changing this value speeds up or slows down ALL moves proportionally because
 * the timer duration is calculated as (distance / MOVE_SPEED) — so the player
 * always travels the requested distance regardless of what this is set to.
 */
const MOVE_SPEED = 300; // pixels per second

/**
 * TILE_SIZE — side length (in pixels) of each small square placed along a
 * diagonal wall to approximate its collision shape.
 *
 * WHAT: When we create physics bodies for a diagonal wall, we can't use one
 *   big rectangle (Arcade Physics only supports axis-aligned boxes — see the
 *   explanation in the guide). Instead, we place many tiny squares along the
 *   line. TILE_SIZE controls how big each square is.
 *
 * WHY 8 pixels?
 *   - Smaller tiles (4 px) = smoother collision, but MORE physics bodies = slower.
 *   - Bigger tiles (16 px) = fewer bodies = faster, but GAPS between tiles
 *     could let the player squeeze through.
 *   - 8 px is a good balance: tiles overlap slightly (because the player is
 *     20 px wide), so there are no gaps, and the performance cost is low.
 *
 * HOW to visualize it: imagine placing 8×8 pixel sticky notes along a
 *   diagonal pencil line on graph paper. Each note is its own collision box.
 */
const TILE_SIZE = 8;

/**
 * LEVEL_CONFIG — per-level settings for start position, exit position,
 * and initial facing direction.
 *
 * WHAT: A lookup table mapping level number → positions and angle.
 *   Each level can place the player and exit anywhere on the 800×600 canvas.
 *
 * WHY centralize this?
 *   Before this change, the start (60,60), exit (740,540), and facing angle (0°)
 *   were hardcoded as bare numbers scattered across create(). If you wanted
 *   Level 2 to start in a different corner, you'd need to find and modify
 *   5+ places. With LEVEL_CONFIG, you change ONE object and everything updates.
 *
 * HOW it's used:
 *   In create(), we read:
 *     const cfg = LEVEL_CONFIG[this.game._currentLevel];
 *   Then use cfg.startX, cfg.startY, etc. wherever we previously had
 *   hardcoded numbers.
 *
 * HOW to add a new level:
 *   Just add a new entry: 3: { startX: ..., startY: ..., ... }
 *
 * COORDINATE REMINDER:
 *   (0,0) = top-left. X increases → right. Y increases ↓ down.
 *   facingAngle: 0° = right, 90° = up, 180° = left, 270° = down.
 */
const LEVEL_CONFIG = {
  1: {
    startX: 60,         // top-left area (same as before) 
    startY: 60,
    exitX: 740,         // bottom-right area (same as before)
    exitY: 540,
    facingAngle: 0,     // facing RIGHT → toward the maze
  },
  2: {
    startX: 740,        // top-RIGHT corner
    startY: 60,
    exitX: 150,         // near top-left, a bit to the right
    exitY: 50,
    facingAngle: 180,   // facing LEFT → toward the exit
  },
  // Add Level 3 here later:
  // 3: { startX: ..., startY: ..., exitX: ..., exitY: ..., facingAngle: ... },
};

/**
 * createDiagonalWallBodies(scene, x1, y1, x2, y2, wallGroup)
 *
 * WHAT: Creates a chain of small square static physics bodies along a
 *   diagonal line from (x1,y1) to (x2,y2). Each square is TILE_SIZE × TILE_SIZE
 *   pixels and is added to the wallGroup for collision detection.
 *
 * WHY we need this (the AABB problem):
 *   Phaser Arcade Physics uses Axis-Aligned Bounding Boxes (AABBs) — every
 *   collision shape is a rectangle whose sides are PARALLEL to the screen edges.
 *   This works perfectly for horizontal/vertical walls. But for a diagonal wall,
 *   a single AABB would be a fat rectangle covering much more area than the
 *   actual wall line:
 *
 *     Diagonal wall:        Single AABB (wrong!):
 *           ██              ┌────────────┐
 *         ██                │xxxx        │  ← blocks open space
 *       ██                  │  xxxx      │
 *     ██                    │    xxxx    │
 *   ██                      └────────────┘
 *
 *   By using many small squares along the line, we get an accurate
 *   collision shape that follows the diagonal closely.
 *
 * HOW the math works (parametric line equation):
 *   1. Find the angle of the wall:
 *        angle = atan2(y2 - y1, x2 - x1)
 *      This gives us the direction from the start to the end point.
 *
 *   2. Find the total length of the wall:
 *        length = sqrt((x2 - x1)² + (y2 - y1)²)
 *
 *   3. Calculate how many tiles we need:
 *        numTiles = ceil(length / TILE_SIZE)
 *
 *   4. For each tile i (from 0 to numTiles), compute its position:
 *        tileX = x1 + i × TILE_SIZE × cos(angle)
 *        tileY = y1 + i × TILE_SIZE × sin(angle)
 *
 *      This is the PARAMETRIC LINE EQUATION — it says:
 *      "Start at (x1, y1), then step forward i×TILE_SIZE pixels
 *       in the direction of the wall."
 *
 *   Visual example — a 45° wall from (100, 300) to (200, 200):
 *     angle = atan2(200-300, 200-100) = atan2(-100, 100) ≈ -0.785 rad (-45°)
 *     length = sqrt(100² + 100²) ≈ 141 px
 *     numTiles = ceil(141 / 8) = 18 tiles
 *
 *     Tile 0:  (100, 300)         — start
 *     Tile 1:  (105.7, 294.3)     — one step along the diagonal
 *     Tile 2:  (111.3, 288.6)     — another step
 *     ...
 *     Tile 17: (195.6, 205.6)     — near the end
 *
 * @param {Phaser.Scene}  scene      The scene to add game objects to.
 * @param {number}        x1         Start X of the wall segment.
 * @param {number}        y1         Start Y of the wall segment.
 * @param {number}        x2         End X of the wall segment.
 * @param {number}        y2         End Y of the wall segment.
 * @param {Phaser.Physics.Arcade.StaticGroup} wallGroup  Group to add bodies to.
 */
function createDiagonalWallBodies(scene, x1, y1, x2, y2, wallGroup) {

  // Step 1: Find the angle of the wall in radians.
  // atan2(dy, dx) returns the angle in radians from the positive X-axis.
  // We use atan2 (not atan) because atan2 handles all four quadrants correctly.
  const angle = Math.atan2(y2 - y1, x2 - x1);

  // Step 2: Find the total length of the wall using the Pythagorean theorem.
  // This is the distance formula: √((x2-x1)² + (y2-y1)²)
  const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

  // Step 3: How many tiles fit along the wall?
  // Math.ceil rounds UP so we always cover the full length (no gap at the end).
  const numTiles = Math.ceil(length / TILE_SIZE);

  // Step 4: Place a small square at each position along the line.
  for (let i = 0; i <= numTiles; i++) {

    // Parametric position: start + i steps in the wall direction.
    // cos(angle) = X component of the direction (how much to move right/left)
    // sin(angle) = Y component of the direction (how much to move up/down)
    const tileX = x1 + i * TILE_SIZE * Math.cos(angle);
    const tileY = y1 + i * TILE_SIZE * Math.sin(angle);

    // Create an invisible square at this position.
    // - TILE_SIZE × TILE_SIZE pixels
    // - setVisible(false): the Graphics API already draws the visible wall line.
    //   These squares exist ONLY for physics collision — they're invisible.
    const tile = scene.add.rectangle(tileX, tileY, TILE_SIZE, TILE_SIZE);
    tile.setVisible(false);

    // Register as a STATIC physics body (true = static, won't move)
    // and add to the wall group for collision detection.
    scene.physics.add.existing(tile, true);
    wallGroup.add(tile);
  }
}


/**
 * createStraightWallBody(scene, x1, y1, x2, y2, wallGroup)
 *
 * WHAT: Creates a single rectangle physics body for a horizontal or vertical
 *   wall segment. This is the ORIGINAL method from Level 1 — simple and efficient.
 *
 * WHY a separate function from createDiagonalWallBodies?
 *   Straight walls (horizontal or vertical) are already perfectly axis-aligned,
 *   so a single rectangle body is accurate AND efficient (1 body vs. ~18 bodies
 *   for a diagonal). We only use the tile chain for diagonal walls.
 *
 * HOW to convert a line segment to a rectangle:
 *   Horizontal wall (y1 === y2):
 *     width  = |x2 - x1|  (full length of the wall)
 *     height = WALL_THICKNESS  (thin strip, perpendicular to the wall)
 *     centre = midpoint of the segment
 *
 *   Vertical wall (x1 === x2):
 *     width  = WALL_THICKNESS
 *     height = |y2 - y1|
 *     centre = midpoint of the segment
 *
 * @param {Phaser.Scene}  scene      The scene to add game objects to.
 * @param {number}        x1, y1     Start point of the wall.
 * @param {number}        x2, y2     End point of the wall.
 * @param {Phaser.Physics.Arcade.StaticGroup} wallGroup  Group to add the body to.
 */
function createStraightWallBody(scene, x1, y1, x2, y2, wallGroup) {

  const isHorizontal = (y1 === y2);

  const cx = (x1 + x2) / 2;  // centre X of the rectangle
  const cy = (y1 + y2) / 2;  // centre Y of the rectangle
  const w  = isHorizontal ? Math.abs(x2 - x1) : WALL_THICKNESS;
  const h  = isHorizontal ? WALL_THICKNESS      : Math.abs(y2 - y1);

  const rect = scene.add.rectangle(cx, cy, w, h);
  rect.setVisible(false);
  scene.physics.add.existing(rect, true);
  wallGroup.add(rect);
}


/**
 * createWallBodies(scene, wall, wallGroup)
 *
 * WHAT: A smart wrapper that picks the right method for each wall type.
 *
 * WHY: We don't want to think about "is this wall straight or diagonal?"
 *   every time we add a wall. This function checks automatically:
 *   - If both Y values are equal → horizontal wall → single rectangle (fast)
 *   - If both X values are equal → vertical wall → single rectangle (fast)
 *   - Otherwise → diagonal wall → chain of small squares (necessary)
 *
 * HOW: Just checks if x1===x2 or y1===y2. If neither, it's diagonal.
 *
 * @param {Phaser.Scene}  scene      The scene to add game objects to.
 * @param {Object}        wall       A wall object { x1, y1, x2, y2 }.
 * @param {Phaser.Physics.Arcade.StaticGroup} wallGroup  Group to add bodies to.
 */
function createWallBodies(scene, wall, wallGroup) {
  const { x1, y1, x2, y2 } = wall;

  if (x1 === x2 || y1 === y2) {
    // Horizontal or vertical — one rectangle is accurate and efficient.
    createStraightWallBody(scene, x1, y1, x2, y2, wallGroup);
  } else {
    // Diagonal — must use the tile chain approach (AABB limitation).
    createDiagonalWallBodies(scene, x1, y1, x2, y2, wallGroup);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default class MazeScene extends Phaser.Scene {
  /**
   * The constructor tells Phaser how to identify this scene.
   * The key string 'MazeScene' is used in config.js to register it.
   */
  constructor() {
    super({ key: 'MazeScene' });
  }

  preload() {
    // WHAT: Queue all Minecraft theme images for downloading.
    // WHY: Phaser's preload() guarantees all queued files are fully loaded
    //   before create() runs. If we loaded in create(), the images wouldn't
    //   be available immediately.
    // HOW: preloadThemeAssets checks if each texture already exists (from a
    //   previous load before scene restart) and only loads missing ones.
    preloadThemeAssets(this);
  }

  /**
   * create()
   * WHAT: Build the scene — draw walls visually, create physics bodies, set up the
   *       camera background colour.
   * HOW:  Called exactly once by Phaser after preload() finishes.
   * WHY:  One-time setup belongs here, not in update(), to avoid recreating objects
   *       every frame (which would be extremely slow).
   */
  create() {

    // WHAT: Check if all theme images loaded successfully.
    // WHY: If any image is missing (user hasn't placed the PNGs yet),
    //   we fall back to the original flat-color rendering.
    //   Every themed rendering function checks this flag.
    this._themed = isThemeLoaded(this);

    // ── Level selection — MUST come FIRST ──────────────────────────────
    //
    // WHY this must be the first thing in create():
    //   Everything below depends on knowing which level we're on:
    //   cfg (positions), wall data, checkpoint data. If we read cfg
    //   before setting _currentLevel, the level is undefined on first
    //   load and cfg falls back to Level 1 every time.
    //
    // ORDER MATTERS:
    //   1. Set _currentLevel  ← must be first
    //   2. Read cfg from LEVEL_CONFIG  ← uses _currentLevel
    //   3. Notify React (_onReset)  ← uses cfg
    //   4. Everything else  ← uses cfg and _currentLevel
    if (this.game._currentLevel === undefined) {
      this.game._currentLevel = window.__anglemazeInitialLevel || 1;
    }

    const cfg = LEVEL_CONFIG[this.game._currentLevel] || LEVEL_CONFIG[1];

    if (this.game._hasStarted) {
      this.game._onReset?.(true, cfg);
    } else {
      this.game._hasStarted = true;
      this.game._onReset?.(false, cfg);
    }

    // ── 0b. Level selection ─────────────────────────────────────────────────
    // WHAT: Read the initial level from the URL (set by GamePage before game starts)
    //   or keep the current level on scene restarts.
    if (this.game._currentLevel === undefined) {
      this.game._currentLevel = window.__anglemazeInitialLevel || 1;
    }


    // Pick the wall data array for the current level.
    const walls = this.game._currentLevel === 2 ? wallsLevel2 : wallsLevel1;

    // ── 1. Background colour ──────────────────────────────────────────────────
    // `this.cameras.main` is the default camera Phaser creates for every scene.
    // Setting its background colour avoids the default black or transparent canvas.
    // WHAT: Grass-tiled background (themed) or solid color (fallback).
    drawThemedBackground(this);
    if (!this._themed) {
      this.cameras.main.setBackgroundColor('#1a1a2e');
    }


    // ── 2. Draw walls visually with the Graphics API ──────────────────────────
    //
    // WHAT: Draw walls as thick dirt-block lines (themed) or thin gray (fallback).
    drawThemedWalls(this, walls);

    // WHAT: Draw a wood/log border around the maze edge (themed only).
    drawThemedBorder(this);


    // ── 3. Create static physics bodies for every wall ────────────────────────
    //
    // WHAT: A StaticGroup is a collection of game objects that all have static
    //       physics bodies. Static bodies can block other objects but never move
    //       themselves — perfect for maze walls.
    //
    // WHY static instead of dynamic?
    //   Dynamic bodies recalculate velocity, gravity, and position every single
    //   frame. That's necessary for moving objects (player, enemies, bullets),
    //   but pure waste for stationary walls. Static bodies are "baked in" once
    //   at creation time, making them essentially free at runtime.
    //
    // WHY a group?
    //   Grouping all wall bodies lets us write a single collider line later:
    //     this.physics.add.collider(player, this.wallGroup)
    //   Without a group, we'd need one collider per wall segment.
    //
    // HOW Arcade Physics handles collision:
    //   Every frame Phaser checks every dynamic body against every static body
    //   it shares a collider with. If their AABBs overlap, Phaser pushes the
    //   dynamic body out of the static body along the axis of least overlap.
    //   This is what stops the player at a wall instead of passing through it.
    this.wallGroup = this.physics.add.staticGroup();

    // ── Create physics bodies for every wall ──────────────────────────────────
    //
    // WHAT: For each wall segment, we create invisible physics bodies so the
    //   player can collide with them. The visual line is drawn separately above.
    //
    // HOW: The createWallBodies() function (defined outside this class)
    //   automatically detects whether a wall is straight or diagonal:
    //   - Straight walls → one efficient rectangle body
    //   - Diagonal walls → a chain of small squares along the line
    //
    // WHY use createWallBodies instead of the old inline code?
    //   The old code assumed all walls were horizontal or vertical. Now that
    //   Level 2 has diagonal walls, we need the smart detection logic.
    //   Using the helper function also keeps create() shorter and cleaner.
    walls.forEach((wall) => {
      createWallBodies(this, wall, this.wallGroup);
    });

    // ── 4. Start zone (visual only — no physics body) ────────────────────────
    //
    // WHAT: A translucent green rectangle that marks where the player begins.
    // WHY no physics body?
    //   The start zone is purely decorative — we don't want the player to
    //   bounce off it or be blocked by it. A game object only participates in
    //   the physics simulation if you explicitly call `physics.add.existing()`
    //   (or create it via a physics factory method). Without that call, Phaser
    //   treats it as a plain display object.
    // HOW: `this.add.rectangle(x, y, w, h, fillColor, fillAlpha)` creates a
    //   filled rectangle centred at (x, y). The 6th argument (0–1) controls
    //   how transparent the fill is — 0.5 lets the background show through.
    //
    // Cell [0,0] spans x=0–200, y=0–200.
    // (60, 60) is well clear of the boundary walls and the x=300 stub.
    
    // WHAT: Draw the start zone at the position from LEVEL_CONFIG.
    // WHY: Level 1 starts top-left (60,60). Level 2 starts top-right (740,60).
     createThemedStart(this, cfg.startX, cfg.startY);


    // ── 5. Exit zone (static body — needed for overlap detection) ─────────────
    //
    // WHAT: A gold rectangle that marks the goal the player must reach.
    //
    // WHY does the exit zone need a physics body when the start zone doesn't?
    //   Phaser's overlap system only works when BOTH objects have physics bodies.
    //   If exitZone had no body, `physics.add.overlap()` would silently never
    //   fire. We make it STATIC so it has zero per-frame cost (same reasoning
    //   as the walls), while still being detectable by the overlap system.
    //
    // WHY overlap instead of collider for the exit zone?
    //   `physics.add.collider` resolves the overlap physically — the dynamic
    //   body is pushed OUT of the static body each frame (like hitting a wall).
    //   `physics.add.overlap` fires a callback when the AABBs intersect but
    //   does NOT alter the physics — the player glides through the zone
    //   naturally. For a goal zone you want detection without a bounce.
    //
    // Cell [3,2] spans x=600–800, y=400–600.
    // (740, 540) sits comfortably inside, clear of the x=600 and x=800 walls.
    // WHAT: Draw the exit zone at the position from LEVEL_CONFIG.
    // WHY: Level 1 exits bottom-right (740,540). Level 2 exits near top-left (150,50).
    const exitZone = createThemedExit(this, cfg.exitX, cfg.exitY);
    
    this.physics.add.existing(exitZone, true); // true = STATIC body


    // ── 6. Angle reference compass (renders first = lowest z-layer) ──────────
    //
    // WHAT: A small circular diagram in the bottom-left corner showing which
    //   direction corresponds to 0°, 90°, 180°, and 270°. Also shows a live
    //   needle pointing in the player's current (or preview) facing direction.
    //
    // WHY draw the static ring before the trail and player?
    //   Phaser renders objects in the order they are added to the scene.
    //   The first object added is drawn at the bottom (behind everything else).
    //   By drawing the compass ring now, it sits below trail lines and the
    //   player — the ring is background reference art, not interactive.
    //
    // NOTE: The moving needle is created LAST (see §9b) so it always renders
    //   on top. Only the static ring is drawn here.
    // this._drawCompass();


    // ── 7. Trail graphics layer (renders BELOW the player) ───────────────────
    //
    // WHAT: A persistent Graphics object that accumulates semi-transparent
    //   blue line segments — one per completed move — showing the player's
    //   full path history through the maze.
    //
    // WHY NOT clear it each frame?
    //   Unlike the direction arrow (which needs to move with the player and is
    //   cleared and redrawn on every angle change), the trail is permanent: we
    //   WANT the old path segments to stay visible. So we only ADD to this
    //   Graphics object (inside movePlayer's callback), never clear it.
    //
    // WHY created BEFORE the player?
    //   Phaser's z-order is determined by creation order. Creating trailGfx
    //   before the player means trail lines will appear underneath the player
    //   square, so the player is always readable on top of its own path.
    this.trailGfx = this.add.graphics();


    // ── 8. Player (dynamic physics body) ─────────────────────────────────────
    //
    // WHAT: A small blue square that the player controls.
    //
    // HOW dynamic bodies differ from static ones:
    //   • Static bodies  → baked in at creation, never move, zero per-frame cost.
    //                       Used for: walls, exit zone, any fixed obstacle.
    //   • Dynamic bodies → updated every frame: velocity, gravity, acceleration
    //                       are all recalculated. Can be pushed by collisions.
    //                       Used for: the player (and eventually enemies, bullets).
    //
    // The player starts at (60, 60) — the centre of the start zone above.
    // WHAT: Create the player at this level's start position.
    this.player = createThemedPlayer(this, cfg.startX, cfg.startY);

    // WHAT: Place enemy mob sprites at key positions (themed only).
    // WHY: Visual decoration — the actual collision comes from the wall
    //   segments that form the diamond shapes in the maze data.
    const enemyPositions = this.game._currentLevel === 2
      ? [{ x: 120, y: 295 }, { x: 325, y: 220 }, { x: 523, y: 97 }, { x: 625, y: 190 }]
      : [];
    placeThemedEnemies(this, enemyPositions);

    // Register the rectangle as a DYNAMIC physics body.
    // Omitting the second argument (or passing `false`) = dynamic.
    this.physics.add.existing(this.player, false);

    // HOW collideWorldBounds works:
    //   Without this, a dynamic body can fly past the canvas edge if given
    //   enough velocity. `setCollideWorldBounds(true)` registers the canvas
    //   boundaries as invisible hard walls so the player always stays inside.
    //   This complements the outer boundary wall segments: the physics wall
    //   bodies stop the player from *touching* the edge lines, and
    //   collideWorldBounds acts as a final safety net.
    this.player.body.setCollideWorldBounds(true);

    // WHAT: `physics.add.collider(A, B, callback, processCallback, context)`
    //   tests A against every member of B each frame. If their AABBs overlap,
    //   Phaser first calls `processCallback` (null = always process), then
    //   resolves the collision (pushes A out of B), then calls `callback`.
    //
    // WHY add a callback here?
    //   In the old version (no callback), wall contact just stopped the player.
    //   Now we want wall contact to RESTART the game — that logic lives in
    //   `_onWallHit`. The callback is the hook Phaser gives us to run custom
    //   code on every collision.
    //
    // WHY pass `this` as the context (5th argument)?
    //   The callback `this._onWallHit` is an object method. Phaser calls it as
    //   a plain function, which would make `this` undefined inside it. Passing
    //   the scene as the context binds `this` correctly — just like
    //   `.bind(this)` but without creating a new function each call.
    this.physics.add.collider(
      this.player,
      this.wallGroup,
      this._onWallHit, // called when player body overlaps any wall body
      null,            // processCallback — null = always fire the collider
      this,            // context — makes `this` inside _onWallHit = scene
    );


    // ── 8b. Player direction indicator (renders above the player square) ──────
    //
    // WHAT: A small filled white triangle drawn on top of the player, pointing
    //   in the player's current facing direction. It acts as an on-body compass
    //   needle — the player square always shows which way the player is facing.
    //
    // WHY a separate Graphics object from arrowGfx?
    //   Two reasons:
    //   • Z-order: the indicator must sit above the player square but can share
    //     the same layer as the external arrow.
    //   • Behaviour during moves: both are hidden mid-move (arrow at stale
    //     position, indicator at stale position), and both are restored
    //     together via setPreviewAngle() when the move ends.
    //
    // HOW the triangle geometry works:
    //   • TIP: 8 px from player centre in the facing direction.
    //   • BASE CORNERS: 5 px from player centre, ±120° off the facing direction.
    //   This produces a compact equilateral-ish triangle that fits comfortably
    //   inside the player's 10 px half-width (20 px total side length).
    this.playerIndicatorGfx = this.add.graphics();


    // ── 9. Direction preview arrow (renders above indicator) ──────────────────
    //
    // WHAT: A Graphics object that draws a yellow arrow from the player's
    //   position in the currently facing direction. It is CLEARED and REDRAWN
    //   whenever the facing direction changes (via setPreviewAngle), and HIDDEN
    //   during a move (to avoid misleading positions while the player travels).
    //
    // WHY created AFTER the player and indicator?
    //   z-order: the arrow shaft starts at the player centre and extends outward
    //   past the player edge. It needs to render on top of everything else in
    //   the player's immediate area so the arrowhead is always fully visible.
    //
    // HOW the clear-and-redraw pattern works:
    //   `arrowGfx.clear()` erases all previous draw calls on this object.
    //   Then we call the draw commands again with the new position/angle.
    //   This is the standard Phaser idiom for dynamic vector graphics that
    //   change shape or position on every update.
    this.arrowGfx = this.add.graphics();


    // ── 9b. Compass needle (highest z-layer — always readable) ────────────────
    //
    // WHAT: A yellow line from the compass ring's centre to its rim, pointing in
    //   the player's current (or preview) facing direction. Updates live as the
    //   player changes the direction controls.
    //
    // WHY created after arrowGfx (topmost layer)?
    //   The needle must always be visible, even if trail lines reach the
    //   bottom-left corner where the compass lives. Being on top guarantees it
    //   is never obscured.
    //
    // WHY separate from the static ring drawn in _drawCompass()?
    //   The ring, tick marks, and labels are drawn once and never change.
    //   The needle changes every time the facing angle changes. Keeping them
    //   on separate Graphics objects lets us `clear()` and redraw just the
    //   needle, leaving the static ring untouched — efficient and correct.
    // this.compassNeedleGfx = this.add.graphics();


    // ── 10. Game state ────────────────────────────────────────────────────────

    /**
     * WHAT: The player's current facing direction, in degrees.
     *   0° = facing right, 90° = facing up, 180° = left, 270° = down.
     *   Counterclockwise positive (standard math convention — like a protractor).
     *
     * TURTLE GRAPHICS MODEL — "turn in place, then walk forward":
     *   This game uses the same movement model as Python's turtle library.
     *   There are three separate commands — each does exactly ONE thing:
     *
     *     ▶ turnLeft(degrees)   — rotate CCW (left), don't move.
     *     ▶ turnRight(degrees)  — rotate CW  (right), don't move.
     *     ▶ goForward(distance) — walk forward in the current facing direction.
     *
     *   Like giving directions to a robot:
     *     "Turn left 90°."   ← robot spins, doesn't move
     *     "Walk 100 steps."  ← robot walks in whichever direction it faces
     *
     * WHY separate turning from moving?
     *   Combining them ("turn AND move") hides two distinct decisions:
     *     1. Which direction should I face?  → turnLeft / turnRight
     *     2. How far should I go?            → goForward
     *   Separating them lets students focus on one question at a time — which
     *   is exactly how a protractor exercise works in class.
     *
     * HOW facingAngle accumulates:
     *   turnLeft  ADDS degrees   (+CCW): facing 0° + left  45° → 45°  (upper-right)
     *   turnRight SUBTRACTS      (−CW):  facing 90° + right 45° → 45° (upper-right)
     *
     *   Example — "turn left 45°, turn left 45°":
     *     Start:      facingAngle = 0°   (facing right)
     *     Left 45°:   facingAngle = 45°  (facing upper-right)
     *     Left 45°:   facingAngle = 90°  (facing straight UP) ✓
     *
     * HOW double-modulo normalization keeps angles in [0, 360):
     *   JavaScript's `%` returns negative values for negative inputs:
     *     (-30) % 360  →  -30  in JS   ✗  (we want 330)
     *   Pattern: ((angle % 360) + 360) % 360  →  always [0, 360)  ✓
     *
     *   Example — facing 10°, turnRight(45°):
     *     10 + (−45) = −35
     *     (−35 % 360)  →  −35
     *     −35 + 360    →  325
     *     325 % 360    →  325  ✓  (facing lower-right, ~5 o'clock)
     */
     // WHAT: Set the initial facing direction from the level config.
    // WHY: Level 1 faces RIGHT (0°) — the exit is to the right.
    //   Level 2 faces LEFT (180°) — the exit is to the left.
    //   The arrow, on-body triangle, and React's "Facing:" display
    //   all read this value, so setting it correctly here makes
    //   everything consistent from the very first frame.
    this.facingAngle = cfg.facingAngle;

    // Guard flag: the overlap callback fires every frame the player is inside
    // the exit zone. Without this flag, "You Win!" would be added to the scene
    // ~60 times per second while the player stands on the goal.
    this.hasWon = false;

    // Guard flag: true while goForward is in progress (between setVelocity and
    // the delayedCall callback). Prevents queueing a second goForward before
    // the first timer fires, and also blocks turnLeft / turnRight mid-flight
    // (turning while moving would detach the arrow from the actual travel path).
    this.isMoving = false;

    // Guard flag: true during the 2-second crash delay (after wall contact,
    // before scene.restart() fires) AND during voluntary restarts via
    // restartGame(). While true, goForward / turnLeft / turnRight all silently
    // return early — no input is accepted during the countdown.
    //
    // WHY a flag instead of just disabling physics?
    //   We want the "Oops!" message and camera shake to play out for the full
    //   2 seconds before the scene resets. During those 2 seconds the player
    //   might click buttons — the flag ensures those clicks are harmlessly
    //   ignored rather than triggering another reset or a partial move.
    this.isResetting = false;
    // WHAT: True only when a timed scene.restart() or respawn is counting down.
    // WHY: Allows restartGame() to work during Game Over (where isResetting
    //   is true but no timed restart is scheduled).
    this._restartScheduled = false;

    // ═══════════════════════════════════════════════════════════════════════
    // CHECKPOINT + LIVES STATE
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * WHAT: Lives remaining before checkpoint is revoked.
     *
     * WHY on this.game instead of this?
     *   `this` is the scene instance — destroyed on scene.restart().
     *   `this.game` survives restarts. Lives must persist across the
     *   "full restart" that happens when all lives are lost.
     *
     * HOW: Starts at 5. Decremented on each wall crash. Reset to 5
     *   when a new checkpoint is activated or when all lives are lost.
     */
    if (this.game._lives === undefined) {
      this.game._lives = 5;
    }

    /**
     * WHAT: The currently active checkpoint (respawn point).
     *   null = no checkpoint active, respawn at maze start.
     *   { id, x, y } = respawn at this checkpoint's position.
     *
     * WHY on this.game?
     *   Must survive both soft respawns (teleport) and hard restarts
     *   (scene.restart when lives run out). Only cleared explicitly
     *   when lives hit 0.
     */
    if (this.game._activeCheckpoint === undefined) {
      this.game._activeCheckpoint = null;
    }

    /**
     * WHAT: Set of checkpoint IDs that have been activated at least once.
     *   Used to render checkpoints in the "passed" visual state.
     *
     * WHY a Set?
     *   Fast O(1) lookup: `activatedSet.has(id)`.
     *   No duplicates: activating the same checkpoint twice doesn't grow it.
     */
    if (this.game._activatedCheckpoints === undefined) {
      this.game._activatedCheckpoints = new Set();
    }

    // Reference to the active goForward timer (a Phaser.Time.TimerEvent).
    // WHY store it?
    //   If the player hits a wall MID-move, we must cancel the pending stop
    //   timer. Without cancellation, the timer would fire after scene.restart()
    //   has already been scheduled — its callback would then try to draw on
    //   dead game objects and call the React onComplete on an stale scene,
    //   causing silent errors or wrong state.
    this._moveTimer = null;

    // ── Level title (top-left corner) ──────────────────────────────────────
    //
    // WHAT: Shows which level the player is on.
    // WHY: So the kid knows whether they're on the easy level or the hard one.
    const levelName = this.game._currentLevel === 2
      ? 'Level 2 — Tricky Angles'
      : 'Level 1 — Right Angles';

    this.add.text(10, 8, levelName, {
      fontSize: '13px',
      color: '#667788',
      fontFamily: 'monospace',
    });

    // WHAT: `physics.add.overlap(A, B, callback)` calls `callback` each frame
    //   that A and B's bounding boxes intersect — without any physical push.
    this.physics.add.overlap(this.player, exitZone, () => {
      if (this.hasWon) return;
      this.hasWon = true;

      // Zero both velocity components so the player stops on the spot.
      // (x = horizontal, y = vertical in Phaser's coordinate system.)
      this.player.body.setVelocity(0, 0);

      // Disable the physics body entirely so no future velocity can move
      // the player (e.g. if the Move button is pressed again after winning).
      this.player.body.enable = false;

      // Hide the arrow and player indicator — neither is meaningful after winning.
      this.arrowGfx.clear();
      this.playerIndicatorGfx.clear();

      // Show a centred win message.
      // `setOrigin(0.5)` anchors the text object at its own centre, so the
      // x/y position refers to the middle of the text block, not its
      // top-left corner.
      this.add.text(400, 300, 'You Win!', {
        fontSize: '48px',
        color: '#ffd700',
        fontFamily: 'monospace',
        backgroundColor: '#00000099',
        padding: { x: 24, y: 12 },
      }).setOrigin(0.5);

      // WHAT: Notify React that this level was completed.
      // WHY: React updates the GameContext (marks level done, unlocks next)
      //   and navigates back to the level menu.
      // HOW: The callback is stored on this.game by GamePage.jsx's useEffect.
      this.game._onLevelWin?.(this.game._currentLevel);
    });

     // ═══════════════════════════════════════════════════════════════════════
    // CHECKPOINTS — visual markers + physics overlap zones
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * WHAT: Create checkpoint markers and their overlap zones.
     *
     * WHY separate sprites and physics zones?
     *   The sprite is the visible flag/beacon marker.
     *   The physics zone is an invisible rectangle for overlap detection.
     *   They must be separate because:
     *   - The sprite needs tinting to show state (inactive/active/passed).
     *   - The physics zone needs a fixed size for consistent hit detection.
     *
     * HOW: For each checkpoint in the current level's data:
     *   1. Create a sprite (visible marker).
     *   2. Create an invisible rectangle with a static physics body.
     *   3. Add an overlap detector between the player and the zone.
     *   4. Tint the sprite based on whether it's inactive, active, or passed.
     */
    const levelCheckpoints = checkpointsByLevel[this.game._currentLevel] || [];

    // Store sprite references so we can update tints when state changes.
    this._checkpointSprites = {};

    levelCheckpoints.forEach((cp) => {
      // ── Visible sprite ──────────────────────────────────────────────────
      const themed = this.textures.exists('checkpoint');
      let sprite;

      if (themed) {
        sprite = this.add.sprite(cp.x, cp.y, 'checkpoint')
          .setDisplaySize(36, 36)
          .setDepth(3);
      } else {
        // Fallback: small colored diamond
        sprite = this.add.rectangle(cp.x, cp.y, 20, 20, 0xffffff, 0.6)
          .setDepth(3);
        // Rotate 45° to look like a diamond shape
        sprite.setAngle(45);
      }

      // ── Set initial tint based on state ─────────────────────────────────
      //
      // WHAT: Three visual states for checkpoints:
      //   INACTIVE: not yet reached — dimmed (gray tint)
      //   ACTIVE:   current respawn point — bright green glow
      //   PASSED:   reached before but not the current respawn — yellow tint
      //
      // WHY tint instead of different images?
      //   Tinting one image is simpler than loading 3 separate images.
      //   Phaser's setTint() multiplies the texture color by the tint color
      //   — so 0xffffff = original colors, 0x888888 = dimmed, 0x00ff00 = green.
      const isActive = this.game._activeCheckpoint?.id === cp.id;
      const isPassed = this.game._activatedCheckpoints.has(cp.id);

      if (isActive) {
        sprite.setTint(0x00ff66);       // bright green = current respawn
      } else if (isPassed) {
        sprite.setTint(0xffcc00);       // yellow = previously activated
      } else {
        sprite.setTint(0x666666);       // gray = not yet reached
        sprite.setAlpha(0.6);
      }

      this._checkpointSprites[cp.id] = sprite;

      // ── Invisible physics zone for overlap detection ────────────────────
      const zone = this.add.rectangle(cp.x, cp.y, 30, 30);
      zone.setVisible(false);
      this.physics.add.existing(zone, true); // static body

      // ── Overlap: player reaches this checkpoint ─────────────────────────
      this.physics.add.overlap(this.player, zone, () => {
        this._onCheckpointReached(cp);
      });
    });

    // ── 11. Coordinate display ─────────────────────────────────────────────────
    //
    // WHAT: A small text label that shows the player's current canvas position
    //   in real time, updated every frame in update().
    // WHY store it as `this.coordText`?
    //   create() runs once; update() runs every frame. Storing the reference on
    //   `this` lets update() call `.setText()` on it without re-querying the
    //   scene's display list each frame.
    // HOW `setOrigin(1, 0)` works:
    //   Origins go from 0 to 1 along each axis. (1, 0) means "anchor the
    //   RIGHT edge of the text to x, and the TOP edge to y". This right-aligns
    //   the label inside the top-right corner of the canvas.
    this.coordText = this.add.text(790, 8, '', {
      fontSize: '13px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(1, 0);


    // ── 12. Initial direction preview ──────────────────────────────────────────
    //
    // Draw the arrow, player indicator, and compass needle once at startup,
    // all pointing right (facingAngle = 0°), so the player immediately sees
    // the initial facing direction before any move is made.
    this.setPreviewAngle(this.facingAngle);
  }

  /**
   * update()
   * WHAT: The game loop — called every frame by Phaser's internal timer.
   * HOW:  Phaser targets 60 fps by default; each call to update() represents one frame.
   * WHY:  This is where you check ongoing state — e.g. "has the player reached the exit?"
   *
   * @param {number} time   Total elapsed time in ms since the game started.
   * @param {number} delta  Time in ms since the last frame. Use this for frame-rate-
   *                        independent movement (e.g. speed × delta / 1000).
   */
  // eslint-disable-next-line no-unused-vars
  update(time, delta) {
    // Refresh the coordinate readout every frame.
    // Math.round() converts the sub-pixel float position (e.g. 59.9998) to a
    // clean integer so the display stays readable and doesn't flicker.
    const px = Math.round(this.player.x);
    const py = Math.round(this.player.y);
    this.coordText.setText(`x: ${px}  y: ${py}`);
  }

  /**
   * goForward(distance, onComplete)
   *
   * WHAT: Moves the player forward — in the direction they are ALREADY FACING —
   *   for `distance` pixels, then stops. This command does NOT turn the player.
   *
   *   Think of it as: "Robot, walk forward 100 steps."
   *   The robot walks in whatever direction it currently faces.
   *   To change direction, call turnLeft() or turnRight() FIRST.
   *
   * WHY separate from turning?
   *   Combining turn + move in one action hides two separate student decisions:
   *     1. Which direction should I face?  → handled by turnLeft / turnRight
   *     2. How far should I go?            → handled by goForward
   *   Keeping them apart makes each decision visible and deliberate — just like
   *   using a protractor: you measure the angle first, THEN draw the line.
   *
   * HOW the movement works:
   *   1. Convert facingAngle (degrees) to a unit direction vector (dx, dy).
   *   2. Set velocity = unit vector × MOVE_SPEED (pixels per second).
   *   3. Let Phaser's Arcade Physics run for (distance / MOVE_SPEED) ms.
   *   4. Zero velocity, draw trail segment, restore visuals, notify React.
   *
   *   If the player hits a wall, Arcade Physics zeroes the perpendicular
   *   velocity component — player slides to a stop. The timer still fires at
   *   the scheduled time and zeroes all remaining velocity.
   *
   * Called from React (App.jsx) via `game.scene.getScene('MazeScene')`.
   *
   * @param {number}   distance    How far to move, in pixels. Must be > 0.
   * @param {Function} onComplete  Optional. Called with (x, y) when the move
   *                               finishes so React can update its status line.
   */
  goForward(distance, onComplete) {

    // Bail early: never move after winning, while already mid-move, or during
    // the restart countdown. Returns false so React knows the call was ignored.
    if (this.hasWon || this.isMoving || this.isResetting) return false;

    // Snapshot the starting position NOW — we need it to draw the trail
    // after the move. player.x / player.y will change during the move.
    const startX = this.player.x;
    const startY = this.player.y;

    // ── Degrees → Radians ─────────────────────────────────────────────────────
    //
    // JavaScript's Math.cos / Math.sin take radians, not degrees.
    // Conversion: radians = degrees × (π / 180).
    // We keep the UI in degrees because "turn 90°" is immediately understood;
    // "turn 1.5708 radians" is not.
    const angleRad = (this.facingAngle * Math.PI) / 180;

    // ── Polar → Cartesian unit vector ─────────────────────────────────────────
    //
    // Convert facing direction to (dx, dy) — how far to move per pixel:
    //   dx =  cos(θ)   ← rightward component  (positive X = right)
    //   dy = −sin(θ)   ← downward component   (NEGATED because Phaser Y-down)
    //
    // WHY negate dy?
    //   In standard math, 90° → sin(90°) = +1 → moves UP.
    //   In Phaser, Y increases DOWNWARD, so +1 in vy moves DOWN — opposite!
    //   Negating makes 90° move toward smaller Y values (= up the screen). ✓
    //
    // Example — facingAngle = 45°, distance = 100 px:
    //   dx =  cos(45°) ≈ +0.707  →  vx ≈ +212 px/s  (right)
    //   dy = −sin(45°) ≈ −0.707  →  vy ≈ −212 px/s  (up)
    //   Combined speed = √(212² + 212²) ≈ 300 px/s = MOVE_SPEED  ✓
    const dx =  Math.cos(angleRad);
    const dy = -Math.sin(angleRad); // negated for Phaser Y-down

    // Apply velocity. (dx, dy) is a unit vector so × MOVE_SPEED = correct speed.
    this.player.body.setVelocity(dx * MOVE_SPEED, dy * MOVE_SPEED);
    this.isMoving = true;

    // Hide the arrow and triangle while moving — they're anchored to the
    // player's START position and would look wrong as the player slides away.
    // Both are restored in the delayedCall callback below.
    this.arrowGfx.clear();
    this.playerIndicatorGfx.clear();

    // ── Schedule the stop ─────────────────────────────────────────────────────
    //
    // duration = distance ÷ speed × 1000  (converts seconds → milliseconds)
    // Example: 100 px ÷ 300 px/s × 1000 = 333 ms.
    //
    // WHY `this.time.delayedCall` instead of `window.setTimeout`?
    //   Phaser's timer pauses when the game pauses, is auto-cleaned when the
    //   scene is destroyed, and stays in sync with the Phaser clock.
    //   `setTimeout` runs independently on the browser event loop.
    const durationMs = (distance / MOVE_SPEED) * 1000;

    // Store the timer reference so _onWallHit can cancel it if the player
    // hits a wall before the timer fires. (See _moveTimer comment in §10.)
    this._moveTimer = this.time.delayedCall(durationMs, () => {
      this._moveTimer = null; // timer has fired — nothing to cancel anymore
      this.player.body.setVelocity(0, 0);
      this.isMoving = false;

      // Draw a permanent trail segment: start → where the player actually landed.
      // (May be shorter than `distance` if a wall stopped the player early.)
      // WHY never clear trailGfx? The trail is permanent history. This contrasts
      // with arrowGfx / playerIndicatorGfx, which ARE cleared on every redraw.
      const trail = getTrailStyle(this._themed);
      this.trailGfx.lineStyle(trail.width, trail.color, trail.alpha);
      this.trailGfx.beginPath();
      this.trailGfx.moveTo(startX, startY);
      this.trailGfx.lineTo(this.player.x, this.player.y);
      this.trailGfx.strokePath();

      // Restore the arrow, triangle, and compass needle at the new position.
      // facingAngle is UNCHANGED by goForward — only turnLeft/turnRight change it.
      this.setPreviewAngle(this.facingAngle);

      // Notify React with the final (x, y) so it can update the status line.
      if (onComplete) onComplete(this.player.x, this.player.y);
    });

    return true; // accepted — React should set disabled=true and increment count
  }

  /**
   * turnLeft(degrees)
   *
   * WHAT: Rotates the player counterclockwise (CCW) by `degrees`, in place.
   *   The player does NOT move — only the facing direction changes.
   *   Like a robot spinning on the spot without taking a step.
   *
   * WHY counterclockwise for "left"?
   *   Standard math (and real protractors): positive angles go CCW.
   *   From the student's perspective:
   *     "Turn left"  = turn CCW = ADD degrees  (+)
   *     "Turn right" = turn CW  = SUBTRACT degrees (−)
   *   This matches "0° is right, 90° is up" — exactly like a protractor.
   *
   * HOW facingAngle accumulates:
   *   "Left 45° then left 45°" = facing 90° (straight up):
   *     Start:      0°
   *     Left 45°:   0 + 45 = 45°   (upper-right)
   *     Left 45°:   45 + 45 = 90°  (straight up) ✓
   *
   *   Double-modulo keeps the result in [0, 360):
   *     ((angle % 360) + 360) % 360
   *   This is needed because JS `%` returns negative for negative inputs.
   *
   * INSTANT action — no animation timer. The arrow updates immediately.
   *
   * @param {number} degrees  How many degrees to rotate CCW. 0 = no turn.
   * @returns {number}  The new facingAngle so React can update its display.
   */
  turnLeft(degrees) {
    if (this.hasWon || this.isMoving || this.isResetting) return undefined;

    // Add degrees (CCW). Double-modulo keeps result in [0, 360).
    this.facingAngle = ((this.facingAngle + degrees) % 360 + 360) % 360;

    // Immediately rotate the arrow, on-body triangle, and compass needle.
    this.setPreviewAngle(this.facingAngle);

    return this.facingAngle;
  }

  /**
   * turnRight(degrees)
   *
   * WHAT: Rotates the player clockwise (CW) by `degrees`, in place.
   *   The player does NOT move — only the facing direction changes.
   *
   * WHY negative (subtract) for right?
   *   Clockwise = decreasing angle in standard math / protractor convention.
   *   "Right 90°" from facing 0° (right) → 0 − 90 = −90 → normalized → 270° (down). ✓
   *
   * HOW: Same double-modulo as turnLeft, but subtracts instead of adds.
   *   Example — "right 45°" from facing 30°:
   *     30 − 45 = −15
   *     (−15 % 360)  → −15
   *     −15 + 360    → 345
   *     345 % 360    → 345  ✓  (facing lower-right, ~11 o'clock)
   *
   * INSTANT action — no animation timer.
   *
   * @param {number} degrees  How many degrees to rotate CW. 0 = no turn.
   * @returns {number}  The new facingAngle so React can update its display.
   */
  turnRight(degrees) {
    if (this.hasWon || this.isMoving || this.isResetting) return undefined;

    // Subtract degrees (CW). Same double-modulo normalization.
    this.facingAngle = ((this.facingAngle - degrees) % 360 + 360) % 360;

    this.setPreviewAngle(this.facingAngle);

    return this.facingAngle;
  }

   /**
   * _onWallHit(_player, _wall)
   *
   * WHAT: Called when the player touches a wall. Now implements the lives
   *   system instead of immediately restarting the scene.
   *
   * TWO PATHS:
   *   lives > 1 → SOFT RESPAWN: lose 1 life, teleport to checkpoint (or start).
   *     The scene stays intact — trail, walls, checkpoints all preserved.
   *     The player is moved back to the respawn point instantly.
   *
   *   lives == 1 → HARD RESTART: lose all checkpoint progress.
   *     "Checkpoint lost!" message, then scene.restart() after 2 seconds.
   *     Lives reset to 5, active checkpoint cleared.
   *
   * WHY soft respawn instead of scene.restart()?
   *   Kids need to see their trail to learn from mistakes. If the scene
   *   restarted every time, the trail would vanish and they'd lose context.
   *   Soft respawn keeps the trail visible, shows which checkpoints they've
   *   passed, and only costs 1 life — much more forgiving and educational.
   */
  _onWallHit(_player, _wall) {
    if (this.isResetting || this.hasWon) return;

    // ── Stop all motion ─────────────────────────────────────────────────
    this.player.body.setVelocity(0, 0);
    this._moveTimer?.remove();
    this._moveTimer = null;
    this.isMoving = false;

    // ── Camera shake (both paths) ───────────────────────────────────────
    this.cameras.main.shake(250, 0.007);

    // ── Decrement lives ─────────────────────────────────────────────────
    this.game._lives -= 1;

    if (this.game._lives > 0) {
      // ══════════════════════════════════════════════════════════════════
      // SOFT RESPAWN — teleport to checkpoint, keep the scene alive
      // ══════════════════════════════════════════════════════════════════

      this.isResetting = true; // prevent multiple triggers

      // Notify React to disable buttons briefly and update lives.
      this.game._onCrash?.();
      this.game._onLivesChanged?.(this.game._lives, null);

      // Flash player red briefly
      if (this.player.setTint) {
        this.player.setTint(0xff4444);
      } else if (this.player.setFillStyle) {
        this.player.setFillStyle(0xff4444);
      }

      // ── Show "Oops!" with lives count ─────────────────────────────────
      const heartsStr = '♥'.repeat(this.game._lives) + '♡'.repeat(5 - this.game._lives);
      const oopsMsg = this.add.text(400, 280, `Oops!  ${heartsStr}`, {
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ff8844',
        fontFamily: 'monospace',
        backgroundColor: '#000000bb',
        padding: { x: 16, y: 10 },
      }).setOrigin(0.5).setDepth(20);

      // ── Determine respawn position ──────────────────────────────────────
      const cfg = LEVEL_CONFIG[this.game._currentLevel] || LEVEL_CONFIG[1];
      const respawn = this.game._activeCheckpoint
        ? { x: this.game._activeCheckpoint.x, y: this.game._activeCheckpoint.y }
        : { x: cfg.startX, y: cfg.startY };

      // ── Teleport after 1 second ─────────────────────────────────────────
      this._restartScheduled = true;
      this.time.delayedCall(1000, () => {
        // Move player to respawn point
        this.player.setPosition(respawn.x, respawn.y);
        this.player.body.reset(respawn.x, respawn.y);

        // Clear the red flash
        if (this.player.clearTint) {
          this.player.clearTint();
        } else if (this.player.setFillStyle) {
          this.player.setFillStyle(0x4499ff);
        }

        // Remove the Oops message
        oopsMsg.destroy();

        // Restore direction indicators
        this.setPreviewAngle(this.facingAngle);

        // Re-enable input
        this.isResetting = false;
        this._restartScheduled = false;
        this.game._onRespawn?.(respawn.x, respawn.y);
      });

    } else {
      // ══════════════════════════════════════════════════════════════════
      // GAME OVER — all 5 lives used up, level is over
      //
      // WHAT: The player has exhausted all 5 lives for this level.
      //   The game stops. No automatic restart. The kid must click
      //   "Start Over" to try again.
      //
      // WHY no automatic restart?
      //   The prompt says: "Hard stop. Show Game Over and require the
      //   player to manually restart." This gives the kid a moment to
      //   reflect on what went wrong before they try again.
      //
      // HOW: We set isResetting = true (blocks all further input),
      //   disable the physics body (no more collisions), and show
      //   the Game Over screen. The only way out is the "Start Over"
      //   button in React, which calls restartGame().
      // ══════════════════════════════════════════════════════════════════

      this.isResetting = true;

      // Notify React to disable movement buttons and update lives display.
      this.game._onCrash?.();
      this.game._onLivesChanged?.(0, null);

      // Flash player red
      if (this.player.setTint) {
        this.player.setTint(0xff4444);
      } else if (this.player.setFillStyle) {
        this.player.setFillStyle(0xff4444);
      }

      // Disable physics — no more movement or collisions possible.
      this.player.body.enable = false;

      // Clear direction indicators
      this.arrowGfx.clear();
      this.playerIndicatorGfx.clear();

      // ── Show Game Over messages ───────────────────────────────────────
      this.add.text(400, 240, 'GAME OVER', {
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#ff4444',
        fontFamily: 'monospace',
        backgroundColor: '#000000cc',
        padding: { x: 28, y: 16 },
      }).setOrigin(0.5).setDepth(20);

      this.add.text(400, 320, 'All 5 lives used!', {
        fontSize: '22px',
        color: '#ff8866',
        fontFamily: 'monospace',
        backgroundColor: '#000000bb',
        padding: { x: 16, y: 8 },
      }).setOrigin(0.5).setDepth(20);

      this.add.text(400, 375, 'Click "Start Over" to try again', {
        fontSize: '15px',
        color: '#aa9988',
        fontFamily: 'monospace',
        backgroundColor: '#000000bb',
        padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setDepth(20);

      // ── NO automatic restart ──────────────────────────────────────────
      // The scene stays frozen on the Game Over screen.
      // The only exit is restartGame() via the React "Start Over" button.
      // restartGame() already resets _lives to 5 and clears checkpoints.
    }
  }

  /**
   * restartGame()
   *
   * WHAT: Public method for voluntary restart (e.g. the "Start Over" button
   *   in React). Immediately resets the scene without the 2-second delay.
   *
   * WHY no delay for voluntary restart?
   *   The kid chose to restart — no need to make them wait. The "Oops!"
   *   message and delay are there for accidental crashes, not intentional
   *   restarts.
   *
   * HOW it differs from `_onWallHit`:
   *   • No camera shake or red flash (nothing bad happened).
   *   • `scene.restart()` fires immediately, not after a `delayedCall`.
   *   • Works even when `hasWon` is true (restart from the win screen is fine).
   *
   * Called from React via `game.scene.getScene('MazeScene').restartGame()`.
   */
  restartGame() {

    // WHAT: Allow restart UNLESS a timed restart is already counting down.
    if (this._restartScheduled) return;
    this.isResetting = true;

    // Stop any active movement.
    this.player.body.setVelocity(0, 0);
    this._moveTimer?.remove();
    this._moveTimer = null;
    this.isMoving = false;

    // Notify React to disable buttons immediately.
    this.game._onCrash?.();

    // WHAT: Clear checkpoint progress on voluntary restart.
    // WHY: "Start Over" means start over completely — don't carry over
    //   checkpoint positions from a previous attempt.
    this.game._activeCheckpoint = null;
    this.game._activatedCheckpoints = new Set();
    this.game._lives = 5;

    // Restart right away — no delay for voluntary action.
    this.scene.restart();
  }

  /**
   * setLevel(level)
   *
   * WHAT: Changes the current level and restarts the scene to load the
   *   new maze walls.
   *
   * WHY store on this.game?
   *   scene.restart() destroys `this` (the scene instance) and creates
   *   a brand-new one. Any value stored on `this` would be lost.
   *   `this.game` is the Phaser.Game object — it SURVIVES all restarts.
   *   So storing _currentLevel there means create() can read it when
   *   the new scene instance boots up.
   *
   * HOW: Set the level, then restart. The new create() call will see the
   *   updated level and load the correct wall data.
   *
   * @param {number} level  1 or 2.
   */
  setLevel(level) {
    this.game._currentLevel = level;

    // Stop any active movement and cancel timers.
    this.player.body.setVelocity(0, 0);
    this._moveTimer?.remove();
    this._moveTimer = null;
    this.isMoving = false;

    // Notify React to disable buttons.
    this.game._onCrash?.();

    // WHAT: Clear checkpoint progress on voluntary restart.
    // WHY: "Start Over" means start over completely — don't carry over
    //   checkpoint positions from a previous attempt.
    this.game._activeCheckpoint = null;
    this.game._activatedCheckpoints = new Set();
    this.game._lives = 5;

    // Restart with the new level data.
    this.scene.restart();
  }

    /**
   * _onCheckpointReached(checkpoint)
   *
   * WHAT: Called when the player's body overlaps a checkpoint zone.
   *   Activates the checkpoint as the new respawn point and refills lives.
   *
   * WHY check if it's already active?
   *   The overlap fires EVERY FRAME the player is inside the zone.
   *   Without the guard, we'd reset lives to 5 sixty times per second
   *   while the player stands on the checkpoint.
   *
   * HOW state changes:
   *   1. Set this checkpoint as the active respawn point.
   *   2. Add its ID to the activated set (for visual state tracking).
   *   3. Reset lives to 5.
   *   4. Update all checkpoint sprite tints to reflect the new state.
   *   5. Notify React to update the lives display.
   *   6. Show a brief "Checkpoint saved!" message on canvas.
   *
   * @param {{ id: number, x: number, y: number, label: string }} checkpoint
   */
  _onCheckpointReached(checkpoint) {
    // Guard: don't re-activate the already-active checkpoint.
    if (this.game._activeCheckpoint?.id === checkpoint.id) return;
    // Guard: don't activate during win/reset states.
    if (this.hasWon || this.isResetting) return;

    // ── Update game state ───────────────────────────────────────────────
    this.game._activeCheckpoint = checkpoint;
    this.game._activatedCheckpoints.add(checkpoint.id);

    // ── Update all checkpoint sprite tints ───────────────────────────────
    const levelCheckpoints = checkpointsByLevel[this.game._currentLevel] || [];
    levelCheckpoints.forEach((cp) => {
      const sprite = this._checkpointSprites[cp.id];
      if (!sprite) return;

      if (cp.id === checkpoint.id) {
        sprite.setTint(0x00ff66);     // bright green = active
        sprite.setAlpha(1);
      } else if (this.game._activatedCheckpoints.has(cp.id)) {
        sprite.setTint(0xffcc00);     // yellow = passed
        sprite.setAlpha(1);
      }
      // Inactive checkpoints keep their gray tint (set in create).
    });

    // ── Notify React ────────────────────────────────────────────────────
    this.game._onLivesChanged?.(this.game._lives, checkpoint.label);

    // ── Brief canvas message ────────────────────────────────────────────
    const msg = this.add.text(400, 500, `✓ ${checkpoint.label} saved!`, {
      fontSize: '16px',
      color: '#00ff66',
      fontFamily: 'monospace',
      backgroundColor: '#00000088',
      padding: { x: 10, y: 6 },
    }).setOrigin(0.5).setDepth(20);

    // Fade out and destroy after 1.5 seconds
    this.tweens.add({
      targets: msg,
      alpha: 0,
      duration: 800,
      delay: 700,
      onComplete: () => msg.destroy(),
    });
  }

  /**
   * setPreviewAngle(angleDeg)
   *
   * WHAT: Draws (or redraws) three direction indicators simultaneously:
   *   1. The external ARROW  — a yellow arrow from the player's position.
   *   2. The on-body TRIANGLE — a small filled triangle inside the player square.
   *   3. The COMPASS NEEDLE  — a line from the compass ring's centre to its rim.
   *
   *   All three always point in the same direction (angleDeg), providing
   *   redundant, at-a-glance confirmation of the current facing/preview angle.
   *
   * CALLED FROM:
   *   • turnLeft() / turnRight() — immediately after updating facingAngle,
   *     to rotate all three direction indicators at once. Instant, no timer.
   *   • goForward's delayedCall callback — after a move ends, to restore the
   *     arrow and triangle at the new (post-move) player position.
   *   • create() — once at startup with facingAngle = 0 (facing right).
   *
   * WHY clear-and-redraw for the arrow and triangle (but not the trail)?
   *   The arrow and triangle always show the CURRENT state — only one should
   *   ever be visible at a time. Without `clear()`, every call would add a
   *   new arrow/triangle on top of the old ones, creating visual clutter.
   *   The trail intentionally accumulates (see movePlayer comments).
   *
   * @param {number} angleDeg  Angle in degrees (0° right, 90° up, CCW positive).
   *                           During live preview this is the computed post-turn
   *                           angle; after a move this equals this.facingAngle.
   */
  setPreviewAngle(angleDeg) {

    // Don't draw while mid-move (player is in flight; all three visuals would
    // be anchored at the stale start position). Or after winning (irrelevant).
    // The caller (movePlayer's callback) only reaches setPreviewAngle after
    // isMoving has already been set back to false.
    if (this.hasWon || this.isMoving) return;

    // WHAT: Rotate the player sprite to match the facing direction.
    // WHY: The arrow and triangle already show direction, but rotating
    //   the character sprite makes it look like the character is physically
    //   turning — much more natural with a Minecraft-style character.
    updatePlayerRotation(this.player, angleDeg, this._themed);

    // Convert to radians once — all three draws below use the same rad value.
    // Example: angleDeg = 45°  →  rad ≈ 0.785
    //   cos(0.785) ≈ 0.707   (X component, points right)
    //   sin(0.785) ≈ 0.707   (Y component, negated → points UP in Phaser)
    const rad = (angleDeg * Math.PI) / 180;

    

    // ── 1. External direction arrow ───────────────────────────────────────────
    //
    // Shaft runs from player centre to a tip 50 px away in the facing direction.
    // Two arrowhead wings branch from the tip ±30° off the backward direction.
    const ARROW_LEN = 50;
    const HEAD_LEN  = 12;

    const tipX = this.player.x + ARROW_LEN * Math.cos(rad);
    const tipY = this.player.y - ARROW_LEN * Math.sin(rad); // −sin for Phaser Y-down

    // Backward direction = rad + π.  Wings at ±30° (π/6) off that.
    const backAngle = rad + Math.PI;
    const wing1     = backAngle + Math.PI / 6;
    const wing2     = backAngle - Math.PI / 6;

    this.arrowGfx.clear();
    this.arrowGfx.lineStyle(2, 0xffee44, 0.85); // bright yellow

    this.arrowGfx.beginPath();
    this.arrowGfx.moveTo(this.player.x, this.player.y);
    this.arrowGfx.lineTo(tipX, tipY);
    this.arrowGfx.strokePath();

    // NOTE: each wing is a separate beginPath/strokePath pair so the line cap
    // is applied correctly at both the wing tip and at the tip juncture.
    this.arrowGfx.beginPath();
    this.arrowGfx.moveTo(tipX, tipY);
    this.arrowGfx.lineTo(tipX + HEAD_LEN * Math.cos(wing1), tipY - HEAD_LEN * Math.sin(wing1));
    this.arrowGfx.strokePath();

    this.arrowGfx.beginPath();
    this.arrowGfx.moveTo(tipX, tipY);
    this.arrowGfx.lineTo(tipX + HEAD_LEN * Math.cos(wing2), tipY - HEAD_LEN * Math.sin(wing2));
    this.arrowGfx.strokePath();

    // ── 2. On-body direction triangle ─────────────────────────────────────────
    //
    // A small filled triangle centred on the player square, with:
    //   Tip    : 8 px from centre in the facing direction.
    //   Base 1 : 5 px from centre at (facing + 180° + 120°).
    //   Base 2 : 5 px from centre at (facing + 180° − 120°).
    // Using ±120° off the backward direction gives an equilateral-ish triangle.
    const TIP_R  = 8; // px from player centre to triangle tip
    const BASE_R = 5; // px from player centre to triangle base corners

    const indTipX = this.player.x + TIP_R * Math.cos(rad);
    const indTipY = this.player.y - TIP_R * Math.sin(rad);

    // Base corners: 120° off the backward direction in each rotational direction.
    const base1Angle = backAngle + (Math.PI * 2) / 3; // +120°
    const base2Angle = backAngle - (Math.PI * 2) / 3; // −120°

    const indB1X = this.player.x + BASE_R * Math.cos(base1Angle);
    const indB1Y = this.player.y - BASE_R * Math.sin(base1Angle);
    const indB2X = this.player.x + BASE_R * Math.cos(base2Angle);
    const indB2Y = this.player.y - BASE_R * Math.sin(base2Angle);

    this.playerIndicatorGfx.clear();
    this.playerIndicatorGfx.fillStyle(0xffffff, 0.85); // white, slightly transparent

    // `fillTriangle(x1,y1, x2,y2, x3,y3)` — Phaser draws a filled triangle
    // using these three vertices. No beginPath/strokePath needed for fills.
    this.playerIndicatorGfx.fillTriangle(
      indTipX, indTipY,
      indB1X,  indB1Y,
      indB2X,  indB2Y,
    );
/* 
    // ── 3. Compass needle ─────────────────────────────────────────────────────
    //
    // A line from the compass ring's centre to a point NEEDLE_R px away in the
    // facing direction, plus a small dot at the centre.
    // Uses this.compassCX / this.compassCY which are set in _drawCompass().
    //
    // WHY use the same `rad` computed above?
    //   Both the player arrow and the compass needle represent the same angle.
    //   Computing rad once and reusing it is both efficient and guarantees they
    //   always agree with each other.
    const NEEDLE_R = 40; // stops just inside the RING_R = 48 border

    const needleX = this.compassCX + NEEDLE_R * Math.cos(rad);
    const needleY = this.compassCY - NEEDLE_R * Math.sin(rad); // −sin, Phaser Y-down

    this.compassNeedleGfx.clear();
    this.compassNeedleGfx.lineStyle(2, 0xffee44, 0.9); // same yellow as arrow

    this.compassNeedleGfx.beginPath();
    this.compassNeedleGfx.moveTo(this.compassCX, this.compassCY);
    this.compassNeedleGfx.lineTo(needleX, needleY);
    this.compassNeedleGfx.strokePath();

    // Small pivot dot at the ring's centre — makes the needle look anchored.
    this.compassNeedleGfx.fillStyle(0xffee44, 0.9);
    this.compassNeedleGfx.fillCircle(this.compassCX, this.compassCY, 3); */
  }

  /**
   * _drawCompass()
   *
   * WHAT: Draws the static parts of the angle-reference diagram in the
   *   bottom-left corner: a ring, four tick marks, four direction labels,
   *   and a title. The live needle is stored separately (this.compassNeedleGfx,
   *   created in create()) and drawn/updated via setPreviewAngle().
   *
   * WHY?
   *   The angle convention (0° = right, 90° = UP, CCW = positive) is the
   *   opposite of the screen's Y-axis and non-obvious to newcomers. A
   *   permanent reference removes the need to memorise the convention.
   *
   * WHY a private helper (underscore prefix)?
   *   JavaScript doesn't have true private methods, but the `_` prefix is a
   *   community convention meaning "internal — don't call this from outside
   *   the class". It signals that this is an implementation detail.
   *
   * HOW: Called once from create() before trailGfx and the player, so the
   *   static ring sits at the bottom of the z-stack. The needle is created
   *   last in create() so it renders above everything else.
   */
  /* _drawCompass() {
    // Store centre on `this` so setPreviewAngle() can reach it when drawing
    // the live needle (a separate Graphics object that must know the centre).
    this.compassCX = 80;  // px from left
    this.compassCY = 520; // px from top — large ring still fits within 600 canvas

    const RING_R = 48; // radius in pixels — bigger than the old 36 so tick labels
                       // have room and kids can read the protractor markings easily

    const cgfx = this.add.graphics();

    // ── Dark background fill ──────────────────────────────────────────────────
    //
    // A filled circle slightly larger than the ring acts as a backdrop, keeping
    // the tick marks and needle readable even if trail lines drift into this
    // corner of the canvas.
    cgfx.fillStyle(0x0d1220, 0.85);
    cgfx.fillCircle(this.compassCX, this.compassCY, RING_R + 3);

    // ── Outer ring ────────────────────────────────────────────────────────────
    cgfx.lineStyle(1.5, 0x334455, 1);
    cgfx.strokeCircle(this.compassCX, this.compassCY, RING_R);

    // ── Tick marks every 30° — protractor style ───────────────────────────────
    //
    // A real protractor has marks at regular degree intervals. We use 30° gaps
    // (12 marks per full rotation) with longer, brighter ticks at each 90°
    // (the four cardinal directions students need most).
    //
    // COORDINATE NOTE: our angle convention is standard math —
    //   0° = right (+X), 90° = UP (−Y in screen coords), 180° = left, 270° = down.
    //   So: screen_x = cx + r × cos(gameAngle)
    //       screen_y = cy − r × sin(gameAngle)   ← NEGATIVE sin for Y-down
    for (let deg = 0; deg < 360; deg += 30) {
      const rad      = (deg * Math.PI) / 180;
      const cardinal = (deg % 90 === 0); // 0°, 90°, 180°, 270°
      const tickLen  = cardinal ? 10 : 5;
      const lw       = cardinal ? 1.5 : 1;
      const color    = cardinal ? 0x556677 : 0x2a3a44;

      const outerX = this.compassCX + RING_R          * Math.cos(rad);
      const outerY = this.compassCY - RING_R          * Math.sin(rad);
      const innerX = this.compassCX + (RING_R-tickLen) * Math.cos(rad);
      const innerY = this.compassCY - (RING_R-tickLen) * Math.sin(rad);

      cgfx.lineStyle(lw, color, 1);
      cgfx.beginPath();
      cgfx.moveTo(innerX, innerY);
      cgfx.lineTo(outerX, outerY);
      cgfx.strokePath();
    }

    // ── Cardinal labels: degree + direction word ──────────────────────────────
    //
    // Two-line label (e.g. "90°\nup") helps students connect the angle number
    // to the screen direction — the same connection they practise with a real
    // protractor in class.
    //
    // Label positions use game angle → screen coords (same −sin for Y):
    //   labelX = cx + cos(gameAngle) × (RING_R + offset)
    //   labelY = cy − sin(gameAngle) × (RING_R + offset)
    const CARD = [
      { deg:   0, label: '0°',   name: 'right' },
      { deg:  90, label: '90°',  name: 'up'    },
      { deg: 180, label: '180°', name: 'left'  },
      { deg: 270, label: '270°', name: 'down'  },
    ];

    CARD.forEach(({ deg, label, name }) => {
      const rad    = (deg * Math.PI) / 180;
      const offset = RING_R + 18; // just past ring + long tick

      const lx = this.compassCX + offset * Math.cos(rad);
      const ly = this.compassCY - offset * Math.sin(rad); // −sin: Y-down

      this.add.text(lx, ly, `${label}\n${name}`, {
        fontSize: '9px',
        color: '#667788',
        fontFamily: 'monospace',
        align: 'center',
      }).setOrigin(0.5);
    });

    // ── Title ─────────────────────────────────────────────────────────────────
    this.add.text(this.compassCX, this.compassCY - RING_R - 16, 'Facing', {
      fontSize: '10px',
      color: '#445566',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
  } */
}
