import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage';

const Dashboard          = React.lazy(() => import('./pages/Dashboard'));
const Disclaimer         = React.lazy(() => import('./pages/Disclaimer'));
const PracticeSession    = React.lazy(() => import('./pages/PracticeSession'));
const HistoryPage        = React.lazy(() => import('./pages/HistoryPage'));
const CheckpointMap      = React.lazy(() => import('./pages/CheckpointMap'));
const ExerciseSandbox    = React.lazy(() => import('./pages/ExerciseSandbox'));

const AdminLayout        = React.lazy(() => import('./components/admin/AdminLayout'));
const AdminOverview      = React.lazy(() => import('./pages/admin/AdminOverview'));
const AdminExercises     = React.lazy(() => import('./pages/admin/AdminExercises'));
const AdminCheckpoints   = React.lazy(() => import('./pages/admin/AdminCheckpoints'));
const AdminLanguages     = React.lazy(() => import('./pages/admin/AdminLanguages'));
const AdminUsers         = React.lazy(() => import('./pages/admin/AdminUsers'));
const AdminSubmissions   = React.lazy(() => import('./pages/admin/AdminSubmissions'));

const Loader = () => <div className="page-loading"><span className="spinner-lg" /></div>;

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user)   return <Navigate to="/" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/" replace />;
  if (!user.is_staff && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
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
    <React.Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/"            element={<PublicRoute><AuthPage /></PublicRoute>} />
        <Route path="/dashboard"   element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/disclaimer"  element={<ProtectedRoute><Disclaimer /></ProtectedRoute>} />
        <Route path="/practice"    element={<ProtectedRoute><PracticeSession /></ProtectedRoute>} />
        <Route path="/history"     element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        <Route path="/checkpoints" element={<ProtectedRoute><CheckpointMap /></ProtectedRoute>} />
        <Route path="/sandbox"     element={<ProtectedRoute><ExerciseSandbox /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index                element={<AdminOverview />} />
          <Route path="exercises"     element={<AdminExercises />} />
          <Route path="checkpoints"   element={<AdminCheckpoints />} />
          <Route path="languages"     element={<AdminLanguages />} />
          <Route path="users"         element={<AdminUsers />} />
          <Route path="submissions"   element={<AdminSubmissions />} />
        </Route>
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