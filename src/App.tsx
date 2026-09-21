import React, { useState, useEffect } from 'react';
import { AppScreen, UserProfile } from './types';
import { ASSETS, MOCK_USERS } from './data/mockData';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { EditorScreen } from './components/EditorScreen';
import { ProjectsScreen } from './components/ProjectsScreen';
import { BackendGeneratorScreen } from './components/BackendGeneratorScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { LoginScreen } from './components/LoginScreen';
import { RegisterScreen } from './components/RegisterScreen';
import { OfflineIndicator } from './components/OfflineIndicator';
import { authService, AuthUser, AuthError } from './services/authService';

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => authService.getStoredUser());
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(() => {
    // If user has existing token, start on proyectos or editor, otherwise login
    return authService.isAuthenticated() ? 'proyectos' : 'login';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(true);
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [activeProjectId, setActiveProjectId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('classflow_active_project_id');
      return saved ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  });

  // Listener para estado de conectividad nativo del navegador
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleOpenProject = (projId: number) => {
    setActiveProjectId(projId);
    try {
      localStorage.setItem('classflow_active_project_id', projId.toString());
    } catch {
      // ignore
    }
  };

  // Verify stored session against real backend on mount
  useEffect(() => {
    const verifySession = async () => {
      if (authService.isAuthenticated()) {
        try {
          const user = await authService.getMe();
          setAuthUser(user);
        } catch (err) {
          if (err instanceof AuthError) {
            // Error de autenticación real (401/403): limpiar sesión y redirigir
            authService.clearSession();
            setAuthUser(null);
            setCurrentScreen('login');
          } else {
            // Error de conexión/red: tolerar offline y mantener sesión local
            const stored = authService.getStoredUser();
            if (stored) {
              setAuthUser(stored);
            } else {
              authService.clearSession();
              setAuthUser(null);
              setCurrentScreen('login');
            }
          }
        }
      } else {
        setAuthUser(null);
        if (currentScreen !== 'register') {
          setCurrentScreen('login');
        }
      }
      setIsVerifyingSession(false);
    };

    verifySession();
  }, []);

  // Protected route handler: blocks unauthenticated access to private screens
  const handleNavigate = (screen: AppScreen) => {
    if (!authUser && screen !== 'login' && screen !== 'register') {
      // Redirect to login if attempting to access a private screen without session
      setCurrentScreen('login');
      return;
    }
    setCurrentScreen(screen);
  };

  // Login handler
  const handleLoginSuccess = (user: AuthUser) => {
    setAuthUser(user);
    // Redirect to projects screen (CU01 flow: Login -> Projects)
    setCurrentScreen('proyectos');
  };

  // Logout handler
  const handleLogout = async () => {
    await authService.logout();
    setAuthUser(null);
    setCurrentScreen('login');
  };

  // Convert authenticated user to UserProfile for IDE components
  const currentUser: UserProfile = authUser
    ? {
        name: authUser.nombre,
        email: authUser.email,
        role: authUser.email.toLowerCase().includes('carlos') ? 'Propietario' : 'Invitado',
        avatar: authUser.email.toLowerCase().includes('carlos')
          ? ASSETS.carlosMendoza
          : ASSETS.anaLopez,
        permissionsBadge: authUser.email.toLowerCase().includes('carlos')
          ? 'Full Control • Propietario'
          : 'Desarrollador Invitado',
      }
    : MOCK_USERS['carlos'];

  const handleSwitchUser = async (userKey: 'carlos' | 'ana') => {
    const creds =
      userKey === 'carlos'
        ? { email: 'carlos@classflow.com', password: 'ClassFlow2026!' }
        : { email: 'ana@classflow.com', password: 'ClassFlow2026!' };
    try {
      const res = await authService.login(creds.email, creds.password);
      setAuthUser(res.user);
      window.location.reload();
    } catch (err) {
      console.error('Error al cambiar usuario:', err);
    }
  };

  // Render Login Screen
  if (currentScreen === 'login') {
    return (
      <div className="relative min-h-screen bg-background text-on-surface">
        {!isOnline && <OfflineIndicator />}
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onNavigateToRegister={() => setCurrentScreen('register')}
        />

        <QuickScreenSwitcher
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
          show={showQuickSwitcher}
          onToggle={() => setShowQuickSwitcher(!showQuickSwitcher)}
          isAuthenticated={!!authUser}
        />
      </div>
    );
  }

  // Render Register Screen
  if (currentScreen === 'register') {
    return (
      <div className="relative min-h-screen bg-background text-on-surface">
        {!isOnline && <OfflineIndicator />}
        <RegisterScreen
          onRegisterSuccess={() => {
            setCurrentScreen('login');
          }}
          onNavigateToLogin={() => setCurrentScreen('login')}
        />

        <QuickScreenSwitcher
          currentScreen={currentScreen}
          onNavigate={handleNavigate}
          show={showQuickSwitcher}
          onToggle={() => setShowQuickSwitcher(!showQuickSwitcher)}
          isAuthenticated={!!authUser}
        />
      </div>
    );
  }

  // Fallback if not authenticated and tried to access private screen
  if (!authUser && !isVerifyingSession) {
    return (
      <div className="relative min-h-screen bg-background text-on-surface">
        {!isOnline && <OfflineIndicator />}
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          onNavigateToRegister={() => setCurrentScreen('register')}
        />
      </div>
    );
  }

  // Full IDE Layout for authenticated session
  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col relative overflow-x-hidden font-sans">
      {!isOnline && <OfflineIndicator />}
      {/* 1. Global Shell Header */}
      <Header
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
      />

      {/* 2. Left IDE Sidebar */}
      <Sidebar
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* 3. Main Screen Viewport Container */}
      <main
        className={`pt-14 transition-all duration-300 flex-1 flex flex-col ${
          sidebarCollapsed ? 'pl-16' : 'pl-64'
        }`}
      >
        {currentScreen === 'editor' && (
          <EditorScreen
            onNavigate={handleNavigate}
            currentUser={currentUser}
            projectId={activeProjectId}
          />
        )}

        {currentScreen === 'proyectos' && (
          <ProjectsScreen
            onNavigate={handleNavigate}
            currentUser={currentUser}
            initialFilter="all"
            onOpenProject={handleOpenProject}
          />
        )}

        {currentScreen === 'compartidos' && (
          <ProjectsScreen
            onNavigate={handleNavigate}
            currentUser={currentUser}
            initialFilter="guest"
            onOpenProject={handleOpenProject}
          />
        )}

        {currentScreen === 'backend' && (
          <BackendGeneratorScreen
            onNavigate={handleNavigate}
            currentUser={currentUser}
            projectId={activeProjectId}
          />
        )}

        {currentScreen === 'perfil' && (
          <ProfileScreen
            onNavigate={handleNavigate}
            currentUser={currentUser}
            onSwitchUser={handleSwitchUser}
          />
        )}
      </main>

      {/* 4. Floating Quick Screen Switcher bar */}
      <QuickScreenSwitcher
        currentScreen={currentScreen}
        onNavigate={handleNavigate}
        show={showQuickSwitcher}
        onToggle={() => setShowQuickSwitcher(!showQuickSwitcher)}
        isAuthenticated={!!authUser}
      />
    </div>
  );
}

