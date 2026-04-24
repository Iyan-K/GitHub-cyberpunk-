import { Injectable, signal } from '@angular/core';

/**
 * Tiny shared store for "critical alert" state, set by the dashboard and consumed by
 * the app shell (to recolour the retrowave background and show the alert overlay).
 */
@Injectable({ providedIn: 'root' })
export class AlertStateService {
  private readonly _active = signal(false);
  private readonly _count = signal(0);

  readonly active = this._active.asReadonly();
  readonly count = this._count.asReadonly();

  set(active: boolean, count: number): void {
    this._active.set(active);
    this._count.set(count);
  }
}
