"use client";

import React from "react";
import { useContext, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ThemeProvider } from "next-themes";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { usePathname } from "next/navigation";

import Footer from "@/components/layout/footer";
import { SidebarProvider } from "@/components/ui/sidebar";
import DownloadButton from "@/components/download-button";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import Navigation from "@/components/layout/navigation";

function FrozenRouter(props: { children: React.ReactNode }) {
  const context = useContext(LayoutRouterContext ?? {});
  const frozen = useRef(context).current;

  return (
    <LayoutRouterContext.Provider value={frozen}>{props.children}</LayoutRouterContext.Provider>
  );
}

export default function MainContent({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode={"wait"} initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 0 }}
        transition={{ duration: 0.3, ease: [0.27, 0.94, 0.48, 1.0] }}>
        <FrozenRouter>
          <SidebarProvider>
            <DownloadButton />
            <CustomSidebarTrigger />
            <ThemeProvider attribute="class" disableTransitionOnChange>
              <div className="flex grow lg:p-4 lg:ps-0">
                <div>
                  <Navigation />
                </div>
                <div className="grow">
                  <main className="bg-background min-h-[90vh] border lg:rounded-2xl">
                    <div className="mx-auto mb-6 max-w-screen-md space-y-14 px-4 py-6 lg:space-y-20 lg:py-16">
                      {children}
                    </div>
                  </main>
                  <Footer />
                </div>
              </div>
            </ThemeProvider>
          </SidebarProvider>
        </FrozenRouter>
      </motion.div>
    </AnimatePresence>
  );
}
