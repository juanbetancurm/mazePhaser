/**
 * App.jsx — Root React component for AngleMaze.
 *
 * TURTLE GRAPHICS MODEL (same as Python's turtle library):
 *   Turning and moving are ALWAYS separate actions — each is its own button:
 *
 *     ▲ Forward     — walk `distance` pixels in the current facing direction.
 *     ↰ Turn Left   — rotate CCW (counterclockwise) by `degrees`, no movement.
 *     Turn Right ↱  — rotate CW  (clockwise)        by `degrees`, no movement.
 *     🔄 Start Over  — voluntarily restart the maze at any time.
 *
 * CRASH / RESTART FLOW:
 *   1. Player touches a wall → MazeScene._onWallHit() fires.
 *   2. MazeScene calls game._onCrash() → React sets disabled=true (buttons locked).
 *   3. Phaser shows "Oops!" on canvas and waits 2 seconds.
 *   4. scene.restart() is called → Phaser rebuilds the scene from scratch.
 *   5. MazeScene.create() calls game._onReset(true) → React resets all state,
 *      shows encourage message for 3 seconds, re-enables buttons.
 *
 * React ↔ Phaser bridge:
 *   The Phaser game lives in a ref (gameRef). React never owns the canvas.
 *   Scene → React: callbacks stored on gameRef.current (_onCrash, _onReset).
 *   React → Scene: direct method calls via getScene().
 */
import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import config from './game/config.js';

