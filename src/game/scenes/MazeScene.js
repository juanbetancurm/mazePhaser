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

  /**
   * preload()
   * WHAT: Load external assets (images, spritesheets, audio) before the scene starts.
   * HOW:  `this.load.*` methods queue assets; Phaser fetches them and waits for all
   *       to finish before calling create().
   * WHY:  Game objects that depend on textures must not be created before the texture
   *       data is available in memory. This phase handles that guarantee.
   *
   * For AngleMaze we draw everything with the Graphics API (no image files needed),
   * so this method intentionally stays empty.
   */
  preload() {
    // No external assets to load — walls and the player will be drawn with Phaser Graphics.
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

    // ── 0. Scene-restart detection ────────────────────────────────────────────
    //
    // WHAT: `this.scene.restart()` creates a FRESH instance of MazeScene,
    //   calling create() again from scratch. All Phaser state — game objects,
    //   timers, physics bodies, graphics — is wiped clean automatically.
    //
    // HOW we detect a restart vs. first load:
    //   `this.game` is the Phaser.Game object. It survives ALL scene restarts
    //   because only the scene is recreated, not the entire game engine.
    //   We store a `_hasStarted` flag on it to tell the two cases apart.
    //
    // WHY notify React on restart?
    //   React holds its own copy of game state (position, facing angle, move
    //   counter) in useState. Phaser's create() resets Phaser state
    //   automatically — but React's state is completely separate and must be
    //   reset explicitly by calling the React setState functions stored on the
    //   game object as `game._onReset`.
    // ── 0. Scene-restart detection and level selection ──────────────────────
    if (this.game._hasStarted) {
      this.game._onReset?.(true);
    } else {
      this.game._hasStarted = true;
    }

    // ── 0b. Level selection ─────────────────────────────────────────────────
    //
    // WHAT: Choose which set of walls to use based on the current level.
    //
    // WHY store currentLevel on `this.game` instead of `this`?
    //   `this` = the scene instance. It gets DESTROYED on scene.restart().
    //   `this.game` = the Phaser.Game instance. It survives all restarts.
    //   So `this.game._currentLevel` persists even when the scene resets.
    //
    // HOW: Default to level 1 if no level has been set yet.
    //   The React UI calls scene.setLevel(n) to change it.
    if (this.game._currentLevel === undefined) {
      this.game._currentLevel = 1;
    }

    // Pick the wall data array for the current level.
    const walls = this.game._currentLevel === 2 ? wallsLevel2 : wallsLevel1;


    // ── 1. Background colour ──────────────────────────────────────────────────
    // `this.cameras.main` is the default camera Phaser creates for every scene.
    // Setting its background colour avoids the default black or transparent canvas.
    this.cameras.main.setBackgroundColor('#1a1a2e');


    // ── 2. Draw walls visually with the Graphics API ──────────────────────────
    //
    // WHAT: `this.add.graphics()` creates a Graphics game object.
    //       Think of it as a blank sheet of paper you can draw on using
    //       vector commands (moveTo, lineTo, arc, fillRect, etc.).
    //
    // WHY use Graphics instead of image files?
    //   • No art assets required — walls are just line segments, which we can
    //     describe perfectly with coordinates.
    //   • Easy to change: editing a number in mazeData.js instantly updates
    //     both the visual and the physics body.
    //   • Teaches the separation between visual rendering and physics — the
    //     Graphics object only draws; a separate rectangle handles collisions.
    //
    // HOW it works under the hood:
    //   Phaser batches all the `moveTo`/`lineTo` calls into a WebGL draw call
    //   (or Canvas 2D path) and renders it once per frame. `strokePath()` is
    //   the command that actually sends the path to the GPU/canvas.
    const gfx = this.add.graphics();

    // lineStyle(lineWidth, color, alpha)
    //   lineWidth — thickness of the stroke in pixels
    //   color     — hex colour as a JavaScript number (0xRRGGBB)
    //   alpha     — opacity, 0 = invisible, 1 = fully opaque
    gfx.lineStyle(4, 0xcccccc, 1); // light grey, 4 px wide

    walls.forEach(({ x1, y1, x2, y2 }) => {
      gfx.beginPath();       // start a new path (clears any previous path state)
      gfx.moveTo(x1, y1);   // lift the "pen" and place it at the wall's start point
      gfx.lineTo(x2, y2);   // draw a line to the wall's end point
      gfx.strokePath();      // paint the current path using the active lineStyle
                             // NOTE: without strokePath() the line is invisible!
    });


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
    this.add.rectangle(60, 60, 40, 40, 0x00cc55, 0.5); // green, 50 % opaque


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
    const exitZone = this.add.rectangle(740, 540, 40, 40, 0xffd700, 0.8); // gold
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
    this._drawCompass();


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
    this.player = this.add.rectangle(60, 60, 20, 20, 0x4499ff); // bright blue

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
    this.compassNeedleGfx = this.add.graphics();


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
    this.facingAngle = 0; // start facing right (0° = →)

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
      this.trailGfx.lineStyle(1.5, 0x88aaff, 0.45); // semi-transparent blue
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
   * _onWallHit(playerObj, wallObj)
   *
   * WHAT: Collider callback — called by Phaser every frame the player's body
   *   overlaps any wall body. When triggered, it:
   *     1. Immediately stops the player and cancels any pending move timer.
   *     2. Shows a kid-friendly "Oops!" message on the canvas.
   *     3. Shakes the camera and flashes the player red for visual feedback.
   *     4. Waits 2 seconds, then calls `this.scene.restart()` to reset everything.
   *
   * HOW collider callbacks work in Phaser:
   *   `physics.add.collider(A, B, callback, processCallback, context)`
   *   Phaser calls `callback(A, B)` AFTER resolving the collision (i.e. after
   *   pushing the player out of the wall). The two arguments are the game
   *   objects (or physics bodies, depending on how A and B were created).
   *   We don't need them here — we already have `this.player`.
   *
   * WHY the `isResetting` guard?
   *   The collider fires EVERY FRAME that two bodies overlap — not just once.
   *   Without the guard, "Oops!" text would be added ~60 times per second,
   *   and `scene.restart()` would be scheduled 60 times per second.
   *   The flag ensures the callback only has full effect once.
   *
   * HOW `this.scene.restart()` works:
   *   Phaser destroys the current scene — removing all game objects, timers,
   *   physics bodies, and graphics — then creates a completely fresh instance
   *   by running `preload()` → `create()` again. It is effectively a full
   *   reset back to the initial game state, as if the page was reloaded.
   *   Any data you want to survive must be stored outside the scene (e.g. on
   *   `this.game`, or in React state).
   *
   * @param {Phaser.GameObjects.GameObject} _player  The player game object (unused — we have `this.player`).
   * @param {Phaser.GameObjects.GameObject} _wall    The wall game object that was hit (unused).
   */
  _onWallHit(_player, _wall) {

    // Guard: only react to the FIRST frame of contact.
    // `isResetting` prevents every subsequent frame from piling up more
    // "Oops!" messages and scheduling multiple restarts simultaneously.
    // `hasWon` prevents the crash handler from firing on the exit zone
    // (which doesn't use a collider, but just in case of edge overlaps).
    if (this.isResetting || this.hasWon) return;
    this.isResetting = true;

    // ── Step 1: Stop all motion ───────────────────────────────────────────────

    // Halt the player immediately.
    this.player.body.setVelocity(0, 0);

    // Cancel the goForward stop-timer if one is active.
    // WHY: goForward schedules a `delayedCall` to stop the player and draw the
    // trail after N milliseconds. If we hit a wall mid-move, that timer is
    // still scheduled. Without cancellation, its callback would fire after
    // scene.restart() — trying to draw on destroyed graphics objects.
    // `remove()` dequeues the event without dispatching the callback. ✓
    this._moveTimer?.remove();
    this._moveTimer = null;
    this.isMoving = false;

    // ── Step 2: Notify React ──────────────────────────────────────────────────

    // Disable React's action buttons so the kid can't keep clicking during
    // the 2-second crash delay. React stores a callback on the game object.
    this.game._onCrash?.();

    // ── Step 3: Visual effects ────────────────────────────────────────────────

    // Flash the player red — immediate visual feedback that something happened.
    // `setFillStyle` works on Rectangle game objects created with `this.add.rectangle`.
    // The scene restart will recreate the rectangle in its original blue (#4499ff),
    // so we don't need to manually restore the colour.
    this.player.setFillStyle(0xff4444);

    // Shake the camera for 350 ms at low intensity.
    // `shake(duration, intensity)`: intensity is in fractions of the camera width
    // (0.009 ≈ 7 px at 800 px wide — noticeable but not nauseating for kids).
    this.cameras.main.shake(350, 0.009);

    // Clear the direction arrow — it would look wrong pointing from a red,
    // stationary player while the "Oops!" message is showing.
    this.arrowGfx.clear();
    this.playerIndicatorGfx.clear();

    // ── Step 4: Show the Oops message ─────────────────────────────────────────

    // Two-line message stacked vertically on the canvas, centred at (400, *).
    // Warm orange/red text on a semi-transparent dark background.
    // `setOrigin(0.5)` centres each text object at its own midpoint.
    this.add.text(400, 255, 'Oops!', {
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#ff8844',
      fontFamily: 'monospace',
      backgroundColor: '#00000099',
      padding: { x: 24, y: 12 },
    }).setOrigin(0.5);

    this.add.text(400, 330, 'You touched a wall!', {
      fontSize: '22px',
      color: '#ffbbaa',
      fontFamily: 'monospace',
      backgroundColor: '#00000099',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5);

    this.add.text(400, 380, 'Try a different path next time...', {
      fontSize: '15px',
      color: '#aa7766',
      fontFamily: 'monospace',
      backgroundColor: '#00000099',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5);

    // ── Step 5: Restart after 2 seconds ──────────────────────────────────────

    // WHY 2 seconds?
    //   Long enough to read the message and understand what happened.
    //   Short enough not to feel like a punishment — this is an encouraging
    //   retry pause, not a penalty screen.
    //
    // `this.scene.restart()` inside a delayedCall is safe: the timer is owned
    // by the scene's clock, so it fires on the correct Phaser frame and the
    // scene system handles teardown cleanly.
    this.time.delayedCall(2000, () => {
      this.scene.restart();
    });
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

    // Don't stack restarts if one is already in progress.
    if (this.isResetting) return;
    this.isResetting = true;

    // Stop any active movement.
    this.player.body.setVelocity(0, 0);
    this._moveTimer?.remove();
    this._moveTimer = null;
    this.isMoving = false;

    // Notify React to disable buttons immediately.
    this.game._onCrash?.();

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

    // Restart with the new level data.
    this.scene.restart();
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
    this.compassNeedleGfx.fillCircle(this.compassCX, this.compassCY, 3);
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
  _drawCompass() {
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
  }
}
