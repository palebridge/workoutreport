import { useCallback, useRef, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Gate } from "./components/Gate";
import { decryptDataset, fetchEncryptedPayload } from "./crypto/decrypt";
import type { Dataset } from "./data/types";
import { UnitProvider } from "./hooks/useUnit";
import { WeeklyTargetProvider } from "./hooks/useWeeklyTarget";

// Vite's BASE_URL already includes the trailing slash (e.g. "/workoutreport/").
const BASE_URL = import.meta.env.BASE_URL;

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  // Kept in memory only (never persisted) so "Refresh" can re-decrypt a newly
  // deployed snapshot without re-prompting for the password.
  const passwordRef = useRef<string | null>(null);
  const lastGenRef = useRef<string | null>(null);

  const handleUnlock = useCallback((d: Dataset, password: string) => {
    passwordRef.current = password;
    lastGenRef.current = d.generatedAt;
    setDataset(d);
  }, []);

  // Re-fetch the latest *deployed* encrypted blob and decrypt it in place.
  const refresh = useCallback(async (): Promise<{ changed: boolean }> => {
    const password = passwordRef.current;
    if (!password) return { changed: false };
    const payload = await fetchEncryptedPayload(BASE_URL);
    const data = await decryptDataset(payload, password);
    const changed = data.generatedAt !== lastGenRef.current;
    // Only swap the dataset (which re-renders/re-animates every chart) when the
    // deployed snapshot actually changed — a no-op refresh stays perfectly still.
    if (changed) {
      lastGenRef.current = data.generatedAt;
      setDataset(data);
    }
    return { changed };
  }, []);

  if (!dataset) {
    return <Gate baseUrl={BASE_URL} onUnlock={handleUnlock} />;
  }

  return (
    <ErrorBoundary>
      <UnitProvider>
        <WeeklyTargetProvider>
          <Dashboard dataset={dataset} onRefresh={refresh} />
        </WeeklyTargetProvider>
      </UnitProvider>
    </ErrorBoundary>
  );
}
