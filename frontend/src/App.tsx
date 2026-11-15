import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ElderDashboard } from './pages/ElderDashboard';
import { FamilyDashboard } from './pages/FamilyDashboard';
import { CaregiverDashboard } from './pages/CaregiverDashboard';
import { DailySchedulePage } from './pages/DailySchedulePage';
import { MedicationsPage } from './pages/MedicationsPage';
import { AdherenceHistoryPage } from './pages/AdherenceHistoryPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { FamilyAccessPage } from './pages/FamilyAccessPage';
import { ActivityTimelinePage } from './pages/ActivityTimelinePage';
import { AISummaryPage } from './pages/AISummaryPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';

// Protected Route Guard with fallback to localStorage session
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  // If initial load in progress and no stored token, show spinner
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('carebridge_token');
  if (isLoading && !hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-slate-500">Checking credentials...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !hasToken) {
    return <Navigate to="/login" replace />;
  }

  // Active user check (with localStorage backup)
  const activeUser = user || (localStorage.getItem('carebridge_user') ? JSON.parse(localStorage.getItem('carebridge_user')!) : null);

  if (allowedRoles && activeUser && !allowedRoles.includes(activeUser.role)) {
    if (activeUser.role === 'elderly') return <Navigate to="/elder/dashboard" replace />;
    if (activeUser.role === 'family') return <Navigate to="/family/dashboard" replace />;
    return <Navigate to="/caregiver/dashboard" replace />;
  }

  return <>{children}</>;
};

// Generic Role-based Dashboard Redirection
const RoleDashboardRedirect: React.FC = () => {
  const { user } = useAuth();
  const activeUser = user || (localStorage.getItem('carebridge_user') ? JSON.parse(localStorage.getItem('carebridge_user')!) : null);
  
  if (!activeUser) return <Navigate to="/login" replace />;
  if (activeUser.role === 'elderly') return <Navigate to="/elder/dashboard" replace />;
  if (activeUser.role === 'family') return <Navigate to="/family/dashboard" replace />;
  if (activeUser.role === 'caregiver') return <Navigate to="/caregiver/dashboard" replace />;
  return <Navigate to="/login" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster 
          position="top-right" 
          toastOptions={{
            duration: 3500,
            style: {
              background: '#14243A',
              color: '#FFFFFF',
              borderRadius: '16px',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            },
            success: {
              iconTheme: {
                primary: '#20B8A5',
                secondary: '#FFFFFF',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#FFFFFF',
              },
            },
          }} 
        />

        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes in Application Layout */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Role Dynamic Redirection */}
            <Route path="/dashboard" element={<RoleDashboardRedirect />} />

            {/* Dashboards with strict role protection */}
            <Route 
              path="/elder/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['elderly']}>
                  <ElderDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/family/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['family']}>
                  <FamilyDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/caregiver/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['caregiver']}>
                  <CaregiverDashboard />
                </ProtectedRoute>
              } 
            />

            {/* Core Modules */}
            <Route path="/schedule" element={<DailySchedulePage />} />
            <Route path="/medications" element={<MedicationsPage />} />
            <Route path="/history" element={<AdherenceHistoryPage />} />
            <Route path="/adherence" element={<Navigate to="/history" replace />} />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/family-access" element={<FamilyAccessPage />} />
            <Route path="/timeline" element={<ActivityTimelinePage />} />
            <Route path="/ai-summary" element={<AISummaryPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
