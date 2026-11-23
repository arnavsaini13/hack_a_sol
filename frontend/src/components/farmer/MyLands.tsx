import React, { useState } from 'react';
import { MapPin, ShieldCheck, AlertCircle, ChevronDown, ChevronUp, Layers, Wheat } from 'lucide-react';
import { useTranslation } from '../../i18n';
import type { LandParcel } from '../../types/models';

interface MyLandsProps {
  parcels: LandParcel[];
}

export const MyLands: React.FC<MyLandsProps> = ({ parcels }) => {
  const { t } = useTranslation();
  const [expandedParcelId, setExpandedParcelId] = useState<string | null>(null);

  // Totals calculation
  const totalHa = parcels.reduce((sum, p) => sum + parseFloat(p.area_ha || '0'), 0);
  const totalAcres = parcels.reduce((sum, p) => sum + parseFloat(p.area_acres || '0'), 0);
  const totalPaddyCap = parcels.reduce((sum, p) => {
    if (p.girdawari_crop?.toLowerCase().includes('paddy') || p.girdawari_crop?.includes('धान')) {
      const cap = parseFloat(p.area_acres || '0') * 21;
      return sum + cap;
    }
    return sum;
  }, 0);

  const toggleExpand = (id: string) => {
    setExpandedParcelId(expandedParcelId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <div className="bg-gradient-to-r from-agri-dark to-agri-primary text-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-agri-accent" />
            <h3 className="text-lg font-bold">{t('farmer.lands_title')}</h3>
          </div>
          <span className="text-xs bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full font-medium">
            {parcels.length} {parcels.length === 1 ? 'Parcel' : 'Parcels'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/20">
          <div>
            <div className="text-xs text-white/80">{t('farmer.area_ha')}</div>
            <div className="text-lg font-bold">{totalHa.toFixed(4)} ha</div>
          </div>
          <div>
            <div className="text-xs text-white/80">{t('farmer.area_acres')}</div>
            <div className="text-lg font-bold">{totalAcres.toFixed(2)} acres</div>
          </div>
          <div>
            <div className="text-xs text-white/80">{t('farmer.paddy_cap')}</div>
            <div className="text-lg font-bold text-agri-accent">{totalPaddyCap.toFixed(2)} qtl</div>
          </div>
        </div>
      </div>

      {/* Parcel Cards */}
      <div className="space-y-4">
        {parcels.map((p) => {
          const isExpanded = expandedParcelId === p.parcel_id;
          const isPaddy = p.girdawari_crop?.toLowerCase().includes('paddy') || p.girdawari_crop?.includes('धान');
          const isMortgaged = p.mortgage_status === 'MORTGAGED';
          const paddyCap = (parseFloat(p.area_acres || '0') * 21).toFixed(2);

          return (
            <div
              key={p.parcel_id}
              className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden transition-all hover:border-agri-primary/40"
            >
              {/* Header row / Clickable summary */}
              <button
                type="button"
                onClick={() => toggleExpand(p.parcel_id)}
                className="w-full text-left p-5 flex items-center justify-between gap-4 min-h-[56px] focus:outline-none"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`p-3 rounded-xl ${isPaddy ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    <Wheat className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-text-primary">
                        {t('farmer.khasra')}: {p.khasra_no}
                      </span>
                      {isMortgaged ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                          <AlertCircle className="w-3 h-3" />
                          {t('farmer.mortgaged')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <ShieldCheck className="w-3 h-3" />
                          {t('farmer.clean_title')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-text-secondary mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-text-muted" />
                      <span>{p.village}, {p.tehsil}, {p.district}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <div className="font-bold text-text-primary">{p.area_acres} acres</div>
                    <div className="text-xs text-text-muted">{p.girdawari_crop}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-muted text-text-secondary">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-surface-border/60 bg-surface-muted/30 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="p-3 bg-white rounded-xl border border-surface-border">
                      <span className="text-xs text-text-muted block">{t('farmer.area_ha')}</span>
                      <span className="font-bold text-text-primary">{p.area_ha} ha</span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-surface-border">
                      <span className="text-xs text-text-muted block">{t('farmer.area_acres')}</span>
                      <span className="font-bold text-text-primary">{p.area_acres} acres</span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-surface-border">
                      <span className="text-xs text-text-muted block">{t('farmer.girdawari_crop')}</span>
                      <span className="font-bold text-agri-dark">{p.girdawari_crop}</span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-surface-border">
                      <span className="text-xs text-text-muted block">{t('farmer.paddy_cap')}</span>
                      <span className="font-bold text-amber-700">{paddyCap} qtl</span>
                    </div>
                  </div>

                  {isMortgaged && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold block">{t('bank.mortgage_alert')}</span>
                        <span>Mortgage registered with: <strong>{p.mortgage_bank || 'Lending Institution'}</strong></span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-surface-border/40">
                    <span>Source: Chhattisgarh Bhuiyan Land Registry</span>
                    <span className="font-mono bg-surface-muted px-2 py-0.5 rounded">ID: {p.parcel_id}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
