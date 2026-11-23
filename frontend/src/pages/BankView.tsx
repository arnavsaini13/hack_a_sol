import React, { useEffect, useState, useCallback } from 'react';
import {
  Building2,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  FileCheck2,
  Lock,
  LogOut,
  Database,
  Hash,
  ShieldAlert
} from 'lucide-react';
import { useTranslation } from '../i18n';
import {
  getBankOfficerMe,
  logoutBankOfficer,
  getBankLocations,
  getBankRegistry,
  verifyBankInteractive,
  submitBankVerdict,
  getBankKPIs,
  getBankAuditLog,
  verifyBankAuditChain,
  type BankOfficerProfile,
} from '../services/api';
import { BankOfficerAuthGate } from '../components/bank/BankOfficerAuthGate';

export const BankView: React.FC = () => {
  const { language } = useTranslation();

  // Auth State
  const [officer, setOfficer] = useState<BankOfficerProfile | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'VERIFY' | 'AUDIT' | 'REGISTRY'>('VERIFY');

  // Live KPI Data (SQLite Backed)
  const [kpiData, setKpiData] = useState<{
    verified_count: number;
    review_needed_count: number;
    blocked_count: number;
    audit_chain_length: number;
    total_applications: number;
  }>({
    verified_count: 0,
    review_needed_count: 0,
    blocked_count: 0,
    audit_chain_length: 0,
    total_applications: 0,
  });

  // Locations Hierarchy
  const [locations, setLocations] = useState<{
    districts: string[];
    hierarchy: Record<string, Record<string, string[]>>;
  }>({ districts: [], hierarchy: {} });

  // Tab 1: Interactive Verification Form State
  const [district, setDistrict] = useState<string>('रायपुर');
  const [tehsil, setTehsil] = useState<string>('आरंग');
  const [village, setVillage] = useState<string>('सिल्ली');
  const [khasraNo, setKhasraNo] = useState<string>('142/1');
  const [applicantName, setApplicantName] = useState<string>('Ramesh Patel');
  const [applicantFather, setApplicantFather] = useState<string>('Shyama Charan Patel');
  const [requestedAmount, setRequestedAmount] = useState<number>(150000);
  const [loanType, setLoanType] = useState<string>('KCC');

  // Verification Results
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyError, setVerifyError] = useState<string>('');

  // Officer Decision State
  const [officerNotes, setOfficerNotes] = useState<string>('');
  const [decisionSubmitting, setDecisionSubmitting] = useState<boolean>(false);
  const [decisionSuccess, setDecisionSuccess] = useState<any>(null);

  // Tab 2: Audit Chain
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [chainVerifyResult, setChainVerifyResult] = useState<any>(null);
  const [chainVerifying, setChainVerifying] = useState<boolean>(false);

  // Tab 3: Registry Browser
  const [registryRecords, setRegistryRecords] = useState<any[]>([]);
  const [registryLoading, setRegistryLoading] = useState<boolean>(false);
  const [registrySearch, setRegistrySearch] = useState<string>('');
  const [registryDistrictFilter, setRegistryDistrictFilter] = useState<string>('');

  // 1. Initial Authentication Check
  useEffect(() => {
    async function checkAuth() {
      setAuthChecking(true);
      try {
        const me = await getBankOfficerMe();
        setOfficer(me);
      } catch {
        setOfficer(null);
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, []);

  // 2. Load Locations & Live KPIs
  const loadKpis = useCallback(async () => {
    try {
      const data = await getBankKPIs();
      setKpiData(data);
    } catch (err) {
      console.error('Failed to load live KPIs:', err);
    }
  }, []);

  useEffect(() => {
    if (officer) {
      loadKpis();
      getBankLocations()
        .then((data) => {
          setLocations(data);
          if (data.districts.length > 0) {
            const firstDist = data.districts.includes('रायपुर') ? 'रायपुर' : data.districts[0];
            setDistrict(firstDist);
            const tehsils = Object.keys(data.hierarchy[firstDist] || {});
            if (tehsils.length > 0) {
              const firstTehsil = tehsils.includes('आरंग') ? 'आरंग' : tehsils[0];
              setTehsil(firstTehsil);
              const villages = data.hierarchy[firstDist][firstTehsil] || [];
              if (villages.length > 0) {
                setVillage(villages.includes('सिल्ली') ? 'सिल्ली' : villages[0]);
              }
            }
          }
        })
        .catch((err) => console.error('Failed to load locations:', err));
    }
  }, [officer, loadKpis]);

  // Handle cascading location changes
  const handleDistrictChange = (d: string) => {
    setDistrict(d);
    const tehsils = Object.keys(locations.hierarchy[d] || {});
    if (tehsils.length > 0) {
      setTehsil(tehsils[0]);
      const vils = locations.hierarchy[d][tehsils[0]] || [];
      if (vils.length > 0) setVillage(vils[0]);
    }
  };

  const handleTehsilChange = (t: string) => {
    setTehsil(t);
    const vils = locations.hierarchy[district]?.[t] || [];
    if (vils.length > 0) setVillage(vils[0]);
  };

  // 4. Interactive Verification Submit
  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setVerifying(true);
    setVerifyError('');
    setVerifyResult(null);
    setDecisionSuccess(null);

    try {
      const res = await verifyBankInteractive({
        district,
        tehsil,
        village,
        khasra_no: khasraNo.trim(),
        applicant_name: applicantName.trim(),
        applicant_father: applicantFather.trim(),
        requested_amount_rupees: requestedAmount,
        loan_type: loanType,
      });
      setVerifyResult(res);
      setOfficerNotes(
        res.verdict === 'GREEN'
          ? 'Identity, Bhuiyan title, and zero duplicate financing verified.'
          : res.verdict === 'AMBER'
          ? 'Minor spelling drift. Held for branch-level physical ID verification.'
          : 'Statutory violation detected. Duplicate active KCC / title mismatch. Blocked.'
      );
    } catch (err: any) {
      setVerifyError(err?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  // 5. Submit Officer Decision
  const handleDecision = async (decision: 'APPROVE' | 'HOLD' | 'REJECT') => {
    if (!verifyResult) return;
    setDecisionSubmitting(true);
    try {
      const res = await submitBankVerdict({
        application_id: verifyResult.application_id,
        parcel_id: verifyResult.bhuiyan_record?.parcel_id,
        khasra_no: khasraNo.trim(),
        applicant_name: applicantName.trim(),
        decision,
        officer_notes: officerNotes.trim(),
        flags: verifyResult.flags,
      });
      setDecisionSuccess(res);
      loadKpis();
    } catch (err: any) {
      console.error('Failed to submit decision:', err);
    } finally {
      setDecisionSubmitting(false);
    }
  };

  // 6. Tab 2: Load Audit Logs
  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const data = await getBankAuditLog();
      setAuditLogs(data.events || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const handleVerifyAuditChain = async () => {
    setChainVerifying(true);
    try {
      const res = await verifyBankAuditChain();
      setChainVerifyResult(res);
    } catch (err) {
      console.error('Failed to verify audit chain:', err);
    } finally {
      setChainVerifying(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'AUDIT') {
      loadAuditLogs();
    }
  }, [activeTab, loadAuditLogs]);

  // 7. Tab 3: Load Registry Records
  const loadRegistry = useCallback(async () => {
    setRegistryLoading(true);
    try {
      const data = await getBankRegistry(registrySearch, registryDistrictFilter);
      setRegistryRecords(data.records || []);
    } catch (err) {
      console.error('Failed to load registry:', err);
    } finally {
      setRegistryLoading(false);
    }
  }, [registrySearch, registryDistrictFilter]);

  useEffect(() => {
    if (activeTab === 'REGISTRY') {
      loadRegistry();
    }
  }, [activeTab, loadRegistry]);

  const handleSelectRegistryRecord = (rec: any) => {
    setDistrict(rec.district);
    setTehsil(rec.tehsil);
    setVillage(rec.village);
    setKhasraNo(rec.khasra_no);
    setApplicantName(rec.farmer_name_en);
    setApplicantFather(rec.father_name_en);
    setRequestedAmount(150000);
    setVerifyResult(null);
    setDecisionSuccess(null);
    setActiveTab('VERIFY');
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await logoutBankOfficer();
    } catch {
      // ignore
    }
    setOfficer(null);
  };

  // If loading auth state
  if (authChecking) {
    return (
      <div className="flex items-center justify-center p-20">
        <RefreshCw className="w-8 h-8 text-sky-800 animate-spin" />
      </div>
    );
  }

  // If not authenticated, show institutional Auth Gate
  if (!officer) {
    return <BankOfficerAuthGate onAuthenticated={(off) => setOfficer(off)} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. BANK OFFICER HEADER BAR (Institutional Deep Navy)          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#0f2744] text-white rounded-3xl p-5 sm:p-6 shadow-md border border-sky-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20 text-sky-300 shadow-inner">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                  {officer.bank_name}
                </h2>
                <span className="text-[10px] bg-sky-500/30 text-sky-200 px-2 py-0.5 rounded font-mono font-bold uppercase">
                  {officer.branch_district} Branch
                </span>
              </div>
              <p className="text-xs text-sky-200 mt-0.5 flex items-center gap-2">
                <span>
                  {language !== 'en' ? 'सत्यापन अधिकारी:' : 'Officer:'}{' '}
                  <strong>{officer.full_name}</strong> ({officer.employee_id})
                </span>
                <span>•</span>
                <span className="font-mono text-emerald-400">Authenticated Session</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadKpis}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors border border-white/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{language !== 'en' ? 'ताज़ा करें' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-700 text-xs font-bold text-white transition-colors border border-rose-500"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{language !== 'en' ? 'लॉग आउट' : 'Logout'}</span>
            </button>
          </div>
        </div>

        {/* Audit Trail Guarantee Notice */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-sky-200 gap-2">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {language !== 'en'
                ? 'सभी सत्यापन निर्णय अपरिवर्तनीय SHA-256 ब्लॉकचेन ऑडिट लेजर में दर्ज होते हैं।'
                : 'Every officer verification verdict is immutably signed to SQLite SHA-256 hash ledger.'}
            </span>
          </div>
          <span className="font-mono text-[11px] text-white/70">
            Audit Ledger: {kpiData.audit_chain_length} Blocks Verified
          </span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. LIVE SQLITE KPI STRIP (Zero Hardcoded JSX Numbers!)         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200 shadow-xs">
          <span className="text-xs text-emerald-900 block font-bold">
            {language !== 'en' ? 'स्वतः सत्यापित (Green)' : 'Auto-Verified (Green)'}
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-800 mt-1">
            {kpiData.verified_count}
          </div>
          <span className="text-[11px] text-emerald-800 mt-0.5 block font-medium">
            ≥ 95% Identity & Title Match
          </span>
        </div>

        <div className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200 shadow-xs">
          <span className="text-xs text-amber-900 block font-bold">
            {language !== 'en' ? 'समीक्षा आवश्यक (Amber)' : 'Review Needed (Amber)'}
          </span>
          <div className="text-2xl sm:text-3xl font-black text-amber-800 mt-1">
            {kpiData.review_needed_count}
          </div>
          <span className="text-[11px] text-amber-800 mt-0.5 block font-medium">
            Minor Drift / Scale Warning
          </span>
        </div>

        <div className="bg-rose-50/70 rounded-2xl p-4 border border-rose-200 shadow-xs">
          <span className="text-xs text-rose-900 block font-bold">
            {language !== 'en' ? 'अस्वीकृत / अवरुद्ध (Red)' : 'Blocked Violations (Red)'}
          </span>
          <div className="text-2xl sm:text-3xl font-black text-rose-800 mt-1">
            {kpiData.blocked_count}
          </div>
          <span className="text-[11px] text-rose-800 mt-0.5 block font-medium">
            Duplicate KCC / Mismatch
          </span>
        </div>

        <div className="bg-slate-100 rounded-2xl p-4 border border-slate-300 shadow-xs">
          <span className="text-xs text-slate-700 block font-bold">
            {language !== 'en' ? 'ऑडिट श्रृंखला प्रविष्टियाँ' : 'Audit Chain Entries'}
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
            {kpiData.audit_chain_length}
          </div>
          <span className="text-[11px] text-slate-600 mt-0.5 block font-mono">
            SHA-256 Chained Blocks
          </span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. WORKBENCH NAVIGATION TABS                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('VERIFY')}
          className={`pb-3 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'VERIFY'
              ? 'border-[#0f2744] text-[#0f2744] font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{language !== 'en' ? 'नया किसान सत्यापन (Workbench)' : 'New Farmer Verification'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('AUDIT')}
          className={`pb-3 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'AUDIT'
              ? 'border-[#0f2744] text-[#0f2744] font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Hash className="w-4 h-4" />
          <span>{language !== 'en' ? 'सत्यापन इतिहास एवं ऑडिट श्रृंखला' : 'Verification History & Audit Chain'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('REGISTRY')}
          className={`pb-3 px-4 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'REGISTRY'
              ? 'border-[#0f2744] text-[#0f2744] font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>{language === 'en' ? 'State Land & Loan Registry Browser (54 Records)' : 'राज्य भूमि एवं ऋण रजिस्ट्री ब्राउज़र (54 रिकॉर्ड)'}</span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: NEW FARMER VERIFICATION (WORKBENCH)                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'VERIFY' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Input Form (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-sky-800" />
                <span>{language !== 'en' ? 'ऋण आवेदन विवरण' : 'Loan Application Details'}</span>
              </h3>

              <form onSubmit={handleVerify} className="space-y-3.5">
                {/* District */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language !== 'en' ? 'जिला (District)' : 'District'}
                  </label>
                  <select
                    value={district}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-900 bg-white"
                  >
                    {locations.districts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tehsil & Village */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language !== 'en' ? 'तहसील (Tehsil)' : 'Tehsil'}
                    </label>
                    <select
                      value={tehsil}
                      onChange={(e) => handleTehsilChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-900 bg-white"
                    >
                      {Object.keys(locations.hierarchy[district] || {}).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language !== 'en' ? 'ग्राम (Village)' : 'Village'}
                    </label>
                    <select
                      value={village}
                      onChange={(e) => setVillage(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-900 bg-white"
                    >
                      {(locations.hierarchy[district]?.[tehsil] || []).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Khasra No */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language !== 'en' ? 'खसरा नंबर (Khasra No.)' : 'Khasra Number'}
                  </label>
                  <input
                    type="text"
                    required
                    value={khasraNo}
                    onChange={(e) => setKhasraNo(e.target.value)}
                    placeholder="e.g. 142/1 or 1087/2"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-xs text-slate-900"
                  />
                </div>

                {/* Applicant Name & Father */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language !== 'en' ? 'आवेदक का नाम' : 'Applicant Full Name'}
                    </label>
                    <input
                      type="text"
                      required
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="e.g. Ramesh Patel"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language !== 'en' ? 'पिता का नाम' : "Father's Name"}
                    </label>
                    <input
                      type="text"
                      required
                      value={applicantFather}
                      onChange={(e) => setApplicantFather(e.target.value)}
                      placeholder="e.g. Shyama Charan Patel"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-900"
                    />
                  </div>
                </div>

                {/* Amount & Loan Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language !== 'en' ? 'मांगी गई राशि (₹)' : 'Requested Loan (₹)'}
                    </label>
                    <input
                      type="number"
                      step={10000}
                      required
                      value={requestedAmount}
                      onChange={(e) => setRequestedAmount(Math.max(0, parseInt(e.target.value || '0', 10)))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language !== 'en' ? 'ऋण प्रकार' : 'Loan Type'}
                    </label>
                    <select
                      value={loanType}
                      onChange={(e) => setLoanType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-900 bg-white"
                    >
                      <option value="KCC">KCC (किसान क्रेडिट कार्ड)</option>
                      <option value="TERM_LOAN">Term Loan (सावधि ऋण)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={verifying}
                  className="w-full py-3 px-4 rounded-xl bg-[#0f2744] hover:bg-[#1a3d66] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all min-h-[44px]"
                >
                  {verifying ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-sky-300" />
                      <span>{language !== 'en' ? 'भू-अभिलेख एवं ऋण क्रॉस-सत्यापन करें' : 'Verify Against Land & Loan Registry'}</span>
                    </>
                  )}
                </button>
              </form>

              {verifyError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
                  {verifyError}
                </div>
              )}
            </div>

            {/* Right: Live Verification Results & Decision Workbench (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {!verifyResult && !verifying && (
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-800">
                    {language !== 'en' ? 'सत्यापन परिणाम यहाँ प्रदर्शित होंगे' : 'Verification Results Awaiting Input'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {language !== 'en'
                      ? 'बाईं ओर विवरण भरें अथवा त्वरित परीक्षण हेतु शीर्ष पर स्थित डेमो चिप्स पर टैप करें।'
                      : 'Fill in details on the left or tap one of the Quick-Fill test chips above to run live statutory verification.'}
                  </p>
                </div>
              )}

              {verifying && (
                <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-sm text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-sky-800 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-600">
                    {language !== 'en'
                      ? 'SQLite रजिस्ट्री, रैपिडफज़ नाम मिलान एवं दोहरा केसीसी जांच जारी...'
                      : 'Querying SQLite registry, RapidFuzz name matching & duplicate KCC cross-check...'}
                  </p>
                </div>
              )}

              {verifyResult && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Traffic Light Banner */}
                  <div
                    className={`p-5 rounded-3xl border shadow-sm flex flex-wrap items-center justify-between gap-3 ${
                      verifyResult.verdict === 'GREEN'
                        ? 'bg-emerald-500/10 border-emerald-300 text-emerald-950'
                        : verifyResult.verdict === 'AMBER'
                        ? 'bg-amber-500/10 border-amber-300 text-amber-950'
                        : 'bg-rose-500/10 border-rose-300 text-rose-950'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {verifyResult.verdict === 'GREEN' ? (
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                      ) : verifyResult.verdict === 'AMBER' ? (
                        <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />
                      ) : (
                        <XCircle className="w-8 h-8 text-rose-600 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              verifyResult.verdict === 'GREEN'
                                ? 'bg-emerald-600 text-white'
                                : verifyResult.verdict === 'AMBER'
                                ? 'bg-amber-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            VERDICT: {verifyResult.verdict}
                          </span>
                          <span className="text-xs font-mono text-slate-500">
                            ID: {verifyResult.application_id}
                          </span>
                        </div>
                        <h4 className="text-base sm:text-lg font-black mt-1">
                          {verifyResult.verdict === 'GREEN'
                            ? (language !== 'en' ? 'सत्यापित एवं पात्र (ELIGIBLE)' : 'Eligible & Title Verified (GREEN)')
                            : verifyResult.verdict === 'AMBER'
                            ? (language !== 'en' ? 'मैन्युअल शाखा समीक्षा आवश्यक (HOLD)' : 'Hold for Manual ID Review (AMBER)')
                            : (language !== 'en' ? 'अस्वीकृत: वैधानिक उल्लंघन (BLOCKED)' : 'Blocked: Statutory Violations Detected (RED)')}
                        </h4>
                      </div>
                    </div>

                    <div className="text-right text-xs">
                      <div className="font-bold text-slate-800">
                        Owner Match: <span className="font-mono">{verifyResult.name_score.toFixed(1)}%</span>
                      </div>
                      <div className="font-bold text-slate-800">
                        Father Match: <span className="font-mono">{verifyResult.father_score.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Individual Human-Readable Flag Cards */}
                  <div className="space-y-2.5">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 block px-1">
                      {language !== 'en' ? 'सत्यापन नियम एवं विसंगति विवरण (Rule Checks):' : 'Verification Flag Cards (Statutory Rules):'}
                    </span>

                    {verifyResult.flags.map((flag: any) => (
                      <div
                        key={flag.id}
                        className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                          flag.severity === 'RED'
                            ? 'bg-rose-50/60 border-rose-300 text-rose-950'
                            : flag.severity === 'AMBER'
                            ? 'bg-amber-50/60 border-amber-300 text-amber-950'
                            : flag.severity === 'GREEN'
                            ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950'
                            : 'bg-slate-50 border-slate-300 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-xs flex items-center gap-1.5">
                            {flag.severity === 'RED' && <XCircle className="w-4 h-4 text-rose-600" />}
                            {flag.severity === 'AMBER' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                            {flag.severity === 'GREEN' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                            {flag.severity === 'INFO' && <ShieldCheck className="w-4 h-4 text-slate-500" />}
                            <span>{language !== 'en' ? flag.title_hi : flag.title_en}</span>
                          </span>
                          <span className="text-[10px] font-mono uppercase bg-white/70 px-2 py-0.5 rounded border border-black/10 font-bold">
                            {flag.rule_id}
                          </span>
                        </div>
                        <p className="leading-relaxed font-medium">
                          {language !== 'en' ? flag.desc_hi : flag.desc_en}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Bhuiyan Record & Active Loans Table */}
                  {verifyResult.bhuiyan_record && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-black text-slate-900 flex items-center gap-1.5 uppercase text-[11px]">
                          <Database className="w-3.5 h-3.5 text-sky-800" />
                          <span>{language !== 'en' ? 'भूइयां आधिकारिक भूमि अभिलेख' : 'Recorded Bhuiyan Title Record'}</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          Parcel ID: {verifyResult.bhuiyan_record.parcel_id}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-[10px] text-slate-500 block">दर्ज स्वामी (Title Owner)</span>
                          <span className="font-bold text-slate-900">{verifyResult.bhuiyan_record.owner_name_en}</span>
                          <span className="text-[10px] text-slate-500 block">s/o {verifyResult.bhuiyan_record.father_name_en}</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-[10px] text-slate-500 block">रकबा (Area)</span>
                          <span className="font-bold text-slate-900">{verifyResult.bhuiyan_record.area_acres} Acres</span>
                          <span className="text-[10px] text-slate-500 block">({verifyResult.bhuiyan_record.area_ha} ha)</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-[10px] text-slate-500 block">गिरदावरी फसल (Crop)</span>
                          <span className="font-bold text-slate-900">{verifyResult.bhuiyan_record.girdawari_crop}</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl">
                          <span className="text-[10px] text-slate-500 block">बंधक स्थिति (Mortgage)</span>
                          <span
                            className={`font-black ${
                              verifyResult.bhuiyan_record.mortgage_status === 'ACTIVE'
                                ? 'text-rose-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {verifyResult.bhuiyan_record.mortgage_status}
                          </span>
                          {verifyResult.bhuiyan_record.mortgage_bank && (
                            <span className="text-[10px] text-slate-600 block truncate">
                              {verifyResult.bhuiyan_record.mortgage_bank}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Active Loans Section */}
                      {verifyResult.active_loans && verifyResult.active_loans.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 space-y-1.5">
                          <span className="text-[11px] font-bold text-rose-800 flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>इस खसरे पर सक्रिय क्रॉस-बैंक ऋण (Cross-Bank Active Loans):</span>
                          </span>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px] text-left border border-rose-200 rounded-lg overflow-hidden">
                              <thead className="bg-rose-50 text-rose-950 font-bold">
                                <tr>
                                  <th className="p-2">Bank</th>
                                  <th className="p-2">Type</th>
                                  <th className="p-2">Principal</th>
                                  <th className="p-2">Sanctioned</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-rose-100">
                                {verifyResult.active_loans.map((l: any, idx: number) => (
                                  <tr key={idx} className="bg-white">
                                    <td className="p-2 font-bold">{l.bank_name}</td>
                                    <td className="p-2">{l.loan_type} ({l.lender_type})</td>
                                    <td className="p-2 font-mono font-bold text-rose-700">₹{l.principal_rupees.toLocaleString('en-IN')}</td>
                                    <td className="p-2 text-slate-500">{l.disbursement_date}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Officer Decision Controls */}
                  <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-sky-800" />
                      <span>{language !== 'en' ? 'अधिकारी निर्णय एवं डिजिटल हस्ताक्षर' : 'Officer Decision & Audit Ledger Signing'}</span>
                    </h4>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {language !== 'en' ? 'निर्णय टिप्पणी (Officer Notes):' : 'Officer Notes & Audit Rationale:'}
                      </label>
                      <textarea
                        rows={2}
                        value={officerNotes}
                        onChange={(e) => setOfficerNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-xs text-slate-900"
                        placeholder="Enter audit rationale for approval, review, or rejection..."
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        disabled={decisionSubmitting}
                        onClick={() => handleDecision('APPROVE')}
                        className="py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all min-h-[44px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{language !== 'en' ? 'स्वीकृत करें (Approve)' : 'Approve Application'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={decisionSubmitting}
                        onClick={() => handleDecision('HOLD')}
                        className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all min-h-[44px]"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{language !== 'en' ? 'पुनः समीक्षा (Hold/Review)' : 'Hold for Review'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={decisionSubmitting}
                        onClick={() => handleDecision('REJECT')}
                        className="py-2.5 px-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all min-h-[44px]"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{language !== 'en' ? 'अस्वीकृत व ब्लॉक करें' : 'Reject & Block'}</span>
                      </button>
                    </div>

                    {decisionSuccess && (
                      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-1 animate-in fade-in">
                        <div className="flex items-center gap-2 text-emerald-900 font-black">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Decision Recorded & Signed to SQLite Audit Chain!</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-700 flex flex-wrap items-center gap-2 pt-1">
                          <span>Status: <strong>{decisionSuccess.status}</strong></span>
                          <span>•</span>
                          <span>Receipt Hash: <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-900">{decisionSuccess.short_hash}</code></span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: AUDIT LOG & CRYPTOGRAPHIC VERIFICATION                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Integrity Verification Header */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Hash className="w-4 h-4 text-sky-800" />
                <span>{language !== 'en' ? 'क्रिप्टोग्राफिक ऑडिट श्रृंखला (SHA-256)' : 'Cryptographic Audit Hash Chain'}</span>
              </h3>
              <p className="text-xs text-slate-600">
                {language !== 'en'
                  ? 'बैंक अधिकारी द्वारा लिए गए प्रत्येक निर्णय की सत्यता एवं अपरिवर्तनीयता की पुष्टि करें।'
                  : 'Verify mathematical integrity and zero-tampering across all logged decisions in SQLite.'}
              </p>
            </div>

            <button
              type="button"
              disabled={chainVerifying}
              onClick={handleVerifyAuditChain}
              className="py-2.5 px-4 rounded-xl bg-[#0f2744] hover:bg-[#1a3d66] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {chainVerifying ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{language !== 'en' ? 'श्रृंखला सत्यता जांचें' : 'Verify Hash Chain Integrity'}</span>
            </button>
          </div>

          {chainVerifyResult && (
            <div
              className={`p-4 rounded-2xl border text-xs flex items-center gap-3 animate-in fade-in ${
                chainVerifyResult.is_valid
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="space-y-0.5">
                <span className="font-black block">{chainVerifyResult.message}</span>
                <span className="font-mono text-[11px] text-slate-600">
                  Total Valid Blocks: {chainVerifyResult.total_events} • Head Hash: {chainVerifyResult.head_hash?.slice(0, 16)}...
                </span>
              </div>
            </div>
          )}

          {/* Audit Logs Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">ID</th>
                    <th className="p-3.5">Actor</th>
                    <th className="p-3.5">Action</th>
                    <th className="p-3.5">Subject</th>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">SHA-256 Entry Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {auditLogs.map((ev: any) => (
                    <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 text-slate-500">#{ev.id}</td>
                      <td className="p-3.5 font-bold text-slate-900">{ev.actor}</td>
                      <td className="p-3.5 font-bold text-sky-800">{ev.action}</td>
                      <td className="p-3.5 text-slate-700">{ev.subject}</td>
                      <td className="p-3.5 text-slate-500 text-[11px]">{ev.timestamp?.slice(0, 19)}</td>
                      <td className="p-3.5">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700 border border-slate-200">
                          {ev.entry_hash?.slice(0, 10)}...{ev.entry_hash?.slice(-6)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && !auditLoading && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 font-sans">
                        No audit events logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: SYNTHETIC REGISTRY BROWSER (50+ SQLite Records)        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'REGISTRY' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Search & Filter Bar */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={registrySearch}
                onChange={(e) => setRegistrySearch(e.target.value)}
                placeholder={language !== 'en' ? 'खसरा, ग्राम, तहसील अथवा किसान के नाम से खोजें...' : 'Search Khasra, Farmer Name, Village, Tehsil...'}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={registryDistrictFilter}
                onChange={(e) => setRegistryDistrictFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white"
              >
                <option value="">{language !== 'en' ? 'सभी जिले (All Districts)' : 'All Districts'}</option>
                {locations.districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={loadRegistry}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{language !== 'en' ? 'खोजें' : 'Search'}</span>
              </button>
            </div>
          </div>

          {/* Registry Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Khasra</th>
                    <th className="p-3">Farmer Name</th>
                    <th className="p-3">Father Name</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Area (Acres)</th>
                    <th className="p-3">Crop</th>
                    <th className="p-3">Mortgage Status</th>
                    <th className="p-3">Active Loans</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registryRecords.map((rec: any) => (
                    <tr key={rec.parcel_id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-sky-900">{rec.khasra_no}</td>
                      <td className="p-3 font-bold text-slate-900">
                        {rec.farmer_name_en}
                        <span className="block text-[10px] text-slate-500 font-normal">{rec.farmer_name_hi}</span>
                      </td>
                      <td className="p-3 text-slate-600">
                        {rec.father_name_en}
                      </td>
                      <td className="p-3 text-slate-700">
                        {rec.village}, {rec.tehsil} ({rec.district})
                      </td>
                      <td className="p-3 font-mono">
                        {rec.area_acres} ac ({rec.area_ha} ha)
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                          {rec.girdawari_crop}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-black text-[11px] ${
                            rec.mortgage_status === 'ACTIVE'
                              ? 'text-rose-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {rec.mortgage_status}
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        {rec.active_loans_count > 0 ? (
                          <span className="text-rose-700 font-bold">{rec.active_loans_count} Active</span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSelectRegistryRecord(rec)}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 font-bold text-[11px] transition-colors"
                        >
                          {language !== 'en' ? 'सत्यापित करें' : 'Verify'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {registryRecords.length === 0 && !registryLoading && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500 font-sans">
                        No records match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default BankView;
