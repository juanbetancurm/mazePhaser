/**
 * config.js — Phaser game configuration for AngleMaze.
 *
 * WHAT: This object is passed directly to `new Phaser.Game(config)` and controls
 *       everything about how Phaser initialises: renderer, canvas size, physics
 *       engine, and which scenes to load.
 *
 * HOW:  Phaser reads this object at startup. Changing a value here (e.g. width)
 *       takes effect without touching any scene code.
 *
 * WHY Arcade Physics?
 *   Phaser ships three physics engines:
 *     • Arcade  — Uses Axis-Aligned Bounding Boxes (AABB). Very fast, ideal for
 *                 grid/maze games where objects are rectangles. This is our choice.
 *     • Matter  — Full rigid-body simulation (rotation, joints, complex shapes).
 *                 Powerful but overkill for a simple maze.
 *     • Ninja   — Slope/tile collision. Deprecated in newer Phaser 3 versions.
 *   For AngleMaze, the player is a square moving along a grid of rectangular walls,
 *   so Arcade Physics gives us collision detection with minimal overhead.
 */

import MazeScene from './scenes/MazeScene.js';

const config = {
  // WHAT: Selects the rendering backend.
  // WHY:  AUTO lets Phaser pick WebGL if the browser supports it, falling back to
  //       Canvas 2D. WebGL is hardware-accelerated and handles many objects faster.
  type: Phaser.AUTO,

  // WHAT: Canvas dimensions in CSS pixels.
  // WHY:  800×600 gives a comfortable play area for a maze on most screens.
  width: 800,
  height: 600,

  // WHAT: The id of the DOM element Phaser will inject the <canvas> into.
  // WHY:  React renders a <div id="game-container"> in App.jsx; Phaser appends
  //       its canvas as a child of that div so React controls layout.
  parent: 'game-container',

  // WHAT: Arcade Physics configuration block.
  // HOW:  Phaser only activates physics for bodies you explicitly call
  //       `this.physics.add.*` on inside a scene, so there's no cost for
  //       game objects that don't need it.
  physics: {
    default: 'arcade',
    arcade: {
      // gravity: { y: 0 } means no downward pull — this is a top-down maze,
      // not a platformer. Objects stay where they're placed unless we move them.
      gravity: { y: 0 },

      // debug: false hides the green collision boxes in production.
      // Tip: set to true while building the maze to visualise physics bodies.
      debug: false,
    },
  },

  // WHAT: The list of scene classes Phaser will manage.
  // HOW:  The first scene in the array starts automatically when the game boots.
  // WHY:  AngleMaze is a single-scene game; more scenes (e.g. a menu) can be
  //       added to this array later.
  scene: [MazeScene],
};

export default config;
