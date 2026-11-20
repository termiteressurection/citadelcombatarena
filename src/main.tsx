import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { isTauri } from './core/persistence/storage';
import { bootstrapPortablePrefs } from './core/persistence/portablePrefs';
import { activateTauriVaultStorage } from './core/security/vaultStorage';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing application root element.');
const root = ReactDOM.createRoot(rootElement);

function StartupFailure({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', gap: 16, padding: 24 }}>
      <h1>Citadel could not start</h1>
      <p>{error}</p>
      <button onClick={onRetry}>Retry startup</button>
    </main>
  );
}

async function bootstrap() {
  if (!isTauri()) {
    throw new Error('Citadel is available only in the Tauri desktop application.');
  }

  await activateTauriVaultStorage();
  await bootstrapPortablePrefs();

  const [{ App }, { hydrateCitadelStore }] = await Promise.all([
    import('./app/App'),
    import('./core/state/citadelStore'),
  ]);
  await hydrateCitadelStore();
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

async function start() {
  try {
    await bootstrap();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[citadel] Startup failed:', error);
    root.render(
      <StartupFailure error={message} onRetry={() => void start()} />,
    );
  }
}

void start();
