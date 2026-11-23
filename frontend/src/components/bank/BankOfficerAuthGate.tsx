import React, { useState } from 'react';
import {
  Building2,
  Lock,
  Mail,
  UserCheck,
  ShieldCheck,
  User,
  MapPin,
} from 'lucide-react';
import { loginBankOfficer, registerBankOfficer, type BankOfficerProfile } from '../../services/api';
import { useTranslation } from '../../i18n';

interface BankOfficerAuthGateProps {
  onAuthenticated: (officer: BankOfficerProfile) => void;
}

const BANK_OPTIONS = [
  'Chhattisgarh Rajya Gramin Bank',
  'Raipur District Cooperative Bank',
  'Dhamtari District Cooperative Bank',
  'Durg District Cooperative Bank',
  'Bilaspur District Cooperative Bank',
  'State Bank of India',
  'Punjab National Bank',
  'Bank of Baroda',
];

export const BankOfficerAuthGate: React.FC<BankOfficerAuthGateProps> = ({ onAuthenticated }) => {
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
  const [regBank, setRegBank] = useState(BANK_OPTIONS[0]);
  const [regDistrict, setRegDistrict] = useState('Raipur');
  const [regPassword, setRegPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setLoginError(language !== 'en' ? 'कृपया ईमेल/कर्मचारी आईडी और पासवर्ड दर्ज करें।' : 'Please enter Email/Employee ID and Password.');
      return;
    }

    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await loginBankOfficer({
        identifier: loginIdentifier.trim(),
        password: loginPassword,
      });
      onAuthenticated(res.officer);
    } catch (err: any) {
      setLoginError(err?.message || (language !== 'en' ? 'लॉग इन विफल। कृपया पुनः प्रयास करें।' : 'Login failed. Please verify credentials.'));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regEmpId.trim() || !regPassword.trim()) {
      setRegError(language !== 'en' ? 'कृपया सभी आवश्यक फ़ील्ड भरें।' : 'Please fill all required fields.');
      return;
    }

    setRegLoading(true);
    setRegError('');
    try {
      const res = await registerBankOfficer({
        full_name: regName.trim(),
        email: regEmail.trim(),
        employee_id: regEmpId.trim().toUpperCase(),
        bank_name: regBank,
        branch_district: regDistrict,
        password: regPassword,
      });
      onAuthenticated(res.officer);
    } catch (err: any) {
      setRegError(err?.message || (language !== 'en' ? 'पंजीकरण विफल। कृपया पुनः प्रयास करें।' : 'Registration failed.'));
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-6 sm:py-10 animate-in fade-in duration-300">
      {/* Institutional Header Card */}
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex p-3 rounded-2xl bg-[#0f2744] text-sky-300 shadow-md border border-sky-800/40">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {language !== 'en' ? 'बैंक अधिकारी सत्यापन पोर्टल' : 'Bank Officer Verification Console'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
          {language !== 'en'
            ? 'केसीसी ऋण क्रॉस-सत्यापन, भू-अभिलेख एवं दोहरे वित्तपोषण जांच हेतु संस्थागत प्रमाणीकरण।'
            : 'Institutional access for statutory KCC cross-verification, Bhuiyan title matching & duplicate financing checks.'}
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-[11px] font-mono text-slate-600">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>{language !== 'en' ? 'आधिकारिक बैंक प्रमाणीकरण • संस्थागत सुरक्षा' : 'Institutional Banking Security • Authorized Access'}</span>
        </div>
      </div>

      {/* Main Auth Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('LOGIN')}
            className={`flex-1 py-3.5 text-center transition-all ${
              activeTab === 'LOGIN'
                ? 'bg-white text-slate-900 border-b-2 border-[#0f2744] font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {language !== 'en' ? 'अधिकारी लॉग इन (Sign In)' : 'Officer Sign In'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('REGISTER')}
            className={`flex-1 py-3.5 text-center transition-all ${
              activeTab === 'REGISTER'
                ? 'bg-white text-slate-900 border-b-2 border-[#0f2744] font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {language !== 'en' ? 'नया पंजीकरण (Register Staff)' : 'Register New Staff'}
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {/* TAB 1: LOGIN */}
          {activeTab === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                  {loginError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language !== 'en' ? 'बैंक ईमेल अथवा कर्मचारी आईडी' : 'Official Bank Email OR Employee ID'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. EMP-2041 or anita.verma@cggb.in"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 text-xs focus:ring-2 focus:ring-[#0f2744] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {language !== 'en' ? 'पासवर्ड' : 'Password'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 text-xs focus:ring-2 focus:ring-[#0f2744] focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 px-4 rounded-xl bg-[#0f2744] hover:bg-[#1a3d66] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all min-h-[44px]"
              >
                {loginLoading ? (
                  <span>{language !== 'en' ? 'प्रमाणीकरण हो रहा है...' : 'Authenticating...'}</span>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>{language !== 'en' ? 'सत्यापन कंसोल में प्रवेश करें' : 'Enter Verification Console'}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {activeTab === 'REGISTER' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {regError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                  {regError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language !== 'en' ? 'अधिकारी का पूरा नाम' : 'Full Name'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar Agrawal"
                    className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-300 font-medium text-slate-900 text-xs outline-none focus:ring-2 focus:ring-[#0f2744]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language !== 'en' ? 'आधिकारिक बैंक ईमेल' : 'Official Bank Email'}
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="rajesh@cggb.in"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-medium text-slate-900 text-xs outline-none focus:ring-2 focus:ring-[#0f2744]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language !== 'en' ? 'कर्मचारी आईडी' : 'Employee ID'}
                  </label>
                  <input
                    type="text"
                    required
                    value={regEmpId}
                    onChange={(e) => setRegEmpId(e.target.value)}
                    placeholder="CGGB-4092"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-medium text-slate-900 text-xs uppercase outline-none focus:ring-2 focus:ring-[#0f2744]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language !== 'en' ? 'बैंक संस्था' : 'Bank Name'}
                  </label>
                  <select
                    value={regBank}
                    onChange={(e) => setRegBank(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 text-xs bg-white outline-none focus:ring-2 focus:ring-[#0f2744]"
                  >
                    {BANK_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language !== 'en' ? 'शाखा / जिला' : 'Branch / District'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      required
                      value={regDistrict}
                      onChange={(e) => setRegDistrict(e.target.value)}
                      placeholder="Raipur / Dhamtari"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-900 text-xs outline-none focus:ring-2 focus:ring-[#0f2744]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language !== 'en' ? 'पासवर्ड (Argon2 सुरक्षित)' : 'Password (Argon2 Hashed)'}
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 font-medium text-slate-900 text-xs outline-none focus:ring-2 focus:ring-[#0f2744]"
                />
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-3 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all min-h-[44px]"
              >
                {regLoading ? (
                  <span>{language !== 'en' ? 'खाता सृजित हो रहा है...' : 'Creating Staff Account...'}</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{language !== 'en' ? 'पंजीकृत कर कंसोल खोलें' : 'Register & Launch Console'}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
export default BankOfficerAuthGate;
