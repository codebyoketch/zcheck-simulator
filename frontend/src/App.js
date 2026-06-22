import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage';

// Lazy load heavier pages
const Dashboard   = React.lazy(() => import('./pages/Dashboard'));
const PracticeSession = React.lazy(() => import('./pages/PracticeSession'));
const HistoryPage = React.lazy(() => import('./pages/HistoryPage'));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading"><span className="spinner-lg" /></div>;
  if (!user)   return <Navigate to="/" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user)    return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <React.Suspense fallback={<div className="page-loading"><span className="spinner-lg" /></div>}>
      <Routes>
        <Route path="/" element={
          <PublicRoute><AuthPage /></PublicRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/practice" element={
          <ProtectedRoute><PracticeSession /></ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute><HistoryPage /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </React.Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
