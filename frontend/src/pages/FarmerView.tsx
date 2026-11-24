import React, { useEffect, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  CreditCard
} from 'lucide-react';
import { useTranslation } from '../i18n';
import { usePageContext } from '../context/PageContext';
import {
  getFarmerSnapshot,
  getFarmerCases,
  createCase,
  logout
} from '../services/api';
import type {
  FarmerProfile,
  FarmerSnapshot,
  CaseItem,
  DiscrepancyItem
} from '../types/models';

import { FarmerLookupGate } from '../components/farmer/FarmerLookupGate';
import { FarmerProfileHeader } from '../components/farmer/FarmerProfileHeader';
import { FarmerHeroBanner } from '../components/farmer/FarmerHeroBanner';
import { EntitlementCalculatorsTab } from '../components/farmer/EntitlementCalculatorsTab';
import { SchemesEligibilityTab } from '../components/farmer/SchemesEligibilityTab';
import { GapsAndCasesTab } from '../components/farmer/GapsAndCasesTab';
import { MyLoans } from '../components/farmer/MyLoans';
import { FarmerProfileTab } from '../components/farmer/FarmerProfileTab';
import { LetterModal } from '../components/farmer/LetterModal';
import { RejectionExplainerModal } from '../components/farmer/RejectionExplainerModal';
import { ChatWidget } from '../components/chat/ChatWidget';

