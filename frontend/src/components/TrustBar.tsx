import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';
import { useTranslation } from '../i18n';

export const TrustBar: React.FC = () => {
  const { language } = useTranslation();

  return (
    <div className="bg-emerald-950 text-emerald-100 text-xs py-1.5 px-4 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-900 sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 font-semibold bg-emerald-800 text-white px-2 py-0.5 rounded-full text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
          {language === 'en' ? 'Govt of Chhattisgarh' : 'छत्तीसगढ़ शासन'}
        </span>
        <span className="hidden sm:inline text-emerald-300">•</span>
        <span className="text-emerald-200">
          {language === 'chh'
            ? 'किसान नीति अउ पारदर्शी उपार्जन मंच'
            : language === 'hi'
            ? 'कृषि नीति एवं पारदर्शी उपार्जन मंच'
            : 'Agricultural Policy & Transparency Platform'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-emerald-200 bg-emerald-900/60 px-2 py-0.5 rounded text-[11px]">
          <Info className="w-3 h-3 text-emerald-400" />
          {language === 'en' ? 'Helpline: 1800-180-1551' : 'हेल्पलाइन: 1800-180-1551'}
        </span>
      </div>
    </div>
  );
};

