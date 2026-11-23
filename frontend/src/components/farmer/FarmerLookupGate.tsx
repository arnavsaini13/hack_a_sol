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
  BellRing
} from 'lucide-react';
import { loginWithKhasra, signupSendOtp, signupVerifyOtp } from '../../services/api';
import { useTranslation } from '../../i18n';
import { FieldVoiceSpeaker } from '../common/FieldVoiceSpeaker';
import type { FarmerProfile } from '../../types/models';

interface FarmerLookupGateProps {
  onFarmerVerified: (farmer: FarmerProfile) => void;
}

export const FarmerLookupGate: React.FC<FarmerLookupGateProps> = ({ onFarmerVerified }) => {
  const { t, language } = useTranslation();

  // Mode: 'lookup' (Khasra / Reg ID) or 'signup' (Phone only)
  const [authMode, setAuthMode] = useState<'lookup' | 'signup'>('lookup');

  // Lookup state
  const [lookupValue, setLookupValue] = useState('');
  const [consentChecked, setConsentChecked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signup State
  const [signupPhone, setSignupPhone] = useState('');
  const [signupOtp, setSignupOtp] = useState('');
  const [signupKhasra, setSignupKhasra] = useState('');
  const [signupStep, setSignupStep] = useState<'phone' | 'otp'>('phone');
  const [incomingSmsOtp, setIncomingSmsOtp] = useState<string | null>(null);

  // Execute lookup
  const executeLookup = async (inputStr: string) => {
    setError(null);
    const cleaned = inputStr.trim();
    if (!cleaned) {
      setError(
        language === 'chh'
          ? 'कृपया खसरा नंबर या किसान पंजीयन नंबर दर्ज करव।'
          : language === 'hi'
          ? 'कृपया खसरा नंबर अथवा पंजीयन क्रमांक दर्ज करें।'
          : 'Please enter Khasra Number or Farmer Registration Number.'
      );
      return;
    }

    if (!consentChecked) {
      setError(
        language === 'chh'
          ? 'रिकॉर्ड देखे बर सहमति चेकबॉक्स म टिक करव।'
          : language === 'hi'
          ? 'कृपया रिकॉर्ड प्राप्त करने हेतु सहमति चेकबॉक्स पर टिक करें।'
          : 'Please check the consent box to fetch records.'
      );
      return;
    }

    setLoading(true);
    try {
      // Map CG-F001 -> F-001, CG-F002 -> F-002
      let regId = cleaned.replace(/^CG-/, '');
      let khasraParam = cleaned;
      if (cleaned.toUpperCase().includes('CG-F') || cleaned.toUpperCase().startsWith('F-')) {
        khasraParam = '';
      }

      const res = await loginWithKhasra(khasraParam || '142/1', regId || undefined);
      onFarmerVerified(res.farmer);
    } catch (err: any) {
      setError(
        err.message ||
          (language === 'chh'
            ? 'रिकॉर्ड नइ मिलीस। अपन खसरा नंबर फिर ले जाँचव।'
            : language === 'hi'
            ? 'रिकॉर्ड नहीं मिला। कृपया खसरा संख्या पुनः जांचें।'
            : 'Record not found. Please verify your Khasra number.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLookup(lookupValue);
  };

  // Signup Handlers
  const handleSignupSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[6-9]\d{9}$/.test(signupPhone.trim())) {
      setError(
        language === 'chh'
          ? 'कृपया सही 10-अंक के मोबाइल नंबर लिखव।'
          : language === 'hi'
          ? 'कृपया वैध 10-अंकों का मोबाइल नंबर दर्ज करें।'
          : 'Please enter a valid 10-digit mobile number.'
      );
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

  const handleSignupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!signupOtp.trim() || signupOtp.trim().length !== 6) {
      setError(language === 'chh' ? 'कृपया 6 अंक के ओटीपी लिखव।' : language === 'hi' ? 'कृपया 6 अंकों का ओटीपी दर्ज करें।' : 'Please enter 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      const res = await signupVerifyOtp({
        mobile: signupPhone.trim(),
        otp: signupOtp.trim(),
        khasra_no: signupKhasra.trim() || undefined,
      });
      onFarmerVerified(res.farmer);
    } catch (err: any) {
      setError(err.message || 'Signup verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pt-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Top Flag Strip */}
        <div className="h-2 bg-gradient-to-r from-orange-500 via-white to-green-600" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {language === 'chh' ? 'छत्तीसगढ़ किसान पहचान गेट' : language === 'hi' ? 'छत्तीसगढ़ किसान पहचान गेट' : 'Chhattisgarh Farmer Identification Gate'}
              </span>
            </span>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {authMode === 'lookup'
                ? (language === 'chh' ? 'किसान रिकॉर्ड खोजव' : language === 'hi' ? 'किसान रिकॉर्ड खोजें' : 'Farmer Record Lookup')
                : (language === 'chh' ? 'नवा किसान पंजीयन (Sign Up)' : language === 'hi' ? 'नया किसान पंजीकरण (Sign Up)' : 'New Farmer Registration')}
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              {authMode === 'lookup'
                ? (language === 'chh'
                    ? 'अपन भुइयां के खसरा नंबर या किसान कोड दर्ज कर अपन सबो अधिकार अउ डीबीटी स्थिति जानव।'
                    : language === 'hi'
                    ? 'अपनी भूमि का खसरा नंबर अथवा किसान कोड दर्ज कर अपने सभी अधिकार एवं डीबीटी स्थिति जानें।'
                    : 'Enter your land Khasra Number or Farmer Registration Code to verify statutory entitlements.')
                : (language === 'chh'
                    ? 'अपन मोबाइल नंबर डाल के तुरंत खाता बनावव।'
                    : language === 'hi'
                    ? 'केवल अपना मोबाइल नंबर दर्ज कर तुरंत खाता बनाएं।'
                    : 'Enter your 10-digit mobile number to register instantly.')}
            </p>
          </div>

          {/* SMS Notification Banner for Signup */}
          {incomingSmsOtp && authMode === 'signup' && (
            <div className="p-3.5 rounded-2xl bg-blue-50 border-2 border-blue-400 text-blue-950 text-xs shadow-sm flex items-start gap-2.5 animate-bounce">
              <BellRing className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  📩 {language === 'en' ? 'SMS Alert [Govt-OTP]:' : 'एसएमएस अलर्ट [Govt-OTP]:'}
                </span>
                <span>
                  {language === 'chh'
                    ? 'कृषि पारदर्शिता पोर्टल सत्यापन कोड: '
                    : language === 'hi'
                    ? 'कृषि पारदर्शिता पोर्टल सत्यापन कोड: '
                    : 'Agri Transparency verification OTP: '}
                  <strong className="text-sm font-mono text-blue-900 bg-blue-200/80 px-2 py-0.5 rounded tracking-widest">
                    {incomingSmsOtp}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSignupOtp(incomingSmsOtp)}
                  className="block text-xs font-bold text-blue-700 underline mt-1 cursor-pointer"
                >
                  {language === 'chh' ? 'कोड अपने-आप भरव (Auto-Fill)' : language === 'hi' ? 'कोड स्वतः भरें (Auto-Fill)' : 'Auto-Fill Code'}
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── MODE 1: LOOKUP FORM ─────────────────────────────────── */}
          {authMode === 'lookup' && (
            <form onSubmit={handleLookupSubmit} className="space-y-5">
              {/* Khasra / Reg Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-700" />
                    <span>
                      {language === 'chh'
                        ? 'खसरा नंबर या किसान पंजीयन संख्या *'
                        : language === 'hi'
                        ? 'खसरा नंबर अथवा किसान पंजीयन क्रमांक *'
                        : 'Khasra Number OR Farmer Registration No. *'}
                    </span>
                  </label>
                  <FieldVoiceSpeaker
                    textHi="कृपया अपनी भूमि का खसरा क्रमांक अथवा किसान पंजीयन क्रमांक दर्ज करें।"
                    textEn="Please enter your land Khasra number or farmer registration number."
                  />
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    value={lookupValue}
                    onChange={(e) => setLookupValue(e.target.value)}
                    placeholder={
                      language === 'en'
                        ? 'e.g. 142/1 or F-001 / CG-F001'
                        : 'उदा. 142/1 अथवा F-001 / CG-F001'
                    }
                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none transition-all"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
              </div>

              {/* DPDP Consent Checkbox */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs text-slate-700 leading-relaxed">
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
                    ? (language === 'chh' ? 'रिकॉर्ड लोड होवत हे...' : language === 'hi' ? 'रिकॉर्ड लोड हो रहा है...' : 'Fetching Records...')
                    : (language === 'chh' ? 'मोर हक जानव' : language === 'hi' ? 'मेरा हक जानें' : 'Check My Entitlements')}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Sign Up Link */}
              <div className="pt-4 border-t border-slate-100 text-center">
                <span className="text-xs text-slate-500">
                  {language === 'chh' ? 'खाता नइ हे?' : language === 'hi' ? 'खाता नहीं है?' : "Don't have an account?"}{' '}
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

          {/* ── MODE 2: SIGNUP FORM ─────────────────────────────────── */}
          {authMode === 'signup' && (
            <div className="space-y-4">
              {signupStep === 'phone' ? (
                <form onSubmit={handleSignupSendOtp} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{language === 'chh' ? 'मोबाइल नंबर *' : language === 'hi' ? 'मोबाइल नंबर *' : 'Mobile Number *'}</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="9876543210"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      {language === 'chh'
                        ? 'हम ए नंबर म 6-अंक के असली ओटीपी कोड भेजबो।'
                        : language === 'hi'
                        ? 'हम इस नंबर पर वास्तविक 6-अंकीय सत्यापन कोड भेजेंगे।'
                        : 'We will send a working 6-digit verification OTP to this phone.'}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>{language === 'chh' ? 'खसरा क्रमांक (वैकल्पिक)' : language === 'hi' ? 'खसरा क्रमांक (वैकल्पिक)' : 'Khasra No. (Optional)'}</span>
                    </label>
                    <input
                      type="text"
                      placeholder="उदा. 101/A"
                      value={signupKhasra}
                      onChange={(e) => setSignupKhasra(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || signupPhone.length !== 10}
                    className="w-full py-3.5 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-50 cursor-pointer"
                  >
                    <span>{loading ? t('app.loading') : (language === 'chh' ? 'ओटीपी सत्यापन कोड भेजव' : language === 'hi' ? 'ओटीपी सत्यापन कोड भेजें' : 'Send Verification OTP')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignupVerify} className="space-y-4">
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
                  </div>

                  <button
                    type="submit"
                    disabled={loading || signupOtp.length !== 6}
                    className="w-full py-3.5 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 min-h-[48px] disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{loading ? t('app.loading') : (language === 'chh' ? 'सत्यापित करके खाता बनावव' : language === 'hi' ? 'सत्यापित कर खाता बनाएं' : 'Verify & Complete Signup')}</span>
                  </button>
                </form>
              )}

              {/* Back to Lookup */}
              <div className="pt-3 text-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setAuthMode('lookup');
                  }}
                  className="font-bold text-emerald-700 hover:underline text-xs inline-flex items-center gap-1 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{language === 'chh' ? 'खसरा खोज म वापस जावव' : language === 'hi' ? 'खसरा खोज पर वापस जाएं' : 'Back to Khasra Lookup'}</span>
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
