/**
 * App.jsx — Route definitions for AngleMaze.
 *
 * WHAT: Defines which page component renders at each URL.
 * WHY: Separates registration, level menu, and game into distinct screens
 *   with their own URLs, enabling back/forward navigation.
 * HOW: React Router's <Routes> matches the current URL to a <Route>.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import Registration from './pages/Registration';
import LevelMenu from './pages/LevelMenu';
import GamePage from './pages/GamePage';

export default function App() {
  return (
    <Routes>
      {/* Default: redirect to registration */}
      <Route path="/" element={<Registration />} />

      {/* Level menu: shown after registration */}
      <Route path="/menu" element={<LevelMenu />} />

      {/* Game: the Phaser maze for a specific level */}
      <Route path="/game/:levelNum" element={<GamePage />} />

      {/* Fallback: unknown URLs redirect to registration */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}