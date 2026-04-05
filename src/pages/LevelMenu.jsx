/**
 * LevelMenu.jsx — Level selector with lock/unlock state.
 *
 * WHAT: Shows a card for each level. Locked levels are grayed out.
 *   Completed levels show a checkmark. Unlocked levels are clickable.
 *
 * WHY a separate menu instead of level buttons on the game screen?
 *   The menu gives kids a sense of progression — they SEE Level 2
 *   unlock after beating Level 1. It also prevents accidentally
 *   playing the wrong level.
 *
 * HOW: Reads levelProgress from GameContext to determine each level's state.
 *   Clicking an unlocked level navigates to /game/:levelNum.
 */
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

// ── Level metadata ──────────────────────────────────────────────────────────
//
// WHAT: Display info for each level — name, description, and a color theme.
// WHY: Centralizes level presentation. Adding Level 3 means adding one entry.
const LEVELS = [
  {
    num: 1,
    name: 'Right Angles',
    description: 'Only 90° turns. Learn the controls.',
    color: '#44aa66',
  },
  {
    num: 2,
    name: 'Tricky Angles',
    description: 'Diagonal walls. Use the protractor!',
    color: '#cc8833',
  },
];

export default function LevelMenu() {
  const navigate = useNavigate();
  const { team, levelProgress, isGameFinished } = useGame();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      fontFamily: 'monospace',
    }}>

      <h1 style={{ fontSize: '24px', color: '#6699cc', marginBottom: '6px' }}>
        AngleMaze
      </h1>

      {/* ── Team info ──────────────────────────────────────────────────────── */}
      {team && (
        <p style={{ fontSize: '13px', color: '#778', marginBottom: '28px' }}>
          Team: {team.members.join(', ')} — Course {team.course}
        </p>
      )}

      {/* ── Game finished message ──────────────────────────────────────────── */}
      {isGameFinished && (
        <div style={{
          padding: '16px 32px',
          marginBottom: '24px',
          border: '2px solid #ffd700',
          borderRadius: '12px',
          background: '#2a2200',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '20px', color: '#ffd700', margin: '0 0 6px 0' }}>
            ▀▄▀▄▀▄ Congratulations! ▀▄▀▄▀▄
          </p>
          <p style={{ fontSize: '13px', color: '#aa9944', margin: 0 }}>
            You mastered all levels!
          </p>
        </div>
      )}

      {/* ── Level cards ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '360px' }}>
        {LEVELS.map((level) => {
          const progress = levelProgress[level.num] || { unlocked: false, completed: false };
          const isLocked = !progress.unlocked && !progress.completed;
          const isCompleted = progress.completed;
          const isPlayable = progress.unlocked && !progress.completed;

          return (
            <button
              key={level.num}
              onClick={() => isPlayable && navigate(`/game/${level.num}`)}
              disabled={!isPlayable}
              style={{
                padding: '20px 24px',
                border: `2px solid ${isPlayable ? level.color : '#333'}`,
                borderRadius: '12px',
                background: isPlayable ? '#111' : '#0a0a0a',
                cursor: isPlayable ? 'pointer' : 'not-allowed',
                opacity: isLocked ? 0.4 : 1,
                textAlign: 'left',
                fontFamily: 'monospace',
                transition: 'transform 0.1s',
              }}
            >
              {/* ── Level header ────────────────────────────────────────────── */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: isPlayable ? level.color : '#555',
                }}>
                  Level {level.num} — {level.name}
                </span>

                <span style={{ fontSize: '18px' }}>
                  {isCompleted ? '✅' : isLocked ? '🔒' : '🟩'}
                </span>
              </div>

              {/* ── Description ─────────────────────────────────────────────── */}
              <p style={{
                fontSize: '12px',
                color: '#667',
                margin: '8px 0 0 0',
              }}>
                {isCompleted ? 'Completed!' : level.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}