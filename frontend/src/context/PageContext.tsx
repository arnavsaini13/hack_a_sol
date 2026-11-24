import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTranslation } from '../i18n';

export interface PageInfo {
  page: string;
  route: string;
  summary: string;
  visibleData?: Record<string, any>;
}

export interface PendingFields {
  amount?: number;
  tenure_months?: number;
  scheme_filter?: string;
  tab?: 'calculators' | 'schemes' | 'cases' | 'loans';
  [key: string]: any;
}

interface PageContextType {
  pageInfo: PageInfo;
  setPageInfo: (info: PageInfo) => void;
  pendingFields: PendingFields | null;
  setPendingFields: (fields: PendingFields | null) => void;
  activeFarmerId: string;
  setActiveFarmerId: (id: string) => void;
  highlightedField: string | null;
  setHighlightedField: (field: string | null) => void;
  speechLanguageCode: string; // e.g. "hi-IN" or "en-IN"
}

const defaultPageInfo: PageInfo = {
  page: 'Farmer Portal',
  route: '/farmer',
  summary: 'Agricultural loan, entitlement and subsidy transparency platform',
};

const PageContext = createContext<PageContextType>({
  pageInfo: defaultPageInfo,
  setPageInfo: () => {},
  pendingFields: null,
  setPendingFields: () => {},
  activeFarmerId: 'F-001',
  setActiveFarmerId: () => {},
  highlightedField: null,
  setHighlightedField: () => {},
  speechLanguageCode: 'hi-IN',
});

export const PageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { language } = useTranslation();
  const [pageInfo, setPageInfo] = useState<PageInfo>(defaultPageInfo);
  const [pendingFields, setPendingFields] = useState<PendingFields | null>(null);
  const [activeFarmerId, setActiveFarmerId] = useState<string>('F-001');
  const [highlightedField, setHighlightedField] = useState<string | null>(null);

  // Sync speech language code: Chhattisgarhi ('chh') maps to 'hi-IN'
  const speechLanguageCode = language === 'en' ? 'en-IN' : 'hi-IN';

  // Clear highlight after 1.5 seconds automatically
  useEffect(() => {
    if (highlightedField) {
      const timer = setTimeout(() => {
        setHighlightedField(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [highlightedField]);

  return (
    <PageContext.Provider
      value={{
        pageInfo,
        setPageInfo,
        pendingFields,
        setPendingFields,
        activeFarmerId,
        setActiveFarmerId,
        highlightedField,
        setHighlightedField,
        speechLanguageCode,
      }}
    >
      {children}
    </PageContext.Provider>
  );
};

export const usePageContext = () => useContext(PageContext);
