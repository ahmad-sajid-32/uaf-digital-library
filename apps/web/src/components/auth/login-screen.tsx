"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ExternalLink, LoaderCircle, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
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
import { useLogin } from "@/hooks/useAuth";

export function LoginScreen(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { submit, loading, error, success } = useLogin();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  React.useEffect(() => {
    const resetState = searchParams.get("reset");

    if (resetState === "success") {
      toast.success("Password updated successfully. Please sign in again.");
      router.replace("/login", { scroll: false });
    }
  }, [router, searchParams]);

  React.useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  React.useEffect(() => {
    if (success) {
      toast.success("Sign-in successful.");
      router.refresh();
    }
  }, [router, success]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submit(email, password);
  };

  return (
    <AuthShell>
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
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <span>Contact Student Assistance</span>
            <ExternalLink className="h-4 w-4" />
          </div>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}
