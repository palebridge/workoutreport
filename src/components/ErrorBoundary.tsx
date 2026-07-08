import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Keeps a metrics/render bug from blanking the whole dashboard. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Dashboard crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="card max-w-md text-center">
            <div className="text-3xl">🏋️‍♂️💥</div>
            <h1 className="mt-3 font-display text-xl font-semibold text-white">
              Something dropped the bar
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              The dashboard hit an unexpected error rendering your data. Reloading usually
              fixes it; if not, the last data sync may have produced something odd.
            </p>
            <p className="mt-2 break-all text-xs text-slate-600">{this.state.error.message}</p>
            <button
              onClick={() => location.reload()}
              className="mt-4 rounded-xl bg-gradient-to-r from-glow-violet to-glow-indigo px-4 py-2 text-sm font-medium text-white"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
