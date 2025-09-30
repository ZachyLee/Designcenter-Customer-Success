import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './components/AuthPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import LandingPage from './components/LandingPage';
import Checklist from './components/Checklist';
import Summary from './components/Summary';
import AdminDashboard from './components/AdminDashboard';
import NXVoucherRequest from './components/NXVoucherRequest';
import { supabase } from './lib/supabase';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="neumo-spinner"></div>
      </div>
    );
  }

  return user ? children : <Navigate to="/" replace />;
};

// Special wrapper for reset password page to avoid auth redirects
const ResetPasswordWrapper = () => {
  return <ResetPasswordPage />;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-neumo-bg">
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPasswordWrapper />} />
          <Route path="/landing" element={
            <ProtectedRoute>
              <LandingPage />
            </ProtectedRoute>
          } />
          <Route path="/checklist" element={
            <ProtectedRoute>
              <Checklist />
            </ProtectedRoute>
          } />
          <Route path="/summary/:responseId" element={
            <ProtectedRoute>
              <Summary />
            </ProtectedRoute>
          } />
          <Route path="/partner/nx-voucher-request" element={
            <ProtectedRoute>
              <NXVoucherRequest />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;