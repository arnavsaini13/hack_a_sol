import React, { useState } from 'react';
import {
  FileText,
  Search,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Phone,
  KeyRound,
  UserPlus,
  LogIn,
  Check,
  BellRing,
  User,
  MapPin,
  Layers,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { loginWithKhasra, signupSendOtp, signupVerifyOtp } from '../../services/api';
import { useTranslation } from '../../i18n';
import { FieldVoiceSpeaker } from '../common/FieldVoiceSpeaker';
import type { FarmerProfile } from '../../types/models';

interface FarmerLookupGateProps {
  onFarmerVerified: (farmer: FarmerProfile) => void;
}

const CG_DISTRICTS = [
  'रायपुर (Raipur)',
  'दुर्ग (Durg)',
  'बिलासपुर (Bilaspur)',
  'धमतरी (Dhamtari)',
  'राजनांदगांव (Rajnandgaon)',
  'महासमुंद (Mahasamund)',
  'जांजगीर-चांपा (Janjgir-Champa)',
  'बालोद (Balod)',
  'बेमेतरा (Bemetara)',
  'कोरबा (Korba)',
  'रायगढ़ (Raigarh)',
  'कबीरधाम (Kawardha)',
  'बलौदाबाज़ार (Baloda Bazar)',
  'कांकेर (Kanker)',
  'बस्तर (Bastar)',
];

const DEMO_PERSONAS = [
  { id: 'F-001', name: 'रामेश्वर पटेल (Ramesh Patel)', khasra: '142/1', phone: '9876543210', district: 'रायपुर', password: 'Kisan@2026', desc: 'Golden Clean Case' },
  { id: 'F-002', name: 'श्याम वर्मा (Shyam Verma)', khasra: '88/2', phone: '9876543211', district: 'दुर्ग', password: 'Kisan@2026', desc: 'Multi-Parcel' },
  { id: 'F-003', name: 'अनिता बाई (Anita Bai)', khasra: '504', phone: '9876543212', district: 'बिलासपुर', password: 'Kisan@2026', desc: 'Marginal Farmer' },
  { id: 'F-004', name: 'विक्रम सिंह (Vikram Singh)', khasra: '45/2', phone: '9876543213', district: 'राजनांदगांव', password: 'Kisan@2026', desc: 'Amber Fuzzy Match' },
  { id: 'F-005', name: 'दिलीप कुमार (Dilip Kumar)', khasra: '77/1', phone: '9876543214', district: 'महासमुंद', password: 'Kisan@2026', desc: 'Duplicate KCC Mortgaged' },
];

export const FarmerLookupGate: React.FC<FarmerLookupGateProps> = ({ onFarmerVerified }) => {
  const { t, language } = useTranslation();

  // Mode: 'signin' (Khasra + Phone + Password) or 'signup' (Register + Password)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Sign-In state (2 Required Fields: Khasra Unique ID & Password)
  const [signinKhasra, setSigninKhasra] = useState('142/1');
  const [signinPhone, setSigninPhone] = useState('9876543210');
  const [signinPassword, setSigninPassword] = useState('Kisan@2026');
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [showDemoQuickFill, setShowDemoQuickFill] = useState(false);
  const [consentChecked, setConsentChecked] = useState(true);

  // Common loading / error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signup State
  const [signupStep, setSignupStep] = useState<'details' | 'otp'>('details');
  const [signupName, setSignupName] = useState('');
  const [signupFatherName, setSignupFatherName] = useState('');
  const [signupAadhaarLast4, setSignupAadhaarLast4] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupDistrict, setSignupDistrict] = useState('रायपुर (Raipur)');
  const [signupTehsil, setSignupTehsil] = useState('आरंग');
  const [signupVillage, setSignupVillage] = useState('अभनपुर');
  const [signupKhasra, setSignupKhasra] = useState('142/1');
  const [signupAreaAcres, setSignupAreaAcres] = useState('4.00');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupConsent, setSignupConsent] = useState(true);

  // OTP State
  const [signupOtp, setSignupOtp] = useState('');
  const [incomingSmsOtp, setIncomingSmsOtp] = useState<string | null>(null);

  // Quick fill helper for judges & reviewers
  const handleSelectDemoPersona = (p: typeof DEMO_PERSONAS[0]) => {
    setSigninKhasra(p.khasra);
    setSigninPhone(p.phone);
    setSigninPassword(p.password);
    setError(null);
  };

  // Execute Sign-In using Unique Khasra Number + Password
  const handleSigninSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanKhasra = signinKhasra.trim();
    const cleanPass = signinPassword.trim();
    const cleanPhone = signinPhone ? signinPhone.trim() : undefined;

    if (!cleanKhasra) {
      setError(
        language === 'chh'
          ? 'कृपया खसरा नंबर (यूनिक आईडी) लिखव।'
          : language === 'hi'
          ? 'कृपया खसरा क्रमांक (यूनिक आईडी) दर्ज करें।'
          : 'Please enter Khasra Number (Unique ID).'
      );
      return;
    }

    if (!cleanPass) {
      setError(
        language === 'chh'
          ? 'कृपया अपन पासवर्ड दर्ज करव।'
          : language === 'hi'
          ? 'कृपया अपना पासवर्ड दर्ज करें।'
          : 'Please enter your password.'
      );
      return;
    }

    if (!consentChecked) {
      setError(
        language === 'chh'
          ? 'रिकॉर्ड देखे बर सहमति चेकबॉक्स म टिक करव।'
          : language === 'hi'
          ? 'कृपया रिकॉर्ड प्राप्त करने हेतु सहमति चेकबॉक्स पर टिक करें।'
          : 'Please check the consent box to proceed.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithKhasra({
        khasra_no: cleanKhasra,
        password: cleanPass,
        phone: cleanPhone,
      });
      onFarmerVerified(res.farmer);
    } catch (err: any) {
      setError(
        err.message ||
          (language === 'chh'
            ? 'लॉगिन विफल: खसरा अथवा पासवर्ड गलत हे।'
            : language === 'hi'
            ? 'साइन इन विफल: खसरा क्रमांक अथवा पासवर्ड अमान्य है।'
            : 'Sign in failed: Khasra number or Password is incorrect.')
      );
    } finally {
      setLoading(false);
    }
  };

  // Signup Step 1: Validate Details & Request OTP
  const handleSignupSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signupName.trim()) {
      setError(language === 'en' ? 'Please enter Full Legal Name.' : 'कृपया किसान का पूरा नाम दर्ज करें।');
      return;
    }
    if (!signupFatherName.trim()) {
      setError(language === 'en' ? "Please enter Father's / Husband's Name." : 'कृपया पिता / पति का नाम दर्ज करें।');
      return;
    }
    if (!/^\d{4}$/.test(signupAadhaarLast4.trim())) {
      setError(language === 'en' ? 'Please enter 4 digits for Aadhaar.' : 'कृपया आधार कार्ड के अंतिम 4 अंक दर्ज करें।');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(signupPhone.trim())) {
      setError(language === 'en' ? 'Please enter a valid 10-digit mobile number.' : 'कृपया वैध 10-अंकों का मोबाइल नंबर दर्ज करें।');
      return;
    }
    if (!signupKhasra.trim()) {
      setError(language === 'en' ? 'Please enter land Khasra Number.' : 'कृपया खसरा क्रमांक दर्ज करें।');
      return;
    }
    if (!signupPassword || signupPassword.length < 6) {
      setError(
        language === 'en'
          ? 'Password must be at least 6 characters long.'
          : 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।'
      );
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setError(
        language === 'en'
          ? 'Passwords do not match. Please re-check.'
          : 'दोनों पासवर्ड मेल नहीं खाते। कृपया पुनः जांचें।'
      );
      return;
    }
    if (!signupConsent) {
      setError(language === 'en' ? 'Please accept DPDP Act consent.' : 'कृपया डेटा उपयोग हेतु सहमति दें (DPDP Act).');
      return;
    }

    setLoading(true);
    try {
      const res = await signupSendOtp(signupPhone.trim());
      setIncomingSmsOtp(res.otp);
      setSignupStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Signup Step 2: Verify OTP & Complete Registration
  const handleSignupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!signupOtp.trim() || signupOtp.trim().length !== 6) {
      setError(language === 'chh' ? 'कृपया 6 अंक के ओटीपी लिखव।' : language === 'hi' ? 'कृपया 6 अंकों का ओटीपी दर्ज करें।' : 'Please enter 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      const cleanedDistrict = signupDistrict.split(' ')[0] || 'रायपुर';
      const res = await signupVerifyOtp({
        mobile: signupPhone.trim(),
        otp: signupOtp.trim(),
        password: signupPassword.trim(),
        name: signupName.trim(),
        father_name: signupFatherName.trim(),
        district: cleanedDistrict,
        tehsil: signupTehsil.trim() || 'आरंग',
        village: signupVillage.trim() || 'अभनपुर',
        khasra_no: signupKhasra.trim() || '142/1',
        aadhaar_last4: signupAadhaarLast4.trim(),
        area_acres: parseFloat(signupAreaAcres) || 4.0,
      });
      onFarmerVerified(res.farmer);
    } catch (err: any) {
      setError(err.message || 'Signup verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Top Flag Strip */}
        <div className="h-2 bg-gradient-to-r from-orange-500 via-white to-green-600" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {language === 'chh' ? 'किसान पहचान एवं सत्यापन गेट' : language === 'hi' ? 'किसान पहचान एवं सत्यापन गेट' : 'Farmer Identification & Security Gate'}
              </span>
            </span>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {authMode === 'signin'
                ? (language === 'chh' ? 'किसान लॉगिन / प्रवेश' : language === 'hi' ? 'किसान साइन इन / प्रवेश' : 'Farmer Sign-In')
                : (language === 'chh' ? 'नवा किसान अधिकृत पंजीयन' : language === 'hi' ? 'नया किसान अधिकृत पंजीकरण' : 'New Farmer Registration')}
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
              {authMode === 'signin'
                ? (language === 'chh'
                    ? 'अपन खसरा नंबर, मोबाइल नंबर अउ पासवर्ड डाल के सुरक्षित प्रवेश करव।'
                    : language === 'hi'
                    ? 'अपने खसरा नंबर, पंजीकृत मोबाइल नंबर एवं पासवर्ड द्वारा सुरक्षित प्रवेश करें।'
                    : 'Sign in securely with your verified Khasra, Phone, and Argon2 Password.')
                : (language === 'chh'
                    ? 'अपन पूरा विवरण, खसरा अउ नवा पासवर्ड बना के सुरक्षित खाता बनावव।'
                    : language === 'hi'
                    ? 'अपना पूरा विवरण, खसरा एवं पासवर्ड बनाकर सुरक्षित खाता बनाएं।'
                    : 'Register with authentic farmer details: Legal Name, Land Khasra, Phone & Password.')}
            </p>
          </div>

          {/* SMS Notification Banner for Signup OTP */}
          {incomingSmsOtp && authMode === 'signup' && (
            <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-400 text-blue-950 text-xs shadow-sm flex items-start gap-3 animate-in fade-in">
              <BellRing className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block text-sm">
                  📩 {language === 'en' ? 'Govt-OTP SMS Received:' : 'शासकीय एसएमएस अलर्ट [Govt-OTP]:'}
                </span>
                <p>
                  {language === 'chh'
                    ? 'कृषि पारदर्शिता पोर्टल सत्यापन कोड: '
                    : language === 'hi'
                    ? 'कृषि पारदर्शिता पोर्टल सत्यापन कोड: '
                    : 'JanAgriPortal verification OTP: '}
                  <strong className="text-sm font-mono text-blue-900 bg-blue-200/80 px-2 py-0.5 rounded tracking-widest ml-1">
                    {incomingSmsOtp}
                  </strong>
                </p>
                <div className="text-[11px] text-blue-700 font-medium">
                  <em>{language === 'en' ? 'Demo OTP — live SMS gateway enabled upon TRAI DLT registration' : 'डेमो ओटीपी — ट्राई (TRAI) डीएलटी पंजीयन उपरांत लाइव एसएमएस गेटवे सक्रिय'}</em>
                </div>
                <button
                  type="button"
                  onClick={() => setSignupOtp(incomingSmsOtp)}
                  className="inline-block text-xs font-bold text-blue-800 underline mt-1 cursor-pointer hover:text-blue-950"
                >
                  {language === 'chh' ? 'कोड अपने-आप भरव (Auto-Fill)' : language === 'hi' ? 'कोड स्वतः भरें (Auto-Fill)' : 'Auto-Fill Code'}
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── MODE 1: 3-FIELD SIGN-IN FORM ─────────────────────────── */}
          {authMode === 'signin' && (
            <form onSubmit={handleSigninSubmit} className="space-y-4">
              {/* Collapsible Demo Persona Quick-Fill */}
              <div className="border border-emerald-200 bg-emerald-50/60 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowDemoQuickFill(!showDemoQuickFill)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-emerald-900 hover:bg-emerald-100/50 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>{language === 'en' ? 'Demo Persona Quick-Fill (Judges / Reviewers)' : 'डेमो किसान त्वरित चयन (Judges Quick-Fill)'}</span>
                  </span>
                  {showDemoQuickFill ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showDemoQuickFill && (
                  <div className="p-3 border-t border-emerald-200/60 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {DEMO_PERSONAS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectDemoPersona(p)}
                        className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer ${
                          signinKhasra === p.khasra && signinPhone === p.phone
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold'
                            : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-[12px]">
                          <span>{p.name}</span>
                          <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">{p.id}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          खसरा: <strong className="text-slate-700">{p.khasra}</strong> • मो: <strong className="text-slate-700">{p.phone}</strong>
                        </div>
                        <div className="text-[10px] text-emerald-700 mt-0.5">
                          {p.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 1. Khasra Number (Unique ID) */}
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{language === 'en' ? 'Khasra Number (Unique ID) *' : 'खसरा क्रमांक (यूनिक आईडी) *'}</span>
                  </span>
                  <FieldVoiceSpeaker
                    textHi="कृपया अपनी भूमि का खसरा क्रमांक अथवा यूनिक आईडी दर्ज करें।"
                    textEn="Please enter your land Khasra number or unique ID."
                  />
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={signinKhasra}
                    onChange={(e) => setSigninKhasra(e.target.value)}
                    placeholder="e.g. 142/1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
                </div>
              </div>

              {/* 2. Password with Show/Hide Toggle */}
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{language === 'en' ? 'Password (पंजीकृत पासवर्ड) *' : 'पासवर्ड (Password) *'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSigninPassword(!showSigninPassword)}
                    className="text-[11px] text-slate-500 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                  >
                    {showSigninPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showSigninPassword ? (language === 'en' ? 'Hide' : 'छिपाएं') : (language === 'en' ? 'Show' : 'दिखाएं')}</span>
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showSigninPassword ? 'text' : 'password'}
                    required
                    value={signinPassword}
                    onChange={(e) => setSigninPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* DPDP Consent */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer text-xs text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="leading-relaxed">
                  {language === 'chh'
                    ? 'मोर भुइयां, करजा, एमएसपी अउ बीमा रिकॉर्ड देख के पारदर्शिता जांच करे बर अनुमति हे (DPDP Act 2023).'
                    : language === 'hi'
                    ? 'मेरी भूमि, ऋण, एमएसपी एवं बीमा रिकॉर्ड प्राप्त कर पारदर्शिता जांच करने की अनुमति दें (DPDP Act 2023).'
                    : 'Fetch my land, loan, MSP & insurance records for statutory entitlement verification (DPDP Act 2023).'}
                </span>
              </label>

              {/* Submit CTA Button */}
              <button
                type="submit"
                disabled={loading || !consentChecked}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all min-h-[48px] disabled:opacity-50 cursor-pointer"
              >
                <span>
                  {loading
                    ? (language === 'chh' ? 'सत्यापन होवत हे...' : language === 'hi' ? 'सत्यापन हो रहा है...' : 'Authenticating...')
                    : (language === 'chh' ? 'साइन इन करव / मोर हक जानव' : language === 'hi' ? 'साइन इन करें / मेरा हक जानें' : 'Sign In & Check Entitlements')}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Sign Up Link */}
              <div className="pt-4 border-t border-slate-100 text-center">
                <span className="text-xs text-slate-500">
                  {language === 'chh' ? 'नवा किसान खाता बनावव?' : language === 'hi' ? 'नया किसान खाता बनाना चाहते हैं?' : "Need to register a new farmer?"}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setAuthMode('signup');
                    }}
                    className="font-bold text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{language === 'chh' ? 'नवा पंजीयन करव (Sign Up)' : language === 'hi' ? 'नया पंजीकरण करें (Sign Up)' : 'Sign Up here'}</span>
                  </button>
                </span>
              </div>
            </form>
          )}

          {/* ── MODE 2: SIGNUP FORM WITH PASSWORD CREATION ───────────── */}
          {authMode === 'signup' && (
            <div className="space-y-4">
              {signupStep === 'details' ? (
                <form onSubmit={handleSignupSendOtp} className="space-y-4">
                  {/* Two-Column Grid for Demographics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Full Name */}
                    <div>
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                        <User className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{language === 'en' ? 'Full Legal Name *' : 'किसान का पूरा नाम *'}</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={language === 'en' ? 'e.g. Ramesh Sahu' : 'उदा. रमेश साहू'}
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    {/* Father's / Husband's Name */}
                    <div>
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                        <User className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{language === 'en' ? "Father's / Husband's Name *" : 'पिता / पति का नाम *'}</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={language === 'en' ? 'e.g. Ramprasad Sahu' : 'उदा. रामप्रसाद साहू'}
                        value={signupFatherName}
                        onChange={(e) => setSignupFatherName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    {/* Aadhaar Last 4 Digits */}
                    <div>
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                        <Lock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{language === 'en' ? 'Aadhaar (Last 4 Digits) *' : 'आधार कार्ड (अंतिम 4 अंक) *'}</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <span className="px-2.5 py-2 rounded-xl bg-slate-100 text-slate-400 font-mono text-xs border border-slate-200">
                          XXXX-XXXX-
                        </span>
                        <input
                          type="text"
                          required
                          maxLength={4}
                          placeholder="7890"
                          value={signupAadhaarLast4}
                          onChange={(e) => setSignupAadhaarLast4(e.target.value.replace(/\D/g, ''))}
                          className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:border-emerald-600 focus:outline-none tracking-widest text-center"
                        />
                      </div>
                    </div>

                    {/* Mobile Number */}
                    <div>
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                        <Phone className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{language === 'en' ? '10-Digit Mobile (For OTP) *' : 'मोबाइल नंबर (ओटीपी हेतु) *'}</span>
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        placeholder="9876543210"
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none font-mono"
                      />
                    </div>

                    {/* Khasra No (Required) */}
                    <div>
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                        <FileText className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{language === 'en' ? 'Khasra Number (खसरा) *' : 'खसरा क्रमांक *'}</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="उदा. 142/1 अथवा 205/3"
                        value={signupKhasra}
                        onChange={(e) => setSignupKhasra(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    {/* Land Area in Acres */}
                    <div>
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{language === 'en' ? 'Land Area (in Acres / एकड़) *' : 'कुल भू-रकबा (एकड़ में) *'}</span>
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        required
                        placeholder="उदा. 4.00"
                        value={signupAreaAcres}
                        onChange={(e) => setSignupAreaAcres(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    {/* District */}
                    <div>
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{language === 'en' ? 'District (जिला) *' : 'जिला (District) *'}</span>
                      </label>
                      <select
                        value={signupDistrict}
                        onChange={(e) => setSignupDistrict(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:border-emerald-600 focus:outline-none"
                      >
                        {CG_DISTRICTS.map((dist) => (
                          <option key={dist} value={dist}>
                            {dist}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tehsil */}
                    <div>
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{language === 'en' ? 'Tehsil / Block *' : 'तहसील / विकासखंड *'}</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="आरंग / पाटन / धमतरी"
                        value={signupTehsil}
                        onChange={(e) => setSignupTehsil(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    {/* Village */}
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{language === 'en' ? 'Village / Gram Panchayat *' : 'ग्राम / ग्राम पंचायत *'}</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="उदा. अभनपुर / जामगांव"
                        value={signupVillage}
                        onChange={(e) => setSignupVillage(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    {/* Create Password */}
                    <div>
                      <label className="text-xs font-bold text-slate-800 flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{language === 'en' ? 'Create Password *' : 'पासवर्ड बनाएं *'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          className="text-[11px] text-slate-500 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                        >
                          {showSignupPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{showSignupPassword ? (language === 'en' ? 'Hide' : 'छिपाएं') : (language === 'en' ? 'Show' : 'दिखाएं')}</span>
                        </button>
                      </label>
                      <input
                        type={showSignupPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="कम से कम 6 अक्षर"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{language === 'en' ? 'Confirm Password *' : 'पासवर्ड की पुष्टि करें *'}</span>
                      </label>
                      <input
                        type={showSignupPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="पासवर्ड पुनः दर्ज करें"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* DPDP Consent */}
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer text-xs text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={signupConsent}
                      onChange={(e) => setSignupConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>
                      {language === 'en'
                        ? 'I hereby authorize JanAgriPortal to verify my land, KCC and subsidy records under the DPDP Act 2023. My data will solely be used for statutory entitlement calculations.'
                        : 'मैं डिजिटल व्यक्तिगत डेटा संरक्षण (DPDP) अधिनियम 2023 के तहत अपने खसरा व कृषि रिकॉर्ड के सत्यापन की सहमति देता हूँ। इसका उपयोग केवल योजना पात्रता व पारदर्शिता हेतु होगा।'}
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={loading || signupPhone.length !== 10 || !signupConsent || !signupPassword}
                    className="w-full py-3.5 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    <span>{loading ? t('app.loading') : (language === 'chh' ? 'ओटीपी सत्यापन कोड मंगाव' : language === 'hi' ? 'ओटीपी सत्यापन कोड मंगाएं' : 'Verify via OTP')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignupVerify} className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                    <div className="font-bold text-slate-800">{signupName} ({signupPhone})</div>
                    <div className="text-slate-500">{signupDistrict} • खसरा: {signupKhasra} • {signupAreaAcres} एकड़</div>
                    <div className="text-[11px] text-emerald-700 font-bold">✓ पासवर्ड सेट किया गया (Argon2 Hashed)</div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{language === 'chh' ? '6-अंक के ओटीपी कोड लिखव' : language === 'hi' ? '6-अंकीय ओटीपी कोड दर्ज करें' : 'Enter 6-digit OTP Code'}</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="123456"
                      value={signupOtp}
                      onChange={(e) => setSignupOtp(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-center text-lg font-mono font-bold tracking-widest focus:border-emerald-600 focus:outline-none"
                    />
                    <div className="text-[11px] text-slate-500 mt-1">
                      <em>{language === 'en' ? 'Demo OTP — live SMS gateway enabled upon TRAI DLT registration' : 'डेमो ओटीपी — ट्राई (TRAI) डीएलटी पंजीयन उपरांत लाइव एसएमएस गेटवे सक्रिय'}</em>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || signupOtp.length !== 6}
                    className="w-full py-3.5 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{loading ? t('app.loading') : (language === 'chh' ? 'सत्यापित करके खाता बनावव' : language === 'hi' ? 'सत्यापित कर अधिकृत खाता बनाएं' : 'Verify & Complete Registration')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignupStep('details')}
                    className="w-full text-xs text-slate-500 font-bold hover:underline text-center cursor-pointer"
                  >
                    ← {language === 'en' ? 'Edit Details' : 'विवरण सुधारें'}
                  </button>
                </form>
              )}

              {/* Back to Sign-In */}
              <div className="pt-3 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setAuthMode('signin');
                    setSignupStep('details');
                  }}
                  className="font-bold text-emerald-700 hover:underline text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{language === 'chh' ? 'लॉगिन म वापस जावव' : language === 'hi' ? 'साइन इन पर वापस जाएं' : 'Back to Sign-In'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default FarmerLookupGate;
