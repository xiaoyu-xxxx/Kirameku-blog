"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ExternalApiConfig = {
  id: number;
  key: string;
  name: string;
  base_url: string;
  path: string;
  method: string;
  enabled: boolean;
  params: Record<string, any> | string;
  description: string;
  sort: number;
};

export type AppConfig = {
  externalApis: ExternalApiConfig[];
  siteSettings: Record<string, any>;
  about: { content: string; cover: string };
};

const EMPTY: AppConfig = {
  externalApis: [],
  siteSettings: {},
  about: { content: "", cover: "" }
};

interface AppConfigContextType extends AppConfig {
  loaded: boolean;
}

const AppConfigContext = createContext<AppConfigContextType>({
  ...EMPTY,
  loaded: false
});

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/config")
      .then(res => (res.ok ? res.json() : null))
      .then((data: {
        external_apis?: ExternalApiConfig[];
        site_settings?: Record<string, any>;
        about?: { content: string; cover: string };
      } | null) => {
        if (cancelled || !data) return;
        setConfig({
          externalApis: Array.isArray(data.external_apis)
            ? data.external_apis
            : [],
          siteSettings: data.site_settings ?? {},
          about: data.about ?? { content: "", cover: "" }
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppConfigContext.Provider value={{ ...config, loaded }}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}
