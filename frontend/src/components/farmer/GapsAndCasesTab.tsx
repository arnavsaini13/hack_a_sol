import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Receipt,
  Share2,
  ArrowRight,
  ShieldAlert,
  Building2,
  Calendar,
  CheckCheck,
  RefreshCw,
  Edit2,
  Save,
  X
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import {
  getAppliedSchemes,
  updateAppliedSchemeReceived,
  getFarmerCases,
  updateCaseStatus,
  resolveAppliedScheme,
  moveSchemeToGrievance,
  type AppliedSchemeItem
} from '../../services/api';
import type { CaseItem, FarmerProfile } from '../../types/models';

interface GapsAndCasesTabProps {
  farmer?: FarmerProfile | null;
  onViewLetter: (caseItem: CaseItem) => void;
  onOpenRejectionModal?: () => void;
}

export const GapsAndCasesTab: React.FC<GapsAndCasesTabProps> = ({
  farmer,
  onViewLetter,
  onOpenRejectionModal,
}) => {
  const { language } = useTranslation();

  const [loadingSchemes, setLoadingSchemes] = useState<boolean>(true);
  const [appliedSchemes, setAppliedSchemes] = useState<AppliedSchemeItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [receivedInput, setReceivedInput] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedMathId, setExpandedMathId] = useState<string | null>(null);
  const [receiptItem, setReceiptItem] = useState<AppliedSchemeItem | null>(null);

  const [loadingCases, setLoadingCases] = useState<boolean>(true);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [creatingCaseForId, setCreatingCaseForId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchSchemes = useCallback(async () => {
    setLoadingSchemes(true);
    try {
      const res = await getAppliedSchemes();
      setAppliedSchemes(res.applied_schemes || []);
    } catch (err) {
      console.error('Failed to load applied schemes:', err);
    } finally {
      setLoadingSchemes(false);
    }
  }, []);

  const fetchCasesList = useCallback(async () => {
    setLoadingCases(true);
    try {
      const res = await getFarmerCases();
      setCases(res || []);
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      setLoadingCases(false);
    }
  }, []);

  useEffect(() => {
    fetchSchemes();
    fetchCasesList();
  }, [fetchSchemes, fetchCasesList]);

  // Handle Editing Received Amount
  const startEditing = (item: AppliedSchemeItem) => {
    setEditingId(item.id);
    setReceivedInput(String(Math.round(item.actual_received_paise / 100)));
  };

  const handleSaveReceived = async (item: AppliedSchemeItem) => {
    const val = parseFloat(receivedInput);
    if (isNaN(val) || val < 0) return;
    setUpdatingId(item.id);
    try {
      const updated = await updateAppliedSchemeReceived(item.id, Math.round(val * 100));
      setAppliedSchemes((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, ...updated } : s))
      );
      setEditingId(null);
      setToastMsg(
        language === 'hi'
          ? 'प्राप्त राशि अपडेट हुई • नियम गणना पुनः मूल्यांकित'
          : 'Received amount updated • Live rules re-evaluated'
      );
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err) {
      console.error('Failed to update received amount:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Confirm Money Received Successfully -> Removes from Section A
  const handleResolveScheme = async (item: AppliedSchemeItem) => {
    setResolvingId(item.id);
    try {
      await resolveAppliedScheme(item.id);
      setAppliedSchemes((prev) => prev.filter((s) => s.id !== item.id));
      setToastMsg(
        language === 'hi'
          ? 'पैसे पूरे प्राप्त हुए • योजना पूर्ण मानकर भाग (A) से हटाई गई।'
          : language === 'chh'
            ? 'पूरा पइसा मिलगे • योजना पूरा होगे अउ भाग (A) ले हटा दे गे।'
            : 'Money received successfully! Scheme marked completed and removed from Section A.'
      );
      setTimeout(() => setToastMsg(null), 4500);
    } catch (err) {
      console.error('Failed to resolve scheme:', err);
    } finally {
      setResolvingId(null);
    }
  };

  // Move Discrepant Scheme from Section A to Section B (Official Grievance Case)
  const handleMoveToGrievance = async (item: AppliedSchemeItem) => {
    setCreatingCaseForId(item.id);
    try {
      await moveSchemeToGrievance(item.id);
      setAppliedSchemes((prev) => prev.filter((s) => s.id !== item.id));
      await fetchCasesList();
      setToastMsg(
        language === 'hi'
          ? 'विसंगति दर्ज! योजना भाग (A) से हटकर भाग (B) "मेरी दर्ज शिकायतें" में आ गई है।'
          : language === 'chh'
            ? 'विसंगति दर्ज! योजना भाग (A) ले हटके भाग (B) मोर शिकायत म आ गे।'
            : 'Discrepancy registered! Scheme moved to Section B Grievances below.'
      );
      setTimeout(() => setToastMsg(null), 4500);

      // Scroll to Section B
      document.getElementById('section-my-cases')?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error('Failed to move scheme to grievance:', err);
    } finally {
      setCreatingCaseForId(null);
    }
  };

  // Update Case Status
  const handleStatusChange = async (caseId: string, nextStatus: string) => {
    try {
      await updateCaseStatus(caseId, nextStatus);
      await fetchCasesList();
      setToastMsg(
        language === 'hi'
          ? `शिकायत स्थिति बदलकर "${nextStatus}" कर दी गई।`
          : `Grievance status updated to "${nextStatus}".`
      );
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err) {
      console.error('Failed to update case status:', err);
    }
  };

  const handleWhatsAppShare = (c: CaseItem) => {
    const gap = '₹' + Math.round(c.gap_paise / 100).toLocaleString('en-IN');
    const text = language === 'hi'
      ? `कृषि पारदर्शिता मंच शिकायत सं: ${c.case_ref_no}%0Aप्राधिकारी: ${c.authority_name} (${c.authority_designation})%0Aयोजना: ${c.scheme_id}%0Aबकाया राशि: ${gap}%0Aकृपया त्वरित कार्रवाई करें।`
      : `Agri-Transparency Portal Grievance Ref: ${c.case_ref_no}%0AAuthority: ${c.authority_name} (${c.authority_designation})%0AScheme: ${c.scheme_id}%0APending Gap: ${gap}%0APlease process at earliest.`;
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const totalGapPaise = appliedSchemes.reduce((acc, s) => acc + (s.gap_paise || 0), 0);

  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs font-bold flex items-center justify-between shadow-xs animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>{toastMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner: Total Discrepancy Summary */}
      <div className={`p-5 sm:p-6 rounded-3xl border-2 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${totalGapPaise > 0 ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-300'
        }`}>
        <div className="flex items-start gap-3.5">
          <div className={`p-3 rounded-2xl text-white shadow-xs mt-0.5 ${totalGapPaise > 0 ? 'bg-rose-600' : 'bg-emerald-600'
            }`}>
            {totalGapPaise > 0 ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
          </div>
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${totalGapPaise > 0 ? 'text-rose-800' : 'text-emerald-800'
              }`}>
              {language === 'chh' ? 'कुल बाकी / विसंगति पइसा' : language === 'hi' ? 'कुल लंबित / विसंगति राशि' : 'Total Pending / Discrepancy Amount'}
            </h3>
            <div className={`text-3xl font-black tracking-tight mt-0.5 ${totalGapPaise > 0 ? 'text-rose-700' : 'text-emerald-800'
              }`}>
              {'₹' + Math.round(totalGapPaise / 100).toLocaleString('en-IN')}
            </div>
            <p className={`text-xs mt-1 ${totalGapPaise > 0 ? 'text-rose-900' : 'text-emerald-700'}`}>
              {totalGapPaise > 0
                ? (language === 'chh'
                  ? 'योजना मन म वैधानिक देय पइसा बाकी या कम मिले हे। नीचे 1-क्लिक म शिकायत चिट्ठी बनाव।'
                  : language === 'hi'
                    ? 'योजनाओं में वैधानिक देय राशि लंबित अथवा कम भुगतान पाया गया। नीचे 1-क्लिक में शिकायत पत्र बनाएं।'
                    : 'Actionable discrepancy identified across your active schemes. Generate formal representation below.')
                : (language === 'chh'
                  ? 'सबो सरकारी योजना मन म पूरा पइसा मिल गे हे। कउनो विसंगति नइ हे।'
                  : language === 'hi'
                    ? 'सभी सरकारी योजनाओं में पूर्ण भुगतान प्राप्त हुआ है। कोई विसंगति नहीं।'
                    : 'All statutory entitlements received in full. No shortfall detected.')}
            </p>
          </div>
        </div>

        {onOpenRejectionModal && (
          <button
            type="button"
            onClick={onOpenRejectionModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-300 bg-white text-rose-800 font-bold text-xs hover:bg-rose-100 min-h-[44px] shadow-xs self-start sm:self-auto shrink-0"
          >
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>{language === 'chh' ? 'खारिज कारण देखव' : language === 'hi' ? 'अस्वीकृति कारण जांचें' : 'Explain Rejection'}</span>
          </button>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SECTION A: APPLIED SCHEMES & PAYOUT DISCREPANCY CHECK         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
              {language === 'hi'
                ? 'भाग (A): अनुप्रयुक्त योजनाएँ एवं भुगतान विसंगति जांच'
                : language === 'chh'
                  ? 'भाग (A): आवेदन करे योजना अउ पइसा जांच'
                  : 'SECTION A — Applied Schemes & Payout Discrepancy Check'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {language === 'hi'
                ? 'पात्रता टैब से आवेदन की गई योजनाएँ। प्राप्त राशि संपादित कर वास्तविक विसंगति की स्वचालित जांच करें।'
                : 'Schemes tracked from Eligibility tab. Edit actually received amount to re-evaluate discrepancy live.'}
            </p>
          </div>

          <button
            type="button"
            onClick={fetchSchemes}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-xl min-h-[36px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSchemes ? 'animate-spin' : ''}`} />
            <span>{language === 'hi' ? 'ताज़ा करें' : 'Refresh'}</span>
          </button>
        </div>

        {loadingSchemes && appliedSchemes.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            <span className="text-xs">{language === 'hi' ? 'योजनाएं लोड हो रही हैं...' : 'Loading schemes...'}</span>
          </div>
        ) : appliedSchemes.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">
              {language === 'hi' ? 'कोई अनुप्रयुक्त योजना नहीं मिली' : 'No Applied Schemes Found'}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {language === 'hi'
                ? '"पात्र व अपात्र योजनाएँ" टैब में जाकर किसी भी पात्र योजना पर "आधिकारिक पोर्टल पर आवेदन करें" पर क्लिक करें।'
                : 'Visit the "Scheme Eligibility" tab and click "Apply on Official Portal" to track any eligible scheme here.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {appliedSchemes.map((item) => {
              const isEditing = editingId === item.id;
              const isUpdating = updatingId === item.id;
              const isExpandedMath = expandedMathId === item.id;
              const isRed = item.badge_color === 'RED';
              const isGreen = item.badge_color === 'GREEN';
              const isBlue = item.badge_color === 'BLUE';

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-3xl border-2 transition-all p-5 sm:p-6 space-y-4 shadow-xs ${isRed ? 'border-rose-200 hover:border-rose-300' : isGreen ? 'border-emerald-200 hover:border-emerald-300' : 'border-blue-200 hover:border-blue-300'
                    }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {item.rule_id}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {item.provenance}
                        </span>
                      </div>
                      <h3 className="text-base font-black text-slate-900 mt-1">
                        {item.scheme_name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {language === 'hi' ? 'आवेदन तिथि:' : 'Applied Date:'}{' '}
                          {item.applied_at ? new Date(item.applied_at).toLocaleDateString() : 'Active'}
                        </span>
                        {item.expected_release_date && (
                          <span className="text-slate-400">
                            • {language === 'hi' ? 'अपेक्षित तिथि:' : 'Expected:'} {new Date(item.expected_release_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Live Payout Verdict Badge */}
                    <div>
                      {isGreen && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          <span>{language === 'hi' ? 'पूर्ण भुगतान प्राप्त — कोई विसंगति नहीं' : item.verdict_badge}</span>
                        </span>
                      )}
                      {isBlue && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs">
                          <Clock className="w-4 h-4 text-blue-700" />
                          <span>{language === 'hi' ? `लंबित — ${item.expected_release_date ? new Date(item.expected_release_date).toLocaleDateString() : ''} तक अपेक्षित (अभी शिकायत आवश्यक नहीं)` : item.verdict_badge}</span>
                        </span>
                      )}
                      {isRed && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs animate-pulse">
                          <AlertTriangle className="w-4 h-4 text-rose-700" />
                          <span>{language === 'hi' ? `विसंगति पाई गई: ${item.gap_display} की कमी` : item.verdict_badge}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3 Interactive Amount Columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Col 1: Entitled Amount */}
                    <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase block mb-1">
                        {language === 'hi' ? '1. नियम अनुसार देय राशि (Entitled)' : '1. Rule-Computed Entitled'}
                      </span>
                      <div className="text-2xl font-black text-emerald-950">
                        {item.entitled_display}
                      </div>
                      <span className="text-[10px] text-emerald-700 font-mono mt-0.5 block">
                        ✓ Statutory Engine Cap
                      </span>
                    </div>

                    {/* Col 2: Actually Received (Interactive Input) */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-bold text-slate-700 uppercase">
                            {language === 'hi' ? '2. खाते में प्राप्त राशि (Received)' : '2. Actually Received'}
                          </span>
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => startEditing(item)}
                              className="text-indigo-700 hover:text-indigo-900 font-bold text-[11px] inline-flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>{language === 'hi' ? 'संपादित करें' : 'Edit'}</span>
                            </button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="relative flex-1">
                              <span className="absolute left-2.5 top-2 font-bold text-slate-400 text-sm">₹</span>
                              <input
                                type="number"
                                value={receivedInput}
                                onChange={(e) => setReceivedInput(e.target.value)}
                                className="w-full pl-7 pr-2 py-1.5 rounded-xl border-2 border-indigo-500 font-black text-slate-900 text-base focus:outline-none"
                                autoFocus
                              />
                            </div>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleSaveReceived(item)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs inline-flex items-center gap-1"
                            >
                              {isUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              <span>{language === 'hi' ? 'सहेजें' : 'Save'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-2xl font-black text-slate-900">
                            {item.actual_received_display}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-sans mt-1 block">
                        {language === 'hi' ? 'बैंक पासबुक / डीबीटी अनुसार' : 'Bank credit entry / DBT'}
                      </span>
                    </div>

                    {/* Col 3: Net Discrepancy Gap */}
                    <div className={`p-4 rounded-2xl border ${isRed ? 'bg-rose-50/80 border-rose-200' : 'bg-slate-50 border-slate-200'
                      }`}>
                      <span className={`text-[11px] font-bold uppercase block mb-1 ${isRed ? 'text-rose-800' : 'text-slate-600'
                        }`}>
                        {language === 'hi' ? '3. शुद्ध विसंगति (Shortfall / Gap)' : '3. Shortfall / Overcharge Gap'}
                      </span>
                      <div className={`text-2xl font-black ${isRed ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {item.gap_display}
                      </div>
                      <span className={`text-[10px] font-bold mt-0.5 block ${isRed ? 'text-rose-700' : 'text-emerald-700'
                        }`}>
                        {isRed
                          ? (language === 'hi' ? '⚠ कार्रवाई योग्य कमी' : '⚠ Actionable deficit')
                          : (language === 'hi' ? '✓ शून्य विसंगति' : '✓ Zero deficit')}
                      </span>
                    </div>
                  </div>

                  {/* Expandable Step-by-Step Math Breakdown */}
                  {item.rule_steps && item.rule_steps.length > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setExpandedMathId(isExpandedMath ? null : item.id)}
                        className="text-xs font-bold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1.5"
                      >
                        {isExpandedMath ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <span>
                          {isExpandedMath
                            ? (language === 'hi' ? 'गणना चरण छुपाएं' : 'Hide Math Proof Steps')
                            : (language === 'hi' ? 'विस्तृत नियम गणना चरण देखें (Deterministic Math)' : 'View Step-by-Step Math Proof')}
                        </span>
                      </button>

                      {isExpandedMath && (
                        <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs font-mono animate-in fade-in">
                          {item.rule_steps.map((st) => (
                            <div key={st.step} className="border-b border-slate-200/60 pb-2 last:border-none">
                              <span className="font-bold text-slate-900 block">
                                Step {st.step}: {st.title}
                              </span>
                              <p className="text-slate-600 font-sans mt-0.5">{st.desc}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bottom Action Strip */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {/* View Math Proof Receipt Button */}
                      <button
                        type="button"
                        onClick={() => setReceiptItem(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs min-h-[40px]"
                      >
                        <Receipt className="w-4 h-4 text-slate-600" />
                        <span>{language === 'hi' ? 'प्रमाण रसीद देखें' : 'View Math Proof Receipt'}</span>
                      </button>
                    </div>

                    {/* Action Buttons: (1) Money Received Successfully (Removes from A) & (2) Discrepancy -> Move to Section B */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Green Button: Money Received Successfully */}
                      <button
                        type="button"
                        disabled={resolvingId === item.id}
                        onClick={() => handleResolveScheme(item)}
                        className="px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-extrabold text-xs inline-flex items-center gap-1.5 shadow-xs min-h-[42px] transition-colors"
                        title={language === 'hi' ? 'पूर्ण भुगतान प्राप्त हुआ, योजना पूर्ण मानकर भाग (A) से हटाएं' : 'Confirm full payment received and remove from Section A'}
                      >
                        {resolvingId === item.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>{language === 'hi' ? 'अपडेट हो रहा है...' : 'Processing...'}</span>
                          </>
                        ) : (
                          <>
                            <CheckCheck className="w-4 h-4" />
                            <span>
                              {language === 'hi'
                                ? 'पैसे पूरे प्राप्त हुए (भाग A से हटाएं)'
                                : language === 'chh'
                                  ? 'पूरा पइसा मिलगे (हटाव)'
                                  : 'Money Received Successfully'}
                            </span>
                          </>
                        )}
                      </button>

                      {/* Button: Discrepancy or Scheme Issue -> Move from Section A to Section B */}
                      <button
                        type="button"
                        disabled={creatingCaseForId === item.id}
                        onClick={() => handleMoveToGrievance(item)}
                        className={`px-4 py-2.5 rounded-xl font-extrabold text-xs inline-flex items-center gap-2 shadow-xs min-h-[42px] transition-colors ${isRed || item.gap_paise > 0
                          ? 'bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white'
                          : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white'
                          }`}
                        title={language === 'hi' ? 'विसंगति या नीति समस्या दर्ज कर भाग (B) में स्थानांतरित करें' : 'Move discrepancy or scheme issue to Section B grievance cases'}
                      >
                        {creatingCaseForId === item.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>{language === 'hi' ? 'भाग (B) में भेजा जा रहा है...' : 'Moving to Section B...'}</span>
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-4 h-4" />
                            <span>
                              {isRed || item.gap_paise > 0
                                ? (language === 'hi'
                                  ? 'विसंगति है • भाग (B) में भेजें ->'
                                  : language === 'chh'
                                    ? 'विसंगति हे • भाग (B) म भेजव ->'
                                    : 'Discrepancy • Move to Section B ->')
                                : (language === 'hi'
                                  ? 'नीति/भुगतान समस्या • भाग (B) में भेजें ->'
                                  : language === 'chh'
                                    ? 'योजना समस्या • भाग (B) म भेजव ->'
                                    : 'Issue / Delay • Move to Section B ->')}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SECTION B: MY FILED CASES (LOCKED HINDI PDF & TIMELINE)       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <section id="section-my-cases" className="space-y-4 pt-6 border-t-2 border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span>
              {language === 'hi'
                ? 'भाग (B): मेरी दर्ज शिकायतें एवं वैधानिक अपील'
                : language === 'chh'
                  ? 'भाग (B): मोर दर्ज शिकायत अउ अपील'
                  : 'SECTION B — My Filed Cases & Statutory Escalation'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {language === 'hi'
                ? 'वैधानिक समय-सीमा (30-दिवसीय आरबीआई/पीएमएफबीवाई लोकपाल) एवं हस्ताक्षरित प्रतिनिधित्व पत्र ट्रैक करें।'
                : 'Track statutory grievance representations, timelines, and verified escalation helplines.'}
            </p>
          </div>

          <button
            type="button"
            onClick={fetchCasesList}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-xl min-h-[36px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingCases ? 'animate-spin' : ''}`} />
            <span>{language === 'hi' ? 'ताज़ा करें' : 'Refresh'}</span>
          </button>
        </div>

        {/* Escalation Guidelines Box */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="border-r border-indigo-200/60 pr-2 last:border-none">
            <span className="font-extrabold block text-indigo-900">🏦 KCC / Bank Escalation</span>
            <span className="text-indigo-800 text-[11px] block mt-0.5">
              RBI Ombudsman Scheme (14448) after 30 days of branch representation.
            </span>
          </div>
          <div className="border-r border-indigo-200/60 pr-2 last:border-none">
            <span className="font-extrabold block text-indigo-900">🌾 PMFBY Crop Insurance</span>
            <span className="text-indigo-800 text-[11px] block mt-0.5">
              Toll-Free 14447 • District Grievance Redressal Committee (Collector Chair).
            </span>
          </div>
          <div>
            <span className="font-extrabold block text-indigo-900">🚜 KUY / Mandi Bonus</span>
            <span className="text-indigo-800 text-[11px] block mt-0.5">
              District Procurement Officer & Markfed Grievance Helpline.
            </span>
          </div>
        </div>

        {loadingCases && cases.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
            <span className="text-xs">{language === 'hi' ? 'शिकायतें लोड हो रही हैं...' : 'Loading cases...'}</span>
          </div>
        ) : cases.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">
              {language === 'hi' ? 'कोई शिकायत दर्ज नहीं है' : 'No Filed Grievances Yet'}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {language === 'hi'
                ? 'यदि किसी योजना में कम राशि अथवा देरी हुई है, तो ऊपर भाग (A) में "1-क्लिक शिकायत पत्र बनाएं" दबाएं।'
                : 'When an entitlement shortfall or delay is detected in Section A, click "Generate Grievance PDF" to track it here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {cases.map((c) => {
              const isResolved = c.status === 'RESOLVED';
              const isFiled = c.status === 'FILED';

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4 hover:border-indigo-300 transition-colors"
                >
                  {/* Case Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-500">
                          {language === 'hi' ? 'शिकायत संदर्भ:' : 'Case Ref:'}
                        </span>
                        <span className="text-xs font-mono font-black text-indigo-950 bg-indigo-100 px-2.5 py-0.5 rounded-md">
                          {c.case_ref_no}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {c.verification_hash ? `${c.verification_hash.slice(0, 8)}...` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold text-slate-900">{c.authority_name}</span>
                        <span className="text-slate-500">({c.authority_designation})</span>
                      </div>
                    </div>

                    {/* Timeline Status Badge */}
                    <div>
                      {c.status === 'DETECTED' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <Clock className="w-3.5 h-3.5" /> 1. Detected
                        </span>
                      )}
                      {c.status === 'LETTER_GENERATED' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
                          <FileText className="w-3.5 h-3.5" /> 2. Letter Generated
                        </span>
                      )}
                      {c.status === 'FILED' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">
                          <ArrowRight className="w-3.5 h-3.5" /> 3. Filed at Office
                        </span>
                      )}
                      {c.status === 'FOLLOWUP_DUE' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-900 border border-rose-300">
                          <AlertTriangle className="w-3.5 h-3.5" /> 4. Follow-up Due (15 Days)
                        </span>
                      )}
                      {c.status === 'ESCALATED' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-900 border border-orange-300">
                          <ShieldAlert className="w-3.5 h-3.5" /> 5. Escalated to Ombudsman
                        </span>
                      )}
                      {c.status === 'RESOLVED' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 6. Resolved
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amounts Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-500 block">{language === 'hi' ? 'योजना' : 'Scheme'}</span>
                      <span className="font-bold text-slate-900 text-sm">{c.scheme_id}</span>
                    </div>
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                      <span className="text-rose-700 block font-bold">{language === 'hi' ? 'मांगी गई राशि (Gap)' : 'Claim Gap'}</span>
                      <span className="font-black text-rose-800 text-base">{c.gap_display}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-500 block">{language === 'hi' ? 'वैधानिक देय' : 'Entitled'}</span>
                      <span className="font-bold text-slate-800 text-sm">{c.entitled_display}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-500 block">{language === 'hi' ? 'वास्तविक प्राप्त' : 'Received'}</span>
                      <span className="font-bold text-slate-800 text-sm">{c.actual_display}</span>
                    </div>
                  </div>

                  {/* Details */}
                  {c.details && (
                    <p className="text-xs text-slate-600 bg-slate-50/60 p-3 rounded-xl border border-slate-100 leading-relaxed">
                      {c.details}
                    </p>
                  )}

                  {/* Actions Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      {/* View & Download Locked Hindi PDF */}
                      <button
                        type="button"
                        onClick={() => onViewLetter(c)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold text-xs min-h-[42px] shadow-xs"
                      >
                        <FileText className="w-4 h-4" />
                        <span>{language === 'hi' ? 'हस्ताक्षरित आवेदन देखें / PDF' : 'Download Hindi PDF'}</span>
                      </button>

                      {/* Share on WhatsApp */}
                      <button
                        type="button"
                        onClick={() => handleWhatsAppShare(c)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs min-h-[42px]"
                      >
                        <Share2 className="w-4 h-4" />
                        <span className="hidden sm:inline">{language === 'hi' ? 'व्हाट्सएप पर भेजें' : 'Share on WhatsApp'}</span>
                      </button>
                    </div>

                    {/* Timeline Progression Buttons */}
                    {!isResolved && (
                      <div className="flex items-center gap-2">
                        {!isFiled && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(c.id, 'FILED')}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs min-h-[40px]"
                          >
                            <CheckCheck className="w-4 h-4" />
                            <span>{language === 'hi' ? 'आवेदन कार्यालय में जमा किया' : 'Mark as Filed'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStatusChange(c.id, 'RESOLVED')}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs min-h-[40px]"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{language === 'hi' ? 'निस्तारित मार्क करें' : 'Mark as Resolved'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MATH PROOF RECEIPT MODAL                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {receiptItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-700" />
                <h3 className="font-black text-slate-900 text-base">
                  {language === 'hi' ? 'वैधानिक नियम गणना प्रमाण रसीद' : 'Statutory Math Proof Receipt'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReceiptItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Body */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 font-mono text-xs text-slate-800">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Farmer:</span>
                <span className="font-bold">{farmer?.name_hi || farmer?.name_en || 'Registered Farmer'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Scheme:</span>
                <span className="font-bold text-slate-900">{receiptItem.scheme_name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Rule Ref:</span>
                <span className="font-bold">{receiptItem.rule_id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Statutory Entitlement:</span>
                <span className="font-bold text-emerald-800">{receiptItem.entitled_display}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500">Actually Received:</span>
                <span className="font-bold">{receiptItem.actual_received_display}</span>
              </div>
              <div className="flex justify-between pt-1 text-sm">
                <span className="font-bold text-rose-800">Verified Actionable Gap:</span>
                <span className="font-black text-rose-700">{receiptItem.gap_display}</span>
              </div>
            </div>

            {/* Math Steps */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-slate-700 block">Calculation Provenance:</span>
              {receiptItem.rule_steps?.map((st) => (
                <div key={st.step} className="p-2.5 rounded-xl bg-slate-100 text-slate-700 font-mono text-[11px]">
                  <strong>Step {st.step}:</strong> {st.desc}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReceiptItem(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs"
              >
                {language === 'hi' ? 'बंद करें' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
