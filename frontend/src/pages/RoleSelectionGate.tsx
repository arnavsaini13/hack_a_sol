import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout, Building2, BarChart3, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../i18n';

export const RoleSelectionGate: React.FC = () => {
  const { language } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-8 px-4 sm:px-6">
      <div className="max-w-4xl w-full space-y-8">
        {/* Title Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>
              {language === 'chh'
                ? 'जन-कृषि मंच • पारदर्शी नागरिक अधिकार पोर्टल'
                : language === 'hi'
                ? 'जन-कृषि मंच • पारदर्शी नागरिक अधिकार पोर्टल'
                : 'JanAgriPortal • Open Agricultural Entitlements & Verification Platform'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
            {language === 'chh' ? 'तुमन कोन अव?' : language === 'hi' ? 'आप कौन हैं?' : 'Who are you?'}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
            {language === 'chh'
              ? 'पारदर्शिता मंच म प्रवेश बर अपन भूमिका चुनव। सबो कानूनी हिसाब अउ योजना सीधा नियम ले चलत हे।'
              : language === 'hi'
              ? 'पारदर्शिता मंच में प्रवेश हेतु अपनी भूमिका चुनें। सभी वैधानिक गणनाएं एवं योजनाएं प्रत्यक्ष नियमों द्वारा संचालित हैं।'
              : 'Select your role to access statutory entitlements, bank audit queues, and policy dashboards.'}
          </p>
        </div>

        {/* 3 Unmistakable Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* 1. Farmer Card */}
          <div
            onClick={() => navigate('/farmer')}
            className="group relative bg-white hover:bg-emerald-50/50 rounded-2xl p-6 border-2 border-slate-200 hover:border-emerald-600 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-5"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-300 group-hover:scale-105 transition-transform shadow-inner">
                <Sprout className="w-8 h-8 text-emerald-700" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 block mb-1">
                  {language === 'en' ? 'Citizen Portal' : 'नागरिक सेवा'}
                </span>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {language === 'en' ? 'Farmer (किसान)' : 'किसान (Farmer)'}
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {language === 'chh'
                  ? 'खसरा नंबर डाल के अपन जमीन, ₹3,100 धान एमएसपी, 0% केसीसी ब्याज छूट अउ फसल बीमा दावा के हिसाब जानव।'
                  : language === 'hi'
                  ? 'खसरा नंबर दर्ज कर अपनी भूमि, ₹3,100 धान एमएसपी, 0% केसीसी ब्याज अनुदान एवं फसल बीमा दावों का पारदर्शी हिसाब जानें।'
                  : 'Verify statutory entitlements for ₹3,100 Paddy MSP, 0% KCC subvention, and PMFBY crop insurance claims via Khasra.'}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-emerald-700 font-extrabold text-xs group-hover:text-emerald-800">
              <span>{language === 'chh' ? 'मोर हक जानव' : language === 'hi' ? 'मेरा हक जानें' : 'Check My Entitlements'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 2. Bank Officer Card */}
          <div
            onClick={() => navigate('/bank')}
            className="group relative bg-white hover:bg-indigo-50/50 rounded-2xl p-6 border-2 border-slate-200 hover:border-indigo-600 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-5"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center border border-indigo-300 group-hover:scale-105 transition-transform shadow-inner">
                <Building2 className="w-8 h-8 text-indigo-700" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 block mb-1">
                  {language === 'en' ? 'Branch Officer' : 'शाखा कंसोल'}
                </span>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {language === 'en' ? 'Bank Officer (बैंक अधिकारी)' : 'बैंक अधिकारी (Bank Officer)'}
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {language === 'chh'
                  ? 'केसीसी करजा आवेदन सत्यापन, भुइयां जमीन रिकॉर्ड मिलान, डुप्लीकेट करजा अलर्ट, अउ जमीन बंधक स्थिति के जांच।'
                  : language === 'hi'
                  ? 'केसीसी ऋण आवेदन सत्यापन, भुइयां भूमि रिकॉर्ड मिलान, डुप्लीकेट ऋण अलर्ट, एवं भूमि बंधक स्थिति की जांच।'
                  : 'Review KCC credit applications with automated land record verification, fuzzy name matching, and duplicate KCC alerts.'}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-indigo-700 font-extrabold text-xs group-hover:text-indigo-800">
              <span>{language === 'chh' ? 'शाखा कंसोल खोलव' : language === 'hi' ? 'शाखा कंसोल खोलें' : 'Open Bank Console'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 3. Policymaker Card */}
          <div
            onClick={() => navigate('/policy')}
            className="group relative bg-white hover:bg-purple-50/50 rounded-2xl p-6 border-2 border-slate-200 hover:border-purple-600 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-5"
          >
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center border border-purple-300 group-hover:scale-105 transition-transform shadow-inner">
                <BarChart3 className="w-8 h-8 text-purple-700" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 block mb-1">
                  {language === 'en' ? 'Analytics & Audit' : 'प्रशासनिक विश्लेषण'}
                </span>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {language === 'en' ? 'Policymaker (नीति निर्माता)' : 'नीति निर्माता (Policymaker)'}
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {language === 'chh'
                  ? 'राज्यभर के डीबीटी बिलंब बॉटलनेक विश्लेषण, स्मॉल-सेल प्राइवेसी सुरक्षा, अउ मजबूत ऑडिट ट्रेल निगरानी।'
                  : language === 'hi'
                  ? 'राज्यस्तरीय डीबीटी विलंब बॉटलनेक विश्लेषण, स्मॉल-सेल प्राइवेसी सुरक्षा, एवं अपरिवर्तनीय ऑडिट ट्रेल निगरानी।'
                  : 'Monitor systemic subsidy delays, privacy-preserving small-cell bottleneck suppression, and unbroken audit logs.'}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-purple-700 font-extrabold text-xs group-hover:text-purple-800">
              <span>{language === 'chh' ? 'नीति डैशबोर्ड देखव' : language === 'hi' ? 'नीति डैशबोर्ड देखें' : 'View Policy Dashboard'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* Official Citizen Helpline Banner */}
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {language === 'chh'
                ? 'किसान नीति, फसल बीमा अउ करजा पारदर्शिता मंच • जन-कृषि'
                : language === 'hi'
                ? 'कृषि नीति, फसल बीमा एवं ऋण पारदर्शिता मंच • जन-कृषि'
                : 'Agricultural Policy, Crop Insurance & Credit Transparency Platform'}
            </span>
          </div>
          <div className="text-xs font-semibold text-emerald-800">
            {language === 'en' ? 'Kisan Call Center: 1800-180-1551' : 'किसान कॉल सेंटर: 1800-180-1551'}
          </div>
        </div>
      </div>
    </div>
  );
};
export default RoleSelectionGate;
