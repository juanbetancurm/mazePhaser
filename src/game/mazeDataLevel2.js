/**
 * mazeDataLevel2.js — Wall definitions for AngleMaze Level 2 (Diagonal Walls).
 *
 * WHAT: Same format as mazeData.js — each wall is { x1, y1, x2, y2 }.
 *   The difference: this level includes DIAGONAL walls at various angles
 *   (30°, 45°, 60°, 135°, etc.) to force the student to use non-90° turns.
 *
 * WHY diagonal walls matter for learning:
 *   In Level 1, every wall is horizontal or vertical. A student can solve the
 *   entire maze using only 90° turns — they never need to read a protractor.
 *   In Level 2, the walls are tilted. To navigate around a 45° wall, the
 *   student must turn 45° — which means measuring 45° on the protractor.
 *   THIS is the learning moment: connecting the game to the real tool.
 *
 * HOW diagonal walls differ in physics:
 *   Horizontal/vertical walls use ONE rectangle physics body (fast, simple).
 *   Diagonal walls use a CHAIN of small square bodies placed along the line
 *   (see createDiagonalWallBodies in MazeScene.js for the full explanation).
 *   The visual rendering is the same — lineBetween works at any angle.
 *
 * MAZE LAYOUT (800 × 600 canvas):
 *
 *   ★ = START (60, 60)       ✦ = EXIT (740, 540)
 *
 *   The solution path requires turns of 45°, 60°, and 30° — not just 90°.
 *   Several dead ends punish students who only try 90° turns.
 *
 * COORDINATE REMINDER:
 *   (0,0) = top-left.  X increases → (right).  Y increases ↓ (down).
 */

const walls = [

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTER BOUNDARY (same as Level 1 — horizontal and vertical)
  // These four walls enclose the 800 × 600 play area.
  // ═══════════════════════════════════════════════════════════════════════════

  { x1:   0, y1:   0, x2: 800, y2:   0 },  // top edge (horizontal)
  { x1:   0, y1: 600, x2: 800, y2: 600 },  // bottom edge (horizontal)
  { x1:   0, y1:   0, x2:   0, y2: 600 },  // left edge (vertical)
  { x1: 800, y1:   0, x2: 800, y2: 600 },  // right edge (vertical)

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL WALLS — mix of diagonal and straight
  //
  // Each wall is commented with:
  //   • Its approximate ANGLE (relative to horizontal, pointing right = 0°)
  //   • Its PURPOSE in the maze (what it blocks, what angle the kid needs)
  //
  // HOW to read a diagonal wall definition:
  //   { x1: 150, y1: 100, x2: 350, y2: 300 }
  //   means "a line from point (150,100) to point (350,300)".
  //   Since BOTH x and y change, this is diagonal (not horizontal or vertical).
  //   The angle is: atan2(300-100, 350-150) = atan2(200, 200) = 45°
  //   But remember Y is flipped in screen coords, so visually it goes
  //   from upper-left to lower-right (like a \ backslash).
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Wall A: 45° diagonal (\) ──────────────────────────────────────────────
  // Goes from upper-left area toward the centre.
  // Blocks the direct path from start. The student must turn ~45° to go
  // parallel to this wall, or turn to go around it.
  //
  // Visual angle on screen: \ (top-left to bottom-right)
  // Math angle: atan2(300-100, 300-100) = 45° downward in screen coords
  // To navigate past it: turn right 45° from facing right, or go around above
  { x1: 150, y1: 100, x2: 350, y2: 300 },

  // ── Wall B: 135° diagonal (/) ─────────────────────────────────────────────
  // Goes from lower-left toward upper-right.
  // Blocks upward escape from the centre area.
  //
  // Visual angle on screen: / (bottom-left to top-right)
  // To navigate past it: the student needs roughly a 45° or 135° turn
  { x1: 350, y1: 350, x2: 500, y2: 200 },

  // ── Wall C: Vertical wall ─────────────────────────────────────────────────
  // A familiar straight wall to give the student a breather.
  // Separates the left area from the centre corridor.
  { x1: 200, y1: 350, x2: 200, y2: 500 },

  // ── Wall D: 30° shallow diagonal ──────────────────────────────────────────
  // A long, shallow-angled wall across the bottom third.
  // This is harder because 30° is less intuitive than 45°.
  //
  // The student must think: "This wall is almost horizontal but tilted a bit.
  // I need to turn 30° to go parallel, or 60° to go perpendicular."
  //
  // atan2(500-420, 650-350) = atan2(80, 300) ≈ 15° in screen coords
  // On the game's protractor: ~345° or the student needs ~30° adjustments
  { x1: 350, y1: 420, x2: 650, y2: 500 },

  // ── Wall E: 60° steep diagonal ────────────────────────────────────────────
  // A steep wall in the right portion of the maze.
  // Forces a 60° turn — the complement of the 30° wall above.
  //
  // atan2(350-150, 600-500) = atan2(200, 100) ≈ 63° in screen coords
  // The student needs to turn about 60° to navigate around it.
  { x1: 550, y1: 100, x2: 650, y2: 300 },

  // ── Wall F: Horizontal wall ───────────────────────────────────────────────
  // Straight horizontal barrier in the upper area.
  // Familiar shape — student can use 90° turns here.
  { x1: 350, y1: 100, x2: 550, y2: 100 },

  // ── Wall G: 45° diagonal (\) ──────────────────────────────────────────────
  // Another 45° wall in the bottom-right, guarding the exit.
  // The student has seen 45° before (Wall A), so this reinforces the skill.
  { x1: 600, y1: 400, x2: 720, y2: 520 },

  // ── Wall H: Short vertical wall ───────────────────────────────────────────
  // A small vertical barrier that narrows a corridor.
  { x1: 450, y1: 300, x2: 450, y2: 400 },

  // ── Wall I: 135° diagonal (/) ─────────────────────────────────────────────
  // Short diagonal in the upper-right, creating a pocket.
  { x1: 680, y1: 200, x2: 750, y2: 130 },

  // ── Wall J: 45° stub (\) ──────────────────────────────────────────────────
  // A short 45° wall that juts into a corridor.
  // Forces a small angular adjustment — tests precision.
  { x1: 100, y1: 300, x2: 180, y2: 380 },

  // ── Wall K: Horizontal wall ───────────────────────────────────────────────
  // Bottom-left horizontal barrier.
  { x1: 0, y1: 500, x2: 200, y2: 500 },

];

export default walls;