import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Sprout,
  Building2,
  BarChart3,
  Shield,
  Search,
  PhoneCall,
  Home,
  ArrowLeft
} from 'lucide-react';
import { useTranslation } from '../i18n';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { language, setLanguage } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const isHomePage = location.pathname === '/';

  // Identify current active workspace
  const getCurrentPageInfo = () => {
    if (location.pathname.startsWith('/farmer')) {
      return {
        path: '/farmer',
        title: language === 'hi' ? 'किसान पोर्टल' : language === 'chh' ? 'किसान पोर्टल' : 'Farmer Portal',
        subtitle: language === 'hi' ? 'पारदर्शी किसान अधिकार एवं गणना' : language === 'chh' ? 'किसान अधिकार अउ हिसाब' : 'Citizen Entitlements & Calculators',
        icon: Sprout,
      };
    }
    if (location.pathname.startsWith('/bank')) {
      return {
        path: '/bank',
        title: language === 'hi' ? 'बैंक शाखा कंसोल' : language === 'chh' ? 'बैंक शाखा कंसोल' : 'Bank Branch Console',
        subtitle: language === 'hi' ? 'ऋण सत्यापन एवं ऑडिट ट्रेल' : language === 'chh' ? 'करजा जांच अउ ऑडिट' : 'Credit Verification & Audit Queue',
        icon: Building2,
      };
    }
    if (location.pathname.startsWith('/policy')) {
      return {
        path: '/policy',
        title: language === 'hi' ? 'नीति एवं विश्लेषण डैशबोर्ड' : language === 'chh' ? 'नीति डैशबोर्ड' : 'Policy & Analytics Dashboard',
        subtitle: language === 'hi' ? 'प्रशासनिक विलंब बॉटलनेक एवं सांख्यिकी' : language === 'chh' ? 'बॉटलनेक विश्लेषण' : 'Administrative Bottlenecks & State Oversight',
        icon: BarChart3,
      };
    }
    if (location.pathname.startsWith('/rules')) {
      return {
        path: '/rules',
        title: language === 'hi' ? 'वैधानिक नियम विनिर्देश' : language === 'chh' ? 'नियम विनिर्देश' : 'Statutory Rules & Transparency',
        subtitle: language === 'hi' ? 'सार्वजनिक सत्यापन योग्य नियम संहिता' : language === 'chh' ? 'सत्यापन योग्य नियम' : 'Public Verifiable Rule Engine',
        icon: Shield,
      };
    }
    return {
      path: '/',
      title: language === 'hi' ? 'पोर्टल द्वार' : language === 'chh' ? 'पोर्टल द्वार' : 'Portal Gate',
      subtitle: language === 'hi' ? 'पारदर्शी कृषि मंच' : language === 'chh' ? 'कृषि मंच' : 'Agri Transparency Platform',
      icon: Home,
    };
  };

  const currentPage = getCurrentPageInfo();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (searchQuery.toLowerCase().includes('kcc') || searchQuery.toLowerCase().includes('loan') || searchQuery.toLowerCase().includes('rule')) {
      navigate('/rules');
    } else {
      navigate('/farmer');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-800 antialiased font-sans">
      
      {/* 1. TOP SAFFRON UTILITY BAR */}
      <div className="bg-[#ea580c] text-white text-xs z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Quick Portal Notice & Helpline */}
          <div className="flex items-center gap-3 text-[11px] font-medium text-orange-100">
            <span className="hidden sm:inline">Citizen Transparency & Entitlements Portal</span>
            <span className="hidden sm:inline text-orange-300">|</span>
            <span className="flex items-center gap-1 text-white font-semibold">
              <PhoneCall className="w-3 h-3 text-amber-200" />
              <span>1800-180-1551 (Kisan Helpline)</span>
            </span>
          </div>

          {/* Right: Search + 3-Language Selector */}
          <div className="flex items-center gap-3">
            <form onSubmit={handleSearch} className="relative hidden md:block">
              <input
                type="text"
                placeholder={language === 'hi' ? 'योजना या खसरा खोजें...' : language === 'chh' ? 'योजना या खसरा खोजव...' : 'Search schemes, Khasra...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 lg:w-60 bg-orange-700/60 hover:bg-orange-700/80 focus:bg-white focus:text-slate-900 text-white placeholder-orange-200 focus:placeholder-slate-400 text-xs px-2.5 py-1 pr-7 rounded-md outline-none transition-all border border-orange-400/40 focus:border-white"
              />
              <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 text-orange-200 hover:text-white">
                <Search className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Language Switcher */}
            <div className="flex items-center bg-orange-800/80 rounded-md p-0.5 border border-orange-400/30">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  language === 'en'
                    ? 'bg-white text-orange-800 shadow-xs'
                    : 'text-orange-100 hover:text-white'
                }`}
                title="English"
              >
                English
              </button>
              <span className="text-orange-300 text-[10px] px-0.5">|</span>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  language === 'hi'
                    ? 'bg-white text-orange-800 shadow-xs'
                    : 'text-orange-100 hover:text-white'
                }`}
                title="हिंदी"
              >
                हिंदी
              </button>
              <span className="text-orange-300 text-[10px] px-0.5">|</span>
              <button
                type="button"
                onClick={() => setLanguage('chh')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  language === 'chh'
                    ? 'bg-white text-orange-800 shadow-xs'
                    : 'text-orange-100 hover:text-white'
                }`}
                title="छत्तीसगढ़ी"
              >
                छत्तीसगढ़ी
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN BRANDING HEADER (Pure White `#ffffff`) */}
      <header className="bg-white border-b border-slate-200 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          
          {/* Left: Platform Logo & Title */}
          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-emerald-700 flex items-center justify-center text-white shadow-sm border border-amber-300/40 group-hover:scale-105 transition-transform flex-shrink-0">
              <Sprout className="w-6 h-6" />
            </div>
            
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 group-hover:text-emerald-800 transition-colors">
                  JanAgriPortal
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200">
                  जन-कृषि मंच
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {language === 'hi' 
                  ? 'पारदर्शी कृषि अधिकार, ऋण एवं नीति मंच' 
                  : language === 'chh' 
                  ? 'पारदर्शी किसान अधिकार अउ नीति मंच' 
                  : 'Public Agricultural Entitlements & Policy Platform'}
              </p>
            </div>
          </NavLink>

          {/* Right: Only Back to Home if inside a page, or current page indicator */}
          <div className="flex items-center gap-3">
            {!isHomePage && (
              <NavLink
                to="/"
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-2 border border-slate-300 shadow-xs transition-all min-h-[40px]"
              >
                <ArrowLeft className="w-4 h-4 text-emerald-700" />
                <span>{language === 'hi' ? 'वापस होम जाएं' : language === 'chh' ? 'होम म वापस जावव' : 'Back to Home'}</span>
              </NavLink>
            )}
          </div>
        </div>
      </header>

      {/* 3. PRIMARY NAVIGATION BAR (STRICT 2-OPTION RULE WHEN INSIDE A PAGE) */}
      <nav className="bg-[#15803d] text-white shadow-md z-30 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          
          {isHomePage ? (
            /* HOME PAGE: Shows Home option */
            <div className="flex items-center gap-2 py-1.5">
              <NavLink
                to="/"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold bg-[#22c55e] text-white shadow-xs"
              >
                <Home className="w-4 h-4" />
                <span>{language === 'hi' ? 'होम (भूमिका चयन)' : language === 'chh' ? 'घर (भूमिका चुनव)' : 'Home (Role Selection)'}</span>
              </NavLink>
            </div>
          ) : (
            /* INSIDE A LOGGED-IN / WORKSPACE PAGE: EXACTLY TWO OPTIONS ONLY:
               Option 1: Back to Home
               Option 2: Explore Current Page
            */
            <div className="flex items-center gap-2 py-1.5">
              {/* Option 1: Back to Home */}
              <NavLink
                to="/"
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold text-emerald-100 hover:text-white hover:bg-emerald-700/70 transition-all min-h-[40px]"
              >
                <Home className="w-4 h-4" />
                <span>{language === 'hi' ? '1. होम (Home)' : language === 'chh' ? '1. होम (Home)' : '1. Home'}</span>
              </NavLink>

              <span className="text-emerald-400/60 font-mono">/</span>

              {/* Option 2: Explore Current Page Workspace */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold bg-[#22c55e] text-white shadow-xs min-h-[40px]">
                <currentPage.icon className="w-4 h-4 shrink-0" />
                <span>2. {currentPage.title}</span>
              </div>
            </div>
          )}

          {/* Current Page Subtitle / Status */}
          <div className="hidden md:flex items-center gap-2 text-xs text-emerald-100 font-medium py-1">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            <span>{currentPage.subtitle}</span>
          </div>

        </div>
      </nav>

      {/* 4. MAIN WORKSPACE / CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 min-w-0">
        {children}
      </main>

      {/* 5. CLEAN OFFICIAL FOOTER (Zero Ministry Claims) */}
      <footer className="bg-slate-900 text-slate-300 text-xs py-8 px-4 border-t-4 border-[#ea580c] mt-auto">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
                <Sprout className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-white text-sm">
                  JanAgriPortal (जन-कृषि मंच)
                </p>
                <p className="text-[11px] text-slate-400">
                  Public Agricultural Entitlements, Credit Verification & Policy Platform
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-300">
              <span className="text-emerald-400 font-bold">Kisan Helpline: 1800-180-1551</span>
              <span>•</span>
              <span>100% Deterministic Rules Engine</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-[11px] text-slate-400">
            <p>© 2026 JanAgriPortal. All statutory entitlements computed via open deterministic rule specifications.</p>
            <div className="flex items-center gap-4">
              <NavLink to="/" className="hover:text-emerald-400">Home</NavLink>
              <NavLink to="/rules" className="hover:text-emerald-400">Statutory Rules</NavLink>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};
export default Layout;
