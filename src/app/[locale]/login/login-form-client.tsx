"use client";

import { AlertTriangle, Eye, EyeOff, Key, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useRouter } from "@/i18n/routing";
import { resolveLoginRedirectTarget } from "./redirect-safety";

type LoginStatus = "idle" | "submitting" | "success" | "error";
type LoginType = "admin" | "dashboard_user" | "readonly_user";

function parseLoginType(value: unknown): LoginType | null {
  if (value === "admin" || value === "dashboard_user" || value === "readonly_user") {
    return value;
  }

  return null;
}

function getLoginTypeFallbackPath(loginType: LoginType): string {
  return loginType === "readonly_user" ? "/my-usage" : "/dashboard";
}

export function LoginControls() {
  return (
    <>
      <ThemeSwitcher size="sm" />
      <LanguageSwitcher size="sm" />
    </>
  );
}

export function LoginFormClient() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "";

  const apiKeyInputRef = useRef<HTMLInputElement>(null);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [error, setError] = useState("");
  const [showHttpWarning, setShowHttpWarning] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (status === "error" && apiKeyInputRef.current) {
      apiKeyInputRef.current.focus();
    }
  }, [status]);

  useEffect(() => {
    const isHttp = window.location.protocol === "http:";
    const isLocalhost =
      window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    setShowHttpWarning(isHttp && !isLocalhost);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("submitting");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t("errors.loginFailed"));
        setStatus("error");
        return;
      }

      setStatus("success");
      const loginType = parseLoginType(data.loginType);
      const fallbackPath = loginType ? getLoginTypeFallbackPath(loginType) : from;
      const redirectTarget = resolveLoginRedirectTarget(data.redirectTo, fallbackPath);
      router.push(redirectTarget);
      router.refresh();
    } catch {
      setError(t("errors.networkError"));
      setStatus("error");
    }
  };

  const isLoading = status === "submitting" || status === "success";

  return (
    <>
      {isLoading && (
        <div
          data-testid="loading-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t("login.loggingIn")}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-200"
        >
          <Loader2 className="h-12 w-12 animate-spin motion-reduce:animate-none text-primary" />
          <p
            className="mt-4 text-lg font-medium text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {t("login.loggingIn")}
          </p>
        </div>
      )}

      <Card className="w-full border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl dark:border-border/30">
        <CardHeader className="space-y-6 flex flex-col items-center text-center pt-8 pb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 ring-8 ring-orange-500/5 dark:text-orange-400 lg:hidden">
            <Key className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight">{t("form.title")}</CardTitle>
            <CardDescription className="text-base">{t("form.description")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {showHttpWarning ? (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t("security.cookieWarningTitle")}</AlertTitle>
              <AlertDescription className="mt-2 space-y-2 text-sm">
                <p>{t("security.cookieWarningDescription")}</p>
                <div className="mt-3">
                  <p className="font-medium">{t("security.solutionTitle")}</p>
                  <ol className="ml-4 mt-1 list-decimal space-y-1">
                    <li>{t("security.useHttps")}</li>
                    <li>{t("security.disableSecureCookies")}</li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="apiKey">{t("form.apiKeyLabel")}</Label>
                <div className="relative">
                  <Key className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="apiKey"
                    ref={apiKeyInputRef}
                    type={showPassword ? "text" : "password"}
                    placeholder={t("placeholders.apiKeyExample")}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pl-9 pr-10"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? t("form.hidePassword") : t("form.showPassword")}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <div className="space-y-2 flex flex-col items-center">
              <Button
                type="submit"
                className="w-full max-w-full"
                disabled={isLoading || !apiKey.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("login.loggingIn")}
                  </>
                ) : (
                  t("actions.enterConsole")
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {t("security.privacyNote")}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
