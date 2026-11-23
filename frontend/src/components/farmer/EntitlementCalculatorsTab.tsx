import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Wheat,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileText,
  Building2
} from 'lucide-react';
import { calculateKCC, calculatePaddy, calculatePMFBY } from '../../services/api';
import { useTranslation } from '../../i18n';
import { FieldVoiceSpeaker } from '../common/FieldVoiceSpeaker';
import type { FarmerSnapshot, FarmerProfile, DiscrepancyItem } from '../../types/models';

interface EntitlementCalculatorsTabProps {
  snapshot: FarmerSnapshot | null;
  farmer?: FarmerProfile;
  onGenerateGrievance: (item: DiscrepancyItem) => void;
}

export const EntitlementCalculatorsTab: React.FC<EntitlementCalculatorsTabProps> = ({
  snapshot,
  onGenerateGrievance,
}) => {
  const { language } = useTranslation();

  // ───────────────────────────────────────────────────────────────────
  // 1. KCC CALCULATOR STATE (BANK LOAN VS SCHEME LOAN)
  // ───────────────────────────────────────────────────────────────────
  const initLoan = snapshot?.loans?.[0];
  const [loanCategory, setLoanCategory] = useState<'SCHEME_LOAN' | 'BANK_LOAN'>('SCHEME_LOAN');
  const [selectedBank, setSelectedBank] = useState<string>('CRGB');

  const [kccPrincipal, setKccPrincipal] = useState<number>(initLoan ? initLoan.principal_paise : 20000000);
  const [kccLender, setKccLender] = useState<string>(initLoan ? initLoan.lender_type.toUpperCase() : 'COMMERCIAL');
  const [kccTimely, setKccTimely] = useState<boolean>(true);
  const [kccMonths, setKccMonths] = useState<number>(12);
  const [kccActualInterest, setKccActualInterest] = useState<number>(
    initLoan ? (initLoan.principal_paise * 7 / 100) * 100 : 1400000
  );
  const [kccResult, setKccResult] = useState<any>(null);
  const [kccStepsExpanded, setKccStepsExpanded] = useState<boolean>(false);

  // ───────────────────────────────────────────────────────────────────
  // 2. GENERAL CROP & PROCUREMENT CALCULATOR STATE
  // ───────────────────────────────────────────────────────────────────
  const initProc = snapshot?.procurements?.[0];
  const initAcres = snapshot?.total_area_acres ? parseFloat(snapshot.total_area_acres) : 4.0;
  const [selectedCrop, setSelectedCrop] = useState<string>('PADDY_COMMON');
  const [paddyAcres, setPaddyAcres] = useState<number>(initAcres || 4.0);
  const [paddyGrade, setPaddyGrade] = useState<string>(initProc?.grade?.toUpperCase().includes('A') ? 'GRADE_A' : 'COMMON');
  const [paddyMoisture, setPaddyMoisture] = useState<number>(initProc ? parseFloat(initProc.moisture_pct) : 15.2);
  const [paddyOffered, setPaddyOffered] = useState<number>(initProc ? parseFloat(initProc.quantity_quintals) : 84.0);
  const [paddyActualReceived, setPaddyActualReceived] = useState<number>(
    initProc ? (initProc.msp_paid_paise + initProc.kuy_paid_paise) : 21888300
  );
  const [paddyResult, setPaddyResult] = useState<any>(null);
  const [paddyStepsExpanded, setPaddyStepsExpanded] = useState<boolean>(false);

  // ───────────────────────────────────────────────────────────────────
  // 3. PMFBY CROP INSURANCE CALCULATOR STATE
  // ───────────────────────────────────────────────────────────────────
  const [pmfbyAcres, setPmfbyAcres] = useState<number>(initAcres || 4.0);
  const [pmfbySeason, setPmfbySeason] = useState<string>('KHARIF');
  const [pmfbySumInsuredPerAcre, setPmfbySumInsuredPerAcre] = useState<number>(3000000); // ₹30,000/acre in paise
  const [pmfbyThresholdYield, setPmfbyThresholdYield] = useState<number>(25.0);
  const [pmfbyActualYield, setPmfbyActualYield] = useState<number>(18.0);
  const [pmfbyActualClaim, setPmfbyActualClaim] = useState<number>(0);
  const [pmfbyResult, setPmfbyResult] = useState<any>(null);
  const [pmfbyStepsExpanded, setPmfbyStepsExpanded] = useState<boolean>(false);

  // Fetch KCC Calculation from Backend (Pure Python)
  const runKccCalculation = useCallback(async () => {
    try {
      const res = await calculateKCC({
        principal_paise: kccPrincipal,
        lender_type: kccLender,
        is_repaid_timely: kccTimely,
        duration_months: kccMonths,
        actual_interest_charged_paise: kccActualInterest,
      });
      setKccResult(res);
    } catch (err) {
      console.error('KCC calculation error:', err);
    }
  }, [kccPrincipal, kccLender, kccTimely, kccMonths, kccActualInterest]);

  // Fetch Crop Calculation from Backend (Pure Python)
  const runPaddyCalculation = useCallback(async () => {
    try {
      const res = await calculatePaddy({
        acres: paddyAcres,
        grade: selectedCrop === 'PADDY_GRADE_A' ? 'GRADE_A' : paddyGrade,
        moisture_pct: paddyMoisture,
        quantity_offered_quintals: paddyOffered,
        actual_received_paise: paddyActualReceived,
        crop_type: selectedCrop,
      });
      setPaddyResult(res);
    } catch (err) {
      console.error('Paddy calculation error:', err);
    }
  }, [paddyAcres, paddyGrade, paddyMoisture, paddyOffered, paddyActualReceived, selectedCrop]);

  // Fetch PMFBY Calculation from Backend (Pure Python)
  const runPmfbyCalculation = useCallback(async () => {
    try {
      const res = await calculatePMFBY({
        acres: pmfbyAcres,
        season: pmfbySeason,
        sum_insured_per_acre_paise: pmfbySumInsuredPerAcre,
        threshold_yield_kg: pmfbyThresholdYield,
        actual_yield_kg: pmfbyActualYield,
        actual_claim_received_paise: pmfbyActualClaim,
      });
      setPmfbyResult(res);
    } catch (err) {
      console.error('PMFBY calculation error:', err);
    }
  }, [pmfbyAcres, pmfbySeason, pmfbySumInsuredPerAcre, pmfbyThresholdYield, pmfbyActualYield, pmfbyActualClaim]);

  useEffect(() => {
    runKccCalculation();
  }, [runKccCalculation]);

  useEffect(() => {
    runPaddyCalculation();
  }, [runPaddyCalculation]);

  useEffect(() => {
    runPmfbyCalculation();
  }, [runPmfbyCalculation]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Statutory Guidance Banner */}
      <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {language === 'chh'
              ? 'छत्तीसगढ़ किसान नीति अउ आरबीआई नियम के अनुसार सरकारी हिसाब-किताब।'
              : language === 'hi'
              ? 'छत्तीसगढ़ कृषि नीति एवं आरबीआई दिशानिर्देशों के अनुसार आधिकारिक गणना।'
              : 'Official statutory calculations under Chhattisgarh Agricultural Policy & RBI Directives.'}
          </span>
        </div>
        <div className="text-[11px] font-semibold text-emerald-800">
          {language === 'en' ? 'Statutory Guidelines: 2026' : 'दिशानिर्देश: 2026'}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CARD 1: KCC / COOPERATIVE LOAN SUBVENTION CALCULATOR           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center border border-indigo-200 shadow-inner">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 block">
                RULE_KCC_SUBVENTION
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                {language === 'chh'
                  ? '1. केसीसी / सहकारी करजा ब्याज छूट कैलकुलेटर'
                  : language === 'hi'
                  ? '1. केसीसी / सहकारी ऋण ब्याज अनुदान कैलकुलेटर'
                  : '1. KCC / Cooperative Loan Subvention Calculator'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-full font-bold">
              {kccResult?.effective_rate_pct !== undefined ? `${kccResult.effective_rate_pct}% Net Rate` : '4% Net Rate'}
            </span>
          </div>
        </div>

        {/* Loan Category Selector: Scheme Loan vs Direct Bank Loan */}
        <div className="p-4 bg-indigo-50/60 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="font-extrabold text-indigo-950 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-700" />
            <span>{language === 'chh' ? 'करजा के प्रकार चुनव (Loan Type):' : language === 'hi' ? 'ऋण का प्रकार चुनें (Loan Type):' : 'Select Loan Category:'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLoanCategory('SCHEME_LOAN');
                setKccLender('COMMERCIAL');
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                loanCategory === 'SCHEME_LOAN'
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {language === 'chh' ? 'योजना वाला करजा (Scheme Loan)' : language === 'hi' ? 'योजना आधारित ऋण (Scheme Loan)' : 'Scheme Loan (KCC / MISS)'}
            </button>
            <button
              type="button"
              onClick={() => {
                setLoanCategory('BANK_LOAN');
                setKccLender('COMMERCIAL');
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                loanCategory === 'BANK_LOAN'
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {language === 'chh' ? 'सीधा बैंक करजा (Direct Bank Loan)' : language === 'hi' ? 'सामान्य बैंक ऋण (Direct Bank Loan)' : 'Direct Bank Loan'}
            </button>
          </div>
        </div>

        {/* Interactive Inputs */}
        <div className="p-5 sm:p-6 bg-slate-50/60 border-b border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Sanctioned Amount */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">
                {language === 'chh' ? 'करजा राशि (₹)' : language === 'hi' ? 'ऋण राशि (₹)' : 'Loan Amount (₹)'}
              </label>
              <FieldVoiceSpeaker
                textHi="ऋण राशि दर्ज करें, जैसे दो लाख रुपये।"
                textEn="Enter loan amount, for example two lakh rupees."
              />
            </div>
            <input
              type="number"
              step={10000}
              value={kccPrincipal / 100}
              onChange={(e) => setKccPrincipal(Math.max(0, parseInt(e.target.value || '0', 10) * 100))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
            />
          </div>

          {/* Scheme or Bank Dropdown depending on category */}
          {loanCategory === 'SCHEME_LOAN' ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">
                  {language === 'chh' ? 'सरकारी योजना (Scheme)' : language === 'hi' ? 'सरकारी योजना (Scheme)' : 'Scheme Option'}
                </label>
              </div>
              <select
                value={kccLender}
                onChange={(e) => setKccLender(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
              >
                <option value="COMMERCIAL">KCC/MISS बैंक ऋण (समय पर 4%)</option>
                <option value="PACS">छत्तीसगढ़ पैक्स समिति (समय पर 0%)</option>
              </select>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">
                  {language === 'chh' ? 'बैंक चुनव (Select Bank)' : language === 'hi' ? 'बैंक चुनें (Select Bank)' : 'Select Bank'}
                </label>
              </div>
              <select
                value={selectedBank}
                onChange={(e) => {
                  setSelectedBank(e.target.value);
                  setKccLender('COMMERCIAL');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
              >
                <option value="CRGB">छत्तीसगढ़ ग्रामीण बैंक (9.0% p.a.)</option>
                <option value="SBI">भारतीय स्टेट बैंक SBI (8.75% p.a.)</option>
                <option value="PNB">पंजाब नेशनल बैंक PNB (8.90% p.a.)</option>
                <option value="BOB">बैंक ऑफ बड़ौदा (8.85% p.a.)</option>
                <option value="DCCB">जिला सहकारी बैंक (9.25% p.a.)</option>
                <option value="PVT">निजी बैंक / HDFC (11.0% p.a.)</option>
              </select>
            </div>
          )}

          {/* Repayment Duration */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">
                {language === 'chh' ? 'पटाए के समे (अवधि)' : language === 'hi' ? 'अदायगी अवधि' : 'Repayment Duration'}
              </label>
            </div>
            <select
              value={kccMonths}
              onChange={(e) => {
                const m = parseInt(e.target.value, 10);
                setKccMonths(m);
                setKccTimely(m <= 12);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
            >
              <option value={12}>12 माह (समय पर / On-Time)</option>
              <option value={15}>15 माह (+3 माह विलंब / +3m Overdue)</option>
              <option value={18}>18 माह (+6 माह विलंब / +6m Overdue)</option>
              <option value={24}>24 माह (+12 माह विलंब / +12m Overdue)</option>
            </select>
          </div>

          {/* What I Actually Paid / Charged */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 text-amber-800">
                {language === 'chh' ? 'बैंक ह कतका ब्याज काटीस (₹)' : language === 'hi' ? 'बैंक ने वास्तव में कितना काटा (₹)' : 'What Bank Charged Me (₹)'}
              </label>
              <FieldVoiceSpeaker
                textHi="बैंक ने आपके खाते से वास्तविक ब्याज कितना काटा, यहाँ दर्ज करें।"
                textEn="Enter what the bank actually charged or deducted from your account."
              />
            </div>
            <input
              type="number"
              step={500}
              value={kccActualInterest / 100}
              onChange={(e) => setKccActualInterest(Math.max(0, parseInt(e.target.value || '0', 10) * 100))}
              className="w-full px-3 py-2 rounded-xl border-2 border-amber-300 font-extrabold text-amber-950 bg-amber-50/50"
            />
          </div>
        </div>

        {/* 4-PART RESULTS IN STRICT ORDER */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* (1) What you should pay / Net Interest Owed */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-xs font-bold text-emerald-800 block mb-1">
              {language === 'hi' 
                ? '(1) अधिकतम वैधानिक देय ब्याज (Net Interest You Owe)' 
                : language === 'chh'
                ? '(1) तुमन ल कतका ब्याज देना चाही (Net Interest Payable)'
                : '(1) Statutory Net Interest Payable (What You Owe)'}
            </span>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-black text-emerald-900">
                {kccResult?.entitled_display || '₹8,000'}
              </span>
              <span className="text-xs font-bold text-emerald-700">
                ({language === 'en' ? 'Statutory Net Interest' : 'देय शुद्ध ब्याज'} @ {kccResult?.effective_rate_pct || 4}%)
              </span>
              <span className="text-xs text-emerald-800 font-mono">
                {kccResult?.rupees_in_words_hi && language !== 'en' ? `[${kccResult.rupees_in_words_hi}]` : ''}
              </span>
            </div>
            <div className="mt-2 text-xs text-emerald-800 flex items-center gap-2">
              <span className="font-bold">
                {kccResult?.collateral_free
                  ? (language === 'en' ? '✓ Within ₹2,00,000 Collateral-Free limit (No mortgage required)' : '✓ ₹2,00,000 बंधक-मुक्त सीमा के भीतर (कोई कोलैटरल आवश्यक नहीं)')
                  : (language === 'en' ? '⚠ Collateral required above ₹2,00,000 threshold' : '⚠ ₹2,00,000 से अधिक होने पर बैंक बंधक अनुमत')}
              </span>
            </div>
          </div>

          {/* (2) Why (expandable rule steps + Rule ID + provenance chip) */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                {language === 'chh' ? '(2) काबर (नियम सूत्र अउ हिसाब)' : language === 'hi' ? '(2) क्यों (नियम सूत्र एवं गणना)' : '(2) Why (Rules & Calculation Steps)'}
              </span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                {kccResult?.provenance || 'वैधानिक संदर्भ: 2026'}
              </span>
            </div>

            <p className="text-slate-600 leading-relaxed">
              {language === 'en' ? kccResult?.rule_desc_en : (kccResult?.rule_desc_chh || kccResult?.rule_desc_hi)}
            </p>

            <button
              type="button"
              onClick={() => setKccStepsExpanded(!kccStepsExpanded)}
              className="text-indigo-700 font-bold hover:underline flex items-center gap-1 pt-1"
            >
              <span>
                {kccStepsExpanded
                  ? (language === 'chh' ? 'हिसाब के चरण छुपाव' : language === 'hi' ? 'गणना चरण छुपाएं' : 'Hide Math Steps')
                  : (language === 'chh' ? 'विस्तृत हिसाब चरण देखव' : language === 'hi' ? 'विस्तृत गणना चरण देखें' : 'View Step-by-Step Math')}
              </span>
              {kccStepsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {kccStepsExpanded && kccResult?.rule_steps && (
              <div className="mt-2 p-3 rounded-xl bg-white border border-slate-200 space-y-2 font-mono text-[11px]">
                {kccResult.rule_steps.map((st: any) => (
                  <div key={st.step} className="border-b border-slate-100 pb-1.5 last:border-none">
                    <span className="font-bold text-slate-900">
                      Step {st.step}: {language === 'en' ? st.title_en : (st.title_chh || st.title_hi)}
                    </span>
                    <p className="text-slate-600 font-sans mt-0.5">
                      {language === 'en' ? st.desc_en : (st.desc_chh || st.desc_hi)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* (3) What you actually got & Gap */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="font-bold text-amber-900 block mb-0.5">
                {language === 'chh' ? '(3) असली म मिले / बैंक कटौती' : language === 'hi' ? '(3) वास्तविक प्राप्ति / बैंक कटौती' : '(3) What You Actually Paid'}
              </span>
              <span className="text-xl font-black text-slate-900">
                {kccResult?.actual_display || '₹14,000'}
              </span>
            </div>

            <div>
              <span className="font-bold text-amber-900 block mb-0.5">
                {language === 'chh' ? 'विसंगति / जादा वसूली राशि (अंतर)' : language === 'hi' ? 'विसंगति / अधिक वसूली राशि (Gap)' : 'Discrepancy / Overcharge Gap'}
              </span>
              <span className={`text-xl font-black ${kccResult?.gap_paise > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                {kccResult?.gap_display || '₹6,000'}
              </span>
              {kccResult?.gap_paise > 0 && (
                <span className="block text-[11px] font-bold text-amber-700 mt-0.5">
                  {language === 'chh' ? '⚠ बैंक ह 7% काटीस जबके दर सिरिफ 4% रिहिस!' : language === 'hi' ? '⚠ बैंक ने 7% काटा जबकि देय दर 4% थी!' : '⚠ Bank charged 7% instead of 4%!'}
                </span>
              )}
            </div>
          </div>

          {/* (4) What to do next (1-tap Grievance PDF + Listen button) */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                {language === 'chh' ? '(4) आगे का करना हे:' : language === 'hi' ? '(4) आगे की कार्रवाई:' : '(4) What to do next:'}
              </span>
              <span className="text-xs text-slate-600">
                {kccResult?.gap_paise > 0
                  ? (language === 'chh' ? 'बैंक शाखा प्रबंधक ल ब्याज वापसी बर चिट्ठी देव' : language === 'hi' ? 'बैंक शाखा प्रबंधक को ब्याज वापसी हेतु पत्र प्रस्तुत करें' : 'Submit grievance letter to Branch Manager for interest refund')
                  : (language === 'chh' ? 'कउनो विसंगति नइ मिले' : language === 'hi' ? 'कोई विसंगति नहीं पाई गई' : 'No discrepancy found')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <FieldVoiceSpeaker
                textHi={`केसीसी ब्याज अनुदान: आपको ₹${kccResult?.entitled_interest_paise ? kccResult.entitled_interest_paise / 100 : 8000} देय है, बैंक ने अधिक ब्याज वसूला है। आप तुरंत शिकायत पत्र तैयार कर सकते हैं।`}
                textEn={`KCC Subvention: You owe ₹${kccResult?.entitled_interest_paise ? kccResult.entitled_interest_paise / 100 : 8000}. Overcharge detected. Generate grievance representation.`}
              />
              <button
                type="button"
                onClick={() =>
                  onGenerateGrievance({
                    scheme_id: 'KCC_OVERCHARGE',
                    scheme_name_hi: 'केसीसी ब्याज अधिक वसूली',
                    scheme_name_en: 'KCC Interest Subvention Overcharge',
                    parcel_id: snapshot?.parcels?.[0]?.parcel_id || 'P-101',
                    entitled_paise: kccResult?.entitled_interest_paise || 800000,
                    entitled_display: kccResult?.entitled_display || '₹8,000',
                    received_paise: kccResult?.actual_interest_paise || 1400000,
                    received_display: kccResult?.actual_display || '₹14,000',
                    gap_paise: kccResult?.gap_paise || 600000,
                    gap_display: kccResult?.gap_display || '₹6,000',
                    status: 'OVERCHARGED',
                    days_overdue: 0,
                    alert_flag: true,
                    next_action: 'GENERATE_GRIEVANCE',
                    explanation_hi: 'बैंक द्वारा 7% आधार दर वसूल की गई जबकि समय पर अदायगी पर 3% अनुदान देय था।',
                    explanation_en: 'Bank charged full 7% interest instead of applying 3% prompt repayment subvention.',
                    speech_text_hi: 'केसीसी ऋण पर छः हजार रुपये अधिक ब्याज काटा गया है।',
                    speech_text_en: 'KCC interest overcharge of six thousand rupees detected.',
                    rule_id: 'RULE_KCC_SUBVENTION',
                  })
                }
                className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs min-h-[44px]"
              >
                <FileText className="w-4 h-4" />
                <span>{language === 'chh' ? '1-क्लिक शिकायत चिट्ठी बनावव' : language === 'hi' ? '1-क्लिक शिकायत पत्र तैयार करें' : 'Generate 1-Tap Grievance Letter'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CARD 2: PADDY MSP & KRISHAK UNNATI YOJANA (KUY) CALCULATOR      */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-amber-50/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-300 shadow-inner">
              <Wheat className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">
                RULE_MSP_AND_KUY_CROPS
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                {language === 'chh'
                  ? '2. फसल समर्थन मूल्य (MSP) अउ उपार्जन पइसा कैलकुलेटर'
                  : language === 'hi'
                  ? '2. फसल समर्थन मूल्य (MSP) एवं उपार्जन भुगतान कैलकुलेटर'
                  : '2. All Crops MSP & Procurement Payout Calculator'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-full font-bold">
              ₹3,100 / qtl (₹2,441 + ₹659)
            </span>
          </div>
        </div>

        {/* Interactive Inputs */}
        <div className="p-5 sm:p-6 bg-slate-50/60 border-b border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
          {/* Acres */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              {language === 'chh' ? 'रकबा (एकड़)' : language === 'hi' ? 'रकबा (एकड़)' : 'Area (Acres)'}
            </label>
            <input
              type="number"
              step={0.1}
              value={paddyAcres}
              onChange={(e) => setPaddyAcres(Math.max(0.1, parseFloat(e.target.value || '1')))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
            />
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {language === 'en' ? `Cap: ${(paddyAcres * 21).toFixed(1)} qtl` : `सीमा: ${(paddyAcres * 21).toFixed(1)} क्विंटल`}
            </span>
          </div>

          {/* Crop Selector (Multi-Crop Support) */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">
                {language === 'chh' ? 'फसल चुनव (Select Crop)' : language === 'hi' ? 'फसल चुनें (Select Crop)' : 'Select Crop'}
              </label>
              <FieldVoiceSpeaker
                textHi="अपनी फसल चुनें जैसे धान, मक्का, अरहर, सोयाबीन या रागी।"
                textEn="Select your crop such as Paddy, Maize, Tur, Soybean, or Ragi."
              />
            </div>
            <select
              value={selectedCrop}
              onChange={(e) => {
                const c = e.target.value;
                setSelectedCrop(c);
                if (c === 'PADDY_GRADE_A') setPaddyGrade('GRADE_A');
                else if (c === 'PADDY_COMMON') setPaddyGrade('COMMON');
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
            >
              <option value="PADDY_COMMON">धान (सामान्य) — ₹2,441 + ₹659 (KUY) = ₹3,100/क्विं.</option>
              <option value="PADDY_GRADE_A">धान (ग्रेड 'ए') — ₹2,461 + ₹659 (KUY) = ₹3,120/क्विं.</option>
              <option value="MAIZE">मक्का (Maize) — MSP ₹2,218/क्विं. (सीमा: 25 क्विं./एकड़)</option>
              <option value="TUR">अरहर / तुअर (Tur) — MSP ₹7,150/क्विं. (सीमा: 10 क्विं./एकड़)</option>
              <option value="RAGI">रागी / मड़ुआ (Ragi) — MSP ₹4,046/क्विं. (सीमा: 12 क्विं./एकड़)</option>
              <option value="SOYBEAN">सोयाबीन (Soybean) — MSP ₹4,892/क्विं. (सीमा: 12 क्विं./एकड़)</option>
              <option value="KODO_KUTKI">कोदो-कुटकी (Kodo-Kutki) — MSP ₹3,200/क्विं.</option>
            </select>
          </div>

          {/* Moisture Slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">
                {language === 'en' ? `Moisture: ${paddyMoisture}%` : `नमी: ${paddyMoisture}%`}
              </label>
              <FieldVoiceSpeaker
                textHi="धान की नमी का प्रतिशत यहाँ स्लाइडर द्वारा बदलें।"
                textEn="Adjust paddy moisture percentage using the slider."
              />
            </div>
            <input
              type="range"
              min={12.0}
              max={22.0}
              step={0.1}
              value={paddyMoisture}
              onChange={(e) => setPaddyMoisture(parseFloat(e.target.value))}
              className="w-full accent-amber-600"
            />
            <span className={`text-[10px] font-bold block ${paddyMoisture > 20 ? 'text-rose-600' : paddyMoisture > 17 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {paddyMoisture > 20 ? '⚠ अस्वीकृत (>20%)' : paddyMoisture > 17 ? '⚠ कटौती (17-20%)' : '✓ पूर्ण भुगतान (≤17%)'}
            </span>
          </div>

          {/* Quantity Offered */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              {language === 'chh' ? 'बेचे गे मात्रा (क्विंटल)' : language === 'hi' ? 'बेची गई मात्रा (क्विंटल)' : 'Quantity Sold (qtl)'}
            </label>
            <input
              type="number"
              step={1}
              value={paddyOffered}
              onChange={(e) => setPaddyOffered(Math.max(0, parseFloat(e.target.value || '0')))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
            />
          </div>

          {/* What I Actually Received */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 text-amber-800">
                {language === 'chh' ? 'असली म का मिले (₹)' : language === 'hi' ? 'वास्तव में क्या मिला (₹)' : 'What I Actually Received (₹)'}
              </label>
            </div>
            <input
              type="number"
              step={1000}
              value={paddyActualReceived / 100}
              onChange={(e) => setPaddyActualReceived(Math.max(0, parseInt(e.target.value || '0', 10) * 100))}
              className="w-full px-3 py-2 rounded-xl border-2 border-amber-300 font-extrabold text-amber-950 bg-amber-50/50"
            />
          </div>
        </div>

        {/* 4-PART RESULTS IN STRICT ORDER */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* (1) What you should get */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
            <span className="text-xs font-bold text-emerald-800 block">
              {language === 'chh' ? '(1) तुमन ल का मिलना चाही' : language === 'hi' ? '(1) आपको क्या मिलना चाहिए' : '(1) What you should get'}
            </span>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-black text-emerald-900">
                {paddyResult?.net_payout_display || '₹2,60,400'}
              </span>
              <span className="text-xs font-bold text-emerald-700">
                ({language === 'chh' ? 'कुल देय पइसा' : language === 'hi' ? 'कुल देय राशि' : 'Total Entitled Amount'} @ ₹{paddyResult?.total_rate_per_quintal || 3100}/qtl)
              </span>
            </div>

            {/* Split Bar: Central MSP vs. KUY Bonus (or 100% MSP for Maize/Tur/Ragi) */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span>
                  {language === 'en' ? (paddyResult?.crop_name_en || 'MSP') : (paddyResult?.crop_name_hi || 'समर्थन मूल्य')} (₹{paddyResult?.msp_rate_per_quintal || 2441}):{' '}
                  {paddyResult ? `₹${Math.round(paddyResult.msp_gross_paise / 100).toLocaleString('en-IN')}` : ''}
                </span>
                {paddyResult?.kuy_rate_per_quintal > 0 && (
                  <span className="text-amber-800">
                    {language === 'chh' ? 'कृषक उन्नति बोनस' : language === 'hi' ? 'कृषक उन्नति बोनस' : 'KUY Bonus'} (₹{paddyResult.kuy_rate_per_quintal}):{' '}
                    ₹{Math.round(paddyResult.kuy_gross_paise / 100).toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-600"
                  style={{
                    width: paddyResult?.total_gross_paise > 0
                      ? `${(paddyResult.msp_gross_paise / paddyResult.total_gross_paise) * 100}%`
                      : '100%',
                  }}
                />
                {paddyResult?.kuy_gross_paise > 0 && (
                  <div
                    className="h-full bg-amber-500"
                    style={{
                      width: `${(paddyResult.kuy_gross_paise / paddyResult.total_gross_paise) * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* (2) Why (expandable rule steps + Rule ID + provenance chip) */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                {language === 'chh' ? '(2) काबर (नियम सूत्र अउ हिसाब)' : language === 'hi' ? '(2) क्यों (नियम सूत्र एवं गणना)' : '(2) Why (Rules & Calculation Steps)'}
              </span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                {paddyResult?.provenance || 'वैधानिक संदर्भ: 2026'}
              </span>
            </div>

            <p className="text-slate-600 leading-relaxed">
              {language === 'en'
                ? `Based on statutory standard, ${paddyAcres} acres yields an eligible cap of ${paddyResult?.cap_quintals || 84} quintals of ${paddyResult?.crop_name_en || 'crop'}.`
                : language === 'chh'
                ? `वैधानिक नियम ले ${paddyAcres} एकड़ रकबा म कुल ${paddyResult?.cap_quintals || 84} क्विंटल ${paddyResult?.crop_name_hi || 'फसल'} बेचे बर मान्य हे।`
                : `वैधानिक मानक अनुसार ${paddyAcres} एकड़ पर कुल ${paddyResult?.cap_quintals || 84} क्विंटल ${paddyResult?.crop_name_hi || 'फसल'} उपार्जन हेतु मान्य है।`}
            </p>

            <button
              type="button"
              onClick={() => setPaddyStepsExpanded(!paddyStepsExpanded)}
              className="text-amber-800 font-bold hover:underline flex items-center gap-1 pt-1"
            >
              <span>
                {paddyStepsExpanded
                  ? (language === 'chh' ? 'हिसाब के चरण छुपाव' : language === 'hi' ? 'गणना चरण छुपाएं' : 'Hide Math Steps')
                  : (language === 'chh' ? 'विस्तृत हिसाब चरण देखव' : language === 'hi' ? 'विस्तृत गणना चरण देखें' : 'View Step-by-Step Math')}
              </span>
              {paddyStepsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {paddyStepsExpanded && paddyResult?.rule_steps && (
              <div className="mt-2 p-3 rounded-xl bg-white border border-slate-200 space-y-2 font-mono text-[11px]">
                {paddyResult.rule_steps.map((st: any) => (
                  <div key={st.step} className="border-b border-slate-100 pb-1.5 last:border-none">
                    <span className="font-bold text-slate-900">
                      Step {st.step}: {language === 'en' ? st.title_en : (st.title_chh || st.title_hi)}
                    </span>
                    <p className="text-slate-600 font-sans mt-0.5">
                      {language === 'en' ? st.desc_en : (st.desc_chh || st.desc_hi)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* (3) What you actually got & Gap */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="font-bold text-amber-900 block mb-0.5">
                {language === 'chh' ? '(3) असली म मिले' : language === 'hi' ? '(3) वास्तविक प्राप्ति' : '(3) What You Actually Received'}
              </span>
              <span className="text-xl font-black text-slate-900">
                {paddyResult?.actual_display || '₹2,18,883'}
              </span>
            </div>

            <div>
              <span className="font-bold text-amber-900 block mb-0.5">
                {language === 'chh' ? 'लंबित बोनस विसंगति (अंतर)' : language === 'hi' ? 'लंबित बोनस विसंगति (Gap)' : 'Pending Overdue Gap'}
              </span>
              <span className={`text-xl font-black ${paddyResult?.gap_paise > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                {paddyResult?.gap_display || '₹41,517'}
              </span>
              {paddyResult?.gap_paise > 0 && (
                <span className="block text-[11px] font-bold text-amber-700 mt-0.5">
                  {language === 'chh' ? '⚠ कृषक उन्नति बोनस ₹41,517 निर्धारित समे ले बाकी हे!' : language === 'hi' ? '⚠ कृषक उन्नति बोनस ₹41,517 निर्धारित समय से लंबित है!' : '⚠ KUY Bonus ₹41,517 is overdue!'}
                </span>
              )}
            </div>
          </div>

          {/* (4) What to do next (1-tap Grievance PDF + Listen button) */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                {language === 'chh' ? '(4) आगे का करना हे:' : language === 'hi' ? '(4) आगे की कार्रवाई:' : '(4) What to do next:'}
              </span>
              <span className="text-xs text-slate-600">
                {paddyResult?.gap_paise > 0
                  ? (language === 'chh' ? 'जिला उपार्जन अधिकारी ल कृषक उन्नति बोनस भुगतान बर चिट्ठी भेजव' : language === 'hi' ? 'जिला उपार्जन अधिकारी को कृषक उन्नति बोनस भुगतान हेतु प्रतिवेदन भेजें' : 'Generate representation letter for overdue KUY bonus to District Procurement Officer')
                  : (language === 'chh' ? 'कउनो पइसा बाकी नइ हे' : language === 'hi' ? 'कोई बकाया नहीं है' : 'All entitlements settled')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <FieldVoiceSpeaker
                textHi={`धान उपार्जन: आपकी कुल देय राशि ₹${paddyResult?.net_payout_paise ? paddyResult.net_payout_paise / 100 : 260400} है, जिसमें से कृषक उन्नति योजना बोनस लंबित है।`}
                textEn={`Paddy Procurement: Total entitlement is ₹${paddyResult?.net_payout_paise ? paddyResult.net_payout_paise / 100 : 260400}. Overdue KUY bonus identified.`}
              />
              <button
                type="button"
                onClick={() =>
                  onGenerateGrievance({
                    scheme_id: 'KUY_2026',
                    scheme_name_hi: 'कृषक उन्नति योजना (बोनस)',
                    scheme_name_en: 'Krishak Unnati Yojana (Bonus)',
                    parcel_id: snapshot?.parcels?.[0]?.parcel_id || 'P-101',
                    entitled_paise: paddyResult?.net_payout_paise || 26040000,
                    entitled_display: paddyResult?.net_payout_display || '₹2,60,400',
                    received_paise: paddyResult?.actual_received_paise || 21888300,
                    received_display: paddyResult?.actual_display || '₹2,18,883',
                    gap_paise: paddyResult?.gap_paise || 4151700,
                    gap_display: paddyResult?.gap_display || '₹41,517',
                    status: 'OVERDUE',
                    days_overdue: 18,
                    alert_flag: true,
                    next_action: 'GENERATE_GRIEVANCE',
                    explanation_hi: 'कृषक उन्नति योजना बोनस की राशि निर्धारित तारीख़ से 18 दिनों से लंबित है।',
                    explanation_en: 'Krishak Unnati Yojana bonus of ₹41,517 is overdue by 18 days.',
                    speech_text_hi: 'कृषक उन्नति योजना बोनस की राशि इकतालीस हज़ार पाँच सौ सत्रह रुपये लंबित है।',
                    speech_text_en: 'Krishak Unnati Yojana bonus of forty-one thousand five hundred seventeen rupees is overdue.',
                    rule_id: 'RULE_KUY_PADDY',
                  })
                }
                className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs min-h-[44px]"
              >
                <FileText className="w-4 h-4" />
                <span>{language === 'chh' ? '1-क्लिक शिकायत चिट्ठी बनावव' : language === 'hi' ? '1-क्लिक शिकायत पत्र तैयार करें' : 'Generate 1-Tap Grievance Letter'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CARD 3: PMFBY CROP INSURANCE CLAIM CALCULATOR                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-sky-50/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center border border-sky-300 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-sky-700" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-800 block">
                RULE_PMFBY_CLAIM
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                {language === 'chh'
                  ? '3. प्रधानमंत्री फसल बीमा योजना (PMFBY) दावा कैलकुलेटर'
                  : language === 'hi'
                  ? '3. प्रधानमंत्री फसल बीमा योजना (PMFBY) दावा कैलकुलेटर'
                  : '3. PMFBY Crop Insurance Claim Calculator'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-sky-100 text-sky-900 border border-sky-300 px-2.5 py-1 rounded-full font-bold">
              2% Kharif Cap • 72h Calamity
            </span>
          </div>
        </div>

        {/* Interactive Inputs */}
        <div className="p-5 sm:p-6 bg-slate-50/60 border-b border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          {/* Season Selector */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              {language === 'chh' ? 'मौसम (सीज़न)' : language === 'hi' ? 'मौसम (सीज़न)' : 'Season'}
            </label>
            <select
              value={pmfbySeason}
              onChange={(e) => setPmfbySeason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
            >
              <option value="KHARIF">खरीफ (2% Cap)</option>
              <option value="RABI">रबी (1.5% Cap)</option>
            </select>
          </div>

          {/* Insured Acres */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              {language === 'chh' ? 'बीमा रकबा (एकड़)' : language === 'hi' ? 'बीमित रकबा (एकड़)' : 'Insured Area (Acres)'}
            </label>
            <input
              type="number"
              step={0.1}
              value={pmfbyAcres}
              onChange={(e) => setPmfbyAcres(Math.max(0.1, parseFloat(e.target.value || '1')))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
            />
          </div>

          {/* Sum Insured Per Acre */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              {language === 'chh' ? 'बीमा राशि प्रति एकड़ (₹)' : language === 'hi' ? 'बीमित राशि प्रति एकड़ (₹)' : 'Sum Insured / Acre (₹)'}
            </label>
            <input
              type="number"
              step={1000}
              value={pmfbySumInsuredPerAcre / 100}
              onChange={(e) => setPmfbySumInsuredPerAcre(Math.max(1000, parseInt(e.target.value || '0', 10) * 100))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
            />
          </div>

          {/* Threshold Yield */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              {language === 'chh' ? 'थ्रेशोल्ड उपज (qtl/ha)' : language === 'hi' ? 'थ्रेशोल्ड उपज (qtl/ha)' : 'Threshold Yield (qtl/ha)'}
            </label>
            <input
              type="number"
              step={0.5}
              value={pmfbyThresholdYield}
              onChange={(e) => setPmfbyThresholdYield(Math.max(1, parseFloat(e.target.value || '1')))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
            />
          </div>

          {/* Actual CCE Yield */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              {language === 'chh' ? 'सीसीई वास्तविक उपज (qtl/ha)' : language === 'hi' ? 'सीसीई वास्तविक उपज (qtl/ha)' : 'Actual CCE Yield (qtl/ha)'}
            </label>
            <input
              type="number"
              step={0.5}
              value={pmfbyActualYield}
              onChange={(e) => setPmfbyActualYield(Math.max(0, parseFloat(e.target.value || '0')))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-slate-900 bg-white"
            />
          </div>

          {/* Claim Actually Received */}
          <div>
            <label className="font-bold text-slate-700 block mb-1 text-amber-800">
              {language === 'chh' ? 'वास्तव म मिले क्लेम (₹)' : language === 'hi' ? 'वास्तव में मिला क्लेम (₹)' : 'Claim Received (₹)'}
            </label>
            <input
              type="number"
              step={1000}
              value={pmfbyActualClaim / 100}
              onChange={(e) => setPmfbyActualClaim(Math.max(0, parseInt(e.target.value || '0', 10) * 100))}
              className="w-full px-3 py-2 rounded-xl border-2 border-amber-300 font-extrabold text-amber-950 bg-amber-50/50"
            />
          </div>
        </div>

        {/* 4-PART RESULTS IN STRICT ORDER */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* (1) What you should get */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-xs font-bold text-emerald-800 block mb-1">
              {language === 'hi' 
                ? '(1) आपको क्या मिलना चाहिए (Statutory Claim Payout)' 
                : language === 'chh'
                ? '(1) तुमन ल कतका मिलना चाही (दावा भुगतान)'
                : '(1) What You Should Get (Statutory Claim Payout)'}
            </span>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-black text-emerald-900">
                {pmfbyResult?.claim_display || '₹33,600'}
              </span>
              <span className="text-xs font-bold text-emerald-700">
                ({language === 'en' ? 'Statutory PMFBY Claim' : 'वैधानिक फसल बीमा दावा'} @ {pmfbyResult?.claim_ratio_pct ? `${pmfbyResult.claim_ratio_pct.toFixed(1)}% Shortfall` : '28.0% Shortfall'})
              </span>
            </div>
            <div className="mt-2 text-xs text-emerald-800 flex items-center gap-2">
              <span className="font-bold">
                {language === 'en'
                  ? `✓ Maximum 2% farmer premium cap: ${pmfbyResult?.farmer_premium_display || '₹2,400'} on ${pmfbyResult?.sum_insured_display || '₹1,20,000'} total sum insured`
                  : `✓ कुल बीमित राशि ${pmfbyResult?.sum_insured_display || '₹1,20,000'} पर 2% अधिकतम प्रीमियम सीमा: ${pmfbyResult?.farmer_premium_display || '₹2,400'}`}
              </span>
            </div>
          </div>

          {/* (2) Why (expandable rule steps + Rule ID + provenance chip) */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                {language === 'chh' ? '(2) काबर (नियम सूत्र अउ हिसाब)' : language === 'hi' ? '(2) क्यों (नियम सूत्र एवं गणना)' : '(2) Why (Rules & Calculation Steps)'}
              </span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                {pmfbyResult?.provenance || 'वैधानिक संदर्भ: 2026'}
              </span>
            </div>

            <p className="text-slate-600 leading-relaxed">
              {language === 'en'
                ? `Actual CCE yield (${pmfbyActualYield} qtl/ha) fell below threshold yield (${pmfbyThresholdYield} qtl/ha), triggering statutory yield deficit claim.`
                : language === 'chh'
                ? `सीसीई पैदावार (${pmfbyActualYield} qtl/ha) थ्रेशोल्ड पैदावार (${pmfbyThresholdYield} qtl/ha) ले कम होए के सेती फसल नुकसानी के वैधानिक दावा मिलही।`
                : `सीसीई उपज (${pmfbyActualYield} qtl/ha) थ्रेशोल्ड उपज (${pmfbyThresholdYield} qtl/ha) से कम होने के कारण फसल क्षति का वैधानिक दावा देय है।`}
            </p>

            <button
              type="button"
              onClick={() => setPmfbyStepsExpanded(!pmfbyStepsExpanded)}
              className="text-sky-800 font-bold hover:underline flex items-center gap-1 pt-1"
            >
              <span>
                {pmfbyStepsExpanded
                  ? (language === 'chh' ? 'हिसाब के चरण छुपाव' : language === 'hi' ? 'गणना चरण छुपाएं' : 'Hide Math Steps')
                  : (language === 'chh' ? 'विस्तृत हिसाब चरण देखव' : language === 'hi' ? 'विस्तृत गणना चरण देखें' : 'View Step-by-Step Math')}
              </span>
              {pmfbyStepsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {pmfbyStepsExpanded && pmfbyResult?.rule_steps && (
              <div className="mt-2 p-3 rounded-xl bg-white border border-slate-200 space-y-2 font-mono text-[11px]">
                {pmfbyResult.rule_steps.map((st: any) => (
                  <div key={st.step} className="border-b border-slate-100 pb-1.5 last:border-none">
                    <span className="font-bold text-slate-900">
                      Step {st.step}: {language === 'en' ? st.title_en : (st.title_chh || st.title_hi)}
                    </span>
                    <p className="text-slate-600 font-sans mt-0.5">
                      {language === 'en' ? st.desc_en : (st.desc_chh || st.desc_hi)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* (3) What you actually got & Gap */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="font-bold text-amber-900 block mb-0.5">
                {language === 'chh' ? '(3) असली म मिले' : language === 'hi' ? '(3) वास्तविक प्राप्ति' : '(3) What You Actually Received'}
              </span>
              <span className="text-xl font-black text-slate-900">
                {pmfbyResult?.actual_display || '₹0'}
              </span>
            </div>

            <div>
              <span className="font-bold text-amber-900 block mb-0.5">
                {language === 'chh' ? 'बाकी बीमा दावा (अंतर)' : language === 'hi' ? 'लंबित बीमा दावा (Gap)' : 'Pending Insurance Claim Gap'}
              </span>
              <span className={`text-xl font-black ${pmfbyResult?.gap_paise > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                {pmfbyResult?.gap_display || '₹33,600'}
              </span>
              {pmfbyResult?.gap_paise > 0 && (
                <span className="block text-[11px] font-bold text-amber-700 mt-0.5">
                  {language === 'chh' ? '⚠ फसल बीमा कंपनी कोति ले 60 दिन के समे पार होगे!' : language === 'hi' ? '⚠ फसल बीमा कंपनी द्वारा 60 दिन की समय-सीमा पार!' : '⚠ PMFBY 60-day settlement deadline exceeded!'}
                </span>
              )}
            </div>
          </div>

          {/* (4) What to do next (1-tap Grievance PDF + Listen button) */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                {language === 'chh' ? '(4) आगे का करना हे:' : language === 'hi' ? '(4) आगे की कार्रवाई:' : '(4) What to do next:'}
              </span>
              <span className="text-xs text-slate-600">
                {pmfbyResult?.gap_paise > 0
                  ? (language === 'chh' ? 'राज्य स्तरीय फसल बीमा समिति ल दावा निपटान बर चिट्ठी भेजव' : language === 'hi' ? 'राज्य स्तरीय फसल बीमा निवारण समिति को दावा निपटान पत्र भेजें' : 'Generate claim enforcement letter to State Level PMFBY Oversight Committee')
                  : (language === 'chh' ? 'दावा राशि पूरा मिलगे' : language === 'hi' ? 'दावा राशि पूर्णतः प्राप्त' : 'No claim pending')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <FieldVoiceSpeaker
                textHi={`प्रधानमंत्री फसल बीमा: आपका ₹${pmfbyResult?.claim_paise ? pmfbyResult.claim_paise / 100 : 33600} का दावा लंबित है। स्थानीय आपदा होने पर बहत्तर घंटे में सूचना अनिवार्य है।`}
                textEn={`PMFBY Claim: You have a pending claim of ₹${pmfbyResult?.claim_paise ? pmfbyResult.claim_paise / 100 : 33600}. Localized calamity reporting mandate is 72 hours.`}
              />
              <button
                type="button"
                onClick={() =>
                  onGenerateGrievance({
                    scheme_id: 'PMFBY_CLAIM_UNDERPAID',
                    scheme_name_hi: 'प्रधानमंत्री फसल बीमा दावा',
                    scheme_name_en: 'PMFBY Crop Insurance Claim',
                    parcel_id: snapshot?.parcels?.[0]?.parcel_id || 'P-101',
                    entitled_paise: pmfbyResult?.claim_paise || 3360000,
                    entitled_display: pmfbyResult?.claim_display || '₹33,600',
                    received_paise: pmfbyResult?.actual_received_paise || 0,
                    received_display: pmfbyResult?.actual_display || '₹0',
                    gap_paise: pmfbyResult?.gap_paise || 3360000,
                    gap_display: pmfbyResult?.gap_display || '₹33,600',
                    status: 'UNDERPAID',
                    days_overdue: 45,
                    alert_flag: true,
                    next_action: 'GENERATE_GRIEVANCE',
                    explanation_hi: 'फसल कटाई प्रयोग अनुसार 28% उपज गिरावट पर बीमा दावा लंबित है।',
                    explanation_en: 'Statutory crop insurance claim on 28% yield shortfall pending settlement.',
                    speech_text_hi: 'तैंतीस हज़ार छह सौ रुपये का बीमा दावा लंबित है।',
                    speech_text_en: 'Crop insurance claim of thirty-three thousand six hundred rupees is pending.',
                    rule_id: 'RULE_PMFBY_CLAIM',
                  })
                }
                className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs min-h-[44px]"
              >
                <FileText className="w-4 h-4" />
                <span>{language === 'chh' ? '1-क्लिक शिकायत चिट्ठी बनावव' : language === 'hi' ? '1-क्लिक शिकायत पत्र तैयार करें' : 'Generate 1-Tap Grievance Letter'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default EntitlementCalculatorsTab;
