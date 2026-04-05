"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { QuickLinks } from "./quick-links";
import { TocNav, type TocItem } from "./toc-nav";
import { useUsageDocAuth } from "./usage-doc-auth-context";

interface UsageDocPageShellProps {
  tocItems: TocItem[];
  children: ReactNode;
}

export function UsageDocPageShell({ tocItems, children }: UsageDocPageShellProps) {
  const t = useTranslations("usage");
  const { isLoggedIn } = useUsageDocAuth();
  const [activeId, setActiveId] = useState<string>(tocItems[0]?.id ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (tocItems.length === 0) {
      setActiveId("");
      return;
    }

    const elements = tocItems
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element instanceof HTMLElement);

    if (elements.length === 0) {
      setActiveId(tocItems[0]?.id ?? "");
      return;
    }

    const indexById = new Map(tocItems.map((item, index) => [item.id, index]));

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              (indexById.get(a.target.id) ?? Number.MAX_SAFE_INTEGER) -
              (indexById.get(b.target.id) ?? Number.MAX_SAFE_INTEGER)
          );

        if (visibleEntries[0]) {
          setActiveId(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: "-96px 0px -65% 0px",
        threshold: [0, 0.25, 0.5, 1],
      }
    );

    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, [tocItems]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }

    const offsetTop = element.offsetTop - 80;
    window.scrollTo({
      top: offsetTop,
      behavior: "smooth",
    });
    setSheetOpen(false);
  };

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {t("skipLinks.mainContent")}
      </a>
      <a
        href="#toc-navigation"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-40 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {t("skipLinks.tableOfContents")}
      </a>

      <div className="relative flex gap-6 lg:gap-8">
        <div className="flex-1 min-w-0">
          <div className="relative bg-card rounded-xl shadow-sm border p-4 sm:p-6 md:p-8 lg:p-12">
            <main id="main-content" role={t("ui.main")} aria-label={t("ui.mainContent")}>
              {children}
            </main>
          </div>
        </div>

        <aside
          id="toc-navigation"
          className="hidden lg:block w-64 shrink-0"
          aria-label={t("navigation.pageNavigation")}
        >
          <div className="sticky top-24 space-y-4">
            <div className="bg-card rounded-lg border p-4">
              <h4 className="font-semibold text-sm mb-3">{t("navigation.tableOfContents")}</h4>
              <TocNav
                tocItems={tocItems}
                activeId={activeId}
                tocReady={true}
                onItemClick={scrollToSection}
              />
            </div>

            <div className="bg-card rounded-lg border p-4">
              <h4 className="font-semibold text-sm mb-3">{t("navigation.quickLinks")}</h4>
              <QuickLinks isLoggedIn={isLoggedIn} />
            </div>
          </div>
        </aside>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className="fixed bottom-6 right-6 z-40 lg:hidden shadow-lg"
              aria-label={t("navigation.openTableOfContents")}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85vw] sm:w-[400px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t("navigation.documentNavigation")}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <div>
                <h4 className="font-semibold text-sm mb-3">{t("navigation.tableOfContents")}</h4>
                <TocNav
                  tocItems={tocItems}
                  activeId={activeId}
                  tocReady={true}
                  onItemClick={scrollToSection}
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-3">{t("navigation.quickLinks")}</h4>
                <QuickLinks isLoggedIn={isLoggedIn} onBackToTop={() => setSheetOpen(false)} />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
