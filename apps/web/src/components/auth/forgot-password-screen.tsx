"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  LoaderCircle,
  Mail,
  SendHorizontal,
  ShieldCheck,
  ShieldEllipsis,
} from "lucide-react";
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
import { PageTransitionLoader } from "@/components/ui/page-transition-loader";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useGuestRouteState } from "@/hooks/use-guest-route-state";
import { useForgotPassword } from "@/hooks/useAuth";

export function ForgotPasswordScreen(): React.JSX.Element {
  const router = useRouter();
  const { submit, loading, error, success } = useForgotPassword();
  const { loading: routeLoading, redirectPath, redirectMessage } =
    useGuestRouteState("forgot-password");
  const [email, setEmail] = React.useState("");
  const [redirecting, setRedirecting] = React.useState(false);

  React.useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  React.useEffect(() => {
    if (success) {
      toast.success("Reset email will arrive shortly.", {
        id: "forgot-password-success",
      });
    }
  }, [success]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submit(email);
  };

  React.useEffect(() => {
    if (!routeLoading && redirectPath) {
      setRedirecting(true);
      router.replace(redirectPath);
    }
  }, [redirectPath, routeLoading, router]);

  if (routeLoading || redirecting) {
    return (
      <AuthShell>
        <PageTransitionLoader
          title={redirecting ? "Returning To Your Workspace" : "Checking Session"}
          message={
            redirecting
              ? (redirectMessage ??
                "An active session was found, so the recovery form is being skipped.")
              : "Validating your current sign-in state before rendering the recovery form."
          }
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <ScrollReveal direction="up-right" delayMs={50}>
      <Card className="border-border/60 bg-card/95 shadow-md shadow-primary/10">
        <CardHeader className="space-y-3.5 px-5 pb-1 pt-5 sm:px-6">
          <div className="mx-auto flex h-20 w-full items-center justify-center rounded-2xl border border-border/60 bg-muted text-primary">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <ShieldEllipsis className="h-7 w-7" />
            </div>
          </div>
          <div className="space-y-2 text-left">
            <CardTitle className="font-display text-3xl font-black tracking-tight text-foreground">
              Forgot Password?
            </CardTitle>
            <CardDescription className="px-0 text-sm leading-7 text-muted-foreground">
              No worries. Enter your university email and we will send a secure
              recovery link to reset your password.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5 sm:px-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="forgot-email">University Email Address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="student@uaf.edu.pk"
                  className="h-12 rounded-xl border-border/70 bg-muted pl-11 text-sm"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>

            {success ? (
              <p className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                Reset email will arrive shortly.
              </p>
            ) : null}

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
                  Sending Reset Link...
                </>
              ) : (
                <>
                  Send Reset Link
                  <SendHorizontal className="h-5 w-5" />
                </>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 border-t border-border/60 px-5 pb-5 pt-4 sm:px-6">
          <Button asChild variant="ghost" className="h-auto p-0 text-sm font-semibold text-primary hover:bg-transparent hover:text-primary/80">
            <Link href="/login">
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </Button>

          <div className="flex flex-wrap items-center justify-center gap-5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <div className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-success" />
              Secure Portal
            </div>
            <div className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              256-Bit Encryption
            </div>
          </div>
        </CardFooter>
      </Card>
      </ScrollReveal>
    </AuthShell>
  );
}
