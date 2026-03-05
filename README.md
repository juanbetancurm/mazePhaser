# AngleMaze

AngleMaze is a browser-based maze game for kids learning to use a **protractor**. You navigate a player square through corridors by giving it three turtle-style commands — turn left, turn right, and go forward — instead of pressing arrow keys. Each command is a separate decision, forcing deliberate angle reasoning: "How many degrees should I turn? Which direction?"

## Run it

```bash
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

## How to play

AngleMaze uses **turtle graphics** — just like Python's `turtle.left()`, `turtle.right()`, and `turtle.forward()`. Turning and moving are always separate steps.

| Button | What it does |
|---|---|
| **▲ Forward** | Walk forward `Distance` px in the current facing direction. No turning. |
| **↰ Turn Left** | Rotate counterclockwise by `Degrees`. No movement. |
| **Turn Right ↱** | Rotate clockwise by `Degrees`. No movement. |

**Typical sequence:**
1. You start facing **right** (0°).
2. Click **Turn Left** with 90° → now facing **up**.
3. Click **Forward** with 150 px → walk straight up.
4. Click **Turn Right** with 45° → now facing **upper-right** (45°).
5. Click **Forward** with 100 px → diagonal move.

**On-canvas guides:**
- The **yellow arrow** on the player always shows the current facing direction. It rotates instantly when you turn.
- The **blue trail** shows every path you've taken.
- The **protractor compass** in the bottom-left corner maps degree values to screen directions (0° = right, 90° = up, etc.).

If the player hits a wall it slides to a stop — the move ends wherever it landed. Reach the **gold square** in the bottom-right corner to win.

## Tech stack

| Layer | Technology |
|---|---|
| UI & component lifecycle | React 18 + Vite |
| Game engine | PhaserJS 3 (Arcade Physics) |
| Rendering | WebGL (auto-fallback to Canvas 2D) |
| Language | JavaScript (ES Modules, no TypeScript) |

## Project structure

```
src/
├── main.jsx              React entry point
├── App.jsx               Root component: Phaser bootstrap + movement controls UI
├── index.css             Dark theme styles for inputs and button
└── game/
    ├── config.js         Phaser.Game configuration (size, physics, scene list)
    ├── mazeData.js       Wall segment definitions — edit this to redesign the maze
    └── scenes/
        └── MazeScene.js  All game logic: walls, player, movement, trail, arrow, compass
```

## Learning goals

This project is designed as a teaching example for developers new to PhaserJS. The source code — especially [src/game/scenes/MazeScene.js](src/game/scenes/MazeScene.js) — is written with detailed explanatory comments covering:

- **Phaser scene lifecycle** — why `preload()`, `create()`, and `update()` exist as separate phases, and what belongs in each one.

- **Arcade Physics bodies** — the difference between *static* bodies (walls, exit zone — baked in once, zero per-frame cost) and *dynamic* bodies (player — recalculated every frame), and when to use each.

- **`collider` vs `overlap`** — how `physics.add.collider` physically pushes a dynamic body out of a static body, while `physics.add.overlap` detects intersection without any physics response, and why the exit zone uses overlap rather than a collider.

- **World bounds** — using `setCollideWorldBounds(true)` so the player can never leave the canvas even if no wall is drawn at the edge.

- **Trigonometric movement** — converting polar coordinates (distance + angle) to Cartesian velocity (`vx`, `vy`), and why Phaser's Y-down coordinate system requires negating the `sin` component:
  ```
  vx =  cos(angleRad) × speed      // right is positive X
  vy = −sin(angleRad) × speed      // UP is negative Y in Phaser
  ```

- **React ↔ Phaser integration** — holding the `Phaser.Game` instance in a `useRef` (not `useState`) to avoid re-renders, bridging React events to Phaser scene methods via `game.scene.getScene('MazeScene')`, and safely updating React state from inside a Phaser timer callback.

- **Graphics API** — drawing lines and shapes procedurally without any image files, and the difference between the *clear-and-redraw* pattern (direction arrow) and the *accumulate-only* pattern (movement trail).

- **Z-ordering** — how Phaser's render depth is determined by the order objects are added in `create()`, and using that to layer the compass → trail → player → arrow correctly.
