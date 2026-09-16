import React, { useState } from 'react';
import { AppScreen, UserProfile } from '../types';
import { ASSETS } from '../data/mockData';

interface HeaderProps {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  currentUser: UserProfile;
  onSwitchUser: (userKey: 'carlos' | 'ana') => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  currentUser,
  onSwitchUser,
  onLogout,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-surface-container-lowest/95 backdrop-blur-md px-4 flex items-center justify-between border-b border-outline-variant/30 shadow-[0_1px_8px_rgba(0,0,0,0.3)] select-none">
      {/* Brand & Workspace breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate('editor')}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity focus:outline-none text-left"
          title="ClassFlow AI Home"
        >
          <img
            alt="ClassFlow AI Logo"
            className="h-8 w-8 object-contain filter drop-shadow-[0_0_8px_rgba(192,193,255,0.4)]"
            src={ASSETS.logo}
          />
          <span className="text-lg font-semibold text-on-surface tracking-tight">
            ClassFlow <span className="text-primary">AI</span>
          </span>
        </button>

        <div className="h-4 w-[1px] bg-outline-variant/40 hidden sm:block"></div>

        <div className="hidden sm:flex items-center gap-1 font-mono text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px]">folder_open</span>
          <span>workspaces</span>
          <span className="text-outline">/</span>
          <span className="text-primary font-medium">microservices-core-v2</span>
          <span className="ml-1 px-1.5 py-0.5 rounded bg-surface-container-high text-primary-fixed-dim text-[10px] font-sans font-semibold uppercase tracking-wider">
            Git:main
          </span>
        </div>
      </div>

      {/* Right controls: Active collaborators & User profile */}
      <div className="flex items-center gap-3">
        {/* Collaborators online badge */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-surface-container-low border border-outline-variant/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
          </span>
          <span className="font-mono text-xs text-on-surface-variant hidden md:inline">
            En línea - 2 colaboradores
          </span>
          <span className="font-mono text-xs text-on-surface-variant md:hidden">
            2 online
          </span>
        </div>

        <div className="h-4 w-[1px] bg-outline-variant/40"></div>

        {/* User profile dropdown trigger */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-container-high transition-colors focus:outline-none"
          >
            <img
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover ring-1 ring-primary/40 shadow-sm"
              src={currentUser.avatar}
            />
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-medium text-on-surface leading-tight">
                {currentUser.name}
              </span>
              <span className="text-[11px] text-primary leading-tight">
                {currentUser.role}
              </span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
              expand_more
            </span>
          </button>

          {/* Profile Menu Popup */}
          {showProfileMenu && (
            <div className="absolute right-0 top-12 w-64 rounded-xl bg-surface-container-low border border-outline-variant/40 shadow-2xl p-2 z-50 flex flex-col gap-1">
              <div className="px-3 py-2 border-b border-outline-variant/20 flex flex-col">
                <span className="text-xs font-semibold text-on-surface">{currentUser.name}</span>
                <span className="text-[11px] text-outline font-mono truncate">{currentUser.email}</span>
                <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-tertiary font-mono w-fit">
                  {currentUser.permissionsBadge}
                </span>
              </div>

              <div className="py-1">
                <span className="px-3 py-1 text-[10px] font-semibold text-outline uppercase tracking-wider block">
                  Cambiar Rol de Sesión
                </span>
                <button
                  onClick={() => {
                    onSwitchUser('carlos');
                    setShowProfileMenu(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors ${
                    currentUser.name === 'Carlos Mendoza'
                      ? 'bg-surface-container-high text-primary font-medium'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <img src={ASSETS.carlosMendoza} className="w-5 h-5 rounded-full object-cover" />
                  <span className="flex-1 text-left">Carlos Mendoza (Propietario)</span>
                </button>
                <button
                  onClick={() => {
                    onSwitchUser('ana');
                    setShowProfileMenu(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors ${
                    currentUser.name === 'Ana López'
                      ? 'bg-surface-container-high text-primary font-medium'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  <img src={ASSETS.anaLopez} className="w-5 h-5 rounded-full object-cover" />
                  <span className="flex-1 text-left">Ana López (Invitado)</span>
                </button>
              </div>

              <div className="border-t border-outline-variant/20 pt-1">
                <button
                  onClick={() => {
                    onNavigate('perfil');
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
                  <span>Configuración de Perfil</span>
                </button>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (onLogout) {
                      onLogout();
                    } else {
                      onNavigate('login');
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded text-error hover:bg-error-container/30 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
