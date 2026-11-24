import React from 'react';
import {
  TrendingUp,
  CloudSun,
  PhoneCall,
  CheckCircle2,
  Sprout
} from 'lucide-react';
import { useTranslation } from '../../i18n';

interface FarmerHeroBannerProps {
  farmerName?: string;
}

export const FarmerHeroBanner: React.FC<FarmerHeroBannerProps> = ({
  farmerName,
}) => {
  const { language } = useTranslation();

  return (
    <div className="space-y-4">
      {/* 1. Main Hero Image Banner (Majestic Farmer Sunrise Background) */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl border border-amber-300/40 bg-slate-900">
        {/* Background Image with warm golden-hour silhouette */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-80 mix-blend-luminosity transform scale-105 hover:scale-100 transition-transform duration-1000"
          style={{ backgroundImage: `url('/farmer-hero.jpg')` }}
        />
        {/* Warm Vignette Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-emerald-950/80" />
        
        {/* Subtle Tricolor Accent Glow Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808]" />

        {/* Banner Content */}
        <div className="relative p-6 sm:p-10 space-y-4 text-white max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold tracking-wide">
            <Sprout className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {language === 'chh' 
                ? 'जन-कृषि मंच • पारदर्शी किसान अधिकार' 
                : language === 'hi' 
                ? 'जन-कृषि मंच • पारदर्शी किसान अधिकार एवं गणना' 
                : 'JanAgriPortal • Agricultural Entitlements & Transparency'}
            </span>
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl sm:text-5xl font-black text-amber-400 tracking-tight drop-shadow-lg font-sans">
              जय जवान जय किसान
            </h1>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-wide font-serif drop-shadow-md">
              Jai Jawan Jai Kisan
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed font-medium">
            {language === 'chh'
              ? 'समृद्ध किसान, सशक्त भारत • पारदर्शी धान उपार्जन ₹3,100, 0% ब्याज करजा अउ फसल बीमा अधिकार।'
              : language === 'hi'
              ? 'समृद्ध किसान, सशक्त भारत • पारदर्शी धान उपार्जन ₹3,100, 0% ब्याज ऋण एवं फसल बीमा अधिकार।'
              : 'Empowering Indian Agriculture with 100% statutory transparency in ₹3,100/Qtl Paddy MSP, 0% KCC subvention, and crop insurance.'}
          </p>

          {farmerName && (
            <div className="pt-2 flex items-center gap-2 text-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                {language === 'hi' ? `सत्यापित किसान: ${farmerName}` : language === 'chh' ? `जांचे गे किसान: ${farmerName}` : `Verified Farmer: ${farmerName}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Official Dashboard Live Updates Card */}
      <div className="bg-white rounded-2xl border border-amber-300/80 p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          
          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-900 font-extrabold text-[11px] uppercase tracking-wide border border-orange-300">
              Dashboard (डैशबोर्ड)
            </span>
          </div>

          {/* 3 Live Info Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 w-full md:w-auto">
            
            {/* 1. Mandi Prices */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-amber-50/80 border border-amber-200">
              <TrendingUp className="w-4 h-4 text-amber-700 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">
                  Mandi Prices (e-NAM)
                </span>
                <span className="text-xs font-black text-slate-900">
                  ₹2,320 + ₹780 = <span className="text-emerald-700">₹3,100/Qtl</span>
                </span>
              </div>
            </div>

            {/* 2. Weather Forecast */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-sky-50/80 border border-sky-200">
              <CloudSun className="w-4 h-4 text-sky-700 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">
                  Weather (Raipur)
                </span>
                <span className="text-xs font-black text-slate-900">
                  Clear Skies, 28°C
                </span>
              </div>
            </div>

            {/* 3. Toll-Free Helpline */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-emerald-50/80 border border-emerald-200">
              <PhoneCall className="w-4 h-4 text-emerald-700 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold block uppercase">
                  Toll-Free Helpline
                </span>
                <span className="text-xs font-black text-emerald-800">
                  1800-180-1551
                </span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
export default FarmerHeroBanner;
