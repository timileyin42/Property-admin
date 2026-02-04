import { RouterProvider, createBrowserRouter } from "react-router-dom";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { VerifyEmail } from "./pages/VerifyEmail";
import ChangePassword from "./pages/ChangePassword";
import { LoginForm } from "./pages/LoginForm";
import DashboardLayout from "./layout/DashboardLayout";
import Interest from "./pages/dashboard/Interest";
import UploadProperties from "./pages/dashboard/UploadProperties";
import UserManagement from "./pages/dashboard/UserManagement";
import AdminProperties from "./pages/dashboard/AdminProperties";
import AdminUpdates from "./pages/dashboard/AdminUpdates";
import AssignInvestment from "./pages/dashboard/AssignInvestment";
import UserDetails from "./pages/dashboard/UserDetails";
import AdminInvestments from "./pages/dashboard/AdminInvestments";
import { ProtectedRoutes } from "./util/ProtectedRoutes";
import { DashboardProvider } from "./context/dashboard.context";

function App() {
  const router = createBrowserRouter([
    { path: "/", element: <LoginForm /> },
    { path: "/login", element: <LoginForm /> },
    { path: "/verify_email", element: <VerifyEmail /> },
    { path: "/forgotpassword", element: <ForgotPassword /> },
    { path: "/resetpassword", element: <ResetPassword /> },
    { path: "/changepassword", element: <ChangePassword /> },
    {
      element: <ProtectedRoutes allowedRole="ADMIN" />,
      children: [
        {
          path: "/admindashboard",
          element: (
            <DashboardProvider>
              <DashboardLayout />
            </DashboardProvider>
          ),
          children: [
            { index: true, element: <Interest /> },
            { path: "uploadproperties", element: <UploadProperties /> },
            { path: "properties", element: <AdminProperties /> },
            { path: "updates", element: <AdminUpdates /> },
            { path: "investments", element: <AdminInvestments /> },
            { path: "user_management", element: <UserManagement /> },
            { path: "assign-investment", element: <AssignInvestment /> },
            { path: "users/:id", element: <UserDetails /> },
          ],
        },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}

export default App;
