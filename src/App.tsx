import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import JobsPage from "./pages/JobsPage";
import JobDetailPage from "./pages/JobDetailPage";
import EditJobPage from "./pages/EditJobPage";
import AddJobPage from "./pages/AddJobPage";
import CandidatesPage from "./pages/CandidatesPage";
import CandidateDetailPage from "./pages/CandidateDetailPage";
import AddCandidatePage from "./pages/AddCandidatePage";
import ClientsPage from "./pages/ClientsPage";
import AddClientPage from "./pages/AddClientPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import AIMatchPage from "./pages/AIMatchPage";
import SettingsPage from "./pages/SettingsPage";
import TeamMembersPage from "./pages/TeamMembersPage";
import TeamKPIDashboardPage from "./pages/TeamKPIDashboardPage";
import BrandingSettingsPage from "./pages/BrandingSettingsPage";
import AcceptInvitationPage from "./pages/AcceptInvitationPage";
import BillingPage from "./pages/BillingPage";
import ReportsPage from "./pages/ReportsPage";
import NotFound from "./pages/NotFound";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminAuditLogsPage from "./pages/admin/AdminAuditLogsPage";
import AdminPagesPage from "./pages/admin/AdminPagesPage";
import AdminBrandingPage from "./pages/admin/AdminBrandingPage";
import AdminEmailTemplatesPage from "./pages/admin/AdminEmailTemplatesPage";
import AdminBillingPage from "./pages/admin/AdminBillingPage";
import AdminVideosPage from "./pages/admin/AdminVideosPage";
import AdminLiveChatPage from "./pages/admin/AdminLiveChatPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminPackagesPage from "./pages/admin/AdminPackagesPage";
import AdminWhatsAppPage from "./pages/admin/AdminWhatsAppPage";
import AdminTestimonialsPage from "./pages/admin/AdminTestimonialsPage";
import TutorialVideosPage from "./pages/TutorialVideosPage";
import EmailAnalyticsPage from "./pages/EmailAnalyticsPage";
import EmailAccountsPage from "./pages/EmailAccountsPage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import CheckoutPage from "./pages/CheckoutPage";
import CheckoutSuccessPage from "./pages/CheckoutSuccessPage";
import CheckoutCancelPage from "./pages/CheckoutCancelPage";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminSEOPage from "./pages/admin/AdminSEOPage";
import AdminPromoCodesPage from "./pages/admin/AdminPromoCodesPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import FeaturesPage from "./pages/FeaturesPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import ReturnPolicyPage from "./pages/ReturnPolicyPage";
import { LiveChatWidget } from "./components/chat/LiveChatWidget";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    {/* Public routes */}
    <Route path="/" element={<Index />} />
    <Route path="/auth" element={<AuthPage />} />
    <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
    <Route path="/about" element={<AboutPage />} />
    <Route path="/contact" element={<ContactPage />} />
    <Route path="/features" element={<FeaturesPage />} />
    <Route path="/privacy" element={<PrivacyPage />} />
    <Route path="/terms" element={<TermsPage />} />
    <Route path="/return-policy" element={<ReturnPolicyPage />} />
    
    {/* Protected routes */}
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/jobs" element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />
    <Route path="/jobs/new" element={<ProtectedRoute><AddJobPage /></ProtectedRoute>} />
    <Route path="/jobs/:id" element={<ProtectedRoute><JobDetailPage /></ProtectedRoute>} />
    <Route path="/jobs/:id/edit" element={<ProtectedRoute><EditJobPage /></ProtectedRoute>} />
    <Route path="/candidates" element={<ProtectedRoute><CandidatesPage /></ProtectedRoute>} />
    <Route path="/candidates/new" element={<ProtectedRoute><AddCandidatePage /></ProtectedRoute>} />
    <Route path="/candidates/add" element={<ProtectedRoute><AddCandidatePage /></ProtectedRoute>} />
    <Route path="/candidates/:id" element={<ProtectedRoute><CandidateDetailPage /></ProtectedRoute>} />
    <Route path="/clients" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
    <Route path="/clients/new" element={<ProtectedRoute><AddClientPage /></ProtectedRoute>} />
    <Route path="/clients/:id" element={<ProtectedRoute><ClientDetailPage /></ProtectedRoute>} />
    <Route path="/ai-match" element={<ProtectedRoute><AIMatchPage /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    <Route path="/team" element={<ProtectedRoute><TeamMembersPage /></ProtectedRoute>} />
    <Route path="/team/kpi" element={<ProtectedRoute><TeamKPIDashboardPage /></ProtectedRoute>} />
    <Route path="/branding" element={<ProtectedRoute><BrandingSettingsPage /></ProtectedRoute>} />
    <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
    <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
    <Route path="/tutorials" element={<ProtectedRoute><TutorialVideosPage /></ProtectedRoute>} />
    <Route path="/email/analytics" element={<ProtectedRoute><EmailAnalyticsPage /></ProtectedRoute>} />
    <Route path="/email/accounts" element={<ProtectedRoute><EmailAccountsPage /></ProtectedRoute>} />
    <Route path="/events" element={<ProtectedRoute><EventsPage /></ProtectedRoute>} />
    <Route path="/events/:id" element={<ProtectedRoute><EventDetailPage /></ProtectedRoute>} />
    
    {/* Super Admin routes */}
    <Route path="/admin" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} />
    <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
    <Route path="/admin/packages" element={<ProtectedRoute><AdminPackagesPage /></ProtectedRoute>} />
    <Route path="/admin/pages" element={<ProtectedRoute><AdminPagesPage /></ProtectedRoute>} />
    <Route path="/admin/branding" element={<ProtectedRoute><AdminBrandingPage /></ProtectedRoute>} />
    <Route path="/admin/emails" element={<ProtectedRoute><AdminEmailTemplatesPage /></ProtectedRoute>} />
    <Route path="/admin/whatsapp" element={<ProtectedRoute><AdminWhatsAppPage /></ProtectedRoute>} />
    <Route path="/admin/billing" element={<ProtectedRoute><AdminBillingPage /></ProtectedRoute>} />
    <Route path="/admin/videos" element={<ProtectedRoute><AdminVideosPage /></ProtectedRoute>} />
    <Route path="/admin/chat" element={<ProtectedRoute><AdminLiveChatPage /></ProtectedRoute>} />
    <Route path="/admin/settings" element={<ProtectedRoute><AdminSettingsPage /></ProtectedRoute>} />
    <Route path="/admin/logs" element={<ProtectedRoute><AdminAuditLogsPage /></ProtectedRoute>} />
    <Route path="/admin/testimonials" element={<ProtectedRoute><AdminTestimonialsPage /></ProtectedRoute>} />
    <Route path="/admin/orders" element={<ProtectedRoute><AdminOrdersPage /></ProtectedRoute>} />
    <Route path="/admin/seo" element={<ProtectedRoute><AdminSEOPage /></ProtectedRoute>} />
    <Route path="/admin/promo-codes" element={<ProtectedRoute><AdminPromoCodesPage /></ProtectedRoute>} />
    
    {/* Checkout routes */}
    <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
    <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccessPage /></ProtectedRoute>} />
    <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
    
    {/* 404 */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
          <LiveChatWidget />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;