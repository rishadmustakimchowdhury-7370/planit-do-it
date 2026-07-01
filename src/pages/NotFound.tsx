import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Structured log for observability without user-visible noise.
    console.warn("[404]", location.pathname);
    document.title = "Page not found — Hiremetrics";
  }, [location.pathname]);

  return (
    <main
      className="min-h-dvh flex items-center justify-center bg-background px-6 py-16"
      role="main"
    >
      <div className="w-full max-w-md text-center space-y-6 animate-fade-up">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Compass className="w-8 h-8 text-primary" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
            Error 404
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            We couldn't find that page
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            The page you're looking for may have been moved or no longer exists.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Go back
          </Button>
          <Button asChild>
            <Link to="/">
              <Home className="w-4 h-4" aria-hidden="true" />
              Return home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
