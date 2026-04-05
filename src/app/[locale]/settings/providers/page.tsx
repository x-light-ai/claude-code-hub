import { BarChart3 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { getSystemSettings } from "@/repository/system-config";
import { SettingsPageHeader } from "../_components/settings-page-header";
import { AutoSortPriorityDialog } from "./_components/auto-sort-priority-dialog";
import { ProviderManagerLoader } from "./_components/provider-manager-loader";
import { ReclusterVendorsDialog } from "./_components/recluster-vendors-dialog";
import { SchedulingRulesDialog } from "./_components/scheduling-rules-dialog";

export const dynamic = "force-dynamic";

export default async function SettingsProvidersPage() {
  const [t, session, systemSettings] = await Promise.all([
    getTranslations("settings"),
    getSession(),
    getSystemSettings(),
  ]);

  return (
    <>
      <SettingsPageHeader title={t("providers.title")} description={t("providers.description")} />

      <Section
        title={t("providers.section.title")}
        description={t("providers.section.description")}
        actions={
          <>
            <AutoSortPriorityDialog />
            <ReclusterVendorsDialog />
            <SchedulingRulesDialog />
          </>
        }
      >
        <ProviderManagerLoader
          currentUser={session?.user}
          currencyCode={systemSettings.currencyDisplay}
        />
      </Section>
    </>
  );
}
