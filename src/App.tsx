import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { Gate } from "./components/Gate";
import type { Dataset } from "./data/types";
import { UnitProvider } from "./hooks/useUnit";

// Vite's BASE_URL already includes the trailing slash (e.g. "/workoutreport/").
const BASE_URL = import.meta.env.BASE_URL;

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);

  if (!dataset) {
    return <Gate baseUrl={BASE_URL} onUnlock={setDataset} />;
  }

  return (
    <UnitProvider>
      <Dashboard dataset={dataset} />
    </UnitProvider>
  );
}
