import React, { useState } from 'react';
import { AppScreen, UserProfile } from './types';
import { MOCK_USERS } from './data/mockData';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { EditorScreen } from './components/EditorScreen';
import { ProjectsScreen } from './components/ProjectsScreen';
import { BackendGeneratorScreen } from './components/BackendGeneratorScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { LoginScreen } from './components/LoginScreen';
import { RegisterScreen } from './components/RegisterScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('editor');
  const [currentUserKey, setCurrentUserKey] = useState<'carlos' | 'ana'>('carlos');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(true);

  const currentUser: UserProfile = MOCK_USERS[currentUserKey];

  const handleSwitchUser = (userKey: 'carlos' | 'ana') => {
    setCurrentUserKey(userKey);
  };

  // Auth screen routes without IDE shell
  if (currentScreen === 'login') {
    return (
      <div className="relative min-h-screen bg-background text-on-surface">
        <LoginScreen
          onLoginSuccess={(userKey) => {
            setCurrentUserKey(userKey);
            setCurrentScreen('editor');
          }}
          onNavigateToRegister={() => setCurrentScreen('register')}
        />

        {/* Floating Screen Switcher bar */}
        <QuickScreenSwitcher
          currentScreen={currentScreen}
          onNavigate={setCurrentScreen}
          show={showQuickSwitcher}
          onToggle={() => setShowQuickSwitcher(!showQuickSwitcher)}
        />
      </div>
    );
  }

  if (currentScreen === 'register') {
    return (
      <div className="relative min-h-screen bg-background text-on-surface">
        <RegisterScreen
          onRegisterSuccess={(userKey) => {
            setCurrentUserKey(userKey);
            setCurrentScreen('editor');
          }}
          onNavigateToLogin={() => setCurrentScreen('login')}
        />

        {/* Floating Screen Switcher bar */}
        <QuickScreenSwitcher
          currentScreen={currentScreen}
          onNavigate={setCurrentScreen}
          show={showQuickSwitcher}
          onToggle={() => setShowQuickSwitcher(!showQuickSwitcher)}
        />
      </div>
    );
  }

  // Full IDE Layout for main workflow
  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col relative overflow-x-hidden font-sans">
      {/* 1. Global Shell Header */}
      <Header
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
      />

      {/* 2. Left IDE Sidebar */}
      <Sidebar
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
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
          <EditorScreen onNavigate={setCurrentScreen} currentUser={currentUser} />
        )}

        {currentScreen === 'proyectos' && (
          <ProjectsScreen
            onNavigate={setCurrentScreen}
            currentUser={currentUser}
            initialFilter="all"
          />
        )}

        {currentScreen === 'compartidos' && (
          <ProjectsScreen
            onNavigate={setCurrentScreen}
            currentUser={currentUser}
            initialFilter="guest"
          />
        )}

        {currentScreen === 'backend' && (
          <BackendGeneratorScreen onNavigate={setCurrentScreen} currentUser={currentUser} />
        )}

        {currentScreen === 'perfil' && (
          <ProfileScreen
            onNavigate={setCurrentScreen}
            currentUser={currentUser}
            onSwitchUser={handleSwitchUser}
          />
        )}
      </main>

      {/* 4. Floating Quick Screen Switcher bar */}
      <QuickScreenSwitcher
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        show={showQuickSwitcher}
        onToggle={() => setShowQuickSwitcher(!showQuickSwitcher)}
      />
    </div>
  );
}

// Quick Switcher Dock to let user easily explore and switch between all 6 screens
interface QuickSwitcherProps {
  currentScreen: AppScreen;
  onNavigate: (s: AppScreen) => void;
  show: boolean;
  onToggle: () => void;
}

function QuickScreenSwitcher({ currentScreen, onNavigate, show, onToggle }: QuickSwitcherProps) {
  const screens: { id: AppScreen; label: string; icon: string; tag: string }[] = [
    { id: 'editor', label: 'Editor UML', icon: 'account_tree', tag: 'Lienzo Activo' },
    { id: 'backend', label: 'Backend CU10', icon: 'bolt', tag: 'Spring / Nest' },
    { id: 'proyectos', label: 'Mis Proyectos', icon: 'dataset', tag: 'CU02' },
    { id: 'compartidos', label: 'Compartidos', icon: 'share', tag: 'Invitado' },
    { id: 'perfil', label: 'Perfil', icon: 'manage_accounts', tag: 'Ajustes' },
    { id: 'login', label: 'Iniciar Sesión', icon: 'login', tag: 'CU01' },
    { id: 'register', label: 'Registro', icon: 'person_add', tag: 'CU01' },
  ];

  if (!show) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-3 right-3 z-50 p-2 rounded-full bg-surface-container-high/90 backdrop-blur-md text-primary hover:text-on-surface shadow-xl border border-outline-variant/30 flex items-center justify-center transition-all"
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
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              isActive
                ? 'bg-primary text-on-primary font-semibold shadow-md'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
            title={`${item.label} (${item.tag})`}
          >
            <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
      <button
        onClick={onToggle}
        className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container transition-colors ml-1"
        title="Ocultar conmutador rápido"
      >
        <span className="material-symbols-outlined text-[15px]">close</span>
      </button>
    </div>
  );
}
