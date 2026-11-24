import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  CheckCircle2,
  Droplets,
  Sprout,
  Landmark,
  FileCheck,
  Sun,
  ArrowRight,
  Save,
  Lock,
  Layers,
  MapPin,
  FileSpreadsheet,
  Coins
} from 'lucide-react';
import type { FarmerProfile, FarmerSnapshot } from '../../types/models';
import { useTranslation } from '../../i18n';

interface FarmerProfileTabProps {
  farmer: FarmerProfile;
  snapshot: FarmerSnapshot | null;
  onNavigateToSchemes: () => void;
}

export const FarmerProfileTab: React.FC<FarmerProfileTabProps> = ({
  farmer,
  snapshot,
  onNavigateToSchemes,
}) => {
  const { language } = useTranslation();

  // Primary profile state
  const totalHa = snapshot?.parcels?.reduce((sum, p) => sum + parseFloat(p.area_ha || '0'), 0) || 1.62;
  const initialCategory = totalHa <= 1.0 ? 'marginal' : totalHa <= 2.0 ? 'small' : 'medium_large';

  const [farmerCategory, setFarmerCategory] = useState<'marginal' | 'small' | 'medium_large'>(initialCategory);
  const [irrigationSource, setIrrigationSource] = useState<'rainfed' | 'borewell' | 'canal' | 'solar'>('canal');
  const [primaryCrop, setPrimaryCrop] = useState<'paddy' | 'maize' | 'pulses' | 'oilseeds'>('paddy');
  const [pmkisanKyc, setPmkisanKyc] = useState<'verified' | 'pending'>('verified');
  const [soilHealthCard, setSoilHealthCard] = useState<'yes' | 'no'>('yes');
  const [solarPumpNeeded, setSolarPumpNeeded] = useState<'yes' | 'no'>('yes');
  const [dbtAadhaarLinked, setDbtAadhaarLinked] = useState<'yes' | 'no'>('yes');
  const [annualIncomeRange, setAnnualIncomeRange] = useState<'lt_1lakh' | '1_to_2_5lakh' | 'gt_2_5lakh'>('1_to_2_5lakh');

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const displayName = language === 'en' ? farmer.name_en : farmer.name_hi;
  const displayFather = language === 'en' ? farmer.father_name_en : farmer.father_name_hi;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* ── DPDP ACT 2023 STATUTORY ASSURANCE BANNER ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-900 to-teal-900 text-white shadow-md border border-emerald-700/50 flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5">
          <Lock className="w-5 h-5 text-emerald-300" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
              {language === 'en' ? 'Digital Personal Data Protection (DPDP) Act 2023' : 'डिजिटल व्यक्तिगत डेटा संरक्षण (DPDP) अधिनियम 2023'}
            </span>
            <span className="bg-emerald-500/30 text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
              {language === 'en' ? 'Verified Secure' : '100% सुरक्षित'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            {language === 'chh'
              ? 'ये जानकारी केवल छत्तीसगढ़ अउ केंद्र सरकार के कृषि योजना (KCC, KUY, सौर सुजला, PM-KISAN, फसल बीमा) के सही पात्रता जांचे बर ले जावत हे। ये डेटा के कोनो दुरुपयोग नइ करे जाही।'
              : language === 'hi'
              ? 'यह अतिरिक्त जानकारी केवल आपकी सरकारी योजनाओं (KCC, KUY, सौर सुजला, PM-KISAN, फसल बीमा) की सटीक पात्रता जांचने और आपको पूर्ण लाभ दिलाने हेतु ली जा रही है। इसका कोई दुरुपयोग या वाणिज्यिक उपयोग नहीं किया जाएगा।'
              : 'This supplementary information is strictly utilized to evaluate your eligibility across Chhattisgarh & Central agricultural schemes (KCC, KUY, Saur Sujala, PM-KISAN, PMFBY). Your data is never shared or misused.'}
          </p>
        </div>
      </div>

      {/* ── VERIFIED CORE PROFILE CARD ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg border border-emerald-300">
              <User className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-900">{displayName}</h3>
                <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-300 inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{farmer.id}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {language === 'chh' ? 'ददा/पति के नाम:' : language === 'hi' ? 'पिता/पति का नाम:' : "Father's/Husband's Name:"} <strong className="text-slate-700">{displayFather}</strong>
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-xs text-slate-400 block">{language === 'en' ? 'Consent Status' : 'सहमति स्थिति'}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {language === 'en' ? 'Active DPDP Consent' : 'डीपीडीपी सहमति सक्रिय'}
            </span>
          </div>
        </div>

        {/* Verified Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-slate-400 block mb-0.5">{language === 'en' ? 'Registered Mobile' : 'पंजीकृत मोबाइल'}</span>
            <strong className="text-slate-800 font-mono text-sm">{farmer.masked_mobile || 'XXXXXX7890'}</strong>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-slate-400 block mb-0.5">{language === 'en' ? 'District & Block' : 'जिला एवं विकासखंड'}</span>
            <strong className="text-slate-800 text-sm flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>{farmer.district}, {farmer.tehsil}</span>
            </strong>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-slate-400 block mb-0.5">{language === 'en' ? 'Village / Panchayat' : 'ग्राम / पंचायत'}</span>
            <strong className="text-slate-800 text-sm">{farmer.village}</strong>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-slate-400 block mb-0.5">{language === 'en' ? 'Total Land Area' : 'कुल भू-रकबा'}</span>
            <strong className="text-slate-800 text-sm flex items-center gap-1">
              <Layers className="w-3 h-3 text-indigo-600 shrink-0" />
              <span>{totalHa.toFixed(2)} ha ({(totalHa * 2.47105).toFixed(2)} एकड़)</span>
            </strong>
          </div>
        </div>
      </div>

      {/* ── SCHEME ELIGIBILITY QUESTIONNAIRE FORM ── */}
      <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Sprout className="w-5 h-5 text-emerald-700" />
              <span>
                {language === 'chh'
                  ? 'योजना पात्रता बर अतिरिक्त विवरण (Scheme Profile)'
                  : language === 'hi'
                  ? 'योजना पात्रता हेतु अतिरिक्त विवरण (Scheme Profile)'
                  : 'Supplementary Scheme Eligibility Attributes'}
              </span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'en'
                ? 'Fill or update your agricultural profile to unlock tailored subsidy calculations & scheme matching.'
                : 'योजनाओं का सटीक लाभ व सब्सिडी गणना प्राप्त करने हेतु अपनी कृषि जानकारी दर्ज करें।'}
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-400 text-emerald-900 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>
              {language === 'chh'
                ? 'मोर प्रोफाइल सफलतापूर्वक सुरक्षित होगे! अब योजना पात्रता जांचव।'
                : language === 'hi'
                ? 'आपकी प्रोफाइल सफलतापूर्वक सुरक्षित हो गई है! अब आप अपनी पात्र योजनाएं देख सकते हैं।'
                : 'Profile details saved securely! Scheme eligibility is now updated.'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Question 1: Farmer Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-700" />
              <span>
                {language === 'chh'
                  ? '1. किसान श्रेणी (Farmer Category) *'
                  : language === 'hi'
                  ? '1. किसान श्रेणी (Farmer Category) *'
                  : '1. Farmer Landholding Category *'}
              </span>
            </label>
            <select
              value={farmerCategory}
              onChange={(e) => setFarmerCategory(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="marginal">
                {language === 'en' ? 'Marginal Farmer (< 1 Hectare / < 2.47 Acres)' : 'सीमांत किसान (< 1 हेक्टेयर / < 2.47 एकड़)'}
              </option>
              <option value="small">
                {language === 'en' ? 'Small Farmer (1 - 2 Hectare / 2.47 - 5 Acres)' : 'लघु किसान (1 से 2 हेक्टेयर / 2.47 से 5 एकड़)'}
              </option>
              <option value="medium_large">
                {language === 'en' ? 'Medium / Large Farmer (> 2 Hectare / > 5 Acres)' : 'मध्यम व बड़े किसान (> 2 हेक्टेयर / > 5 एकड़)'}
              </option>
            </select>
            <span className="text-[10px] text-slate-500 block">
              {language === 'en' ? 'Used for KCC subvention rate & subsidy slabs.' : 'केसीसी ब्याज छूट व अधिकतम सब्सिडी दर हेतु उपयोग।'}
            </span>
          </div>

          {/* Question 2: Irrigation Source */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {language === 'chh'
                  ? '2. सिंचाई के साधन (Irrigation Type) *'
                  : language === 'hi'
                  ? '2. सिंचाई साधन (Irrigation Facility) *'
                  : '2. Primary Irrigation Source *'}
              </span>
            </label>
            <select
              value={irrigationSource}
              onChange={(e) => setIrrigationSource(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="canal">
                {language === 'en' ? 'Canal / Government Water Supply (नहर / शासकीय स्रोत)' : 'नहर / शासकीय स्रोत (Canal / Gov Supply)'}
              </option>
              <option value="borewell">
                {language === 'en' ? 'Tube Well / Borewell (नलकूप / बोरवेल)' : 'नलकूप / बोरवेल (Tube Well / Borewell)'}
              </option>
              <option value="rainfed">
                {language === 'en' ? 'Rainfed Only (केवल वर्षा आधारित / असिंचित)' : 'केवल वर्षा आधारित / असिंचित (Rainfed)'}
              </option>
              <option value="solar">
                {language === 'en' ? 'Solar Pump Already Installed (सौर पंप स्थापित)' : 'सौर पंप स्थापित (Solar Pump)'}
              </option>
            </select>
            <span className="text-[10px] text-slate-500 block">
              {language === 'en' ? 'Determines Scale of Finance (₹62,000/ha irrigated vs ₹45,000/ha rainfed).' : 'सिंचित (₹62,000/हे.) बनाम असिंचित (₹45,000/हे.) केसीसी दर हेतु।'}
            </span>
          </div>

          {/* Question 3: Primary Crop */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sprout className="w-3.5 h-3.5 text-emerald-700" />
              <span>
                {language === 'chh'
                  ? '3. मुख्य बोई गई फसल (Crop) *'
                  : language === 'hi'
                  ? '3. मुख्य बोई गई फसल (Crop) *'
                  : '3. Primary Crop Cultivated *'}
              </span>
            </label>
            <select
              value={primaryCrop}
              onChange={(e) => setPrimaryCrop(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="paddy">
                {language === 'en' ? 'Paddy / धान (Krishak Unnati Yojana ₹3,100/qtl Eligible)' : 'धान / Paddy (कृषक उन्नति योजना ₹3,100/क्विंटल पात्र)'}
              </option>
              <option value="maize">
                {language === 'en' ? 'Maize / मक्का (MSP Eligible)' : 'मक्का / Maize (MSP पात्र)'}
              </option>
              <option value="pulses">
                {language === 'en' ? 'Pulses / दलहन (Kodo-Kutki / Ragi)' : 'दलहन व मिलेट्स / Pulses & Millets'}
              </option>
              <option value="oilseeds">
                {language === 'en' ? 'Oilseeds / तिलहन' : 'तिलहन / Oilseeds'}
              </option>
            </select>
          </div>

          {/* Question 4: Saur Sujala Solar Pump Requirement */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {language === 'chh'
                  ? '4. सौर सुजला योजना (Solar Pump Subsidy) के जरूरत हे?'
                  : language === 'hi'
                  ? '4. सौर सुजला योजना (Solar Pump Subsidy) की आवश्यकता है?'
                  : '4. Need Solar Irrigation Pump (Saur Sujala Yojana)?'}
              </span>
            </label>
            <select
              value={solarPumpNeeded}
              onChange={(e) => setSolarPumpNeeded(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="yes">
                {language === 'en' ? 'Yes, I require subsidized Solar Pump (हाँ, आवश्यकता है)' : 'हाँ, रियायती सौर पंप की आवश्यकता है (Yes)'}
              </option>
              <option value="no">
                {language === 'en' ? 'No / Already have grid or solar power' : 'नहीं / पहले से बिजली या सौर पंप उपलब्ध है (No)'}
              </option>
            </select>
          </div>

          {/* Question 5: PM-KISAN e-KYC */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>
                {language === 'chh'
                  ? '5. पीएम-किसान ई-केवाईसी (PM-KISAN eKYC)'
                  : language === 'hi'
                  ? '5. पीएम-किसान ई-केवाईसी स्थिति (PM-KISAN eKYC)'
                  : '5. PM-KISAN eKYC Status'}
              </span>
            </label>
            <select
              value={pmkisanKyc}
              onChange={(e) => setPmkisanKyc(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="verified">
                {language === 'en' ? 'Completed & Verified (पूर्ण एवं सत्यापित)' : 'पूर्ण एवं सत्यापित (Completed & Verified)'}
              </option>
              <option value="pending">
                {language === 'en' ? 'Pending Biometric / Aadhaar OTP (लंबित)' : 'लंबित (Pending e-KYC)'}
              </option>
            </select>
          </div>

          {/* Question 6: DBT Aadhaar NPCI Link */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-indigo-700" />
              <span>
                {language === 'chh'
                  ? '6. बैंक खाता आधार डीबीटी सीडेड हे? (NPCI Link)'
                  : language === 'hi'
                  ? '6. बैंक खाता आधार डीबीटी सीडेड है? (NPCI Link)'
                  : '6. Bank Account Aadhaar NPCI DBT Seeded?'}
              </span>
            </label>
            <select
              value={dbtAadhaarLinked}
              onChange={(e) => setDbtAadhaarLinked(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="yes">
                {language === 'en' ? 'Yes, NPCI Direct Benefit Transfer Active (हाँ, सक्रिय)' : 'हाँ, एनपीसीआई डीबीटी सक्रिय (Yes)'}
              </option>
              <option value="no">
                {language === 'en' ? 'No / Not sure (नहीं अथवा निश्चित नहीं)' : 'नहीं अथवा निश्चित नहीं (No / Unsure)'}
              </option>
            </select>
          </div>

          {/* Question 7: Soil Health Card */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>
                {language === 'chh'
                  ? '7. मृदा स्वास्थ्य कार्ड (Soil Health Card)'
                  : language === 'hi'
                  ? '7. मृदा स्वास्थ्य कार्ड (Soil Health Card)'
                  : '7. Soil Health Card Available?'}
              </span>
            </label>
            <select
              value={soilHealthCard}
              onChange={(e) => setSoilHealthCard(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="yes">
                {language === 'en' ? 'Yes, Issued within 3 years (हाँ, उपलब्ध है)' : 'हाँ, उपलब्ध है (Yes, Active Card)'}
              </option>
              <option value="no">
                {language === 'en' ? 'No / Not tested (उपलब्ध नहीं है)' : 'उपलब्ध नहीं है (No / Not Issued)'}
              </option>
            </select>
          </div>

          {/* Question 8: Annual Income Bracket */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {language === 'chh'
                  ? '8. वार्षिक आय वर्ग (Annual Farm Income)'
                  : language === 'hi'
                  ? '8. वार्षिक कृषि आय वर्ग (Annual Farm Income)'
                  : '8. Annual Farm Income Slabs'}
              </span>
            </label>
            <select
              value={annualIncomeRange}
              onChange={(e) => setAnnualIncomeRange(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none"
            >
              <option value="lt_1lakh">
                {language === 'en' ? 'Less than ₹1.00 Lakh (₹1 लाख से कम)' : '₹1 लाख से कम (< ₹1 Lakh)'}
              </option>
              <option value="1_to_2_5lakh">
                {language === 'en' ? '₹1.00 Lakh - ₹2.50 Lakh (₹1 से ₹2.5 लाख)' : '₹1 लाख से ₹2.5 लाख (₹1 - 2.5 Lakhs)'}
              </option>
              <option value="gt_2_5lakh">
                {language === 'en' ? 'Greater than ₹2.50 Lakh (₹2.5 लाख से अधिक)' : '₹2.5 लाख से अधिक (> ₹2.5 Lakhs)'}
              </option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all min-h-[44px] cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>
              {language === 'chh' ? 'प्रोफाइल सुरक्षित करव (Save Profile)' : language === 'hi' ? 'प्रोफाइल सुरक्षित करें (Save Profile)' : 'Save Profile Details'}
            </span>
          </button>

          <button
            type="button"
            onClick={onNavigateToSchemes}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl border-2 border-emerald-600 text-emerald-800 hover:bg-emerald-50 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all min-h-[44px] cursor-pointer"
          >
            <span>
              {language === 'chh' ? 'पात्र योजनाएं देखव' : language === 'hi' ? 'पात्र योजनाएं देखें' : 'View Matching Schemes'}
            </span>
            <ArrowRight className="w-4 h-4 text-emerald-700" />
          </button>
        </div>
      </form>
    </div>
  );
};
export default FarmerProfileTab;
