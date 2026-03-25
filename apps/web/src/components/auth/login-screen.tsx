"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  ExternalLink,
  LoaderCircle,
  Lock,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageTransitionLoader } from "@/components/ui/page-transition-loader";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useGuestRouteState } from "@/hooks/use-guest-route-state";
import { useLogin } from "@/hooks/useAuth";

const STUDENT_ASSISTANCE_EMAIL = "ahmadsajid41324@gmail.com";
const STUDENT_ASSISTANCE_COMPOSE_URL =
  "https://mail.google.com/mail/?view=cm&fs=1&tf=1" +
  `&to=${encodeURIComponent(STUDENT_ASSISTANCE_EMAIL)}` +
  `&su=${encodeURIComponent("UAF Smart E-Library Assistance")}`;

export function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { submit, loading, error } = useLogin();
  const { auth, loading: routeLoading, redirectPath, redirectMessage } =
    useGuestRouteState("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);
  const [redirecting, setRedirecting] = React.useState(false);
  const seededRememberMeRef = React.useRef(false);
  const handledToastStateRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const resetState = searchParams.get("reset");
    const setupState = searchParams.get("setup");
    const authState = searchParams.get("auth");
    const toastStateKey = `${resetState ?? ""}|${setupState ?? ""}|${authState ?? ""}`;

    if (handledToastStateRef.current === toastStateKey) {
      return;
    }

    if (resetState === "success") {
      handledToastStateRef.current = toastStateKey;
      toast.success("Password updated successfully. Please sign in again.", {
        id: "login-reset-success",
      });
      router.replace("/login", { scroll: false });
      return;
    }

    if (setupState === "success") {
      handledToastStateRef.current = toastStateKey;
      toast.success("Password set successfully. You can now sign in.", {
        id: "login-setup-success",
      });
      router.replace("/login", { scroll: false });
      return;
    }

    if (authState === "invalid-recovery-link") {
      handledToastStateRef.current = toastStateKey;
      toast.error(
        "This password link is invalid or expired. Please sign in again.",
        {
          id: "login-invalid-recovery-link",
        },
      );
      router.replace("/login", { scroll: false });
      return;
    }

    if (authState === "session-expired") {
      handledToastStateRef.current = toastStateKey;
      toast.error("Your session expired. Please sign in again.", {
        id: "login-session-expired",
      });
      router.replace("/login", { scroll: false });
      return;
    }

    handledToastStateRef.current = null;
  }, [router, searchParams]);

  React.useEffect(() => {
    if (error) {
      toast.error(error, {
        id: "login-submit-error",
      });
    }
  }, [error]);

  React.useEffect(() => {
    if (!seededRememberMeRef.current && !routeLoading) {
      setRememberMe(auth.rememberMe);
      seededRememberMeRef.current = true;
    }
  }, [auth.rememberMe, routeLoading]);

  React.useEffect(() => {
    if (!routeLoading && redirectPath) {
      setRedirecting(true);
      router.replace(redirectPath);
    }
  }, [redirectPath, routeLoading, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPath = await submit(email, password, {
      rememberMe,
    });

    if (!nextPath) {
      return;
    }

    if (nextPath === "/auth/verify-required") {
      toast.warning(
        "Sign-in completed, but email verification is still required.",
        {
          id: "login-submit-verification-required",
        },
      );
    } else if (nextPath === "/auth/access-denied") {
      toast.error(
        "Signed in successfully, but this account role is not routable.",
        {
          id: "login-submit-access-denied",
        },
      );
    } else {
      toast.success("Sign-in successful.", {
        id: "login-submit-success",
      });
    }

    router.replace(nextPath);
  };

  const handleStudentAssistanceClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    event.preventDefault();

    const composeWindow = window.open(
      STUDENT_ASSISTANCE_COMPOSE_URL,
      "student-assistance-compose",
      "popup=yes,width=1200,height=820,left=120,top=80,noopener,noreferrer",
    );

    if (composeWindow) {
      composeWindow.focus();
      return;
    }

    window.open(
      STUDENT_ASSISTANCE_COMPOSE_URL,
      "_blank",
      "noopener,noreferrer",
    );
  };

  if (routeLoading || redirecting) {
    return (
      <AuthShell>
        <PageTransitionLoader
          title={redirecting ? "Opening Your Workspace" : "Checking Session"}
          message={
            redirecting
              ? (redirectMessage ?? "Redirecting to your account destination.")
              : "Validating your current sign-in state before rendering the login form."
          }
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <ScrollReveal direction="up" delayMs={30}>
      <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
        <CardHeader className="space-y-2 px-5 pb-1 pt-5 text-center sm:px-6">
          <CardTitle className="font-display text-3xl font-black tracking-tight text-foreground">
            Welcome Back
          </CardTitle>
          <CardDescription className="px-0 text-sm leading-6 text-muted-foreground">
            Access your academic resources and digital collections.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-5 pb-5 sm:px-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="login-email">University Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="username@uaf.edu.pk"
                  className="h-12 rounded-xl border-border/70 bg-muted pl-11 text-sm"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="login-password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-12 rounded-xl border-border/70 bg-muted pl-11 pr-12 text-sm"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-start gap-4">
              <Label
                htmlFor="login-remember-me"
                className="text-xs font-semibold text-foreground"
              >
                Remember Me
              </Label>
              <Checkbox
                id="login-remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => {
                  setRememberMe(checked === true);
                }}
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-sm font-bold shadow-md shadow-primary/20"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 border-t border-border/60 px-5 pb-5 pt-4 text-center sm:px-6">
          <p className="text-sm text-muted-foreground">
            Having trouble logging in?
          </p>
          <a
            href={STUDENT_ASSISTANCE_COMPOSE_URL}
            onClick={handleStudentAssistanceClick}
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
          >
            <span>Contact Student Assistance</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </CardFooter>
      </Card>
      </ScrollReveal>
    </AuthShell>
  );
}
