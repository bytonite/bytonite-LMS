import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: object | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: object) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backgroundColor: 'var(--background-primary)',
          color: 'var(--text-normal)',
        }}>
          <h2 style={{ color: 'var(--text-normal)' }}>Что-то пошло не так</h2>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '20px', maxWidth: '800px' }}>
            {this.state.error && (
              <div>
                <h3>Ошибка:</h3>
                <p>{this.state.error.toString()}</p>
                <h3>Детали:</h3>
                <p>{JSON.stringify(this.state.errorInfo, null, 2)}</p>
              </div>
            )}
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: 'var(--interactive-accent)',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Перезагрузить приложение
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
