import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors in a page so one broken component doesn't take
 * down the whole app — the header/nav (rendered outside this boundary, in
 * Layout) stay usable so there's always a way back to a working page. Resets
 * automatically on navigation (see Layout, which remounts this by key).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Turkoll: unhandled error in page render", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <div className="notice notice--danger">
            <strong>Något gick fel när sidan skulle visas.</strong>
            <p>
              Prova att ladda om, eller gå till en annan sida via menyn ovan. Om
              felet kvarstår, kontrollera din internetanslutning.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
