import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-critical-alert',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="alert-overlay" *ngIf="active">
      <div class="alert-banner">
        <div class="row top">
          <span class="chev">▲</span>
          <span class="alert-text">CRITICAL ALERT</span>
          <span class="chev">▲</span>
        </div>
        <div class="row sub">
          <span>BUILD FAILURE DETECTED</span>
          <span class="count" *ngIf="failureCount > 0">— {{ failureCount }} BROKEN PIPELINE{{ failureCount === 1 ? '' : 'S' }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 50;
        pointer-events: none;
      }
      .alert-overlay {
        position: absolute;
        inset: 0;
        background: radial-gradient(
          ellipse at center,
          rgba(255, 0, 40, 0.18) 0%,
          rgba(255, 0, 40, 0.32) 60%,
          rgba(120, 0, 20, 0.5) 100%
        );
        animation: redPulse 1s ease-in-out infinite;
        mix-blend-mode: screen;
      }
      .alert-banner {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        padding: 0.9rem 1rem;
        background: linear-gradient(180deg, rgba(120, 0, 20, 0.85), rgba(60, 0, 10, 0.4));
        border-bottom: 2px solid #ff2d4f;
        box-shadow: 0 0 24px #ff2d4f;
        text-align: center;
        font-family: 'Orbitron', 'Rajdhani', sans-serif;
        color: #fff;
        animation: bannerFlicker 0.8s steps(8, end) infinite;
        letter-spacing: 0.2em;
      }
      .row {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 1rem;
      }
      .top {
        font-size: clamp(1.4rem, 4vw, 2.6rem);
        font-weight: 800;
      }
      .sub {
        margin-top: 0.35rem;
        font-size: clamp(0.7rem, 1.2vw, 0.95rem);
        font-weight: 600;
        opacity: 0.9;
        text-shadow: 0 0 6px #ff8aa3;
      }
      .alert-text {
        text-shadow:
          0 0 6px #ff2d4f,
          0 0 16px #ff2d4f,
          0 0 32px #ff2d4f;
      }
      .chev {
        color: #ff2d4f;
        text-shadow: 0 0 10px #ff2d4f;
        animation: bannerFlicker 0.4s steps(4) infinite;
      }
      .count {
        color: #ffcfd6;
      }

      @keyframes redPulse {
        0%, 100% {
          opacity: 0.85;
        }
        50% {
          opacity: 1;
        }
      }
      @keyframes bannerFlicker {
        0%, 100% {
          opacity: 1;
        }
        45% {
          opacity: 1;
        }
        50% {
          opacity: 0.55;
        }
        55% {
          opacity: 1;
        }
      }
    `
  ]
})
export class CriticalAlertComponent {
  @Input() active = false;
  @Input() failureCount = 0;
}
