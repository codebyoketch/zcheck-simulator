import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage';

const Dashboard       = React.lazy(() => import('./pages/Dashboard'));
const PracticeSession = React.lazy(() => import('./pages/PracticeSession'));
const HistoryPage     = React.lazy(() => import('./pages/HistoryPage'));

// Admin pages
const AdminLayout     = React.lazy(() => import('./components/admin/AdminLayout'));
const AdminOverview   = React.lazy(() => import('./pages/admin/AdminOverview'));
const AdminExercises  = React.lazy(() => import('./pages/admin/AdminExercises'));
const AdminCheckpoints= React.lazy(() => import('./pages/admin/AdminCheckpoints'));
const AdminLanguages  = React.lazy(() => import('./pages/admin/AdminLanguages'));
const AdminUsers      = React.lazy(() => import('./pages/admin/AdminUsers'));

const Loader = () => (
  <div className="page-loading"><span className="spinner-lg" /></div>
);

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user)   return <Navigate to="/" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user)         return <Navigate to="/" replace />;
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
        {/* Public */}
        <Route path="/" element={<PublicRoute><AuthPage /></PublicRoute>} />

        {/* Student */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/practice"  element={<ProtectedRoute><PracticeSession /></ProtectedRoute>} />
        <Route path="/history"   element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />

        {/* Admin — nested under AdminLayout sidebar */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index         element={<AdminOverview />} />
          <Route path="exercises"   element={<AdminExercises />} />
          <Route path="checkpoints" element={<AdminCheckpoints />} />
          <Route path="languages"   element={<AdminLanguages />} />
          <Route path="users"       element={<AdminUsers />} />
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
