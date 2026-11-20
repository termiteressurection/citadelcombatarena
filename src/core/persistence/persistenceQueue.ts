import type { CitadelStateModel } from '../model/types';

export type StateWriter = (state: CitadelStateModel, revision: number) => Promise<void>;

export class PersistenceQueue {
  private currentRevision = 0;
  private committedRevision = 0;
  private pendingSnapshot: { state: CitadelStateModel; revision: number } | null = null;
  private isWriting = false;
  private writer: StateWriter;
  private idleResolvers: Array<() => void> = [];
  private lastError: Error | null = null;

  constructor(writer: StateWriter) {
    this.writer = writer;
  }

  /**
   * Enqueue a new state snapshot synchronously.
   * Returns the monotonic revision number assigned to this state.
   */
  enqueue(state: CitadelStateModel): number {
    this.currentRevision += 1;
    this.pendingSnapshot = { state, revision: this.currentRevision };
    void this.processQueue();
    return this.currentRevision;
  }

  getCurrentRevision(): number {
    return this.currentRevision;
  }

  getCommittedRevision(): number {
    return this.committedRevision;
  }

  getLastError(): Error | null {
    return this.lastError;
  }

  private async processQueue(): Promise<void> {
    if (this.isWriting || !this.pendingSnapshot) {
      if (!this.isWriting && !this.pendingSnapshot) {
        this.notifyIdle();
      }
      return;
    }

    this.isWriting = true;

    while (this.pendingSnapshot) {
      const next = this.pendingSnapshot;
      this.pendingSnapshot = null;

      // Skip stale revisions if somehow out of order
      if (next.revision <= this.committedRevision) {
        continue;
      }

      try {
        await this.writer(next.state, next.revision);
        this.committedRevision = Math.max(this.committedRevision, next.revision);
        this.lastError = null;
      } catch (err) {
        this.lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`[citadel] Persistence write failed at rev ${next.revision}:`, err);
      }
    }

    this.isWriting = false;
    this.notifyIdle();
  }

  private notifyIdle(): void {
    if (this.idleResolvers.length > 0 && !this.isWriting && !this.pendingSnapshot) {
      const resolvers = [...this.idleResolvers];
      this.idleResolvers = [];
      resolvers.forEach((resolve) => resolve());
    }
  }

  /**
   * Resolves when all queued writes have been processed.
   */
  async waitForIdle(): Promise<void> {
    if (!this.isWriting && !this.pendingSnapshot) {
      return;
    }
    return new Promise((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  /** Wait for durable writer completion and surface the last failed revision. */
  async flush(): Promise<void> {
    await this.waitForIdle();
    if (this.lastError) throw this.lastError;
  }
}
