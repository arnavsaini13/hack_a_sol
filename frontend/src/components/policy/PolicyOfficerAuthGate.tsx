import React, { useState } from 'react';
import {
  BarChart3,
  Lock,
  Mail,
  UserCheck,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import {
  loginPolicyOfficer,
  registerPolicyOfficer,
  type PolicyOfficerProfile
} from '../../services/api';
import { useTranslation } from '../../i18n';

interface PolicyOfficerAuthGateProps {
  onAuthenticated: (officer: PolicyOfficerProfile) => void;
}

const DEPARTMENTS = [
  'Directorate of Agriculture & DBT Oversight',
  'Food, Civil Supplies & Consumer Protection',
  'State Planning Commission',
  'Finance Department (Expenditure & Audit)',
  'Revenue & Land Records Administration',
];

const DESIGNATIONS = [
  'Joint Secretary (Agriculture)',
  'Director (Policy & DBT Oversight)',
  'State Statistical Officer',
  'District Collector / Magistrate',
  'Chief Audit & Vigilance Officer',
  'Deputy Director (Monitoring & Evaluation)',
];

const JURISDICTIONS = [
  'State HQ (Raipur)',
  'Central Zone (Durg / Rajnandgaon)',
  'North Zone (Bilaspur / Ambikapur)',
  'South Zone (Bastar / Jagdalpur)',
];

export const PolicyOfficerAuthGate: React.FC<PolicyOfficerAuthGateProps> = ({ onAuthenticated }) => {
  const { language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regEmpId, setRegEmpId] = useState('');
  const [regDept, setRegDept] = useState(DEPARTMENTS[0]);
  const [regDesignation, setRegDesignation] = useState(DESIGNATIONS[0]);
  const [regJurisdiction, setRegJurisdiction] = useState(JURISDICTIONS[0]);
  const [regPassword, setRegPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  // Quick fill profiles
  const fillQuickProfile = (profile: {
    name: string;
    email: string;
    id: string;
    dept: string;
    desig: string;
    juris: string;
  }) => {
    setLoginIdentifier(profile.email);
    setLoginPassword('admin123');
    setLoginError('');
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setLoginError(
        language !== 'en'
          ? 'कृपया शासकीय ईमेल / अधिकारी आईडी और पासवर्ड दर्ज करें।'
          : 'Please enter Official Email / Officer ID and Password.'
      );
      return;
    }

    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await loginPolicyOfficer({
        identifier: loginIdentifier.trim(),
        password: loginPassword,
      });
      onAuthenticated(res.officer);
    } catch (err: any) {
      setLoginError(
        err?.message ||
          (language !== 'en'
            ? 'लॉग इन विफल। कृपया क्रेडेंशियल जांचें।'
            : 'Login failed. Please verify official credentials.')
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regEmpId.trim() || !regPassword.trim()) {
      setRegError(
        language !== 'en'
          ? 'कृपया सभी आवश्यक फ़ील्ड भरें।'
          : 'Please fill all required registration fields.'
      );
      return;
    }

    setRegLoading(true);
    setRegError('');
    try {
      const res = await registerPolicyOfficer({
        full_name: regName.trim(),
        email: regEmail.trim(),
        employee_id: regEmpId.trim().toUpperCase(),
        department: regDept,
        designation: regDesignation,
        jurisdiction: regJurisdiction,
        password: regPassword,
      });
      onAuthenticated(res.officer);
    } catch (err: any) {
      setRegError(
        err?.message ||
          (language !== 'en'
            ? 'पंजीकरण विफल। कृपया पुनः प्रयास करें।'
            : 'Registration failed. Please check inputs.')
      );
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-10 animate-in fade-in duration-300">
      {/* Institutional Header Card */}
      <div className="text-center space-y-3 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-800 text-white flex items-center justify-center mx-auto shadow-md border border-purple-400/40">
          <BarChart3 className="w-8 h-8" />
        </div>

        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-purple-700 bg-purple-100 px-3 py-1 rounded-full border border-purple-200">
            {language !== 'en' ? 'राज्य नीति एवं सांख्यिकी नियंत्रण' : 'State Policy & Analytics Oversight'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
            {language !== 'en' ? 'नीति निर्माता प्रमाणीकरण गेट' : 'Policy Maker Authentication Gate'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto mt-1 leading-relaxed">
            {language !== 'en'
              ? 'राज्यभर में प्रत्यक्ष लाभ अंतरण (DBT) विलंब, विसंगतियों एवं अपरिवर्तनीय ऑडिट ट्रेल का प्रशासनिक विश्लेषण।'
              : 'Authorized administrative access to state-wide subsidy bottlenecks, k-anonymity privacy safeguards, and cryptographic audit logs.'}
          </p>
        </div>
      </div>

      {/* Main Tabbed Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Tab Toggle */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 p-1.5 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('LOGIN');
              setLoginError('');
            }}
            className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
              activeTab === 'LOGIN'
                ? 'bg-purple-800 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>{language !== 'en' ? 'अधिकारी लॉगिन (Sign In)' : 'Officer Sign In'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('REGISTER');
              setRegError('');
            }}
            className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
              activeTab === 'REGISTER'
                ? 'bg-purple-800 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>{language !== 'en' ? 'नया अधिकारी पंजीकरण (Register)' : 'New Officer Registration'}</span>
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {/* TAB 1: LOGIN */}
          {activeTab === 'LOGIN' && (
            <div className="space-y-6">
              {/* Quick Fill Officer Profiles for Evaluators */}
              <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                  <Sparkles className="w-4 h-4 text-purple-700" />
                  <span>
                    {language !== 'en' ? 'त्वरित अधिकृत प्रोफाइल चुनें:' : 'Select Authorized Officer Profile:'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      fillQuickProfile({
                        name: 'Dr. S. K. Verma',
                        email: 'dr.verma@cg.gov.in',
                        id: 'CG-POL-8492',
                        dept: 'Directorate of Agriculture & DBT Oversight',
                        desig: 'Joint Secretary (Agriculture)',
                        juris: 'State HQ (Raipur)',
                      })
                    }
                    className="p-2.5 rounded-xl bg-white border border-purple-200 hover:border-purple-500 text-left text-xs transition-all shadow-xs group"
                  >
                    <div className="font-extrabold text-slate-900 group-hover:text-purple-800">
                      Dr. S. K. Verma
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Joint Secretary (Agriculture) • State HQ
                    </div>
                    <div className="text-[10px] font-mono text-purple-700 mt-0.5">
                      dr.verma@cg.gov.in
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      fillQuickProfile({
                        name: 'Pooja Kashyap',
                        email: 'pooja.kashyap@cg.gov.in',
                        id: 'CG-POL-5510',
                        dept: 'State Planning Commission',
                        desig: 'State Statistical Officer',
                        juris: 'State HQ (Raipur)',
                      })
                    }
                    className="p-2.5 rounded-xl bg-white border border-purple-200 hover:border-purple-500 text-left text-xs transition-all shadow-xs group"
                  >
                    <div className="font-extrabold text-slate-900 group-hover:text-purple-800">
                      Pooja Kashyap
                    </div>
                    <div className="text-[11px] text-slate-500">
                      State Statistical Officer • Planning Comm.
                    </div>
                    <div className="text-[10px] font-mono text-purple-700 mt-0.5">
                      pooja.kashyap@cg.gov.in
                    </div>
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                    <Mail className="w-3.5 h-3.5 text-purple-700" />
                    <span>
                      {language !== 'en' ? 'शासकीय ईमेल अथवा अधिकारी कोड *' : 'Official Email or Officer Code *'}
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="उदा. dr.verma@cg.gov.in या CG-POL-8492"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                    <Lock className="w-3.5 h-3.5 text-purple-700" />
                    <span>
                      {language !== 'en' ? 'गोपनीय पासवर्ड / सुरक्षा पिन *' : 'Confidential Access PIN / Password *'}
                    </span>
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 bg-slate-50/50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-purple-800 hover:bg-purple-900 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50 min-h-[48px]"
                >
                  <span>
                    {loginLoading
                      ? (language !== 'en' ? 'प्रमाणीकरण हो रहा है...' : 'Authenticating...')
                      : (language !== 'en' ? 'नीति कंसोल में प्रवेश करें' : 'Sign In to Policy Console')}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: REGISTER */}
          {activeTab === 'REGISTER' && (
            <div className="space-y-6">
              {regError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1.5">
                      {language !== 'en' ? 'अधिकारी का पूरा नाम *' : 'Officer Full Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="उदा. डॉ. अरविंद देवांगन"
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 text-xs focus:border-purple-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1.5">
                      {language !== 'en' ? 'अधिकारी / सेवा संवर्ग कोड (ID) *' : 'Officer / Cadre Code (ID) *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={regEmpId}
                      onChange={(e) => setRegEmpId(e.target.value)}
                      placeholder="उदा. CG-POL-9281"
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 text-xs font-mono uppercase focus:border-purple-600 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1.5">
                      {language !== 'en' ? 'शासकीय ईमेल आईडी *' : 'Official Email ID *'}
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="officer@cg.gov.in"
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 text-xs focus:border-purple-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1.5">
                      {language !== 'en' ? 'शासकीय विभाग / निदेशालय *' : 'Government Department *'}
                    </label>
                    <select
                      value={regDept}
                      onChange={(e) => setRegDept(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl border border-slate-300 text-xs bg-white focus:border-purple-600 outline-none"
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1.5">
                      {language !== 'en' ? 'पदनाम (Designation) *' : 'Designation *'}
                    </label>
                    <select
                      value={regDesignation}
                      onChange={(e) => setRegDesignation(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl border border-slate-300 text-xs bg-white focus:border-purple-600 outline-none"
                    >
                      {DESIGNATIONS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1.5">
                      {language !== 'en' ? 'प्रशासनिक क्षेत्राधिकार (Jurisdiction) *' : 'Jurisdiction Level *'}
                    </label>
                    <select
                      value={regJurisdiction}
                      onChange={(e) => setRegJurisdiction(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl border border-slate-300 text-xs bg-white focus:border-purple-600 outline-none"
                    >
                      {JURISDICTIONS.map((j) => (
                        <option key={j} value={j}>
                          {j}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 block mb-1.5">
                    {language !== 'en' ? 'सुरक्षित पासवर्ड / पिन बनाएं *' : 'Create Secure Access PIN / Password *'}
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="कम से कम 6 अक्षर या अंक"
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 text-xs focus:border-purple-600 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-purple-800 hover:bg-purple-900 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50 min-h-[48px]"
                >
                  <span>
                    {regLoading
                      ? (language !== 'en' ? 'पंजीकरण हो रहा है...' : 'Registering...')
                      : (language !== 'en' ? 'अधिकारी पंजीकरण पूर्ण करें' : 'Complete Officer Registration')}
                  </span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default PolicyOfficerAuthGate;
