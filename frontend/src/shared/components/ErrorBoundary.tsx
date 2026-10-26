import React from 'react';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('THANDANAZI app crash', error, info);
  }

  resetApp = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } finally {
      window.location.href = `${window.location.origin}${window.location.pathname}?recovered=${Date.now()}`;
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="safe min-h-screen grid place-items-center p-5 bg-black text-white">
      <section className="card-glow max-w-xl w-full">
        <p className="section-title text-red-300">App safety screen</p>
        <h1 className="text-2xl font-black mt-2">The app stopped before it could continue</h1>
        <p className="text-zinc-400 mt-3 text-sm">This safety screen prevents a blank page. Clear the local app cache and open a fresh copy.</p>
        <pre className="mt-4 rounded-2xl bg-black/50 border border-red-500/20 p-3 text-xs text-red-200 overflow-auto max-h-40">{this.state.error.message}</pre>
        <button className="btn bg-orange-500 text-black w-full mt-5" onClick={this.resetApp}>Clear app cache and reload</button>
      </section>
    </main>;
  }
}
