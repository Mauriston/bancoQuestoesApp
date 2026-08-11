import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { AdminLoginPage } from '../pages/AdminLoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { UnauthorizedPage, InactivePage, NotFoundPage } from '../pages/UnauthorizedPage';
import { useAuth } from '../contexts/AuthContext';

import { UserLayout } from '../layouts/UserLayout';
import { ExamsPage } from '../pages/app/ExamsPage';
import { TakeExamPage } from '../pages/app/TakeExamPage';
import { ExamResultPage } from '../pages/app/ExamResultPage';
import { HistoryPage } from '../pages/app/HistoryPage';
import { PerformancePage } from '../pages/app/PerformancePage';
import { ExamStatsPage } from '../pages/app/ExamStatsPage';
import { SettingsPage } from '../pages/app/SettingsPage';

import { AdminLayout } from '../layouts/AdminLayout';
import { DashboardPage } from '../pages/admin/DashboardPage';
import { UsersPage } from '../pages/admin/UsersPage';
import { UserDetailPage } from '../pages/admin/UserDetailPage';
import { QuestionsPage } from '../pages/admin/QuestionsPage';
import { ImportPage } from '../pages/admin/ImportPage';
import { ExamsListPage } from '../pages/admin/ExamsListPage';
import { ExamViewPage } from '../pages/admin/ExamViewPage';
import { CreateExamPage } from '../pages/admin/CreateExamPage';
import { AttemptsPage } from '../pages/admin/AttemptsPage';

const UserProtectedRoute: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Verificando sessão de usuário...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (!currentUser.active) {
    return <Navigate to="/inactive" replace />;
  }

  return <UserLayout />;
};

const AdminProtectedRoute: React.FC = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Verificando permissões administrativas...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!currentUser.active) {
    return <Navigate to="/inactive" replace />;
  }

  if (currentUser.role !== 'admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  return <AdminLayout />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Landing & Login Routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/cadastro" element={<RegisterPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/inactive" element={<InactivePage />} />

      {/* User Application Routes */}
      <Route path="/app" element={<UserProtectedRoute />}>
        <Route index element={<Navigate to="/app/exams" replace />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="exams/:assignmentId" element={<TakeExamPage />} />
        <Route path="attempts/:attemptId/result" element={<ExamResultPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="performance" element={<PerformancePage />} />
        <Route path="exam-stats" element={<ExamStatsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Admin Application Routes */}
      <Route path="/admin" element={<AdminProtectedRoute />}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:userId" element={<UserDetailPage />} />
        <Route path="questions" element={<QuestionsPage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="images" element={<Navigate to="/admin/import" replace />} />
        <Route path="exams" element={<ExamsListPage />} />
        <Route path="exams/new" element={<CreateExamPage />} />
        <Route path="exams/:examId/edit" element={<CreateExamPage />} />
        <Route path="exams/:examId" element={<ExamViewPage />} />
        <Route path="attempts" element={<AttemptsPage />} />
        <Route path="exam-stats" element={<ExamStatsPage />} />
      </Route>

      {/* Fallback 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
