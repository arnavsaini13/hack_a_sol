import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Sprout, Building2, BarChart3, Globe, Shield } from 'lucide-react';
import { useTranslation } from '../i18n';

export const RoleSwitcher: React.FC = () => {
  const { language, setLanguage, t } = useTranslation();
  const location = useLocation();

  const navItems = [
    { path: '/farmer', labelKey: 'app.role_farmer', icon: Sprout },
    { path: '/bank', labelKey: 'app.role_bank', icon: Building2 },
    { path: '/policy', labelKey: 'app.role_policy', icon: BarChart3 },
  ];

  return (
    <header className="bg-agri-dark text-white shadow-md">
      {/* Platform Branding Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600/30 flex items-center justify-center border border-emerald-400/40">
            <Sprout className="w-6 h-6 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight leading-tight">
              {t('app.title')}
            </h1>
            <p className="text-xs text-emerald-200 hidden sm:block">
              {t('app.subtitle')}
            </p>
          </div>
        </div>

        {/* 3-Language Segmented Switcher (EN | हिंदी | छत्तीसगढ़ी) */}
        <div className="flex items-center bg-emerald-900/90 rounded-xl p-1 border border-emerald-700/60 shadow-inner">
          <Globe className="w-4 h-4 text-emerald-300 ml-1.5 mr-1 hidden sm:inline" />
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
              language === 'en'
                ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                : 'text-emerald-100 hover:text-white hover:bg-emerald-800/60'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('hi')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
              language === 'hi'
                ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                : 'text-emerald-100 hover:text-white hover:bg-emerald-800/60'
            }`}
          >
            हिंदी
          </button>
          <button
            type="button"
            onClick={() => setLanguage('chh')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
              language === 'chh'
                ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                : 'text-emerald-100 hover:text-white hover:bg-emerald-800/60'
            }`}
          >
            छत्तीसगढ़ी
          </button>
        </div>
      </div>

      {/* Role Navigation Bar with 'Demo only' badge */}
      <div className="bg-emerald-900 border-t border-emerald-800/80 px-4 py-1.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider bg-emerald-950/60 px-2 py-1 rounded border border-emerald-700/50 mr-1 hidden sm:inline-block">
              {t('app.role_switcher_label')}
            </span>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`touch-target px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                    isActive
                      ? 'bg-white text-agri-dark shadow-sm font-semibold'
                      : 'text-emerald-100 hover:bg-emerald-800/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-agri-primary' : 'text-emerald-300'}`} />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              );
            })}
          </div>

          <NavLink
            to="/rules"
            className="text-xs text-emerald-200 hover:text-white px-2.5 py-1 rounded hover:bg-emerald-800/60 transition-colors flex items-center gap-1"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">{t('rules.title')}</span>
          </NavLink>
        </div>
      </div>
    </header>
  );
};
