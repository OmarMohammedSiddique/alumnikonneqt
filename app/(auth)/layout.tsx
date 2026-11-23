import { AuthAtmosphere } from "./auth-atmosphere";
import styles from "./login/login-sky.module.css";
import Link from "next/link";
import { PrototypeNotice } from "@/components/brand";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { CookieSettingsTrigger } from "@/components/cookie-settings-trigger";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${styles.authLayout} flex min-h-svh items-center justify-center border-t-4 border-t-(--brand-red) bg-surface px-4 py-4 sm:px-6 lg:px-10`}>
      <main className="w-full max-w-[1440px]">
        <a href="#auth-content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-background focus:px-5 focus:py-3 focus:text-foreground focus:outline-2 focus:outline-ring">Skip to content</a>
        <SiteHeader flush className="mb-3" />
        <AuthAtmosphere />
        <div id="auth-content" tabIndex={-1} className="outline-none">{children}</div>
        <footer className="mt-6 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
          <nav aria-label="Auth page footer navigation" className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/about-developer" className="underline-offset-4 hover:underline">
              About Developer
            </Link>
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            <CookieSettingsTrigger className="underline-offset-4 hover:underline" />
          </nav>
          <div className="flex flex-col items-center justify-center gap-2">
            <ThemeToggle />
            <PrototypeNotice className="text-center" />
          </div>
        </footer>
      </main>
    </div>
  );
}
