import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render/runtime errors in the subtree instead of letting a single
 * broken component blank the entire app — important once this is a public
 * product where you don't control every input someone throws at it. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ margin: 24, maxWidth: 480 }}>
          <h3 style={{ marginTop: 0 }}>Something went wrong</h3>
          <p className="footer-note">
            This part of the app hit an unexpected error. Your data is safe — it's saved independently of this
            view. Reloading the page usually fixes it.
          </p>
          <button className="btn" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
