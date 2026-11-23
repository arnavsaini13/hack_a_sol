import React from 'react';
import { User, MapPin, ShieldCheck, RefreshCw, Sprout, Layers } from 'lucide-react';
import type { FarmerProfile, LandParcel } from '../../types/models';
import { useTranslation } from '../../i18n';

interface FarmerProfileHeaderProps {
  farmer: FarmerProfile;
  parcels?: LandParcel[];
  onLogout: () => void;
}

export const FarmerProfileHeader: React.FC<FarmerProfileHeaderProps> = ({
  farmer,
  parcels = [],
  onLogout,
}) => {
  const { language } = useTranslation();

  const displayName = language === 'en' ? farmer.name_en : farmer.name_hi;
  const displayFather = language === 'en' ? farmer.father_name_en : farmer.father_name_hi;

  // Aggregate parcel details
  const khasraList = parcels.map((p) => p.khasra_no).join(', ') || '142/1';
  const totalHa = parcels.reduce((sum, p) => sum + parseFloat(p.area_ha || '0'), 0);
  const totalAcres = parcels.reduce((sum, p) => sum + parseFloat(p.area_acres || '0'), 0);
  const girdawariCrop = parcels[0]?.girdawari_crop || (language === 'en' ? 'Paddy' : 'धान (Paddy)');

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in">
      <div className="flex items-start sm:items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0 border border-emerald-300 shadow-inner">
          <User className="w-6 h-6 text-emerald-700" />
        </div>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">
              {displayName}
            </h2>
            <span className="text-[11px] bg-emerald-100 text-emerald-900 font-bold px-2.5 py-0.5 rounded-full border border-emerald-300 inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>{farmer.id}</span>
            </span>
          </div>

          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              <strong>{language === 'chh' ? 'ददा/पिता:' : language === 'hi' ? 'पिता:' : 'Father:'}</strong> {displayFather}
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-600" />
              <span>{farmer.village}, {farmer.tehsil}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1">
              <Layers className="w-3 h-3 text-indigo-600" />
              <span>
                <strong>{language === 'en' ? 'Khasra:' : 'खसरा:'}</strong> {khasraList}
              </span>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              <strong>{language === 'chh' ? 'रकबा (जमीन):' : language === 'hi' ? 'रकबा:' : 'Land:'}</strong>{' '}
              {totalHa > 0 ? `${totalHa.toFixed(2)} ha (${totalAcres.toFixed(2)} एकड़)` : '1.62 ha (4.00 एकड़)'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
              <Sprout className="w-3 h-3 text-emerald-700" />
              <span>{girdawariCrop}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Change Farmer Action */}
      <div className="self-end md:self-auto shrink-0">
        <button
          type="button"
          onClick={onLogout}
          className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs min-h-[40px]"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>{language === 'chh' ? 'दूसर किसान चुनव' : language === 'hi' ? 'किसान बदलें' : 'Change Farmer'}</span>
        </button>
      </div>
    </div>
  );
};
export default FarmerProfileHeader;
