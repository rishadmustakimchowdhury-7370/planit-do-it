import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CookieConsentProvider } from "@/lib/cookie-consent";
import { DynamicHead } from "@/components/DynamicHead";
import { CookieConsentBanner } from "@/components/cookie/CookieConsentBanner";
import { Loader2 } from "lucide-react";
// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const RecruiterDashboardPage = lazy(() => import("./pages/RecruiterDashboardPage"));
const JobsPage = lazy(() => import("./pages/JobsPage"));
const JobDetailPage = lazy(() => import("./pages/JobDetailPage"));
const EditJobPage = lazy(() => import("./pages/EditJobPage"));
const AddJobPage = lazy(() => import("./pages/AddJobPage"));
const JobAssignmentsPage = lazy(() => import("./pages/JobAssignmentsPage"));
const CandidatesPage = lazy(() => import("./pages/CandidatesPage"));
const CandidateDetailPage = lazy(() => import("./pages/CandidateDetailPage"));
const EditCandidatePage = lazy(() => import("./pages/EditCandidatePage"));
const AddCandidatePage = lazy(() => import("./pages/AddCandidatePage"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const AddClientPage = lazy(() => import("./pages/AddClientPage"));
const ClientDetailPage = lazy(() => import("./pages/ClientDetailPage"));
const AIMatchPage = lazy(() => import("./pages/AIMatchPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TeamMembersPage = lazy(() => import("./pages/TeamMembersPage"));
const TeamKPIDashboardPage = lazy(() => import("./pages/TeamKPIDashboardPage"));
const WorkTrackingPage = lazy(() => import("./pages/WorkTrackingPage"));
const RecruiterWorkDashboardPage = lazy(() => import("./pages/RecruiterWorkDashboardPage"));
const ManagerWorkDashboardPage = lazy(() => import("./pages/ManagerWorkDashboardPage"));
const TeamUsagePage = lazy(() => import("./pages/TeamUsagePage"));
const BrandingSettingsPage = lazy(() => import("./pages/BrandingSettingsPage"));
const AcceptInvitationPage = lazy(() => import("./pages/AcceptInvitationPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TutorialVideosPage = lazy(() => import("./pages/TutorialVideosPage"));
const EmailAnalyticsPage = lazy(() => import("./pages/EmailAnalyticsPage"));
const EmailAccountsPage = lazy(() => import("./pages/EmailAccountsPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const EventDetailPage = lazy(() => import("./pages/EventDetailPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const CheckoutSuccessPage = lazy(() => import("./pages/CheckoutSuccessPage"));
const CheckoutCancelPage = lazy(() => import("./pages/CheckoutCancelPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const ReturnPolicyPage = lazy(() => import("./pages/ReturnPolicyPage"));
const CookiePolicyPage = lazy(() => import("./pages/CookiePolicyPage"));

// Admin pages - lazy loaded
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminAuditLogsPage = lazy(() => import("./pages/admin/AdminAuditLogsPage"));
const AdminPagesPage = lazy(() => import("./pages/admin/AdminPagesPage"));
const AdminBrandingPage = lazy(() => import("./pages/admin/AdminBrandingPage"));
const AdminEmailTemplatesPage = lazy(() => import("./pages/admin/AdminEmailTemplatesPage"));
const AdminBillingPage = lazy(() => import("./pages/admin/AdminBillingPage"));
const AdminVideosPage = lazy(() => import("./pages/admin/AdminVideosPage"));
const AdminLiveChatPage = lazy(() => import("./pages/admin/AdminLiveChatPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminPackagesPage = lazy(() => import("./pages/admin/AdminPackagesPage"));
const AdminUserMarketingPage = lazy(() => import("./pages/admin/AdminUserMarketingPage"));
const AdminBillingSettingsPage = lazy(() => import("./pages/admin/AdminBillingSettingsPage"));
const AdminStripeConnectPage = lazy(() => import("./pages/admin/AdminStripeConnectPage"));
const AdminTestimonialsPage = lazy(() => import("./pages/admin/AdminTestimonialsPage"));
const AdminUsageAnalyticsPage = lazy(() => import("./pages/admin/AdminUsageAnalyticsPage"));
const AdminOrdersPage = lazy(() => import("./pages/admin/AdminOrdersPage"));
const AdminSEOPage = lazy(() => import("./pages/admin/AdminSEOPage"));
const AdminTrustedClientsPage = lazy(() => import("./pages/admin/AdminTrustedClientsPage"));
const AdminPromoCodesPage = lazy(() => import("./pages/admin/AdminPromoCodesPage"));

// Lazy load chat widget
const LiveChatWidget = lazy(() => import("./components/chat/LiveChatWidget").then(m => ({ default: m.LiveChatWidget })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-accent" />
  </div>
);

// Protected route wrapper with role-based dashboard routing
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isRecruiter, isOwner, isManager } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Dashboard route wrapper that redirects recruiters
function DashboardRoute() {
  const { isRecruiter, isOwner, isManager, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  // Redirect recruiters to their specific dashboard
  if (isRecruiter && !isOwner && !isManager) {
    return (
      <Suspense fallback={<PageLoader />}>
        <RecruiterDashboardPage />
      </Suspense>
    );
  }

  // Owners and managers see the full dashboard
  return (
    <Suspense fallback={<PageLoader />}>
      <DashboardPage />
    </Suspense>
  );
}

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
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
      <Route path="/cookie-policy" element={<CookiePolicyPage />} />
      
      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardRoute /></ProtectedRoute>} />
      <Route path="/jobs" element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />
      <Route path="/jobs/assignments" element={<ProtectedRoute><JobAssignmentsPage /></ProtectedRoute>} />
      <Route path="/jobs/new" element={<ProtectedRoute><AddJobPage /></ProtectedRoute>} />
      <Route path="/jobs/:id" element={<ProtectedRoute><JobDetailPage /></ProtectedRoute>} />
      <Route path="/jobs/:id/edit" element={<ProtectedRoute><EditJobPage /></ProtectedRoute>} />
      <Route path="/candidates" element={<ProtectedRoute><CandidatesPage /></ProtectedRoute>} />
      <Route path="/candidates/new" element={<ProtectedRoute><AddCandidatePage /></ProtectedRoute>} />
      <Route path="/candidates/add" element={<ProtectedRoute><AddCandidatePage /></ProtectedRoute>} />
      <Route path="/candidates/:id" element={<ProtectedRoute><CandidateDetailPage /></ProtectedRoute>} />
      <Route path="/candidates/:id/edit" element={<ProtectedRoute><EditCandidatePage /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
      <Route path="/clients/new" element={<ProtectedRoute><AddClientPage /></ProtectedRoute>} />
      <Route path="/clients/:id" element={<ProtectedRoute><ClientDetailPage /></ProtectedRoute>} />
      <Route path="/ai-match" element={<ProtectedRoute><AIMatchPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute><TeamMembersPage /></ProtectedRoute>} />
      <Route path="/team/kpi" element={<ProtectedRoute><TeamKPIDashboardPage /></ProtectedRoute>} />
      <Route path="/team/work-tracking" element={<ProtectedRoute><WorkTrackingPage /></ProtectedRoute>} />
      <Route path="/team/work-dashboard" element={<ProtectedRoute><RecruiterWorkDashboardPage /></ProtectedRoute>} />
      <Route path="/team/manager-dashboard" element={<ProtectedRoute><ManagerWorkDashboardPage /></ProtectedRoute>} />
      <Route path="/team/usage" element={<ProtectedRoute><TeamUsagePage /></ProtectedRoute>} />
      
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
      <Route path="/admin/marketing" element={<ProtectedRoute><AdminUserMarketingPage /></ProtectedRoute>} />
      <Route path="/admin/packages" element={<ProtectedRoute><AdminPackagesPage /></ProtectedRoute>} />
      <Route path="/admin/pages" element={<ProtectedRoute><AdminPagesPage /></ProtectedRoute>} />
      <Route path="/admin/branding" element={<ProtectedRoute><AdminBrandingPage /></ProtectedRoute>} />
      <Route path="/admin/emails" element={<ProtectedRoute><AdminEmailTemplatesPage /></ProtectedRoute>} />
      
      <Route path="/admin/billing" element={<ProtectedRoute><AdminBillingPage /></ProtectedRoute>} />
      <Route path="/admin/videos" element={<ProtectedRoute><AdminVideosPage /></ProtectedRoute>} />
      <Route path="/admin/chat" element={<ProtectedRoute><AdminLiveChatPage /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute><AdminSettingsPage /></ProtectedRoute>} />
      <Route path="/admin/logs" element={<ProtectedRoute><AdminAuditLogsPage /></ProtectedRoute>} />
      <Route path="/admin/testimonials" element={<ProtectedRoute><AdminTestimonialsPage /></ProtectedRoute>} />
      <Route path="/admin/usage-analytics" element={<ProtectedRoute><AdminUsageAnalyticsPage /></ProtectedRoute>} />
      <Route path="/admin/orders" element={<ProtectedRoute><AdminOrdersPage /></ProtectedRoute>} />
      <Route path="/admin/seo" element={<ProtectedRoute><AdminSEOPage /></ProtectedRoute>} />
      <Route path="/admin/promo-codes" element={<ProtectedRoute><AdminPromoCodesPage /></ProtectedRoute>} />
      <Route path="/admin/billing-settings" element={<ProtectedRoute><AdminBillingSettingsPage /></ProtectedRoute>} />
      <Route path="/admin/stripe-connect" element={<ProtectedRoute><AdminStripeConnectPage /></ProtectedRoute>} />
      <Route path="/admin/trusted-clients" element={<ProtectedRoute><AdminTrustedClientsPage /></ProtectedRoute>} />
      
      {/* Checkout routes */}
      <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
      <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccessPage /></ProtectedRoute>} />
      <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
      
      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CookieConsentProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <DynamicHead />
            <AppRoutes />
            <Suspense fallback={null}>
              <LiveChatWidget />
            </Suspense>
            <CookieConsentBanner />
          </BrowserRouter>
        </TooltipProvider>
      </CookieConsentProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
