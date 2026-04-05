import { headers } from "next/headers";
import { Footer } from "./footer";

export async function ConditionalFooter() {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";

  // 隐藏 footer 的路径
  const hideFooterPaths = ["/login", "/my-usage"];

  const shouldHideFooter = hideFooterPaths.some((path) => pathname.includes(path));

  if (shouldHideFooter) {
    return null;
  }

  return <Footer />;
}
