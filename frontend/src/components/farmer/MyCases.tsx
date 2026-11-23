import React from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Share2,
  Calendar,
  Building2,
  CheckCheck
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import type { CaseItem } from '../../types/models';

interface MyCasesProps {
  cases: CaseItem[];
  onViewLetter: (caseItem: CaseItem) => void;
  onUpdateStatus?: (caseId: string, newStatus: string) => void;
}

export const MyCases: React.FC<MyCasesProps> = ({ cases, onViewLetter, onUpdateStatus }) => {
  const { t, language } = useTranslation();

  const formatRupees = (paise: number) => {
    const rupees = Math.round(paise / 100);
    return '₹' + rupees.toLocaleString('en-IN');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DETECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5" /> Detected
          </span>
        );
      case 'LETTER_GENERATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <FileText className="w-3.5 h-3.5" /> Letter Ready
          </span>
        );
      case 'FILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
            <ArrowRight className="w-3.5 h-3.5" /> Filed at Office
          </span>
        );
      case 'FOLLOWUP_DUE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3.5 h-3.5" /> Follow-up Due
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-muted text-text-secondary">
            {status}
          </span>
        );
    }
  };

  const handleWhatsAppShare = (c: CaseItem) => {
    const gap = formatRupees(c.gap_paise);
    const text = language === 'chh'
      ? `कृषि मंच शिकायत सं: ${c.case_ref_no}%0Aअधिकारी: ${c.authority_name} (${c.authority_designation})%0Aयोजना: ${c.scheme_id}%0Aबाकी पइसा: ${gap}%0Aकृपया जल्दी कार्रवाई करव।`
      : language === 'hi'
      ? `कृषि पारदर्शिता मंच शिकायत सं: ${c.case_ref_no}%0Aप्राधिकारी: ${c.authority_name} (${c.authority_designation})%0Aयोजना: ${c.scheme_id}%0Aबकाया राशि: ${gap}%0Aकृपया त्वरित कार्रवाई करें।`
      : `Agri-Transparency Portal Grievance Ref: ${c.case_ref_no}%0AAuthority: ${c.authority_name} (${c.authority_designation})%0AScheme: ${c.scheme_id}%0APending Gap: ${gap}%0APlease process at earliest.`;

    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  if (cases.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-surface-border p-12 text-center shadow-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-muted flex items-center justify-center text-text-muted">
          <FileText className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-text-primary mb-1">{t('farmer.cases_empty')}</h3>
        <p className="text-sm text-text-secondary max-w-md mx-auto">
          {language === 'chh'
            ? 'जब कोनो विसंगति या देरी के पता चलही, त औपचारिक आवेदन बनाय बर विसंगति कार्ड म "शिकायत पत्र बनावव" म क्लिक करव।'
            : language === 'hi'
            ? 'जब किसी विसंगति अथवा विलंब का पता चले, तो औपचारिक अभ्यावेदन तैयार करने हेतु विसंगति कार्ड पर "शिकायत पत्र बनाएं" पर क्लिक करें।'
            : 'When an underpayment or overdue disbursement is detected, click "Generate Grievance" on the Discrepancy card to draft a formal representation.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {cases.map((c) => (
        <div
          key={c.id}
          className="bg-white rounded-2xl border border-surface-border shadow-sm p-5 space-y-4 hover:border-agri-primary/40 transition-colors"
        >
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-border">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-text-muted">{t('farmer.case_ref')}:</span>
                <span className="text-sm font-mono font-bold text-agri-dark bg-agri-light/40 px-2 py-0.5 rounded">
                  {c.case_ref_no}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-text-secondary mt-1">
                <Building2 className="w-3.5 h-3.5 text-text-muted" />
                <span className="font-medium text-text-primary">{c.authority_name}</span>
                <span className="text-text-muted">({c.authority_designation})</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {getStatusBadge(c.status)}
            </div>
          </div>

          {/* Amount and Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="p-3 bg-surface-muted/40 rounded-xl">
              <span className="text-xs text-text-muted block">Scheme</span>
              <span className="font-bold text-text-primary">{c.scheme_id}</span>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
              <span className="text-xs text-rose-800 block">{t('farmer.card_gap')}</span>
              <span className="font-bold text-rose-700 text-base">{formatRupees(c.gap_paise)}</span>
            </div>
            <div className="p-3 bg-surface-muted/40 rounded-xl">
              <span className="text-xs text-text-muted block">Entitled</span>
              <span className="font-semibold text-text-primary">{formatRupees(c.entitled_paise)}</span>
            </div>
            <div className="p-3 bg-surface-muted/40 rounded-xl">
              <span className="text-xs text-text-muted block">Actually Received</span>
              <span className="font-semibold text-text-primary">{formatRupees(c.actual_paise)}</span>
            </div>
          </div>

          {/* Dates & Timeline info */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted pt-1">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-text-muted" />
              <span>Generated: {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Today'}</span>
            </div>
            <div className="flex items-center gap-1 text-amber-700 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Statutory Follow-up: 15 Working Days</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-surface-border">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onViewLetter(c)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-agri-dark text-white font-medium text-xs hover:bg-agri-primary transition-colors min-h-[44px]"
              >
                <FileText className="w-4 h-4" />
                {t('farmer.view_letter')}
              </button>

              <button
                type="button"
                onClick={() => handleWhatsAppShare(c)}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 transition-colors min-h-[44px]"
                title={t('farmer.share_whatsapp')}
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">{t('farmer.share_whatsapp')}</span>
              </button>
            </div>

            {onUpdateStatus && c.status !== 'RESOLVED' && (
              <div className="flex items-center gap-2">
                {c.status === 'LETTER_GENERATED' && (
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(c.id, 'FILED')}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-purple-300 bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 min-h-[40px]"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    {t('farmer.mark_filed')}
                  </button>
                )}
                {c.status === 'FILED' && (
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(c.id, 'RESOLVED')}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 min-h-[40px]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t('farmer.mark_resolved')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
