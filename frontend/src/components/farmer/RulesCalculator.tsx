import React, { useState } from 'react';
import { Wheat, ShieldCheck, AlertCircle, Info, Landmark, Clock, TrendingDown } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { FieldVoiceSpeaker } from '../common/FieldVoiceSpeaker';

export const RulesCalculator: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'kcc' | 'msp' | 'pmfby'>('kcc');

  // ── KCC State ──────────────────────────────────────────────────────
  const [kccAmount, setKccAmount] = useState<number>(150000);
  const [kccType, setKccType] = useState<'pacs' | 'commercial'>('pacs');
  const [kccOnTime, setKccOnTime] = useState<boolean>(true);
  const [repaymentMonths, setRepaymentMonths] = useState<number>(12);

  // ── MSP State ──────────────────────────────────────────────────────
  const [mspAcres, setMspAcres] = useState<number>(3.5);
  const [mspGrade, setMspGrade] = useState<'common' | 'grade_a'>('common');
  const [mspMoisture, setMspMoisture] = useState<number>(15.5);
  const [mspQty, setMspQty] = useState<number>(70);

  // ── PMFBY State ────────────────────────────────────────────────────
  const [pmfbyAcres, setPmfbyAcres] = useState<number>(3.5);
  const [sumInsuredPerAcre, setSumInsuredPerAcre] = useState<number>(30000);
  const [thresholdYield, setThresholdYield] = useState<number>(25);
  const [actualYield, setActualYield] = useState<number>(18);

  // ── KCC Dynamic Calculation (Duration-Aware) ──────────────────────
  const kccBaseRate = 7;
  let kccEffectiveRate = 7;
  let kccSubvention = 0;

  if (kccType === 'pacs') {
    if (kccOnTime && repaymentMonths <= 12) {
      kccEffectiveRate = 0;
      kccSubvention = 7;
    } else {
      kccEffectiveRate = 7;
      kccSubvention = 0;
    }
  } else {
    if (kccOnTime && repaymentMonths <= 12) {
      kccEffectiveRate = 4;
      kccSubvention = 3;
    } else {
      kccEffectiveRate = 7;
      kccSubvention = 0;
    }
  }

  // Exact interest calculation based on repayment duration
  const durationFactor = repaymentMonths / 12;
  const kccInterestRupees = Math.round(
    (kccAmount * (kccEffectiveRate / 100)) * durationFactor
  );

  // ── MSP & KUY Dynamic Moisture-Aware Calculation ───────────────────
  const mspCapQuintals = Math.round(mspAcres * 21 * 100) / 100;
  const eligibleQty = Math.min(mspQty, mspCapQuintals);
  const excessQty = Math.max(0, mspQty - mspCapQuintals);

  const mspRate = mspGrade === 'grade_a' ? 2461 : 2441;
  const kuyRate = 659;
  const totalCompositeRate = mspRate + kuyRate;

  const mspBaseGross = eligibleQty * mspRate;
  const kuyBonusGross = eligibleQty * kuyRate;
  const totalMspPayoutGross = eligibleQty * totalCompositeRate;

  // Dynamic moisture deduction / rejection logic:
  // - <= 17%: Full payout (100%)
  // - 17% to 20%: 1.5% moisture cut / driage discount per 1% excess moisture
  // - > 20%: Mandi rejects weighing (0 payout until dried)
  let moistureDeductionRupees = 0;
  let totalMspPayoutNet = totalMspPayoutGross;
  let isMandiRejected = false;

  if (mspMoisture > 20.0) {
    isMandiRejected = true;
    totalMspPayoutNet = 0;
  } else if (mspMoisture > 17.0) {
    const excessMoisture = mspMoisture - 17.0;
    const deductionPct = excessMoisture * 0.015; // 1.5% deduction per 1% moisture
    moistureDeductionRupees = Math.round(totalMspPayoutGross * deductionPct);
    totalMspPayoutNet = Math.max(0, totalMspPayoutGross - moistureDeductionRupees);
  }

  // ── PMFBY Calculation ──────────────────────────────────────────────
  const totalSumInsured = pmfbyAcres * sumInsuredPerAcre;
  const farmerPremium = Math.round(totalSumInsured * 0.02);

  let pmfbyClaimAmount = 0;
  let shortfallPct = 0;
  if (thresholdYield > 0 && actualYield < thresholdYield) {
    shortfallPct = (thresholdYield - actualYield) / thresholdYield;
    pmfbyClaimAmount = Math.round(shortfallPct * totalSumInsured);
  }

  const formatRupees = (val: number) => '₹' + Math.round(val).toLocaleString('en-IN');

  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden">
      {/* Sub Tabs Header */}
      <div className="flex border-b border-surface-border bg-surface-muted/50 p-1.5 gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('kcc')}
          className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors min-h-[44px] ${
            activeTab === 'kcc'
              ? 'bg-white text-agri-dark shadow-xs border border-surface-border'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>{t('farmer.tab_kcc_calc')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('msp')}
          className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors min-h-[44px] ${
            activeTab === 'msp'
              ? 'bg-white text-agri-dark shadow-xs border border-surface-border'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Wheat className="w-4 h-4" />
          <span>{t('farmer.tab_msp_calc')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pmfby')}
          className={`flex-1 py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors min-h-[44px] ${
            activeTab === 'pmfby'
              ? 'bg-white text-agri-dark shadow-xs border border-surface-border'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{t('farmer.tab_pmfby_calc')}</span>
        </button>
      </div>

      {/* Tab 1: KCC Calculator (Duration & Late Payment Aware) */}
      {activeTab === 'kcc' && (
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-agri-dark" />
              <h3 className="font-bold text-base text-text-primary">{t('farmer.kcc_calc_title')}</h3>
            </div>
            <FieldVoiceSpeaker
              textHi="किसान क्रेडिट कार्ड ब्याज कैलकुलेटर। ऋण राशि, ऋणदाता संस्था और भुगतान अवधि चुनकर सटीक ब्याज जानें।"
              textEn="Kisan Credit Card Interest Calculator. Choose loan amount, institution, and duration to calculate interest."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-text-secondary">
                    {t('farmer.kcc_calc_amount')}: <strong>{formatRupees(kccAmount)}</strong>
                  </label>
                  <FieldVoiceSpeaker
                    textHi="अपनी आवश्यकतानुसार केसीसी ऋण राशि चुनें।"
                    textEn="Select your required KCC loan amount."
                  />
                </div>
                <input
                  type="range"
                  min="20000"
                  max="300000"
                  step="5000"
                  value={kccAmount}
                  onChange={(e) => setKccAmount(Number(e.target.value))}
                  className="w-full h-2 bg-surface-muted rounded-lg appearance-none cursor-pointer accent-agri-dark"
                />
                <div className="flex justify-between text-xs text-text-muted mt-1">
                  <span>₹20,000</span>
                  <span>₹1,50,000</span>
                  <span>₹3,00,000</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-text-secondary">
                    {t('farmer.kcc_calc_type')}
                  </label>
                  <FieldVoiceSpeaker
                    textHi="ऋणदाता संस्था चुनें, जैसे प्राथमिक सहकारी साख समिति पैक्स अथवा व्यावसायिक बैंक।"
                    textEn="Select lending institution: PACS or Commercial Bank."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setKccType('pacs')}
                    className={`p-3 rounded-xl border text-xs font-semibold text-left transition-colors ${
                      kccType === 'pacs'
                        ? 'border-agri-dark bg-agri-light/40 text-agri-dark font-bold'
                        : 'border-surface-border bg-white text-text-secondary'
                    }`}
                  >
                    {t('farmer.kcc_pacs')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setKccType('commercial')}
                    className={`p-3 rounded-xl border text-xs font-semibold text-left transition-colors ${
                      kccType === 'commercial'
                        ? 'border-agri-dark bg-agri-light/40 text-agri-dark font-bold'
                        : 'border-surface-border bg-white text-text-secondary'
                    }`}
                  >
                    {t('farmer.kcc_commercial')}
                  </button>
                </div>
              </div>

              {/* Late Payment & Duration Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-agri-dark" />
                    <span>ऋण चुकाने की अवधि / Repayment Timing: <strong>{repaymentMonths} महीने ({repaymentMonths > 12 ? `${repaymentMonths - 12} माह विलंबित` : 'समय पर'})</strong></span>
                  </label>
                  <FieldVoiceSpeaker
                    textHi="ऋण चुकाने की अवधि चुनें। बारह माह के भीतर चुकाने पर अनुदान मिलता है, विलंब होने पर सामान्य सात प्रतिशत ब्याज लगता है।"
                    textEn="Select loan repayment timing. Timely repayment within 12 months gets interest subvention."
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    { months: 12, label: '12 माह (समय पर / On-time)' },
                    { months: 15, label: '15 माह (+3 माह देरी)' },
                    { months: 18, label: '18 माह (+6 माह देरी)' },
                    { months: 24, label: '24 माह (+1 वर्ष देरी)' },
                  ].map((m) => (
                    <button
                      key={m.months}
                      type="button"
                      onClick={() => {
                        setRepaymentMonths(m.months);
                        setKccOnTime(m.months <= 12);
                      }}
                      className={`py-2 px-2.5 rounded-xl border font-semibold text-center transition-colors ${
                        repaymentMonths === m.months
                          ? m.months <= 12
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                            : 'border-rose-600 bg-rose-50 text-rose-800'
                          : 'border-surface-border bg-white text-text-secondary'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results Card */}
            <div className="bg-surface-muted/40 rounded-2xl p-5 border border-surface-border space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white rounded-xl border border-surface-border">
                  <span className="text-xs text-text-muted block">{t('farmer.kcc_rate_label')}</span>
                  <span className="text-xl font-bold text-agri-dark">{kccEffectiveRate}% p.a.</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-surface-border">
                  <span className="text-xs text-text-muted block">
                    {repaymentMonths} माह का ब्याज / Interest ({repaymentMonths}m)
                  </span>
                  <span className="text-xl font-bold text-rose-700">{formatRupees(kccInterestRupees)}</span>
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-surface-border text-xs space-y-1.5 text-text-secondary">
                <div className="flex justify-between">
                  <span>Base Interest Rate:</span>
                  <span className="font-semibold text-text-primary">{kccBaseRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Interest Subvention Applied:</span>
                  <span className="font-semibold text-emerald-700">
                    {kccSubvention > 0 ? `-${kccSubvention}% (समय पर भुगतान छूट)` : '0% (विलंब के कारण छूट निरस्त)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Repayment Duration Multiplier:</span>
                  <span className="font-semibold text-text-primary">
                    {repaymentMonths}/12 = {durationFactor.toFixed(2)} वर्ष
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-surface-border">
                  <span className="font-bold text-text-primary">{t('farmer.kcc_collateral_label')}:</span>
                  <span className="font-semibold text-text-primary">
                    {kccAmount <= 200000 ? 'Collateral-Free (≤ ₹2 Lakh)' : 'Mortgage Required (> ₹2 Lakh)'}
                  </span>
                </div>
              </div>

              {repaymentMonths > 12 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                  <span>
                    विलंब चेतावनी: नियत तिथि से {repaymentMonths - 12} माह देरी होने पर ब्याज अनुदान (Subvention) समाप्त हो जाता है एवं पूरे {repaymentMonths} माह के लिए सामान्य दर (7%) से ब्याज देय होता है।
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: MSP & KUY Calculator (Dynamic Moisture-Aware Payout) */}
      {activeTab === 'msp' && (
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wheat className="w-5 h-5 text-agri-dark" />
              <h3 className="font-bold text-base text-text-primary">{t('farmer.msp_calc_title')}</h3>
            </div>
            <FieldVoiceSpeaker
              textHi="धान एमएसपी एवं कृषक उन्नति योजना कैलकुलेटर। रकबा, धान की श्रेणी और नमी प्रतिशत बदलकर शुद्ध देय राशि जानें।"
              textEn="Paddy MSP and KUY Calculator. Adjust acres, grade, and moisture to view dynamic net payout."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-text-secondary">
                    {t('farmer.msp_calc_acres')}
                  </label>
                  <FieldVoiceSpeaker
                    textHi="अपनी बोई गई धान का रकबा एकड़ में दर्ज करें।"
                    textEn="Enter your sown paddy area in acres."
                  />
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={mspAcres}
                  onChange={(e) => setMspAcres(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-surface-border rounded-xl text-sm"
                />
                <span className="text-xs text-text-muted mt-1 block">
                  {t('farmer.msp_cap_note')} = <strong>{mspCapQuintals} quintals</strong>
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-text-secondary">
                    {t('farmer.msp_calc_variety')}
                  </label>
                  <FieldVoiceSpeaker
                    textHi="धान की किस्म चुनें, जैसे सामान्य धान या ग्रेड ए धान।"
                    textEn="Select paddy variety: Common or Grade A."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMspGrade('common')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold ${
                      mspGrade === 'common'
                        ? 'border-agri-dark bg-agri-light/40 text-agri-dark font-bold'
                        : 'border-surface-border bg-white text-text-secondary'
                    }`}
                  >
                    {t('farmer.msp_common')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMspGrade('grade_a')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold ${
                      mspGrade === 'grade_a'
                        ? 'border-agri-dark bg-agri-light/40 text-agri-dark font-bold'
                        : 'border-surface-border bg-white text-text-secondary'
                    }`}
                  >
                    {t('farmer.msp_grade_a')}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-text-secondary">
                    {t('farmer.msp_calc_qty')}
                  </label>
                  <FieldVoiceSpeaker
                    textHi="मंडी में बेचने हेतु प्रस्तावित कुल धान मात्रा क्विंटल में दर्ज करें।"
                    textEn="Enter quantity offered in quintals."
                  />
                </div>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={mspQty}
                  onChange={(e) => setMspQty(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-surface-border rounded-xl text-sm"
                />
                {excessQty > 0 && (
                  <div className="text-xs text-rose-700 font-semibold mt-1">
                    सीमा से अधिक: {excessQty.toFixed(2)} क्विंटल! केवल {eligibleQty.toFixed(2)} क्विंटल का ही उपार्जन होगा।
                  </div>
                )}
              </div>

              {/* Moisture Slider with Dynamic Effect on Payout */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-text-secondary">
                    {t('farmer.msp_moisture_label')}: <strong className={mspMoisture > 17 ? 'text-rose-600' : 'text-emerald-700'}>{mspMoisture}%</strong>
                  </label>
                  <FieldVoiceSpeaker
                    textHi="फसल में नमी प्रतिशत। सत्रह प्रतिशत तक पूरा भुगतान मिलता है, सत्रह से बीस प्रतिशत तक कटौती होती है, और बीस प्रतिशत से अधिक होने पर मंडी में अस्वीकृत हो जाता है।"
                    textEn="Moisture percentage. Under 17% gets full payout, 17-20% incurs drying cut, above 20% is rejected."
                  />
                </div>
                <input
                  type="range"
                  min="12"
                  max="24"
                  step="0.5"
                  value={mspMoisture}
                  onChange={(e) => setMspMoisture(Number(e.target.value))}
                  className="w-full h-2 bg-surface-muted rounded-lg appearance-none cursor-pointer accent-agri-dark"
                />
                <div className="mt-1">
                  {mspMoisture <= 17 ? (
                    <span className="text-xs text-emerald-700 font-semibold">{t('farmer.msp_moisture_ok')} (0% कटौती)</span>
                  ) : mspMoisture <= 20 ? (
                    <span className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5" />
                      नमी {mspMoisture}% (17% से अधिक) - सुखाना आवश्यक या {((mspMoisture - 17) * 1.5).toFixed(1)}% कटौती लागू
                    </span>
                  ) : (
                    <span className="text-xs text-rose-700 font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      अस्वीकृत: 20% से अधिक नमी होने पर मंडी उपार्जन रोक दिया जाएगा! (0 भुगतान)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Results Card (Dynamically updates with moisture) */}
            <div className="bg-surface-muted/40 rounded-2xl p-5 border border-surface-border space-y-4">
              <div
                className={`p-4 rounded-xl shadow-xs text-white transition-all ${
                  isMandiRejected
                    ? 'bg-rose-700'
                    : moistureDeductionRupees > 0
                    ? 'bg-gradient-to-r from-amber-700 to-amber-800'
                    : 'bg-gradient-to-r from-agri-dark to-agri-primary'
                }`}
              >
                <span className="text-xs text-white/80 block">
                  {isMandiRejected ? 'अस्वीकृत - शुद्ध भुगतान / Net Payout' : 'वास्तविक शुद्ध देय राशि / Net Payout'}
                </span>
                <div className="text-3xl font-extrabold mt-0.5">
                  {formatRupees(totalMspPayoutNet)}
                </div>
                <div className="text-xs text-white/90 mt-1">
                  {isMandiRejected ? (
                    'नमी 20% से अधिक होने के कारण धान अस्वीकृत है। सुखाकर पुनः लाएं।'
                  ) : (
                    `प्रभावी दर: ₹${(totalCompositeRate).toLocaleString('en-IN')}/क्विंटल (${eligibleQty} qtl)`
                  )}
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 bg-white rounded-xl border border-surface-border flex justify-between">
                  <span>एमएसपी आधार ({eligibleQty} qtl @ ₹{mspRate}):</span>
                  <span className="font-bold text-text-primary">{formatRupees(mspBaseGross)}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-surface-border flex justify-between">
                  <span>कृषक उन्नति योजना ({eligibleQty} qtl @ ₹{kuyRate}):</span>
                  <span className="font-bold text-emerald-700">{formatRupees(kuyBonusGross)}</span>
                </div>
                {moistureDeductionRupees > 0 && !isMandiRejected && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex justify-between text-rose-800 font-bold">
                    <span>नमी कटौती ({mspMoisture}% नमी):</span>
                    <span>-{formatRupees(moistureDeductionRupees)}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                एमएसपी का भुगतान तौल के 48-72 घंटे के भीतर तथा कृषक उन्नति योजना इनपुट सहायता का भुगतान बैंक डीबीटी के माध्यम से सीधे बैंक खाते में जमा किया जाता है।
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: PMFBY Calculator */}
      {activeTab === 'pmfby' && (
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-agri-dark" />
              <h3 className="font-bold text-base text-text-primary">{t('farmer.pmfby_calc_title')}</h3>
            </div>
            <FieldVoiceSpeaker
              textHi="प्रधानमंत्री फसल बीमा योजना दावा कैलकुलेटर। बीमित रकबा, थ्रेसहोल्ड उपज एवं वास्तविक उपज दर्ज कर दावा राशि जानें।"
              textEn="PMFBY Crop Insurance Calculator. Enter insured acres, threshold yield, and actual yield to calculate claim."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-text-secondary">
                    {t('farmer.pmfby_acres')}
                  </label>
                  <FieldVoiceSpeaker
                    textHi="बीमित फसल का रकबा एकड़ में दर्ज करें।"
                    textEn="Enter insured area in acres."
                  />
                </div>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={pmfbyAcres}
                  onChange={(e) => setPmfbyAcres(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-surface-border rounded-xl text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-text-secondary">
                    {t('farmer.pmfby_sum_insured')}
                  </label>
                  <FieldVoiceSpeaker
                    textHi="प्रति एकड़ बीमित राशि, सामान्यतः तीस हज़ार रुपये प्रति एकड़।"
                    textEn="Sum insured per acre, typically thirty thousand rupees."
                  />
                </div>
                <input
                  type="number"
                  step="1000"
                  value={sumInsuredPerAcre}
                  onChange={(e) => setSumInsuredPerAcre(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-surface-border rounded-xl text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-text-secondary">
                    {t('farmer.pmfby_threshold_yield')}
                  </label>
                  <FieldVoiceSpeaker
                    textHi="तहसील अथवा ग्राम पंचायत की अधिसूचित थ्रेसहोल्ड उपज क्विंटल प्रति एकड़।"
                    textEn="Notified threshold yield in quintals per acre."
                  />
                </div>
                <input
                  type="number"
                  step="0.5"
                  value={thresholdYield}
                  onChange={(e) => setThresholdYield(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-surface-border rounded-xl text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-text-secondary">
                    {t('farmer.pmfby_actual_yield')}
                  </label>
                  <FieldVoiceSpeaker
                    textHi="फसल कटाई प्रयोग द्वारा प्राप्त वास्तविक उपज क्विंटल प्रति एकड़।"
                    textEn="Actual harvest yield from crop cutting experiments in quintals per acre."
                  />
                </div>
                <input
                  type="number"
                  step="0.5"
                  value={actualYield}
                  onChange={(e) => setActualYield(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-surface-border rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Results Card */}
            <div className="bg-surface-muted/40 rounded-2xl p-5 border border-surface-border space-y-4">
              <div className="p-4 bg-white rounded-xl border border-surface-border">
                <span className="text-xs text-text-muted block">{t('farmer.pmfby_claim_payout')}</span>
                <span className="text-2xl font-bold text-agri-dark">{formatRupees(pmfbyClaimAmount)}</span>
                {shortfallPct > 0 ? (
                  <div className="text-xs text-rose-700 font-semibold mt-1">
                    उपज क्षति: {(shortfallPct * 100).toFixed(1)}% (थ्रेसहोल्ड के विरुद्ध)
                  </div>
                ) : (
                  <div className="text-xs text-emerald-700 font-semibold mt-1">
                    कोई दावा नहीं: वास्तविक उपज थ्रेसहोल्ड के बराबर या अधिक है।
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-surface-border text-xs space-y-1.5 text-text-secondary">
                <div className="flex justify-between">
                  <span>Total Sum Insured:</span>
                  <span className="font-semibold text-text-primary">{formatRupees(totalSumInsured)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('farmer.pmfby_farmer_premium')}:</span>
                  <span className="font-semibold text-text-primary">{formatRupees(farmerPremium)}</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <span>{t('farmer.pmfby_claim_note')}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
