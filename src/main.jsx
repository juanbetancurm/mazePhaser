/**
 * main.jsx — Application entry point.
 *
 * WHAT: Sets up the React root, wraps the app in the Router and GameProvider.
 *
 * WHY this wrapping order?
 *   <BrowserRouter> must be the outermost wrapper because React Router's
 *   hooks (useNavigate, useParams) need it.
 *   <GameProvider> is inside the Router so that context consumers
 *   (like Registration.jsx) can also use navigation hooks.
 *
 * ORDER:
 *   <StrictMode>          — React dev checks (double-mount, etc.)
 *     <BrowserRouter>     — URL-based routing
 *       <GameProvider>    — Global game state
 *         <App />         — Route definitions
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <GameProvider>
        <App />
      </GameProvider>
    </BrowserRouter>
  </React.StrictMode>
);