export const FarmerView: React.FC = () => {
  const { t, language } = useTranslation();

  const [loading, setLoading] = useState<boolean>(false);
  const [farmer, setFarmer] = useState<FarmerProfile | null>(null);
  const [snapshot, setSnapshot] = useState<FarmerSnapshot | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);

  // Clean Tabs + Dedicated Profile View
  const [activeTab, setActiveTab] = useState<'calculators' | 'schemes' | 'cases' | 'loans' | 'profile'>('calculators');

  // PageContext for AI Co-Pilot
  const { setPageInfo, pendingFields, setActiveFarmerId } = usePageContext();

  useEffect(() => {
    setPageInfo({
      page: 'Farmer Portal',
      route: '/farmer',
      summary: `Farmer Entitlements & Transparency Portal. Current Tab: ${activeTab}. Active Farmer: ${farmer ? farmer.name_en : 'Not selected'}`,
      visibleData: {
        farmerId: farmer?.id,
        farmerName: farmer?.name_en,
        activeTab: activeTab,
        totalCases: cases.length,
      },
    });
  }, [farmer, activeTab, cases.length, setPageInfo]);

  // Handle Co-Pilot pendingFields UI navigation
  useEffect(() => {
    if (pendingFields) {
      if (pendingFields.tab && ['calculators', 'schemes', 'cases', 'loans', 'profile'].includes(pendingFields.tab)) {
        setActiveTab(pendingFields.tab as any);
      } else if (pendingFields.amount !== undefined || pendingFields.tenure_months !== undefined) {
        setActiveTab('calculators');
      } else if (pendingFields.scheme_filter) {
        setActiveTab('schemes');
      }
    }
  }, [pendingFields]);

  // Modals state
  const [activeCaseForLetter, setActiveCaseForLetter] = useState<CaseItem | null>(null);
  const [isLetterModalOpen, setIsLetterModalOpen] = useState<boolean>(false);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState<boolean>(false);

  // Status message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load verified farmer records from backend
  const handleFarmerVerified = async (verifiedFarmer: FarmerProfile) => {
    setLoading(true);
    setFarmer(verifiedFarmer);
    setActiveFarmerId(verifiedFarmer.id);
    try {
      const [snapData, casesData] = await Promise.all([
        getFarmerSnapshot(),
        getFarmerCases(),
      ]);
      setSnapshot(snapData);
      setCases(casesData);
      setActiveTab('calculators');
    } catch (err) {
      console.error('Error fetching farmer workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setFarmer(null);
      setSnapshot(null);
      setCases([]);
    }
  };

  useEffect(() => {
    const handleOpenRejection = () => setIsRejectionModalOpen(true);
    const handleOpenCalculator = () => setActiveTab('calculators');
    const handleOpenCases = () => setActiveTab('cases');

    window.addEventListener('open-rejection-modal', handleOpenRejection);
    window.addEventListener('open-calculator-tab', handleOpenCalculator);
    window.addEventListener('switch-to-cases-tab', handleOpenCases);

    return () => {
      window.removeEventListener('open-rejection-modal', handleOpenRejection);
      window.removeEventListener('open-calculator-tab', handleOpenCalculator);
      window.removeEventListener('switch-to-cases-tab', handleOpenCases);
    };
  }, []);

  const handleGenerateGrievance = async (item: DiscrepancyItem) => {
    if (!farmer) return;
    try {
      const newCase = await createCase({
        parcel_id: item.parcel_id || null,
        authority_name: item.scheme_id.includes('KUY') || item.scheme_id.includes('MSP')
          ? 'District Procurement Officer / Markfed'
          : item.scheme_id.includes('KCC')
            ? 'Lead District Manager (LDM) / Bank Branch'
            : 'District PMFBY Oversight Committee',
        authority_designation: item.scheme_id.includes('KUY') || item.scheme_id.includes('MSP')
          ? 'District Supply & Procurement Division'
          : item.scheme_id.includes('KCC')
            ? 'Agricultural Credit Division'
            : 'State Crop Insurance Cell',
        scheme_id: item.scheme_id,
        entitled_paise: item.entitled_paise,
        actual_paise: item.received_paise,
        gap_paise: item.gap_paise,
        details: item.explanation_en,
      });

      setCases((prev) => [newCase, ...prev.filter((c) => c.id !== newCase.id)]);
      setActiveCaseForLetter(newCase);
      setIsLetterModalOpen(true);
      setToastMessage(t('farmer.case_created_success'));
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Failed to create grievance case:', err);
    }
  };

  const handleViewLetter = (caseItem: CaseItem) => {
    setActiveCaseForLetter(caseItem);
    setIsLetterModalOpen(true);
  };

  // ── STEP 1: FARMER IDENTIFICATION GATE ──────────────────────────────
  if (!farmer) {
    return (
      <div className="space-y-6">
        {/* Official Hero Banner with Jai Jawan Jai Kisan */}
        <FarmerHeroBanner />

        <FarmerLookupGate onFarmerVerified={handleFarmerVerified} />
        <RejectionExplainerModal
          isOpen={isRejectionModalOpen}
          onClose={() => setIsRejectionModalOpen(false)}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <RefreshCw className="w-8 h-8 text-emerald-700 animate-spin" />
        <span className="text-sm font-semibold text-slate-600">
          {language === 'hi' ? 'किसान अभिलेख लोड हो रहे हैं...' : 'Loading verified records...'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 bg-emerald-700 text-white rounded-2xl shadow-md text-sm font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Verified Compact Farmer Header with "Change Farmer" Button and "My Profile" Button */}
      <FarmerProfileHeader
        farmer={farmer}
        parcels={snapshot?.parcels || []}
        onLogout={handleLogout}
        onOpenProfile={() => setActiveTab('profile')}
        isProfileActive={activeTab === 'profile'}
      />

      {/* Hero Banner with Jai Jawan Jai Kisan */}
      <FarmerHeroBanner
        farmerName={language === 'en' ? farmer.name_en : farmer.name_hi}
      />

      {/* 4 Clean Tabs */}
      <div className="flex border-2 border-emerald-100 bg-white rounded-2xl p-1.5 shadow-sm gap-1.5 overflow-x-auto no-scrollbar">
        {/* Tab 1: Entitlement Calculators */}
        <button
          type="button"
          onClick={() => setActiveTab('calculators')}
          className={`flex-1 py-3 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all min-h-[48px] whitespace-nowrap ${activeTab === 'calculators'
            ? 'bg-[#15803d] text-white shadow-md'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          <Calculator className="w-4 h-4" />
          <span>{language === 'chh' ? '1. नियम हिसाब-किताब' : language === 'hi' ? '1. नियम कैलकुलेटर' : '1. Calculators'}</span>
        </button>

        {/* Tab 2: Eligible vs. Not Eligible Schemes */}
        <button
          type="button"
          onClick={() => setActiveTab('schemes')}
          className={`flex-1 py-3 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all min-h-[48px] whitespace-nowrap ${activeTab === 'schemes'
            ? 'bg-[#15803d] text-white shadow-md'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{language === 'chh' ? '2. पात्र अउ अपात्र योजना' : language === 'hi' ? '2. पात्र व अपात्र योजनाएँ' : '2. Scheme Eligibility'}</span>
        </button>

        {/* Tab 3: Discrepancies, Rejections & My Cases */}
        <button
          type="button"
          onClick={() => setActiveTab('cases')}
          className={`flex-1 py-3 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all min-h-[48px] whitespace-nowrap ${activeTab === 'cases'
            ? 'bg-[#15803d] text-white shadow-md'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{language === 'chh' ? '3. विसंगति अउ शिकायत' : language === 'hi' ? '3. विसंगति व शिकायतें' : '3. Gaps & Cases'}</span>
          {cases.length > 0 && (
            <span className="text-[10px] bg-rose-500 text-white px-1.5 py-0.2 rounded-full">
              {cases.length}
            </span>
          )}
        </button>

        {/* Tab 4: My Loans & Bank Bridge (Replaces My Lands) */}
        <button
          type="button"
          onClick={() => setActiveTab('loans')}
          className={`flex-1 py-3 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all min-h-[48px] whitespace-nowrap ${activeTab === 'loans'
            ? 'bg-[#15803d] text-white shadow-md'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>
            {language === 'chh'
              ? '4. मोर करजा अउ आवेदन'
              : language === 'hi'
                ? '4. मेरे ऋण व बैंक आवेदन'
                : '4. My Loans & Applications'}
          </span>
          {snapshot?.loans && (
            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full hidden sm:inline font-mono">
              {snapshot.loans.length}
            </span>
          )}
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: ENTITLEMENT CALCULATORS (PURE PYTHON RULES ENGINE)     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'calculators' && (
        <EntitlementCalculatorsTab
          snapshot={snapshot}
          farmer={farmer}
          onGenerateGrievance={handleGenerateGrievance}
        />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: ELIGIBLE VS. NOT ELIGIBLE SCHEMES (5 SCHEMES LIVE Q&A) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'schemes' && (
        <SchemesEligibilityTab
          farmer={farmer}
          snapshot={snapshot}
          onNavigateToCases={() => setActiveTab('cases')}
        />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: GAPS & CASES (LIVE SQLITE: SECTION A & SECTION B)      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'cases' && (
        <GapsAndCasesTab
          farmer={farmer}
          onViewLetter={handleViewLetter}
          onOpenRejectionModal={() => setIsRejectionModalOpen(true)}
        />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 4: MY LOANS & BANK BRIDGE                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'loans' && (
        <MyLoans
          snapshot={snapshot}
          farmer={farmer}
          onExplainRejection={() => setIsRejectionModalOpen(true)}
          onNavigateToCases={() => setActiveTab('cases')}
        />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 5: FARMER PROFILE & SCHEME ELIGIBILITY ATTRIBUTES        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <FarmerProfileTab
          farmer={farmer}
          snapshot={snapshot}
          onNavigateToSchemes={() => setActiveTab('schemes')}
        />
      )}

      {/* Representation Letter Modal */}
      <LetterModal
        isOpen={isLetterModalOpen}
        onClose={() => setIsLetterModalOpen(false)}
        caseItem={activeCaseForLetter}
        farmer={farmer}
      />

      {/* Rejection Explainer Modal */}
      <RejectionExplainerModal
        isOpen={isRejectionModalOpen}
        onClose={() => setIsRejectionModalOpen(false)}
      />

      {/* AI Co-Pilot Assistant - Active only on Farmer main interface */}
      <ChatWidget />
    </div>
  );
};
export default FarmerView;
