import { Key, Loader2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getSystemSettings } from "@/repository/system-config";
import { LoginControls, LoginFormClient } from "./login-form-client";

// CUSTOM: 自定义系统名称
const DEFAULT_SITE_TITLE = "API 管理控制台";

export default async function LoginPage() {
  const [t, settings] = await Promise.all([getTranslations("auth"), getSystemSettings()]);
  const siteTitle = settings.siteTitle?.trim() || DEFAULT_SITE_TITLE;

  return (
    <div className="relative min-h-[var(--cch-viewport-height,100vh)] overflow-hidden bg-gradient-to-br from-background via-background to-orange-500/5 dark:to-orange-500/10">
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <LoginControls />
      </div>

      <div className="flex min-h-[var(--cch-viewport-height,100vh)]">
        <aside
          data-testid="login-brand-panel"
          className="relative hidden w-[45%] items-center justify-center overflow-hidden lg:flex"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-orange-400/5 to-transparent dark:from-orange-500/15 dark:via-orange-400/10" />

          <div className="relative z-10 flex flex-col items-center gap-6 px-12 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-600 ring-8 ring-orange-500/5 dark:text-orange-400">
              <Key className="h-10 w-10" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{siteTitle}</h1>
            <p className="max-w-xs text-base text-muted-foreground">{t("brand.tagline")}</p>
            <div className="mt-4 h-16 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
          </div>
        </aside>

        <div className="flex w-full flex-col items-center justify-center px-4 py-16 lg:w-[55%]">
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 ring-4 ring-orange-500/5 dark:text-orange-400">
              <Key className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{siteTitle}</h1>
              <p className="text-sm text-muted-foreground">{t("brand.tagline")}</p>
            </div>
          </div>

          <div className="w-full max-w-lg space-y-4">
            <Suspense fallback={<LoginPageFallback />}>
              <LoginFormClient />
            </Suspense>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-1"></div>
    </div>
  );
}

function LoginPageFallback() {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl dark:border-border/30">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