// Quick Switcher Dock
interface QuickSwitcherProps {
  currentScreen: AppScreen;
  onNavigate: (s: AppScreen) => void;
  show: boolean;
  onToggle: () => void;
  isAuthenticated: boolean;
}

function QuickScreenSwitcher({
  currentScreen,
  onNavigate,
  show,
  onToggle,
  isAuthenticated,
}: QuickSwitcherProps) {
  const screens: { id: AppScreen; label: string; icon: string; tag: string; isPublic?: boolean }[] = [
    { id: 'editor', label: 'Editor UML', icon: 'account_tree', tag: 'Lienzo Activo' },
    { id: 'backend', label: 'Backend CU10', icon: 'bolt', tag: 'Spring' },
    { id: 'proyectos', label: 'Mis Proyectos', icon: 'dataset', tag: 'CU02' },
    { id: 'compartidos', label: 'Compartidos', icon: 'share', tag: 'Invitado' },
    { id: 'perfil', label: 'Perfil', icon: 'manage_accounts', tag: 'Ajustes' },
    { id: 'login', label: 'Iniciar Sesión', icon: 'login', tag: 'CU01', isPublic: true },
    { id: 'register', label: 'Registro', icon: 'person_add', tag: 'CU01', isPublic: true },
  ];

  if (!show) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-3 right-3 z-50 p-2 rounded-full bg-surface-container-high/90 backdrop-blur-md text-primary hover:text-on-surface shadow-xl border border-outline-variant/30 flex items-center justify-center transition-all cursor-pointer"
        title="Mostrar conmutador de pantallas"
      >
        <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 bg-surface-container-lowest/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5 border border-outline-variant/30 select-none">
      <span className="font-mono text-[10px] text-outline uppercase tracking-wider pl-1.5 pr-1 hidden sm:inline">
        Vistas:
      </span>
      {screens.map((item) => {
        const isActive = currentScreen === item.id;
        const isLocked = !isAuthenticated && !item.isPublic;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
              isActive
                ? 'bg-primary text-on-primary font-semibold shadow-md'
                : isLocked
                ? 'text-outline/50 hover:bg-surface-container hover:text-outline'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
            title={`${item.label} (${item.tag})${isLocked ? ' - Requiere Iniciar Sesión' : ''}`}
          >
            <span className="material-symbols-outlined text-[15px]">
              {isLocked ? 'lock' : item.icon}
            </span>
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
      <button
        onClick={onToggle}
        className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container transition-colors ml-1 cursor-pointer"
        title="Ocultar conmutador rápido"
      >
        <span className="material-symbols-outlined text-[15px]">close</span>
      </button>
    </div>
  );
}



