import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nProvider } from './i18n';
import { PageProvider } from './context/PageContext';
import { Layout } from './components/Layout';
import { RoleSelectionGate } from './pages/RoleSelectionGate';
import { FarmerView } from './pages/FarmerView';
import { BankView } from './pages/BankView';
import { PolicyView } from './pages/PolicyView';
import { RulesPage } from './pages/RulesPage';

export const App: React.FC = () => {
  return (
    <I18nProvider>
      <PageProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<RoleSelectionGate />} />
              <Route path="/farmer" element={<FarmerView />} />
              <Route path="/bank" element={<BankView />} />
              <Route path="/policy" element={<PolicyView />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="*" element={<Navigate to="/farmer" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </PageProvider>
    </I18nProvider>
  );
};

export default App;
