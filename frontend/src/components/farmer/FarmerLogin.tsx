import React, { useState } from 'react';
import {
  FileText,
  Phone,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  UserPlus,
  LogIn,
  Check,
  BellRing
} from 'lucide-react';
import { loginWithKhasra, signupSendOtp, signupVerifyOtp, sendOtp, verifyOtp } from '../../services/api';
import { useTranslation } from '../../i18n';
import { FieldVoiceSpeaker } from '../common/FieldVoiceSpeaker';

interface FarmerLoginProps {
  onLoginSuccess: (farmer: any) => void;
}

export const FarmerLogin: React.FC<FarmerLoginProps> = ({ onLoginSuccess }) => {
  const { t, language } = useTranslation();

  // Mode: 'khasra' (default), 'signup', or 'mobile_otp'
  const [authMode, setAuthMode] = useState<'khasra' | 'signup' | 'mobile_otp'>('khasra');

  // Khasra Login State
  const [khasraNo, setKhasraNo] = useState('142/1');
  const [registryNo, setRegistryNo] = useState('F-001');

  // Signup State
  const [signupPhone, setSignupPhone] = useState('');
  const [signupOtp, setSignupOtp] = useState('');
  const [signupKhasra, setSignupKhasra] = useState('');
  const [signupStep, setSignupStep] = useState<'phone' | 'otp'>('phone');
  const [incomingSmsOtp, setIncomingSmsOtp] = useState<string | null>(null);

  // Standard Mobile OTP Login State
  const [mobile, setMobile] = useState('9876543210');
  const [otp, setOtp] = useState('123456');
  const [otpStep, setOtpStep] = useState<'mobile' | 'otp'>('mobile');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(true);

  // ── Handler: Khasra + Registry Login ──────────────────────────────
  const handleKhasraLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!khasraNo.trim()) {
      setError(language === 'chh' ? 'खसरा नंबर दर्ज करव।' : language === 'hi' ? 'कृपया खसरा क्रमांक दर्ज करें।' : 'Please enter Khasra Number.');
      return;
    }
    setLoading(true);
    try {
      const res = await loginWithKhasra(khasraNo.trim(), registryNo.trim() || undefined);
      onLoginSuccess(res.farmer);
    } catch (err: any) {
      setError(err.message || (language === 'chh' ? 'लॉगिन विफल। अपन खसरा नंबर जाँचव।' : language === 'hi' ? 'लॉगिन विफल। कृपया खसरा नंबर जांचें।' : 'Login failed. Please check Khasra number or Sign Up.'));
    } finally {
      setLoading(false);
    }
  };

  // ── Handler: Signup Step 1 (Send Real OTP to Phone) ───────────────
  const handleSignupSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[6-9]\d{9}$/.test(signupPhone.trim())) {
      setError(language === 'chh' ? 'कृपया सही 10-अंक के मोबाइल नंबर लिखव।' : language === 'hi' ? 'कृपया वैध 10-अंकों का मोबाइल नंबर दर्ज करें।' : 'Please enter a valid 10-digit mobile number.');
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

  // ── Handler: Signup Step 2 (Verify OTP & Register Farmer) ─────────
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
      onLoginSuccess(res.farmer);
    } catch (err: any) {
      setError(err.message || 'Signup verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handler: Mobile OTP Login ─────────────────────────────────────
  const handleSendMobileOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      await sendOtp(mobile);
      setOtpStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMobileOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await verifyOtp(mobile, otp);
      onLoginSuccess(res.farmer);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* JanPortal-inspired Tricolor & Title Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-surface-border overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-white to-green-600" />
        <div className="p-6 text-center space-y-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-agri-light/60 text-agri-dark border border-agri-dark/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            {language === 'chh' ? 'छत्तीसगढ़ शासन • पारदर्शी किसान सेवा' : language === 'hi' ? 'छत्तीसगढ़ शासन • आधिकारिक पारदर्शिता सेवा' : 'Govt of Chhattisgarh • Official Citizen Portal'}
          </span>
          <h2 className="text-2xl font-extrabold text-text-primary mt-2">
            {authMode === 'signup'
              ? (language === 'chh' ? 'नवा किसान पंजीयन (Sign Up)' : language === 'hi' ? 'नया किसान पंजीकरण (Sign Up)' : 'New Farmer Registration')
              : (language === 'chh' ? 'किसान लॉगिन (Farmer Login)' : language === 'hi' ? 'किसान लॉगिन (Farmer Login)' : 'Farmer Login')}
          </h2>
          <p className="text-xs text-text-secondary">
            {authMode === 'signup'
              ? (language === 'chh' ? 'अपन मोबाइल नंबर डाल के तुरंत खाता बनावव' : language === 'hi' ? 'केवल अपना मोबाइल नंबर दर्ज कर तुरंत खाता बनाएं' : 'Enter your mobile number to register instantly')
              : (language === 'chh' ? 'अपन भुइयां के खसरा नंबर अउ पंजीयन संख्या लिखव' : language === 'hi' ? 'अपनी भूमि का खसरा नंबर एवं पंजीयन क्रमांक दर्ज करें' : 'Enter your land Khasra and Registry number to verify records')}
          </p>
        </div>

        {/* Incoming SMS Notification Toast (Simulation of real SMS delivery) */}
        {incomingSmsOtp && authMode === 'signup' && (
          <div className="mx-6 mb-4 p-3.5 rounded-xl bg-blue-50 border-2 border-blue-400 text-blue-950 text-xs shadow-sm flex items-start gap-2.5 animate-bounce">
            <BellRing className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">
                📩 {language === 'en' ? 'SMS Alert [Govt-OTP]:' : 'एसएमएस अलर्ट [Govt-OTP]:'}
              </span>
              <span>
                {language === 'chh'
                  ? `कृषि पारदर्शिता पोर्टल बर तुंहर 6-अंक के सत्यापन कोड हे: `
                  : language === 'hi'
                  ? `कृषि पारदर्शिता पोर्टल हेतु आपका 6-अंकीय सत्यापन कोड है: `
                  : `Your 6-digit verification code for Agri-Transparency is: `}
                <strong className="text-sm font-mono text-blue-900 bg-blue-200/80 px-2 py-0.5 rounded tracking-widest">
                  {incomingSmsOtp}
                </strong>
                {' '}({language === 'en' ? 'Valid for 5 mins' : 'मान्य: 5 मिनट'})
              </span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mb-4 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium">
            {error}
          </div>
        )}

        {/* ── MODE 1: KHASRA NO. & REGISTRY NO. LOGIN (Default) ──────── */}
        {authMode === 'khasra' && (
          <form onSubmit={handleKhasraLogin} className="p-6 pt-0 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-agri-dark" />
                  <span>{language === 'chh' ? 'खसरा क्रमांक (Khasra No.) *' : language === 'hi' ? 'खसरा क्रमांक (Khasra No.) *' : 'Khasra Number *'}</span>
                </label>
                <FieldVoiceSpeaker
                  textHi="कृपया अपनी भूमि का खसरा क्रमांक दर्ज करें, जैसे एक सौ बयालीस बटा एक या अठासी बटा दो।"
                  textEn="Please enter your land Khasra number, for example 142/1 or 88/2."
                />
              </div>
              <input
                type="text"
                required
                placeholder={language === 'en' ? 'e.g. 142/1 or 88/2' : 'उदा. 142/1 या 88/2'}
                value={khasraNo}
                onChange={(e) => setKhasraNo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border bg-white text-sm font-semibold focus:border-agri-dark focus:ring-1 focus:ring-agri-dark"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-agri-dark" />
                  <span>{language === 'chh' ? 'पंजीयन संख्या / किसान कोड' : language === 'hi' ? 'पंजीयन संख्या / किसान कोड (Registry No.)' : 'Registry / B-I Record No.'}</span>
                </label>
                <FieldVoiceSpeaker
                  textHi="अपना किसान पंजीयन क्रमांक अथवा भुइयां रिकॉर्ड संख्या दर्ज करें।"
                  textEn="Enter your farmer registration or Bhuiyan record number."
                />
              </div>
              <input
                type="text"
                placeholder={language === 'en' ? 'e.g. F-001 or B-I ID' : 'उदा. F-001 या पंजीयन संख्या'}
                value={registryNo}
                onChange={(e) => setRegistryNo(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border bg-white text-sm font-semibold focus:border-agri-dark focus:ring-1 focus:ring-agri-dark"
              />
            </div>

            {/* Consent checkbox */}
            <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 rounded text-agri-dark focus:ring-agri-dark"
              />
              <span className="text-xs text-text-secondary leading-snug">
                {language === 'chh'
                  ? 'हम भुइयां जमीन रिकॉर्ड, केसीसी अउ धान उपार्जन पारदर्शिता जाँच बर सहमति देथन।'
                  : language === 'hi'
                  ? 'मैं भुइयां भूमि रिकॉर्ड, केसीसी एवं उपार्जन पारदर्शिता जाँच हेतु डेटा पढ़ने की सहमति देता हूँ।'
                  : 'I grant read-only consent to verify Bhuiyan land, KCC loan, and procurement entitlements.'}
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !consentChecked}
              className="w-full py-3.5 px-4 rounded-xl bg-agri-dark text-white font-bold text-sm hover:bg-agri-primary transition-colors flex items-center justify-center gap-2 shadow-sm min-h-[48px] disabled:opacity-50 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? t('app.loading') : (language === 'chh' ? 'खसरा ले लॉगिन करव' : language === 'hi' ? 'खसरा द्वारा लॉगिन करें' : 'Login with Khasra')}</span>
            </button>

            {/* "Not have an account? Sign Up" link */}
            <div className="pt-3 text-center border-t border-surface-border space-y-2">
              <div className="text-xs text-text-secondary">
                {language === 'chh' ? 'खाता नइ हे?' : language === 'hi' ? 'खाता नहीं है?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setAuthMode('signup');
                  }}
                  className="font-bold text-agri-dark hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{language === 'chh' ? 'नवा पंजीयन करव (Sign Up)' : language === 'hi' ? 'नया पंजीकरण करें (Sign Up)' : 'Sign Up here'}</span>
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setAuthMode('mobile_otp');
                  }}
                  className="text-xs text-text-muted hover:text-agri-dark hover:underline cursor-pointer"
                >
                  {language === 'chh' ? 'या मोबाइल ओटीपी ले लॉगिन करव' : language === 'hi' ? 'या मोबाइल ओटीपी से लॉगिन करें' : 'Or login with Mobile OTP'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── MODE 2: SIGN UP WITH PHONE NUMBER ONLY ─────────────────── */}
        {authMode === 'signup' && (
          <div className="p-6 pt-0 space-y-4">
            {signupStep === 'phone' ? (
              <form onSubmit={handleSignupSendOtp} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-agri-dark" />
                      <span>{language === 'chh' ? 'मोबाइल नंबर (Phone Number) *' : language === 'hi' ? 'मोबाइल नंबर (Phone Number) *' : 'Phone Number *'}</span>
                    </label>
                    <FieldVoiceSpeaker
                      textHi="नया खाता बनाने के लिए अपना दस अंकों का मोबाइल नंबर दर्ज करें जिस पर सत्यापन कोड भेजा जाएगा।"
                      textEn="Enter your 10-digit mobile number to receive a verification OTP."
                    />
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border bg-white text-sm font-semibold focus:border-agri-dark"
                  />
                  <p className="text-[11px] text-text-muted mt-1">
                    {language === 'chh'
                      ? 'हम ए नंबर म 6-अंक के असली ओटीपी कोड भेजबो।'
                      : language === 'hi'
                      ? 'हम इस नंबर पर 6-अंकीय वास्तविक ओटीपी कोड भेजेंगे।'
                      : 'We will send a working 6-digit OTP verification code to this number.'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-text-muted" />
                      <span>{language === 'chh' ? 'खसरा क्रमांक (वैकल्पिक)' : language === 'hi' ? 'खसरा क्रमांक (वैकल्पिक / Optional)' : 'Initial Khasra No. (Optional)'}</span>
                    </label>
                    <FieldVoiceSpeaker
                      textHi="यदि आपके पास खसरा संख्या है तो यहाँ दर्ज करें, अन्यथा स्वतः आवंटित की जाएगी।"
                      textEn="Enter your Khasra number if available, or it will be assigned automatically."
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="उदा. 101/A"
                    value={signupKhasra}
                    onChange={(e) => setSignupKhasra(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-border bg-white text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || signupPhone.length !== 10}
                  className="w-full py-3.5 px-4 rounded-xl bg-agri-dark text-white font-bold text-sm hover:bg-agri-primary transition-colors flex items-center justify-center gap-2 shadow-sm min-h-[48px] disabled:opacity-50 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>{loading ? t('app.loading') : (language === 'chh' ? 'ओटीपी सत्यापन कोड भेजव' : language === 'hi' ? 'ओटीपी सत्यापन कोड भेजें' : 'Send Verification OTP')}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignupVerify} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-agri-dark" />
                      <span>{language === 'chh' ? '6-अंक के ओटीपी कोड लिखव' : language === 'hi' ? '6-अंकीय ओटीपी कोड दर्ज करें' : 'Enter 6-digit OTP Code'}</span>
                    </label>
                    <FieldVoiceSpeaker
                      textHi="अपने मोबाइल पर प्राप्त छह अंकों का ओटीपी यहाँ दर्ज करें।"
                      textEn="Enter the 6-digit OTP received on your phone."
                    />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={signupOtp}
                    onChange={(e) => setSignupOtp(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-surface-border bg-white text-center text-lg font-mono font-bold tracking-widest focus:border-agri-dark"
                  />
                  {incomingSmsOtp && (
                    <button
                      type="button"
                      onClick={() => setSignupOtp(incomingSmsOtp)}
                      className="text-xs text-agri-dark hover:underline mt-1 font-semibold block cursor-pointer"
                    >
                      {language === 'en' ? `Auto-fill code: ${incomingSmsOtp}` : `ऑटो-फ़िल कोड: ${incomingSmsOtp}`}
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || signupOtp.length !== 6}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2 shadow-sm min-h-[48px] disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{loading ? t('app.loading') : (language === 'chh' ? 'सत्यापित करके खाता बनावव' : language === 'hi' ? 'सत्यापित कर खाता बनाएं' : 'Verify & Complete Signup')}</span>
                </button>
              </form>
            )}

            {/* Back to Login link */}
            <div className="pt-3 text-center border-t border-surface-border">
              <span className="text-xs text-text-secondary">
                {language === 'chh' ? 'पहिली ले खाता हे?' : language === 'hi' ? 'पहले से खाता है?' : 'Already have an account?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setAuthMode('khasra');
                  }}
                  className="font-bold text-agri-dark hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{language === 'chh' ? 'लॉगिन करव (Log In)' : language === 'hi' ? 'लॉगिन करें (Log In)' : 'Log In here'}</span>
                </button>
              </span>
            </div>
          </div>
        )}

        {/* ── MODE 3: MOBILE + OTP LOGIN ─────────────────────────────── */}
        {authMode === 'mobile_otp' && (
          <div className="p-6 pt-0 space-y-4">
            {otpStep === 'mobile' ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-text-primary">
                      {t('auth.mobile_label')}
                    </label>
                    <FieldVoiceSpeaker
                      textHi="अपना दस अंकों का पंजीकृत मोबाइल नंबर दर्ज करें।"
                      textEn="Enter your registered 10-digit mobile number."
                    />
                  </div>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-surface-border bg-white text-sm font-semibold focus:border-agri-dark"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendMobileOtp}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-agri-dark text-white font-bold text-sm hover:bg-agri-primary"
                >
                  {t('auth.send_otp')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-text-primary">
                      {t('auth.otp_title')}
                    </label>
                    <FieldVoiceSpeaker
                      textHi="प्राप्त छह अंकों का ओटीपी कोड दर्ज करें।"
                      textEn="Enter the 6-digit OTP code."
                    />
                  </div>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl border border-surface-border bg-white text-center text-lg font-mono font-bold tracking-widest"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleVerifyMobileOtp}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-800"
                >
                  {t('auth.verify_otp')}
                </button>
              </div>
            )}

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setAuthMode('khasra')}
                className="text-xs text-agri-dark font-bold hover:underline"
              >
                {language === 'chh' ? '← खसरा लॉगिन म वापस जावव' : language === 'hi' ? '← खसरा लॉगिन पर वापस जाएं' : '← Back to Khasra Login'}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
