import React from 'react';
import { AppScreen } from '../types';

interface SidebarProps {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onNavigate,
  collapsed,
  onToggleCollapse,
}) => {
  const navItems = [
    { id: 'proyectos' as AppScreen, label: 'Mis proyectos', icon: 'dataset' },
    { id: 'compartidos' as AppScreen, label: 'Proyectos compartidos', icon: 'share' },
    {
      id: 'editor' as AppScreen,
      label: 'Editor UML Activo',
      icon: 'account_tree',
      hasActiveDot: true,
    },
    { id: 'backend' as AppScreen, label: 'Generador Backend (CU10/CU11)', icon: 'bolt' },
    { id: 'perfil' as AppScreen, label: 'Perfil', icon: 'manage_accounts' },
  ];

  return (
    <aside
      className={`fixed left-0 top-14 bottom-0 z-40 bg-surface-container-lowest border-r border-outline-variant/30 flex flex-col justify-between py-3 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex flex-col gap-3 px-2">
        <div className="px-2 py-1 flex items-center justify-between text-on-surface-variant">
          {!collapsed && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-outline">
              Navegación IDE
            </span>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors ml-auto"
            title={collapsed ? 'Expandir panel lateral' : 'Colapsar panel lateral'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {collapsed ? 'dock_to_right' : 'dock_to_left'}
            </span>
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded text-xs transition-all text-left ${
                  isActive
                    ? 'bg-surface-container-high text-primary border-l-2 border-primary font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
                title={item.label}
              >
                <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-primary' : ''}`}>
                  {item.icon}
                </span>
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!collapsed && item.hasActiveDot && (
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Stack Badge */}
      <div className="px-2 flex flex-col gap-1 border-t border-outline-variant/20 pt-3">
        <div className="px-2 py-1 bg-surface-container-low/60 rounded border border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-1 text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-tertiary">bolt</span>
            {!collapsed && <span className="font-mono text-[11px]">Spring Boot 3.2 • Java 17</span>}
          </div>
          {!collapsed && <span className="font-mono text-[10px] text-outline">Snap 8px</span>}
        </div>
      </div>
    </aside>
  );
};
