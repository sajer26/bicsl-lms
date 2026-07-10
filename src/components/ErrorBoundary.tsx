import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * Per AI Development Instructions: "Never allow blank pages. Never leave
 * runtime errors visible to users." This boundary catches render errors
 * anywhere in the tree and shows a friendly fallback instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center text-center px-4">
          <div>
            <h1 className="text-2xl font-bold text-brand-800 mb-2">Something went wrong</h1>
            <p className="text-ink/60 mb-6">
              Please refresh the page. If the problem continues, contact your administrator.
            </p>
            <button onClick={() => window.location.assign('/')} className="btn-primary">
              Return Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
