/**
 * mazeData.js — Wall definitions for the AngleMaze level.
 *
 * WHAT: Each wall is a line segment described by start (x1, y1) and end (x2, y2)
 *       coordinates in Phaser's canvas space.
 * HOW:  MazeScene.js reads this array, draws each segment visually with the
 *       Graphics API, and creates a matching static physics body for collision.
 * WHY:  Keeping level data in a separate file makes it easy to redesign the maze
 *       without touching any rendering or physics logic.
 *
 * Coordinate system:
 *   (0, 0) = TOP-LEFT corner of the 800 × 600 canvas.
 *   X increases →  (right).
 *   Y increases ↓  (down) — opposite of standard math convention.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MAZE LAYOUT  (4 columns × 3 rows, each cell 200 × 200 px)
 *
 *        x=0   x=200  x=400  x=600  x=800
 *   y=0   +──────+──────+──────+──────+
 *         │[0,0]★│[1,0] │[2,0] ║[3,0] │   ║ = wall (no passage)
 *   y=200 +      ╠══════╣      +      +   + = open passage
 *         │[0,1] ║[1,1] ║[2,1] │[3,1] │   ★ = START (60, 60)
 *   y=400 +      ╠══════╬══════╣      +   ✦ = EXIT  (740, 540)
 *         │[0,2] ║[1,2] ║[2,2] ║[3,2]✦│
 *   y=600 +──────+──────+──────+──────+
 *
 * SOLUTION PATH (each step shows the direction of travel):
 *   [0,0] ──right──▶ [1,0] ──right──▶ [2,0]
 *                                        │
 *                                      down↓
 *                                        │
 *                                      [2,1] ──right──▶ [3,1]
 *                                                          │
 *                                                        down↓
 *                                                          │
 *                                                        [3,2] ✦ EXIT
 *
 *   Each right-arrow crossing is open (no wall blocks it).
 *   Each down-arrow crossing is open (no wall blocks it).
 *   Two stubs inside [1,0] and [2,1] add in-corridor challenge — see below.
 *
 * DEAD ENDS:
 *   • From [0,0], going DOWN leads into [0,1] → [0,2]  (left-column trap).
 *   • From [3,1], going UP  leads into [3,0]            (top-right pocket).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const walls = [

  // ── Outer boundary ──────────────────────────────────────────────────────────
  // These four segments enclose the entire play area.
  // The canvas is 800 px wide and 600 px tall.

  { x1:   0, y1:   0, x2: 800, y2:   0 }, // top edge
  { x1:   0, y1: 600, x2: 800, y2: 600 }, // bottom edge
  { x1:   0, y1:   0, x2:   0, y2: 600 }, // left edge
  { x1: 800, y1:   0, x2: 800, y2: 600 }, // right edge

  // ── Internal grid walls ──────────────────────────────────────────────────────
  // Each segment is either fully horizontal (y1 === y2) or fully vertical
  // (x1 === x2). A gap between two cells means there is NO wall there —
  // the player can pass through freely.

  // — Horizontal walls (run left/right, block vertical movement) —

  // Seals the bottom of cells [1,0] and the top of cells [1,1] + [2,1]:
  // blocks the direct downward shortcut from the top corridor.
  { x1: 200, y1: 200, x2: 400, y2: 200 },

  // Seals the bottom of the left dead-end [1,1] and right-sealed [2,1]:
  { x1: 200, y1: 400, x2: 400, y2: 400 },
  { x1: 400, y1: 400, x2: 600, y2: 400 },

  // — Vertical walls (run up/down, block horizontal movement) —

  // Right wall of the left dead-end column (cells [0,1] and [0,2]
  // cannot escape to the right):
  { x1: 200, y1: 200, x2: 200, y2: 400 },
  { x1: 200, y1: 400, x2: 200, y2: 600 },

  // Right wall of the sealed centre room [1,1] and [1,2]:
  { x1: 400, y1: 200, x2: 400, y2: 400 },
  { x1: 400, y1: 400, x2: 400, y2: 600 },

  // Separates the solution-path columns [2,*] from the top-right pocket [3,0]
  // and the bottom-right locked zone [3,2] left side:
  { x1: 600, y1:   0, x2: 600, y2: 200 }, // top-right pocket left wall
  { x1: 600, y1: 400, x2: 600, y2: 600 }, // bottom-right locked zone left wall

  // ── Stub walls (partial — do not span a full cell edge) ────────────────────
  // These create narrower passages within corridors, forcing the player to think
  // about the exact angle and distance needed to navigate around them.

  // Stub in cell [1,0]: juts down from the top edge at x=300.
  // The player must travel at y > 100 to slip past it on the way right.
  { x1: 300, y1:   0, x2: 300, y2: 100 },

  // Stub in cell [2,1]: juts down from y=200 at x=500.
  // The player must travel at x ≠ 500 (e.g., x=450 or x=550) to pass it.
  { x1: 500, y1: 200, x2: 500, y2: 300 },

];

export default walls;
