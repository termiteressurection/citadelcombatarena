import { Suspense, lazy } from 'react';

const App = lazy(() => import('@/app/App').then(module => ({ default: module.App })));

export function UnlockGate() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#07070a' }} />}>
      <App />
    </Suspense>
  );
}
