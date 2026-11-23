import React, { useEffect, useState } from 'react';
import { Shield, ExternalLink, CheckCircle2, Clock } from 'lucide-react';
import { getRules } from '../services/api';
import type { RulesData } from '../types/models';
import { useTranslation } from '../i18n';

export const RulesPage: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<RulesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRules()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-text-secondary">
        <Clock className="w-6 h-6 animate-spin text-agri-primary mr-2" />
        <span>{t('app.loading')}</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-alert-redLight text-alert-red p-4 rounded-xl border border-alert-redBorder">
        {t('app.error')}: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-agri-light text-agri-dark">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">{t('rules.title')}</h2>
            <p className="text-sm text-text-secondary">{t('rules.subtitle')}</p>
          </div>
        </div>

        {/* Persistent Provenance Notice */}
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span>
            {data.trust_bar.verification_state} (Mode: {data.trust_bar.data_mode})
          </span>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface-muted text-text-secondary border-b border-surface-border text-xs uppercase tracking-wider">
                <th className="py-3 px-4">{t('rules.col_id')}</th>
                <th className="py-3 px-4">{t('rules.col_desc')}</th>
                <th className="py-3 px-4">{t('rules.col_value')}</th>
                <th className="py-3 px-4">{t('rules.col_effective')}</th>
                <th className="py-3 px-4">{t('rules.col_status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {data.rules.map((rule) => (
                <tr key={rule.rule_id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-medium text-xs text-emerald-800">
                    {rule.rule_id}
                  </td>
                  <td className="py-3.5 px-4 text-text-primary">
                    <div>{rule.description}</div>
                    {rule.source_url && (
                      <a
                        href={rule.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-agri-primary hover:underline mt-0.5"
                      >
                        Source Link <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-text-primary">
                    {String(rule.value)} <span className="text-xs text-text-secondary font-normal">{rule.unit}</span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-text-secondary">
                    {rule.effective_date || 'Statutory Permanent'}
                  </td>
                  <td className="py-3.5 px-4">
                    {rule.verified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {t('rules.badge_verified')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        {t('rules.badge_pending')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
