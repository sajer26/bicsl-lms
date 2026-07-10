import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/routes/ProtectedRoute';

import Landing from '@/pages/Landing';
import Register from '@/pages/auth/Register';
import SignIn from '@/pages/auth/SignIn';
import SuperAdminSignIn from '@/pages/auth/SuperAdminSignIn';
import Welcome from '@/pages/learner/Welcome';
import LearnerDashboard from '@/pages/learner/LearnerDashboard';
import ModuleScreen from '@/pages/learner/ModuleScreen';
import CertificateScreen from '@/pages/learner/CertificateScreen';
import HospitalAdminDashboard from '@/pages/hospital/HospitalAdminDashboard';
import AdminLayout from '@/pages/admin/AdminLayout';
import SuperAdminDashboard from '@/pages/admin/SuperAdminDashboard';
import HospitalsManagement from '@/pages/admin/HospitalsManagement';
import LearnersManagement from '@/pages/admin/LearnersManagement';
import ModulesManagement from '@/pages/admin/ModulesManagement';
import ModuleContentEditor from '@/pages/admin/ModuleContentEditor';
import Reports from '@/pages/admin/Reports';
import AuditLog from '@/pages/admin/AuditLog';
import PlatformSettings from '@/pages/admin/PlatformSettings';
import Unauthorized from '@/pages/errors/Unauthorized';
import NotFound from '@/pages/errors/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<Register />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/super-admin/sign-in" element={<SuperAdminSignIn />} />

          <Route
            path="/welcome"
            element={
              <ProtectedRoute allowedRoles={['learner']}>
                <Welcome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['learner']}>
                <LearnerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/module/:moduleId"
            element={
              <ProtectedRoute allowedRoles={['learner']}>
                <ModuleScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/certificate"
            element={
              <ProtectedRoute allowedRoles={['learner']}>
                <CertificateScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hospital"
            element={
              <ProtectedRoute allowedRoles={['hospital_admin']}>
                <HospitalAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SuperAdminDashboard />} />
            <Route path="hospitals" element={<HospitalsManagement />} />
            <Route path="learners" element={<LearnersManagement />} />
            <Route path="modules" element={<ModulesManagement />} />
            <Route path="modules/:moduleId" element={<ModuleContentEditor />} />
            <Route path="reports" element={<Reports />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="settings" element={<PlatformSettings />} />
          </Route>

          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
