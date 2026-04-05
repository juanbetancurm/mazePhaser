/**
 * Registration.jsx — Team registration form.
 *
 * WHAT: Collects team member names and course selection before the game starts.
 * WHY: The school needs to track which teams played and their results.
 * HOW: Stores data in GameContext via registerTeam(), then navigates to the
 *   level menu using React Router's useNavigate().
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

export default function Registration() {
  const navigate = useNavigate();
  const { registerTeam } = useGame();

  // ── Form state ────────────────────────────────────────────────────────────
  //
  // WHAT: members is an array of strings — one per team member input field.
  //   We start with 2 empty fields. The student can add more with the + button.
  //
  // WHY an array instead of separate name1/name2 variables?
  //   Arrays make it easy to add/remove fields dynamically without adding
  //   new useState calls. The .map() in the JSX creates one input per entry.
  const [members, setMembers] = useState(['', '']);
  const [course, setCourse] = useState('');
  const [error, setError] = useState('');

  /**
   * handleMemberChange(index, value)
   *
   * WHAT: Updates one member name in the array.
   * HOW: Creates a copy of the array, changes the element at `index`,
   *   and sets the new array as state. We copy instead of mutating because
   *   React only re-renders when it detects a NEW array reference.
   */
  const handleMemberChange = (index, value) => {
    const updated = [...members];
    updated[index] = value;
    setMembers(updated);
  };

  /**
   * addMember()
   *
   * WHAT: Adds a new empty input field to the team.
   * WHY: Some teams have 2 members, some have 5. Dynamic fields accommodate both.
   * HOW: Appends an empty string to the members array. Max 6 to prevent abuse.
   */
  const addMember = () => {
    if (members.length < 6) {
      setMembers([...members, '']);
    }
  };

  /**
   * removeMember(index)
   *
   * WHAT: Removes a team member input field.
   * WHY: Kid added too many fields by accident.
   * HOW: Filters out the element at `index`. Minimum 1 member required.
   */
  const removeMember = (index) => {
    if (members.length > 1) {
      setMembers(members.filter((_, i) => i !== index));
    }
  };

  /**
   * handleSubmit()
   *
   * WHAT: Validates the form, saves team data, and navigates to the level menu.
   *
   * VALIDATION RULES:
   *   1. At least one non-empty member name.
   *   2. Course must be selected (not the empty default).
   *
   * WHY validate here instead of disabling the button?
   *   Showing an error message is more informative than a grayed-out button.
   *   The kid knows WHAT is missing — "Please enter at least one name."
   */
  const handleSubmit = () => {
    // Filter out empty names and trim whitespace
    const validMembers = members
      .map(m => m.trim())
      .filter(m => m.length > 0);

    if (validMembers.length === 0) {
      setError('Please enter at least one team member name.');
      return;
    }
    if (!course) {
      setError('Please select your course.');
      return;
    }

    // Save to context and navigate
    registerTeam(validMembers, course);
    navigate('/menu');
  };

  // ── Render ──────────────────────────────────────────────────────────────────
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

      <h1 style={{
        fontSize: '28px',
        color: '#6699cc',
        marginBottom: '8px',
      }}>
        AngleMaze
      </h1>

      <p style={{
        fontSize: '14px',
        color: '#889',
        marginBottom: '32px',
      }}>
        Register your team to start playing
      </p>

      {/* ── Team members ──────────────────────────────────────────────────── */}
      <div style={{
        width: '100%',
        maxWidth: '360px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginBottom: '20px',
      }}>
        <label style={{ color: '#aab', fontSize: '13px' }}>Team Members:</label>

        {members.map((name, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={name}
              onChange={e => handleMemberChange(i, e.target.value)}
              placeholder={`Member ${i + 1}`}
              style={{
                flex: 1,
                padding: '10px 12px',
                fontFamily: 'monospace',
                fontSize: '14px',
                border: '1px solid #334',
                borderRadius: '6px',
                background: '#1a1a2e',
                color: '#dde',
                outline: 'none',
              }}
            />
            {members.length > 1 && (
              <button
                onClick={() => removeMember(i)}
                style={{
                  padding: '8px 12px',
                  background: '#2a1a1a',
                  border: '1px solid #443',
                  borderRadius: '6px',
                  color: '#a66',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        {members.length < 6 && (
          <button
            onClick={addMember}
            style={{
              padding: '8px',
              background: '#111',
              border: '1px dashed #445',
              borderRadius: '6px',
              color: '#778',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '13px',
            }}
          >
            + Add member
          </button>
        )}
      </div>

      {/* ── Course selection ───────────────────────────────────────────────── */}
      <div style={{
        width: '100%',
        maxWidth: '360px',
        marginBottom: '24px',
      }}>
        <label style={{ color: '#aab', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
          Course:
        </label>
        <select
          value={course}
          onChange={e => setCourse(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontFamily: 'monospace',
            fontSize: '14px',
            border: '1px solid #334',
            borderRadius: '6px',
            background: '#1a1a2e',
            color: course ? '#dde' : '#667',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">Select your course...</option>
          <option value="8A">8A</option>
          <option value="8B">8B</option>
          <option value="8C">8C</option>
        </select>
      </div>

      {/* ── Error message ──────────────────────────────────────────────────── */}
      {error && (
        <p style={{
          color: '#ff6655',
          fontSize: '13px',
          marginBottom: '16px',
        }}>
          {error}
        </p>
      )}

      {/* ── Start button ──────────────────────────────────────────────────── */}
      <button
        onClick={handleSubmit}
        style={{
          padding: '14px 48px',
          fontSize: '16px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          background: '#1a3a1a',
          border: '2px solid #44aa66',
          borderRadius: '10px',
          color: '#55dd77',
          cursor: 'pointer',
          letterSpacing: '0.05em',
        }}
      >
        Start Game
      </button>
    </div>
  );
}