export default function App() {

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const gameRef    = useRef(null);
  const distRef    = useRef(null);
  const degreesRef = useRef(null);

  // ── State ─────────────────────────────────────────────────────────────────────

  // WHAT: Initial position and facing angle for the React status display.
  // WHY: These must match the DEFAULT level's LEVEL_CONFIG values.
  //   Default level is 2 → start at (740, 60) facing 180° (left).
  //   If you change the default level back to 1, change these to
  //   { x: 60, y: 60 } and 0.
  // HOW: After Phaser's create() runs, _onReset syncs these to the actual
  //   values. But for the brief moment before that, React uses these.
  const [position,     setPosition]     = useState({ x: 740, y: 60 });
  const [facingAngle,  setFacingAngle]  = useState(180);
  const [moveCount,    setMoveCount]    = useState(0);

  /**
   * currentLevel — which maze the player is on (1 or 2).
   * WHY in React state?
   *   The Phaser scene stores the level on this.game._currentLevel (survives
   *   scene restarts). But React needs its OWN copy to update the UI —
   *   highlighting the active level button and showing the level name.
   */
  const [currentLevel, setCurrentLevel] = useState(1);
  /**
   * disabled — true while buttons should be non-interactive:
   *   • During a goForward animation (player is mid-move).
   *   • During the 2-second crash delay after hitting a wall.
   *   • During a voluntary restart (brief moment before scene.restart fires).
   *
   * WHY a single `disabled` flag for all these cases?
   *   All three cases share the same desired behaviour: "ignore button clicks."
   *   Using one flag keeps the JSX simple — one `disabled={disabled}` prop
   *   on each button rather than a complex boolean expression.
   */
  const [disabled, setDisabled] = useState(false);

  /**
   * encourageMsg — shown briefly after a restart to cheer the kid on.
   *   Set in the _onReset callback when wasRestart=true.
   *   Cleared automatically after 3 seconds via setTimeout.
   *   Empty string '' = no message shown.
   */
  const [encourageMsg, setEncourageMsg] = useState('');

  // ── Phaser lifecycle ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (gameRef.current !== null) return; // React 18 StrictMode double-mount guard

    gameRef.current = new Phaser.Game(config);

    // ── Scene → React callbacks ───────────────────────────────────────────────
    //
    // We store callbacks directly on the Phaser.Game object because it survives
    // across scene restarts. Storing them on the scene instance would not work
    // — the old scene instance is destroyed on restart, losing the callbacks.
    //
    // WHY store them here (in useEffect) rather than at module scope?
    //   The React state setters (setPosition, setFacingAngle, etc.) are only
    //   available inside the component. useEffect runs after first render, when
    //   `gameRef.current` has been assigned and the setters are in scope.
    //
    // WHY is it safe to call React setters from Phaser callbacks?
    //   React 18 "automatic batching" handles state updates from any context —
    //   including non-React code like Phaser timer callbacks — batching them
    //   into a single re-render automatically.

    /**
     * _onCrash — called by MazeScene when the player touches a wall OR when
     *   a voluntary restart begins via restartGame(). Its only job is to
     *   disable the React buttons immediately so the kid can't spam them
     *   during the reset countdown.
     */
    gameRef.current._onCrash = () => {
      setDisabled(true);
    };

    /**
     * _onReset(wasRestart) — called at the start of MazeScene.create()
     *   whenever the scene has been restarted (not on first load).
     *
     *   @param {boolean} wasRestart  true if this create() is a restart.
     *
     * Resets all React state to match the fresh Phaser scene:
     *   - Position back to start (60, 60).
     *   - Facing angle back to 0° (right).
     *   - Move counter back to 0.
     *   - Buttons re-enabled.
     *   - Encourage message shown for 3 seconds then cleared.
     */
    /**
     * _onReset(wasRestart, cfg)
     *
     * WHAT: Called by MazeScene.create() to sync React state with Phaser.
     *
     * @param {boolean} wasRestart  true if this is a restart, false on first load.
     * @param {Object}  cfg         The LEVEL_CONFIG entry for the current level:
     *   { startX, startY, exitX, exitY, facingAngle }
     *
     * WHY the `cfg` parameter?
     *   Before: we always reset to (60, 60) and 0° — correct for Level 1,
     *   but WRONG for Level 2 (start at 740, 60, facing 180°).
     *   Now: Phaser passes the level config, so React uses the right values.
     *
     * HOW the destructuring works:
     *   const { startX = 60, startY = 60, facingAngle: startAngle = 0 } = cfg || {};
     *
     *   This says:
     *   - Pull startX from cfg. If missing, use 60.
     *   - Pull startY from cfg. If missing, use 60.
     *   - Pull facingAngle from cfg, rename it to startAngle. If missing, use 0.
     *   - If cfg itself is undefined/null, use {} (empty object) so all defaults kick in.
     *
     *   The rename `facingAngle: startAngle` avoids shadowing the React state
     *   variable also called `facingAngle`.
     */
    gameRef.current._onReset = (wasRestart, cfg) => {
      const { startX = 60, startY = 60, facingAngle: startAngle = 0 } = cfg || {};

      setDisabled(false);
      setPosition({ x: startX, y: startY });
      setFacingAngle(startAngle);
      setMoveCount(0);

      const level = gameRef.current?._currentLevel ?? 1;
      setCurrentLevel(level);

      if (wasRestart) {
        setEncourageMsg('Try again! You got this!');
        setTimeout(() => setEncourageMsg(''), 3000);
      }
    };

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const getScene = () => gameRef.current?.scene.getScene('MazeScene') ?? null;

  /**
   * facingLabel(angle) — maps well-known angles to friendly direction words.
   * e.g. 90 → " — up", 270 → " — down". Returns '' for non-standard angles.
   */
  const facingLabel = (angle) => {
    const map = {
      0:   'right',
      45:  'upper-right',
      90:  'up',
      135: 'upper-left',
      180: 'left',
      225: 'lower-left',
      270: 'down',
      315: 'lower-right',
    };
    return map[angle] ? ` — ${map[angle]}` : '';
  };

  // ── Action handlers ───────────────────────────────────────────────────────────

  /**
   * handleForward()
   *
   * Calls goForward() on the scene. The scene returns `true` if the call was
   * accepted (not blocked by hasWon / isMoving / isResetting), `false` if ignored.
   *
   * WHY check the return value?
   *   We disable buttons and increment the move counter ONLY if the scene
   *   actually started a move. If goForward returns false (e.g. called mid-
   *   restart), we avoid setting disabled=true with no matching re-enable path.
   */
  const handleForward = () => {
    const scene    = getScene();
    if (!scene) return;
    const distance = parseFloat(distRef.current.value) || 0;
    if (distance <= 0) return;

    const accepted = scene.goForward(distance, (x, y) => {
      setPosition({ x: Math.round(x), y: Math.round(y) });
      setDisabled(false);
    });

    if (accepted) {
      setDisabled(true);
      setMoveCount(c => c + 1);

      // WHAT: Clear the distance input after a successful move.
      //
      // WHY: Forces the kid to type a NEW distance for the next move.
      //   Without this, the old value stays and the kid can just mash
      //   the Forward button without thinking about each step.
      //   Every move should be a conscious decision: "How far this time?"
      //
      // HOW: distRef.current is the actual <input> DOM element.
      //   Setting .value = '' directly changes what the browser displays.
      //   This works because we use an UNCONTROLLED input (ref + defaultValue),
      //   not a controlled one (value + onChange + useState).
      //   With a controlled input, we'd need to call a setState function
      //   instead — setting .value directly would be overwritten by React.
      distRef.current.value = '';
    }
  };

  /**
   * handleTurnLeft() / handleTurnRight()
   *
   * Turns are INSTANT — no animation. The scene updates facingAngle and
   * redraws the arrow in the same synchronous call, then returns the new angle.
   * We don't need to set `disabled` because there is no wait time.
   *
   * If the return value is `undefined`, the scene rejected the call
   * (hasWon / isMoving / isResetting) — we skip the React state update.
   */
  const handleTurnLeft = () => {
    const scene   = getScene();
    if (!scene) return;
    const degrees  = parseFloat(degreesRef.current.value) || 0;
    const newAngle = scene.turnLeft(degrees);
    if (newAngle !== undefined) {
      setFacingAngle(newAngle);
      setMoveCount(c => c + 1);

      // WHAT: Clear the degrees input after a successful turn.
      // WHY: Same reason as Forward — the kid should decide the angle
      //   for each turn deliberately, not reuse the old value by habit.
      // HOW: Same technique — direct DOM manipulation via the ref.
      degreesRef.current.value = '';
    }
  };

  const handleTurnRight = () => {
    const scene   = getScene();
    if (!scene) return;
    const degrees  = parseFloat(degreesRef.current.value) || 0;
    const newAngle = scene.turnRight(degrees);
    if (newAngle !== undefined) {
      setFacingAngle(newAngle);
      setMoveCount(c => c + 1);

      // WHAT: Clear the degrees input after a successful turn.
      // WHY: Consistent with Forward — every action requires fresh input.
      // HOW: Direct DOM manipulation via degreesRef.
      degreesRef.current.value = '';
    }
  };

  /**
   * handleStartOver()
   *
   * Voluntary restart — calls MazeScene.restartGame() which stops motion,
   * notifies React (_onCrash → setDisabled(true)), and calls scene.restart()
   * immediately (no 2-second delay). The new scene's create() then calls
   * _onReset(true) which re-enables buttons and resets all state.
   */
  const handleStartOver = () => {
    getScene()?.restartGame();
  };

  /**
   * handleLevelSwitch(level)
   *
   * WHAT: Switches to a different maze level.
   * WHY: Lets the kid choose between the easy level (90° turns only)
   *   and the hard level (diagonal walls, non-90° turns).
   * HOW: Calls setLevel() on the Phaser scene, which stores the level
   *   on the Game object and restarts the scene. The _onReset callback
   *   then syncs React's state.
   */
  const handleLevelSwitch = (level) => {
    getScene()?.setLevel(level);
  };









  // ── Render ────────────────────────────────────────────────────────────────────
  //
  // LAYOUT STRUCTURE:
  //
  //   <root column>          ← vertical: title on top, content below
  //     <title />
  //     <level buttons />
  //     <content row>        ← horizontal: maze left, controls right
  //       <game-container /> ← left: the Phaser canvas
  //       <sidebar column>   ← right: controls + status stacked vertically
  //         <forward card />
  //         <turn card />
  //         <start over />
  //         <encourage msg />
  //         <status />
  //       </sidebar>
  //     </content>
  //   </root>
  //
  // WHY this structure?
  //   The title and level buttons span the full width (they're outside the row).
  //   The maze and controls sit side-by-side inside the row.
  //   The controls panel uses flexDirection: 'column' to stack its children
  //   vertically, and justifyContent: 'center' to vertically center them
  //   against the maze canvas height.

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '16px',
    }}>

      {/* ── Header (spans full width) ──────────────────────────────────────── */}
      <h1 style={{
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#6699cc',
        marginBottom: '12px',
        letterSpacing: '0.04em',
      }}>
        AngleMaze — Move with Math!
      </h1>

      {/* ── Level selector (spans full width) ──────────────────────────────── */}
      {/*
        WHAT: Level buttons sit above the maze + controls row.
        WHY: They apply to the whole game, not just the controls panel.
        HOW: They're outside the row div, so they span the full width.

        NOTE: If your level buttons are currently somewhere else in the JSX,
        move them here — between the <h1> and the row div below.
        If you don't have level buttons yet, skip this section.
      */}
      {/* ── Level selector ───────────────────────────────────────────────── */}
      {/*
        WHAT: Two buttons that let the kid switch between levels.
        WHY: Level 1 teaches 90° turns. Level 2 teaches protractor angles.
             The kid should be able to practice either one freely.
        HOW: Each button calls handleLevelSwitch(n). The active level is
             highlighted with a brighter background and border.
      */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '12px',
      }}>
        <button
          onClick={() => handleLevelSwitch(1)}
          disabled={disabled}
          style={{
            padding: '8px 18px',
            fontFamily: 'monospace',
            fontSize: '13px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            border: currentLevel === 1 ? '2px solid #44aa66' : '1px solid #334',
            borderRadius: '6px',
            background: currentLevel === 1 ? '#1a3a1a' : '#111',
            color: currentLevel === 1 ? '#55dd77' : '#556',
            fontWeight: currentLevel === 1 ? 'bold' : 'normal',
          }}
        >
          Level 1 — Right Angles
        </button>
        <button
          onClick={() => handleLevelSwitch(2)}
          disabled={disabled}
          style={{
            padding: '8px 18px',
            fontFamily: 'monospace',
            fontSize: '13px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            border: currentLevel === 2 ? '2px solid #cc8833' : '1px solid #334',
            borderRadius: '6px',
            background: currentLevel === 2 ? '#2a1a00' : '#111',
            color: currentLevel === 2 ? '#ffaa44' : '#556',
            fontWeight: currentLevel === 2 ? 'bold' : 'normal',
          }}
        >
          Level 2 — Tricky Angles
        </button>
      </div>

      {/* ── Side-by-side row: maze (left) + controls (right) ──────────────── */}
      {/*
        WHAT: A horizontal flex container that puts the Phaser canvas on the
          left and the control panel on the right.
        WHY: So the kid can see the maze AND the controls at the same time,
          without scrolling.
        HOW: display: 'flex' with flexDirection: 'row' (the default).
          gap: '24px' adds spacing between the canvas and controls.
          alignItems: 'flex-start' aligns both to the top edge.
      */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '24px',
        alignItems: 'flex-start',
      }}>

        {/* ── Left side: Phaser game canvas ────────────────────────────────── */}
        {/*
          WHAT: The div Phaser injects its <canvas> into.
          WHY: It must be a separate element so Phaser can control it.
          HOW: Phaser's config.js has `parent: 'game-container'`, which tells
            Phaser to find this div by id and append the canvas inside it.
            The canvas is 800×600 px (set in config.js width/height).
            flexShrink: 0 prevents the canvas from being squished if the
            browser window is narrower than the total row width.
        */}
        <div id="game-container" style={{ flexShrink: 0 }} />

        {/* ── Right side: control panel ────────────────────────────────────── */}
        {/*
          WHAT: All the turtle controls, the restart button, encourage message,
            and status readout — stacked vertically in a sidebar.
          WHY: Keeps controls visible at all times alongside the maze.
          HOW: flexDirection: 'column' stacks children vertically.
            justifyContent: 'center' vertically centers the controls
            against the height of the maze canvas (600px).
            minWidth prevents the controls from collapsing too narrow.
        */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#99aabb',
          minWidth: '200px',
        }}>

          {/* ── Forward card (green) ───────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 24px',
            border: '1px solid #1a4a1a',
            borderRadius: '10px',
            background: '#0a1f0a',
            width: '100%',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Distance:
              <input
                ref={distRef}
                type="number"
                defaultValue={50}
                min={1}
                step={10}
                placeholder="px"
                className="maze-input"
                style={{ width: '72px' }}
              />
              <span>px</span>
            </label>

            <button
              onClick={handleForward}
              disabled={disabled}
              className="maze-btn-forward"
            >
              ▲ Forward
            </button>
          </div>

          {/* ── Turn card (amber) ──────────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 24px',
            border: '1px solid #4a3800',
            borderRadius: '10px',
            background: '#1a1200',
            width: '100%',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Degrees:
              <input
                ref={degreesRef}
                type="number"
                defaultValue={90}
                min={0}
                step={5}
                placeholder="°"
                className="maze-input"
                style={{ width: '72px' }}
              />
              <span>°</span>
            </label>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleTurnLeft}
                disabled={disabled}
                className="maze-btn-turn"
              >
                ↰ Turn Left
              </button>
              <button
                onClick={handleTurnRight}
                disabled={disabled}
                className="maze-btn-turn"
              >
                Turn Right ↱
              </button>
            </div>
          </div>

          {/* ── Start Over button ──────────────────────────────────────────── */}
          <button
            onClick={handleStartOver}
            className="maze-btn-reset"
          >
            🔄 Start Over
          </button>

          {/* ── Encourage message ──────────────────────────────────────────── */}
          {encourageMsg && (
            <div style={{
              fontFamily: 'monospace',
              fontSize: '15px',
              fontWeight: 'bold',
              color: '#55ee88',
              textAlign: 'center',
            }}>
              {encourageMsg}
            </div>
          )}

          {/* ── Status readout ─────────────────────────────────────────────── */}
          <div style={{
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#556677',
            textAlign: 'center',
            lineHeight: '1.7',
          }}>
            <div>Position: ({position.x}, {position.y})</div>
            <div>Facing: {facingAngle}°{facingLabel(facingAngle)}</div>
            <div>Moves: {moveCount}</div>
          </div>

        </div>
        {/* ── End of control panel ─────────────────────────────────────────── */}

      </div>
      {/* ── End of side-by-side row ──────────────────────────────────────────── */}

    </div>
  );
}
