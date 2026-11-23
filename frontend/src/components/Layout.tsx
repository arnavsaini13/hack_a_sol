import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sprout,
  Building2,
  BarChart3,
  Globe,
  Shield,
  Layers,
  ChevronDown
} from 'lucide-react';
import { useTranslation } from '../i18n';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { language, setLanguage, t } = useTranslation();
  const location = useLocation();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const navRoles = [
    { path: '/farmer', labelKey: 'app.role_farmer', icon: Sprout },
    { path: '/bank', labelKey: 'app.role_bank', icon: Building2 },
    { path: '/policy', labelKey: 'app.role_policy', icon: BarChart3 },
    { path: '/rules', labelKey: 'rules.title', icon: Shield },
  ];

  const currentRole = navRoles.find((r) => location.pathname.startsWith(r.path));

  const portalSubtitle =
    language === 'chh'
      ? 'छत्तीसगढ़ शासन • पारदर्शी कृषि मंच (छत्ती.)'
      : language === 'hi'
      ? 'छत्तीसगढ़ शासन • पारदर्शी कृषि मंच'
      : 'Govt of Chhattisgarh • Agri Transparency Platform';

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-800 antialiased font-sans">
      {/* 1. Indian Tricolor Accent Strip (Saffron, White, Green) */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808] z-50 sticky top-0 shadow-xs" />

      {/* 2. Top JanAgriPortal Header (Deep Navy Slate) */}
      <header className="bg-[#0f172a] text-white shadow-md z-40 sticky top-1.5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Logo & Brand (Clicking returns to / Role Gate) */}
          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-emerald-600 flex items-center justify-center shadow-inner border border-amber-300/40 p-1">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-black tracking-tight text-white group-hover:text-amber-300 transition-colors">
                  JanAgriPortal
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-semibold border border-emerald-400/30">
                  CG-GOV
                </span>
              </div>
              <p className="text-[11px] text-amber-400 font-medium">
                {portalSubtitle}
              </p>
            </div>
          </NavLink>

          {/* Right Controls: Compact "Switch Role (Demo)" Pill + Language Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Compact "Switch Role" Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700 shadow-xs transition-all min-h-[44px]"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline text-amber-300">
                  {currentRole ? t(currentRole.labelKey) : (language === 'en' ? 'Select Role' : language === 'chh' ? 'भूमिका चुनव' : 'भूमिका चुनें')}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {roleMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 text-slate-800 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {language === 'en' ? 'Switch Role' : language === 'chh' ? 'भूमिका बदलव' : 'भूमिका बदलें'}
                  </div>
                  <NavLink
                    to="/"
                    onClick={() => setRoleMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <span>🏠</span>
                    <span>{language === 'en' ? 'Role Selection Gate' : language === 'chh' ? 'भूमिका चयन गेट' : 'भूमिका चयन गेट (Gate)'}</span>
                  </NavLink>
                  {navRoles.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname.startsWith(item.path);
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setRoleMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold ${
                          isActive
                            ? 'bg-amber-50 text-amber-900 font-bold border-l-4 border-amber-600'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-emerald-700" />
                        <span>{t(item.labelKey)}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3-Language Segmented Switcher (EN | हिंदी | छत्तीसगढ़ी) */}
            <div className="flex items-center bg-slate-800/95 rounded-xl p-0.5 sm:p-1 border border-slate-700 shadow-inner">
              <Globe className="w-3.5 h-3.5 text-amber-400 ml-1.5 mr-1 hidden sm:inline" />
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                  language === 'en'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
                title="English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                  language === 'hi'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
                title="हिंदी (Hindi)"
              >
                हिंदी
              </button>
              <button
                type="button"
                onClick={() => setLanguage('chh')}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                  language === 'chh'
                    ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
                title="छत्तीसगढ़ी (Chhattisgarhi)"
              >
                छत्तीसगढ़ी
              </button>
            </div>
          </div>
        </div>

        {/* 3. Official Status Strip */}
        <div className="bg-slate-900/90 border-t border-slate-800 px-4 sm:px-6 py-1.5 text-[11px] text-slate-300">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-medium text-slate-300">
                छत्तीसगढ़ शासन • आधिकारिक नागरिक पारदर्शिता मंच | Official Citizen Transparency Portal
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-[11px]">
              <span className="text-emerald-300">किसान हेल्पलाइन (Kisan Helpline): 1800-180-1551</span>
            </div>
          </div>
        </div>
      </header>

      {/* 4. Main Page Workflow (Clean, Uncluttered, Direct) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 min-w-0">
        {children}
      </main>

      {/* 5. Clean Honest Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-6 px-4 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-300 font-medium">
              छत्तीसगढ़ शासन • कृषि नीति, ऋण एवं उपार्जन पारदर्शिता मंच
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            कृषि विकास एवं किसान कल्याण तथा जैव प्रौद्योगिकी विभाग, छत्तीसगढ़ शासन
          </div>
        </div>
      </footer>
    </div>
  );
};
export default Layout;
