import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * "Deck Overheat" gauge — a Cyberdeck Heat Sink styled progress bar that
 * visualises the repository's overall CI/CD health.
 *
 * Heat % = ratio of failing builds to total open PRs (capped at 100%).
 * If there are no open PRs, we fall back to a raw-count scale where each
 * failure adds 20% so 5+ failures still register as a full Overheat.
 *
 * The bar uses a green → yellow → red gradient, and once heat crosses the
 * "danger" threshold the whole component switches into a flashing-red
 * "OVERHEAT" state.
 */
@Component({
  selector: 'app-overheat-gauge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './overheat-gauge.html',
  styleUrl: './overheat-gauge.scss',
})
export class OverheatGaugeComponent {
  private _failedBuilds = signal(0);
  private _openPRs = signal(0);

  @Input() set failedBuilds(value: number) {
    this._failedBuilds.set(Math.max(0, value | 0));
  }
  @Input() set openPRs(value: number) {
    this._openPRs.set(Math.max(0, value | 0));
  }

  /** Heat percentage in the [0, 100] range. */
  heat = computed(() => {
    const failures = this._failedBuilds();
    const open = this._openPRs();
    if (failures === 0) return 0;
    if (open > 0) {
      return Math.min(100, Math.round((failures / open) * 100));
    }
    // No open PRs to compare against — fall back to raw count.
    return Math.min(100, failures * 20);
  });

  failingCount = computed(() => this._failedBuilds());
  openCount = computed(() => this._openPRs());

  /** Display label for the right-hand status readout. */
  statusLabel = computed(() => {
    const h = this.heat();
    if (h >= 80) return 'OVERHEAT';
    if (h >= 50) return 'CRITICAL';
    if (h >= 25) return 'WARM';
    if (h > 0)   return 'NOMINAL';
    return 'COOL';
  });

  /** Once we cross this threshold the whole gauge starts flashing red. */
  isOverheating = computed(() => this.heat() >= 80);
}
