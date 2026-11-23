import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Search,
  Lock,
  Layers,
  ArrowRight,
  Shield,
  EyeOff,
  Filter
} from 'lucide-react';
import { useTranslation } from '../i18n';
import { getPolicyBottlenecks, getPolicyAuditLog } from '../services/api';
import type { PolicyDashboardData } from '../types/models';

interface AuditLogResponse {
  chain_valid: boolean;
  tamper_detected: boolean;
  integrity_status: string;
  total_events: number;
  events: Array<{
    id: number;
    prev_hash: string;
    entry_hash: string;
    actor: string;
    subject: string;
    action: string;
    timestamp: string;
  }>;
}

export const PolicyView: React.FC = () => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'bottlenecks' | 'audit'>('bottlenecks');
  const [loading, setLoading] = useState<boolean>(true);
  const [bottleneckData, setBottleneckData] = useState<PolicyDashboardData | null>(null);
  const [auditData, setAuditData] = useState<AuditLogResponse | null>(null);

  // Filters
  const [selectedScheme, setSelectedScheme] = useState<string>('ALL');
  const [searchDistrict, setSearchDistrict] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bData, aData] = await Promise.all([
        getPolicyBottlenecks(),
        getPolicyAuditLog(),
      ]);
      setBottleneckData(bData);
      setAuditData(aData as AuditLogResponse);
    } catch (err) {
      console.error('Error fetching policy data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredBottlenecks = (bottleneckData?.bottlenecks || []).filter((item) => {
    if (selectedScheme !== 'ALL' && item.scheme !== selectedScheme) return false;
    if (searchDistrict.trim()) {
      const q = searchDistrict.toLowerCase();
      return item.district.toLowerCase().includes(q) || item.tehsil.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* AgriGov Portal Top Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-agri-dark text-white rounded-2xl p-6 shadow-sm border border-emerald-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest bg-emerald-500/30 text-emerald-200 px-2.5 py-0.5 rounded font-bold">
                AgriGov Portal
              </span>
              <span className="text-xs text-emerald-200">Government of Chhattisgarh</span>
            </div>
            <h2 className="text-2xl font-bold mt-1">{t('policy.title')}</h2>
            <p className="text-xs text-emerald-100/90 mt-0.5">{t('policy.subtitle')}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors border border-white/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>

        {/* Small-Cell Suppression Privacy Guarantee Banner */}
        <div className="mt-4 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-100">
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-emerald-300" />
            <span className="font-semibold">{t('policy.stat_privacy_active')}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] bg-black/20 px-2 py-0.5 rounded">
            <Lock className="w-3 h-3 text-emerald-300" />
            <span>K-Anonymity Guard: ENFORCED</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-surface-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-text-muted font-medium mb-1">
            <span>{t('policy.stat_total_delayed')}</span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-text-primary">
            {bottleneckData?.total_delayed_farmers_display || '...'}
          </div>
          <span className="text-xs text-text-secondary mt-1 block">
            Aggregated across all blocks & districts
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-surface-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-text-muted font-medium mb-1">
            <span>{t('policy.stat_total_amount')}</span>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-rose-700">
            {bottleneckData?.total_state_delayed_amount_display || '...'}
          </div>
          <span className="text-xs text-text-secondary mt-1 block">
            Pending statutory DBT / subsidy release
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-surface-border shadow-xs">
          <div className="flex items-center justify-between text-xs text-text-muted font-medium mb-1">
            <span>Audit Chain Integrity</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 flex items-center gap-1.5">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <span>{auditData?.chain_valid ? '100% Verified' : 'Alert'}</span>
          </div>
          <span className="text-xs text-emerald-800 mt-1 block font-medium">
            {auditData?.total_events || 0} Cryptographically chained events
          </span>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex border-b border-surface-border bg-white rounded-2xl p-1.5 shadow-xs gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('bottlenecks')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors min-h-[44px] ${
            activeTab === 'bottlenecks'
              ? 'bg-agri-dark text-white shadow-xs'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted/50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{t('policy.tab_bottlenecks')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors min-h-[44px] ${
            activeTab === 'audit'
              ? 'bg-agri-dark text-white shadow-xs'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted/50'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>{t('policy.tab_audit')}</span>
        </button>
      </div>

      {/* Tab 1: Bottlenecks Analysis */}
      {activeTab === 'bottlenecks' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl p-4 border border-surface-border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-text-muted" />
              <select
                value={selectedScheme}
                onChange={(e) => setSelectedScheme(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-surface-border text-xs font-semibold bg-white"
              >
                <option value="ALL">All Schemes</option>
                <option value="KUY">Krishak Unnati Yojana (KUY)</option>
                <option value="KCC">Kisan Credit Card (KCC)</option>
                <option value="PMFBY">PMFBY Crop Insurance</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search District / Tehsil..."
                value={searchDistrict}
                onChange={(e) => setSearchDistrict(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-surface-border rounded-xl bg-surface-muted/30 focus:bg-white"
              />
            </div>
          </div>

          {/* Bottleneck Table / Cards */}
          {loading ? (
            <div className="text-center py-12 text-text-muted space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
              <p className="text-xs">Computing bottlenecks from event log...</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-surface-border shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted/70 border-b border-surface-border font-bold text-text-secondary uppercase">
                    <tr>
                      <th className="p-4">{t('policy.col_district')} / {t('policy.col_tehsil')}</th>
                      <th className="p-4">{t('policy.col_scheme')}</th>
                      <th className="p-4">{t('policy.col_stage')}</th>
                      <th className="p-4 text-right">{t('policy.col_affected')}</th>
                      <th className="p-4 text-right">{t('policy.col_amount')}</th>
                      <th className="p-4 text-right">{t('policy.col_delay')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {filteredBottlenecks.map((item, idx) => (
                      <tr key={idx} className="hover:bg-surface-muted/20 transition-colors">
                        <td className="p-4 font-semibold text-text-primary">
                          <div>{item.district}</div>
                          <div className="text-[11px] text-text-muted font-normal">{item.tehsil}</div>
                        </td>

                        <td className="p-4">
                          <span className="font-bold px-2 py-0.5 rounded bg-surface-muted text-text-primary">
                            {item.scheme}
                          </span>
                        </td>

                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs">
                            <ArrowRight className="w-3 h-3 text-amber-600" />
                            {item.stage}
                          </span>
                        </td>

                        <td className="p-4 text-right font-medium">
                          {item.is_suppressed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                              <EyeOff className="w-3 h-3 text-purple-600" />
                              {item.affected_count_display}
                            </span>
                          ) : (
                            <span className="font-bold text-text-primary text-sm">
                              {item.affected_count_display}
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-right font-bold text-rose-700">
                          {item.total_delayed_paise_display}
                        </td>

                        <td className="p-4 text-right">
                          <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                            {item.average_delay_days} days
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Cryptographic Audit Chain */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Integrity Guarantee Card */}
          <div
            className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              auditData?.chain_valid
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-xl text-white ${
                  auditData?.chain_valid ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              >
                {auditData?.chain_valid ? (
                  <ShieldCheck className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-base">
                  {auditData?.chain_valid
                    ? t('policy.audit_chain_valid')
                    : t('policy.audit_chain_tampered')}
                </h3>
                <p className="text-xs opacity-90">
                  Status: <strong>{auditData?.integrity_status}</strong> • Every ledger verdict is cryptographically chained with SHA-256.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-surface-border text-xs font-bold text-text-primary hover:bg-surface-muted self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Verify Hashes</span>
            </button>
          </div>

          {/* Event Log Table */}
          <div className="bg-white rounded-2xl border border-surface-border shadow-xs overflow-hidden">
            <div className="p-4 border-b border-surface-border bg-surface-muted/40 flex items-center justify-between">
              <span className="font-bold text-xs uppercase text-text-secondary tracking-wider">
                Chronological Audit Event Log ({auditData?.total_events || 0} committed records)
              </span>
              <span className="text-xs text-text-muted">Algorithm: SHA-256</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-surface-muted border-b border-surface-border text-text-secondary">
                  <tr>
                    <th className="p-3">Event ID</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Actor / Subject</th>
                    <th className="p-3">Previous Hash</th>
                    <th className="p-3">Entry Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {(auditData?.events || []).map((ev) => (
                    <tr key={ev.id} className="hover:bg-surface-muted/20">
                      <td className="p-3 font-bold text-text-primary font-sans">#{ev.id}</td>
                      <td className="p-3 text-text-muted font-sans">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold font-sans">
                          {ev.action}
                        </span>
                      </td>
                      <td className="p-3 text-text-primary font-sans">
                        <span className="font-semibold">{ev.actor}</span>
                        <span className="text-text-muted text-[11px] block">{ev.subject}</span>
                      </td>
                      <td className="p-3 text-text-muted font-mono text-[11px]">
                        {ev.prev_hash}
                      </td>
                      <td className="p-3 text-emerald-800 font-bold font-mono text-[11px]">
                        {ev.entry_hash}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
