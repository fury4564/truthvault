import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import HomePage from './pages/HomePage';
import ChatRoom from './pages/ChatRoom';
import NothingPage from './pages/NothingPage';
import InviteRedirect from './pages/InviteRedirect';

function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-logo">
        <span className="logo-icon">🔐</span>
        TruthVault
      </NavLink>
      <div className="navbar-links">
        <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>Home</NavLink>
        <NavLink to="/nothing" className={({ isActive }) => isActive ? 'active' : ''}>Nothing</NavLink>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:roomCode" element={<ChatRoom />} />
          <Route path="/nothing" element={<NothingPage />} />
          <Route path="/join/:token" element={<InviteRedirect />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
