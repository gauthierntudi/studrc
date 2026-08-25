"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ToastContainer } from "react-toastify";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider, useSiteTheme } from "@/components/site/theme-provider";
import "react-toastify/dist/ReactToastify.css";
import type { SiteTheme } from "@/lib/site-theme";

function ThemedToasts() {
  const { theme } = useSiteTheme();
  return (
    <ToastContainer
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme={theme}
    />
  );
}

export function Providers({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: SiteTheme;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initialTheme={initialTheme}>
        <AuthProvider>
          {children}
          <ThemedToasts />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
