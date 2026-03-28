import type { ReactNode } from "react";
import { HideFooter } from "@/components/customs/hide-footer";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <HideFooter />
    </>
  );
}
