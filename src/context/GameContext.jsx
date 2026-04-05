/**
 * GameContext.jsx — Global game state shared across all screens.
 *
 * WHAT: A React Context that stores:
 *   - Team information (member names, course)
 *   - Level progress (which levels are completed, which are unlocked)
 *
 * WHY Context instead of props?
 *   Three separate pages (Registration, LevelMenu, GamePage) need to
 *   read or write this data. Passing it through props would require
 *   every intermediate component to forward props it doesn't use.
 *   Context lets any component access the data directly.
 *
 * WHY not localStorage?
 *   We'll add PostgreSQL later. Keeping state in React Context makes
 *   it easy to swap in API calls — just change the functions here,
 *   and every component that uses the context gets the new behavior
 *   automatically. localStorage would require a separate migration.
 *
 * HOW to use in a component:
 *   import { useGame } from '../context/GameContext';
 *   const { team, levelProgress, completeLevel } = useGame();
 */
import { createContext, useContext, useState, useCallback } from 'react';

// ── Create the context ──────────────────────────────────────────────────────
//
// WHAT: createContext() creates a "channel" that components can subscribe to.
// WHY: The default value (null) is only used if a component tries to read
//   the context without being wrapped in a Provider — which would be a bug.
//   We'll throw an error in useGame() to catch this early.
const GameContext = createContext(null);

/**
 * useGame() — custom hook to read the game context.
 *
 * WHAT: A shortcut for useContext(GameContext) with an error check.
 * WHY: Calling useContext(GameContext) outside a Provider returns null,
 *   which causes confusing "cannot read property of null" errors later.
 *   This hook catches the mistake immediately with a clear message.
 * HOW: Every component that needs team data or level progress calls:
 *   const { team, levelProgress, completeLevel } = useGame();
 */
export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame() must be used inside <GameProvider>');
  }
  return ctx;
}

/**
 * GameProvider — wraps the app and provides the game context to all children.
 *
 * WHAT: A React component that holds the global state and makes it
 *   available to every nested component via useGame().
 *
 * HOW: Wrap your entire app (or Router) in <GameProvider>:
 *   <GameProvider>
 *     <RouterProvider router={router} />
 *   </GameProvider>
 *
 * STATE SHAPE:
 *   team: { members: ['Alice', 'Bob'], course: '8A' } | null
 *   levelProgress: {
 *     1: { unlocked: true,  completed: false },
 *     2: { unlocked: false, completed: false },
 *   }
 */
export function GameProvider({ children }) {

  // ── Team data ─────────────────────────────────────────────────────────────
  //
  // null before registration, { members: string[], course: string } after.
  // Set once by the registration form, read by the level menu header.
  const [team, setTeam] = useState(null);

  // ── Level progress ────────────────────────────────────────────────────────
  //
  // WHAT: Tracks which levels are unlocked and completed.
  // WHY separate flags?
  //   unlocked: can the student click on this level in the menu?
  //   completed: has the student beaten this level?
  //   A level can be unlocked but not completed (currently playing).
  //   A level can be completed and locked (Level 1 after winning).
  //
  // HOW to add Level 3 later: add `3: { unlocked: false, completed: false }`
  const [levelProgress, setLevelProgress] = useState({
    1: { unlocked: true,  completed: false },
    2: { unlocked: false, completed: false },
  });

  /**
   * registerTeam(members, course)
   *
   * WHAT: Saves the team information from the registration form.
   * WHEN: Called once when the student clicks "Start Game".
   * FUTURE: This is where we'll add a POST /api/teams call.
   *
   * @param {string[]} members  Array of team member names.
   * @param {string} course     Course code: '8A', '8B', or '8C'.
   */
  const registerTeam = useCallback((members, course) => {
    setTeam({ members, course });
  }, []);

  /**
   * completeLevel(levelNum)
   *
   * WHAT: Marks a level as completed and unlocks the next one.
   *
   * RULES:
   *   - The completed level is marked completed AND locked (can't replay).
   *   - The next level (levelNum + 1) is unlocked — IF it exists.
   *   - If all levels are completed, the game is "finished".
   *
   * WHY useCallback?
   *   This function is passed as a prop and used inside useEffect.
   *   useCallback prevents unnecessary re-renders by keeping the same
   *   function reference across renders.
   *
   * FUTURE: This is where we'll add a PATCH /api/progress call.
   *
   * @param {number} levelNum  The level that was just completed (1 or 2).
   */
  const completeLevel = useCallback((levelNum) => {
    setLevelProgress(prev => {
      const next = { ...prev };

      // Mark the completed level as done and locked
      if (next[levelNum]) {
        next[levelNum] = { unlocked: false, completed: true };
      }

      // Unlock the next level (if it exists)
      const nextLevel = levelNum + 1;
      if (next[nextLevel]) {
        next[nextLevel] = { ...next[nextLevel], unlocked: true };
      }

      return next;
    });
  }, []);

  /**
   * isGameFinished
   *
   * WHAT: True when all levels are completed.
   * WHY: The level menu shows a final congratulations message.
   */
  const isGameFinished = Object.values(levelProgress).every(l => l.completed);

  // ── Provide the context ───────────────────────────────────────────────────
  return (
    <GameContext.Provider value={{
      team,
      registerTeam,
      levelProgress,
      completeLevel,
      isGameFinished,
    }}>
      {children}
    </GameContext.Provider>
  );
}