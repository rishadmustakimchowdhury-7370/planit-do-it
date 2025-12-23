import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, ArrowLeft, Eye, EyeOff, BarChart3, Target, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BRAND, getLogoHTML } from '@/components/brand/Logo';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

// Hiremetrics Logo Component
function HiremetricsLogo({ variant = 'default', size = 'md' }: { variant?: 'default' | 'light'; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12',
  };
  
  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const colorClass = variant === 'light' ? 'text-white' : 'text-foreground';
  const iconBg = variant === 'light' ? 'bg-white/20' : 'bg-gradient-to-br from-primary to-primary/80';
  const iconColor = variant === 'light' ? 'text-white' : 'text-primary-foreground';

  return (
    <div className="flex items-center gap-3">
      <div className={`${sizeClasses[size]} aspect-square rounded-xl ${iconBg} flex items-center justify-center`}>
        <BarChart3 className={`${iconColor} h-1/2 w-1/2`} />
      </div>
      <div className="flex flex-col">
        <span className={`font-bold tracking-tight ${textSizeClasses[size]} ${colorClass}`}>
          Hiremetrics
        </span>
        {size !== 'sm' && (
          <span className={`text-[10px] font-medium tracking-wider uppercase ${variant === 'light' ? 'text-white/70' : 'text-muted-foreground'}`}>
            Recruitment Analytics
          </span>
        )}
      </div>
    </div>
  );
}

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const tempToken = searchParams.get('temp_token');
  const tempUserId = searchParams.get('user_id');
  
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isLoading, setIsLoading] = useState(false);
  const [isTempLoginLoading, setIsTempLoginLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewConfirmPassword, setShowNewConfirmPassword] = useState(false);
  const { signIn, signUp, signInWithGoogle, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Handle temporary login via edge function
  useEffect(() => {
    const handleTempLogin = async () => {
      if (!tempToken || !tempUserId) return;

      setIsTempLoginLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('temp-login', {
          body: { token: tempToken, user_id: tempUserId },
        });

        if (error || !data?.success) {
          toast({
            variant: 'destructive',
            title: 'Invalid or expired link',
            description: data?.error || 'This temporary login link is invalid or has expired.',
          });
          setIsTempLoginLoading(false);
          return;
        }

        if (data.redirect_url) {
          window.location.href = data.redirect_url;
        } else {
          toast({
            title: 'Login successful',
            description: 'Redirecting to dashboard...',
          });
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Temp login error:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'An error occurred while processing the temporary login.',
        });
        setIsTempLoginLoading(false);
      }
    };

    handleTempLogin();
  }, [tempToken, tempUserId, toast, navigate]);

  // Listen for PASSWORD_RECOVERY event
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowResetPassword(true);
        setShowForgotPassword(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authLoading && user && !showResetPassword) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate, showResetPassword]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);
    setIsLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: error.message === 'Invalid login credentials' 
          ? 'Incorrect email or password. Please try again.'
          : error.message,
      });
    } else {
      toast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
      });
      navigate('/dashboard');
    }
  };

  const handleSignup = async (data: SignupFormData) => {
    setIsLoading(true);
    const { error } = await signUp(data.email, data.password, data.fullName);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          variant: 'destructive',
          title: 'Account exists',
          description: 'An account with this email already exists. Please login instead.',
        });
        setActiveTab('login');
      } else {
        toast({
          variant: 'destructive',
          title: 'Signup failed',
          description: error.message,
        });
      }
    } else {
      toast({
        title: 'Account created!',
        description: 'Please check your email to verify your account.',
      });
    }
  };

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email: data.email },
      });
      
      if (error) throw error;
      
      toast({
        title: 'Password reset email sent',
        description: 'Check your email for the password reset link. It will expire in 1 hour.',
      });
      setShowForgotPassword(false);
      forgotPasswordForm.reset();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to send password reset email.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });
      
      if (error) throw error;
      
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: user?.email,
            subject: `Password Changed Successfully - ${BRAND.name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                ${getLogoHTML({ size: 'md' })}
                <h2 style="color: #1E3A8A; margin-top: 20px;">Password Changed Successfully</h2>
                <p>Hello,</p>
                <p>Your password has been successfully changed for your ${BRAND.name} account.</p>
                <p>If you did not make this change, please contact our support team immediately at ${BRAND.supportEmail}.</p>
                <br/>
                <p>Best regards,<br/>The ${BRAND.name} Team</p>
              </div>
            `,
          },
        });
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
      
      toast({
        title: 'Password updated!',
        description: 'Your password has been successfully changed.',
      });
      
      setShowResetPassword(false);
      resetPasswordForm.reset();
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update password.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Google login failed',
        description: error.message,
      });
    }
  };

  if (authLoading || isTempLoginLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {isTempLoginLoading && (
          <p className="text-muted-foreground">Processing temporary login...</p>
        )}
      </div>
    );
  }

  const features = [
    { icon: BarChart3, title: 'Performance Analytics', description: 'Track recruiter KPIs in real-time' },
    { icon: Target, title: 'Smart Matching', description: 'AI-powered candidate matching' },
    { icon: TrendingUp, title: 'Growth Insights', description: 'Data-driven hiring decisions' },
    { icon: Users, title: 'Team Management', description: 'Collaborate with your team' },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left side - Hero Section */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/70" />
        
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div>
            <Link to="/" className="inline-block">
              <HiremetricsLogo variant="light" size="lg" />
            </Link>
          </div>
          
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                Measure What Matters.<br />
                <span className="text-white/80">Hire Smarter.</span>
              </h1>
              <p className="text-lg text-white/70 mt-4 max-w-lg">
                The recruitment analytics platform that helps you track performance, optimize processes, and make data-driven hiring decisions.
              </p>
            </motion.div>
            
            {/* Feature cards */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="grid grid-cols-2 gap-4"
            >
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10"
                >
                  <feature.icon className="h-6 w-6 text-white/90 mb-2" />
                  <h3 className="font-semibold text-white text-sm">{feature.title}</h3>
                  <p className="text-white/60 text-xs mt-1">{feature.description}</p>
                </motion.div>
              ))}
            </motion.div>
            
            {/* Stats */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="flex gap-12"
            >
              <div>
                <div className="text-3xl font-bold text-white">10k+</div>
                <div className="text-white/60 text-sm">Candidates Matched</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">500+</div>
                <div className="text-white/60 text-sm">Agencies Trust Us</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">95%</div>
                <div className="text-white/60 text-sm">Match Accuracy</div>
              </div>
            </motion.div>
          </div>
          
          <div className="text-sm text-white/50">
            © 2024 Hiremetrics. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 min-h-screen lg:min-h-0">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link to="/">
              <HiremetricsLogo size="md" />
            </Link>
          </div>

          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors text-sm group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back to home
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                {showResetPassword 
                  ? 'Set new password'
                  : showForgotPassword 
                    ? 'Reset your password'
                    : activeTab === 'login' ? 'Welcome back' : 'Create an account'}
              </h2>
              <p className="text-muted-foreground mt-2">
                {showResetPassword
                  ? 'Enter your new password below'
                  : showForgotPassword
                    ? "Enter your email and we'll send you a reset link"
                    : activeTab === 'login' 
                      ? 'Enter your credentials to access your account' 
                      : 'Get started with your free trial today'}
              </p>
            </div>

            {showResetPassword ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pl-10 pr-10 h-12 bg-muted/50 border-border/50 focus:bg-background"
                        {...resetPasswordForm.register('password')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {resetPasswordForm.formState.errors.password && (
                      <p className="text-sm text-destructive">{resetPasswordForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-new-password"
                        type={showNewConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pl-10 pr-10 h-12 bg-muted/50 border-border/50 focus:bg-background"
                        {...resetPasswordForm.register('confirmPassword')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowNewConfirmPassword(!showNewConfirmPassword)}
                      >
                        {showNewConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {resetPasswordForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-destructive">{resetPasswordForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full h-12 text-base font-medium" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Update Password
                  </Button>
                </form>
              </motion.div>
            ) : showForgotPassword ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPassword)} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-10 h-12 bg-muted/50 border-border/50 focus:bg-background"
                        {...forgotPasswordForm.register('email')}
                      />
                    </div>
                    {forgotPasswordForm.formState.errors.email && (
                      <p className="text-sm text-destructive">{forgotPasswordForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full h-12 text-base font-medium" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Send Reset Link
                  </Button>

                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full" 
                    onClick={() => setShowForgotPassword(false)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to login
                  </Button>
                </form>
              </motion.div>
            ) : (
              <>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-8 h-12 bg-muted/50 p-1">
                    <TabsTrigger value="login" className="h-10 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      Login
                    </TabsTrigger>
                    <TabsTrigger value="signup" className="h-10 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">
                      Sign Up
                    </TabsTrigger>
                  </TabsList>

                  <AnimatePresence mode="wait">
                    <TabsContent value="login" className="space-y-5 mt-0">
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                      >
                        <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
                          <div className="space-y-2">
                            <Label htmlFor="login-email">Email</Label>
                            <div className="relative">
                              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="login-email"
                                type="email"
                                placeholder="you@example.com"
                                className="pl-10 h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                                {...loginForm.register('email')}
                              />
                            </div>
                            {loginForm.formState.errors.email && (
                              <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="login-password">Password</Label>
                              <Button 
                                type="button" 
                                variant="link" 
                                className="px-0 h-auto text-xs text-muted-foreground hover:text-primary"
                                onClick={() => setShowForgotPassword(true)}
                              >
                                Forgot password?
                              </Button>
                            </div>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="login-password"
                                type={showLoginPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                className="pl-10 pr-10 h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                                {...loginForm.register('password')}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                              >
                                {showLoginPassword ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                            {loginForm.formState.errors.password && (
                              <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                            )}
                          </div>

                          <Button type="submit" className="w-full h-12 text-base font-medium" disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Sign In
                          </Button>
                        </form>
                      </motion.div>
                    </TabsContent>

                    <TabsContent value="signup" className="space-y-5 mt-0">
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                      >
                        <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-5">
                          <div className="space-y-2">
                            <Label htmlFor="signup-name">Full Name</Label>
                            <div className="relative">
                              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="signup-name"
                                type="text"
                                placeholder="John Doe"
                                className="pl-10 h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                                {...signupForm.register('fullName')}
                              />
                            </div>
                            {signupForm.formState.errors.fullName && (
                              <p className="text-sm text-destructive">{signupForm.formState.errors.fullName.message}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="signup-email">Email</Label>
                            <div className="relative">
                              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="signup-email"
                                type="email"
                                placeholder="you@example.com"
                                className="pl-10 h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                                {...signupForm.register('email')}
                              />
                            </div>
                            {signupForm.formState.errors.email && (
                              <p className="text-sm text-destructive">{signupForm.formState.errors.email.message}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="signup-password">Password</Label>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="signup-password"
                                type={showSignupPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                className="pl-10 pr-10 h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                                {...signupForm.register('password')}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowSignupPassword(!showSignupPassword)}
                              >
                                {showSignupPassword ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                            {signupForm.formState.errors.password && (
                              <p className="text-sm text-destructive">{signupForm.formState.errors.password.message}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="signup-confirm">Confirm Password</Label>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="signup-confirm"
                                type={showConfirmPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                className="pl-10 pr-10 h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                                {...signupForm.register('confirmPassword')}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              >
                                {showConfirmPassword ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                            {signupForm.formState.errors.confirmPassword && (
                              <p className="text-sm text-destructive">{signupForm.formState.errors.confirmPassword.message}</p>
                            )}
                          </div>

                          <Button type="submit" className="w-full h-12 text-base font-medium" disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Create Account
                          </Button>
                        </form>
                      </motion.div>
                    </TabsContent>
                  </AnimatePresence>
                </Tabs>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-4 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full h-12 text-base font-medium border-border/50 hover:bg-muted/50" 
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Google
                </Button>
              </>
            )}
          </motion.div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            By continuing, you agree to our{' '}
            <Link to="/terms" className="underline hover:text-foreground transition-colors">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
