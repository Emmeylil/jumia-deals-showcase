import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import "./index.css";
import posthog from "posthog-js";
import { PostHogProvider } from '@posthog/react';

const options = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: "2025-05-24", 
} as const;

// Initialize globally for non-React files (like stats.ts)
posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN, options);

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ErrorBoundary>
            <PostHogProvider client={posthog}>
                <App />
            </PostHogProvider>
        </ErrorBoundary>
    </StrictMode>
);
