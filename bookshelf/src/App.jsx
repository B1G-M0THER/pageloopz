import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import BookDetails from './pages/BookDetails';
import Profile from './pages/Profile';
import { Login, Register } from './pages/Auth';
import AdminPanel from './pages/AdminPanel';
import UserProfile from './pages/UserProfile';
import AddBook from './pages/AddBook';
import Particles from './components/Particles';
import { useTheme } from './hooks/useTheme';
import './styles/global.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/admin.css';

const PARTICLES_DARK = {
  particleCount: 1000,
  particleSpread: 10,
  speed: 0.08,
  particleColors: ['#ffffff', '#c9a84c', '#7baaf7'],
  alphaParticles: true,
  particleBaseSize: 90,
  sizeRandomness: 1,
  disableRotation: false,
};

const PARTICLES_LIGHT = {
  particleCount: 1000,
  particleSpread: 10,
  speed: 0.08,
  particleColors: ['#a0720e', '#c9a84c', '#d4930f'],
  alphaParticles: true,
  particleBaseSize: 90,
  sizeRandomness: 1,
  disableRotation: false,
};

const AppInner = () => {
  const { theme } = useTheme();
  const particlesProps = theme === 'light' ? PARTICLES_LIGHT : PARTICLES_DARK;

  return (
      <div className="app-layout">
        <div className="app-galaxy-bg" aria-hidden="true">
          <Particles key={theme} {...particlesProps} />
        </div>
        <div className="app-content">
          <Navbar />
          <Routes>
            <Route path="/"               element={<Home />} />
            <Route path="/book/:bookId"   element={<BookDetails />} />
            <Route path="/profile"        element={<Profile />} />
            <Route path="/add-book"       element={<AddBook />} />
            <Route path="/admin"          element={<AdminPanel />} />
            <Route path="/user/:username" element={<UserProfile />} />
            <Route path="/login"          element={<Login />} />
            <Route path="/register"       element={<Register />} />
          </Routes>
        </div>
      </div>
  );
};

const App = () => (
    <BrowserRouter>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </BrowserRouter>
);

export default App;