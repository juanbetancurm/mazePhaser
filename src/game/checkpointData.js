/**
 * checkpointData.js — Checkpoint positions for each maze level.
 *
 * WHAT: Each checkpoint is a point location (x, y) where the player can
 *   save their progress. When the player's sprite overlaps a checkpoint's
 *   hit zone, it activates and becomes the new respawn point.
 *
 * WHY separate from wall data?
 *   Checkpoints are NOT walls. They don't block movement or cause collision.
 *   They are interactive zones that change game state. Mixing them with
 *   wall data would confuse the physics system.
 *
 * HOW they're used:
 *   MazeScene.create() reads this data and creates:
 *     1. A visible sprite (checkpoint.png) at each position.
 *     2. An invisible physics zone for overlap detection.
 *   When the player overlaps a zone, _onCheckpointReached() fires.
 *
 * CHECKPOINT ORDER:
 *   The `id` field is used to identify checkpoints in the game state.
 *   The player can activate them in ANY order — whichever was touched
 *   most recently becomes the active respawn point.
 */

const checkpointsByLevel = {
  1: [
    // Level 1 has no checkpoints (it's the tutorial level)
  ],

  2: [
    { id: 1, x: 645, y: 525, label: 'Checkpoint 1' },
    { id: 2, x: 450, y: 340, label: 'Checkpoint 2' },
    { id: 3, x: 200, y: 180, label: 'Checkpoint 3' },
    { id: 4, x: 460, y: 500, label: 'Checkpoint 4' },
  ],

  // Add Level 3 checkpoints here later:
  // 3: [ { id: 1, x: ..., y: ..., label: '...' }, ... ],
};

export default checkpointsByLevel;