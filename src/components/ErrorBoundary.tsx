import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: Readonly<ErrorBoundaryProps>;
  state: ErrorBoundaryState = { hasError: false };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-6 max-w-3xl mx-auto">
            <h1 className="text-xl font-bold mb-2 text-red-600">
              אירעה שגיאה בעת טעינת התצוגה.
            </h1>
            <p className="text-sm text-gray-600">
              אנחנו מציגים כרגע נתוני דמו בלבד כדי שתוכל להמשיך לעבוד. אפשר לרענן את הדף או לנסות שוב מאוחר יותר.
            </p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

