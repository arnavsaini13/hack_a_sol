import React, { useState } from 'react';
import { X, Printer, Copy, Check, FileText, Globe } from 'lucide-react';
import { useTranslation } from '../../i18n';
import type { CaseItem, FarmerProfile } from '../../types/models';

interface LetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: CaseItem | null;
  farmer: FarmerProfile | null;
}

export const LetterModal: React.FC<LetterModalProps> = ({
  isOpen,
  onClose,
  caseItem,
  farmer,
}) => {
  const { t, language } = useTranslation();
  const [modalLang, setModalLang] = useState<'hi' | 'en'>(language as 'hi' | 'en');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !caseItem || !farmer) return null;

  const farmerName = modalLang === 'hi' ? farmer.name_hi : farmer.name_en;
  const fatherName = modalLang === 'hi' ? farmer.father_name_hi : farmer.father_name_en;

  const formatRupees = (paise: number) => {
    const rupees = Math.round(paise / 100);
    return '₹' + rupees.toLocaleString('en-IN');
  };

  const todayStr = new Date().toLocaleDateString(modalLang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const element = document.getElementById('letter-content');
    if (element) {
      navigator.clipboard.writeText(element.innerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-surface-border overflow-hidden print:border-none print:shadow-none flex flex-col max-h-[90vh] print:max-h-none">
        {/* Modal Controls Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-surface-muted/50 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-agri-dark" />
            <span className="font-bold text-sm sm:text-base text-text-primary">
              {t('farmer.letter_modal_title')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModalLang(modalLang === 'hi' ? 'en' : 'hi')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-white text-xs font-semibold hover:bg-surface-muted"
            >
              <Globe className="w-3.5 h-3.5" />
              {modalLang === 'hi' ? 'Switch to English' : 'हिंदी में देखें'}
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-white text-xs font-semibold hover:bg-surface-muted"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-agri-dark text-white text-xs font-semibold hover:bg-agri-primary"
            >
              <Printer className="w-3.5 h-3.5" />
              {t('farmer.print_letter')}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-muted ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Formal Letter Body */}
        <div
          id="letter-content"
          className="p-8 sm:p-12 overflow-y-auto space-y-6 text-text-primary leading-relaxed print:p-0 print:text-black font-serif"
          style={{ fontFamily: modalLang === 'hi' ? "'Noto Sans Devanagari', sans-serif" : 'serif' }}
        >
          {/* Header */}
          <div className="text-center border-b pb-4">
            <h1 className="text-lg font-bold uppercase tracking-wider">
              {modalLang === 'hi'
                ? 'छत्तीसगढ़ राज्य कृषि कल्याण एवं पारदर्शिता शिकायत प्रतिवेदन'
                : 'STATE OF CHHATTISGARH — STATUTORY GRIEVANCE REPRESENTATION'}
            </h1>
            <p className="text-xs text-text-muted mt-1">
              Generated under Chhattisgarh Citizen Redressal & Transparency Protocols
            </p>
          </div>

          {/* Reference & Date */}
          <div className="flex justify-between items-start text-sm">
            <div>
              <span className="font-bold">{modalLang === 'hi' ? 'संदर्भ सं.' : 'Case Ref:'} </span>
              <span className="font-mono font-bold text-agri-dark">{caseItem.case_ref_no}</span>
            </div>
            <div>
              <span className="font-bold">{modalLang === 'hi' ? 'दिनांक:' : 'Date:'} </span>
              <span>{todayStr}</span>
            </div>
          </div>

          {/* Recipient */}
          <div className="text-sm space-y-1">
            <div className="font-bold">{modalLang === 'hi' ? 'सेवा में,' : 'To,'}</div>
            <div className="font-bold text-base">{caseItem.authority_name}</div>
            <div>{caseItem.authority_designation}</div>
            <div>
              {farmer.district}, {modalLang === 'hi' ? 'छत्तीसगढ़' : 'Chhattisgarh'}
            </div>
          </div>

          {/* Subject */}
          <div className="text-sm font-bold bg-surface-muted/60 p-3 rounded-lg border border-surface-border">
            {modalLang === 'hi'
              ? `विषय: योजना ${caseItem.scheme_id} के अंतर्गत वैधानिक देय राशि के विलंब / विसंगति के संबंध में अभ्यावेदन।`
              : `Subject: Formal Representation regarding Delayed / Discrepant Entitlement under Scheme: ${caseItem.scheme_id}.`}
          </div>

          {/* Body Salutation */}
          <div className="text-sm space-y-4">
            <p>
              {modalLang === 'hi'
                ? `महोदय / महोदया,`
                : `Respected Sir / Madam,`}
            </p>
            <p>
              {modalLang === 'hi'
                ? `मैं, ${farmerName}, आत्मज ${fatherName}, निवासी ग्राम ${farmer.village}, तहसील ${farmer.tehsil}, ज़िला ${farmer.district}, मोबाइल नंबर ${farmer.masked_mobile}, इस पत्र के माध्यम से आपके संज्ञान में लाना चाहता हूँ कि राज्य शासन के वैधानिक नियमों के अनुसार मुझे निम्नलिखित लाभ प्राप्त होना था:`
                : `I, ${farmerName}, S/o ${fatherName}, resident of Village ${farmer.village}, Tehsil ${farmer.tehsil}, District ${farmer.district}, registered mobile ${farmer.masked_mobile}, respectfully bring to your immediate notice the following non-payment / discrepancy under the statutory guidelines:`}
            </p>

            {/* Structured Table */}
            <div className="overflow-x-auto border border-surface-border rounded-lg">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-surface-muted border-b border-surface-border font-bold">
                  <tr>
                    <th className="p-2 sm:p-3">{modalLang === 'hi' ? 'योजना का नाम' : 'Scheme Name'}</th>
                    <th className="p-2 sm:p-3 text-right">{modalLang === 'hi' ? 'वैधानिक पात्रता' : 'Statutory Entitlement'}</th>
                    <th className="p-2 sm:p-3 text-right">{modalLang === 'hi' ? 'प्राप्त राशि' : 'Actual Received'}</th>
                    <th className="p-2 sm:p-3 text-right text-rose-700">{modalLang === 'hi' ? 'बकाया अंतर' : 'Net Deficit (Gap)'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-surface-border font-medium">
                    <td className="p-2 sm:p-3 font-semibold">{caseItem.scheme_id}</td>
                    <td className="p-2 sm:p-3 text-right">{formatRupees(caseItem.entitled_paise)}</td>
                    <td className="p-2 sm:p-3 text-right">{formatRupees(caseItem.actual_paise)}</td>
                    <td className="p-2 sm:p-3 text-right font-bold text-rose-700">{formatRupees(caseItem.gap_paise)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Specific Case Details */}
            <div className="bg-amber-50/70 p-3.5 rounded-lg border border-amber-200 text-xs sm:text-sm">
              <span className="font-bold block mb-1">
                {modalLang === 'hi' ? 'मामले का विशिष्ट विवरण:' : 'Detailed Grievance Note:'}
              </span>
              <p>{caseItem.details}</p>
            </div>

            {/* Escalation Warning */}
            <p className="text-xs text-text-secondary italic">
              {modalLang === 'hi'
                ? `नोट: यदि आगामी 15 दिवस के भीतर उक्त विसंगति का निराकरण नहीं किया जाता है, तो यह प्रकरण नियमानुसार उच्च अपीलीय मंच (ज़िला स्तरीय निगरानी समिति / भारतीय रिज़र्व बैंक एकीकृत लोकपाल) को स्वतः अग्रेषित किया जाएगा।`
                : `Statutory Notice: If this discrepancy is not redressed within 15 working days, this case will be formally escalated to the District Oversight Committee and RBI Integrated Ombudsman as prescribed by statutory guidelines.`}
            </p>

            <p>
              {modalLang === 'hi'
                ? `अतः आपसे विनम्र निवेदन है कि उपर्युक्त बकाया राशि का तत्काल भुगतान / समायोजन कराने का कष्ट करें।`
                : `Therefore, it is earnestly requested to expedite the release/adjustment of the legitimate outstanding amount at the earliest.`}
            </p>
          </div>

          {/* Signature Block */}
          <div className="pt-8 flex justify-between items-end text-sm">
            <div>
              <div className="text-xs text-text-muted">Digital Verification Hash:</div>
              <div className="font-mono text-xs text-text-muted bg-surface-muted px-2 py-1 rounded">
                SHA256:{caseItem.id.substring(0, 16)}...
              </div>
            </div>

            <div className="text-right">
              <div className="font-bold">{farmerName}</div>
              <div className="text-xs text-text-secondary">{modalLang === 'hi' ? 'आवेदक कृषक' : 'Applicant Farmer'}</div>
              <div className="text-xs text-text-muted">{farmer.village}, {farmer.district}</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-surface-border bg-surface-muted/30 flex justify-end print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-surface-muted text-text-primary text-sm font-semibold hover:bg-surface-border"
          >
            {t('farmer.close_modal')}
          </button>
        </div>
      </div>
    </div>
  );
};
