import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { UserRole } from '../../../shared/types';
import { ProtectedRoute, AuthRedirect } from '../components/ProtectedRoute';
import MainLayout from '../layouts/MainLayout';
import StaffLayout from '../layouts/StaffLayout';
import DriverLayout from '../layouts/DriverLayout';

// ── Auth Pages ──
import LoginPage from '../pages/auth/LoginPage';
import UnauthorizedPage from '../pages/error/UnauthorizedPage';

// ── Admin Pages ──
import DashboardPage from '../pages/admin/dashboard/DashboardPage';

const BillingPage = lazy(() => import('../pages/admin/billing/BillingPage'));
const ConfigPage = lazy(() => import('../pages/admin/config/ConfigPage'));
const StaffPage = lazy(() => import('../pages/admin/staff/StaffPage'));
const StaffDetailPage = lazy(() => import('../pages/admin/staff/StaffDetailPage'));
const CustomersPage = lazy(() => import('../pages/admin/customers/CustomersPage'));
const RolesPage = lazy(() => import('../pages/admin/roles/RolesPage'));
const LogsPage = lazy(() => import('../pages/admin/logs/LogsPage'));

// ── Manager / Staff / Driver Pages ──
import ManagerDashboard from '../pages/manager/ManagerDashboard';
const AssignmentsPage = lazy(() => import('../pages/manager/assignments/AssignmentsPage'));
const VehiclesPage = lazy(() => import('../pages/shared/vehicles/VehiclesPage'));
const SharedFacilitiesPage = lazy(() => import('../pages/shared/facilities/FacilitiesPage'));
const SharedPricingPage = lazy(() => import('../pages/shared/pricing/PricingPage'));

const ExceptionsManagerPage = lazy(
  () => import('../pages/manager/exceptionsManager/ExceptionsManagerPage')
);
// Staff Pages ──
const VehicleCheckPage = lazy(() => import('../pages/staff/vehicleCheck/VehicleCheckPage'));
const ActiveSessionsPage = lazy(() => import('../pages/staff/activeSessions/ActiveSessionsPage'));
const ExceptionsStaffPage = lazy(
  () => import('../pages/staff/exceptionsStaff/ExceptionsStaffPage')
);
const ShiftSelectionPage = lazy(() => import('../pages/staff/shiftSelection/ShiftSelectionPage'));

// ── Driver Pages ──
const DriverDashboard = lazy(() => import('../pages/driver/dashboard/DriverDashboard'));
const DriverFacilitiesPage = lazy(() => import('../pages/driver/facilities/FacilitiesPage'));
const ReservationPage = lazy(() => import('../pages/driver/book/ReservationPage'));
const HistoryPage = lazy(() => import('../pages/driver/history/HistoryPage'));
import { Loading } from '../components/ui/Loading';

const S = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<Loading variant="fullscreen" text="Đang tải hệ thống..." />}>{children}</Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: (
      <AuthRedirect>
        <LoginPage />
      </AuthRedirect>
    ),
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        path: 'staff/shift-selection',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN]} />
        ),
        children: [
          {
            index: true,
            element: (
              <S>
                <ShiftSelectionPage />
              </S>
            ),
          },
        ],
      },
      {
        element: <MainLayout />,
        children: [
          // ── Admin Routes ──────────────────────────────────
          {
            path: 'admin',
            element: <ProtectedRoute allowedRoles={[UserRole.ADMIN]} />,
            children: [
              { index: true, element: <DashboardPage /> },
              {
                path: 'facilities',
                element: (
                  <S>
                    <SharedFacilitiesPage />
                  </S>
                ),
              },
              // FR-5: Quản lý Bảng giá
              {
                path: 'pricing',
                element: (
                  <S>
                    <SharedPricingPage />
                  </S>
                ),
              },
              {
                path: 'billing',
                element: (
                  <S>
                    <BillingPage />
                  </S>
                ),
              },
              {
                path: 'config',
                element: (
                  <S>
                    <ConfigPage />
                  </S>
                ),
              },
              {
                path: 'logs',
                element: (
                  <S>
                    <LogsPage />
                  </S>
                ),
              },
              // FR-18: User Management
              {
                path: 'staff',
                element: (
                  <S>
                    <StaffPage />
                  </S>
                ),
              },
              {
                path: 'staff/:id',
                element: (
                  <S>
                    <StaffDetailPage />
                  </S>
                ),
              },
              {
                path: 'customers',
                element: (
                  <S>
                    <CustomersPage />
                  </S>
                ),
              },
              // FR-19: Role & Permission Management
              {
                path: 'roles',
                element: (
                  <S>
                    <RolesPage />
                  </S>
                ),
              },
              {
                path: 'vehicles',
                element: (
                  <S>
                    <VehiclesPage />
                  </S>
                ),
              },
            ],
          },

          // ── Manager Routes ────────────────────────────────
          {
            path: 'manager',
            element: <ProtectedRoute allowedRoles={[UserRole.MANAGER, UserRole.ADMIN]} />,
            children: [
              { index: true, element: <ManagerDashboard /> },
              {
                path: 'assignments',
                element: (
                  <S>
                    <AssignmentsPage />
                  </S>
                ),
              },
              {
                path: 'vehicles',
                element: (
                  <S>
                    <VehiclesPage />
                  </S>
                ),
              },
              // FR-1,2,3: Quản lý Tòa nhà & Phân tầng
              {
                path: 'facilities',
                element: (
                  <S>
                    <SharedFacilitiesPage />
                  </S>
                ),
              },
              // FR-5: Quản lý Bảng giá
              {
                path: 'pricing',
                element: (
                  <S>
                    <SharedPricingPage />
                  </S>
                ),
              },

              // FR-7: Sự cố (Manager)
              {
                path: 'exceptions',
                element: (
                  <S>
                    <ExceptionsManagerPage />
                  </S>
                ),
              },
            ],
          },
        ],
      },
      {
        path: 'staff',
        element: (
          <ProtectedRoute allowedRoles={[UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN]} />
        ),
        children: [
          {
            element: <StaffLayout />,
            children: [
              {
                index: true,
                element: (
                  <S>
                    <VehicleCheckPage />
                  </S>
                ),
              },
              {
                path: 'active-sessions',
                element: (
                  <S>
                    <ActiveSessionsPage />
                  </S>
                ),
              },
              {
                path: 'exceptions',
                element: (
                  <S>
                    <ExceptionsStaffPage />
                  </S>
                ),
              },
            ],
          },
        ],
      },
      // ── Driver Routes ────────────────────────────────
      {
        path: 'driver',
        element: <ProtectedRoute allowedRoles={[UserRole.DRIVER]} />,
        children: [
          {
            element: <DriverLayout />,
            children: [
              {
                index: true,
                element: (
                  <S>
                    <DriverDashboard />
                  </S>
                ),
              },
              {
                path: 'facilities',
                element: (
                  <S>
                    <DriverFacilitiesPage />
                  </S>
                ),
              },
              {
                path: 'book/:facilityId',
                element: (
                  <S>
                    <ReservationPage />
                  </S>
                ),
              },
              {
                path: 'active-session',
                element: (
                  <S>
                    <DriverDashboard />
                  </S>
                ),
              },
              {
                path: 'history',
                element: (
                  <S>
                    <HistoryPage />
                  </S>
                ),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);
