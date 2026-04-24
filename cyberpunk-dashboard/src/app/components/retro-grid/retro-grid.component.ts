import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild
} from '@angular/core';

/**
 * Animated retrowave perspective grid background, drawn on a 2D canvas.
 * Inspired by 80s synth-wave album art: horizon glow + scrolling grid + faux sun.
 */
@Component({
  selector: 'app-retro-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas class="retro-grid-canvas"></canvas>`,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        overflow: hidden;
      }
      .retro-grid-canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
    `
  ]
})
export class RetroGridComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  /** When true, recolor the grid red for "critical alert" mode. */
  @Input() alert = false;

  private rafId = 0;
  private resizeObserver?: ResizeObserver;
  private offset = 0;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.tick();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
  }

  private resize(): void {
    const canvas = this.canvasRef.nativeElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private tick = (): void => {
    this.offset = (this.offset + 0.6) % 60;
    this.draw();
    this.rafId = requestAnimationFrame(this.tick);
  };

  private draw(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Background gradient: deep purple/black at top → warm magenta near horizon.
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (this.alert) {
      bgGrad.addColorStop(0, '#1a0006');
      bgGrad.addColorStop(0.55, '#330011');
      bgGrad.addColorStop(0.65, '#660022');
      bgGrad.addColorStop(1, '#0a0000');
    } else {
      bgGrad.addColorStop(0, '#0a0014');
      bgGrad.addColorStop(0.55, '#1a0030');
      bgGrad.addColorStop(0.65, '#3a0a4a');
      bgGrad.addColorStop(1, '#05000a');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const horizon = h * 0.55;

    // Sun / circle behind the grid.
    const sunRadius = Math.min(w, h) * 0.18;
    const sunCx = w / 2;
    const sunCy = horizon - sunRadius * 0.2;
    const sunGrad = ctx.createLinearGradient(sunCx, sunCy - sunRadius, sunCx, sunCy + sunRadius);
    if (this.alert) {
      sunGrad.addColorStop(0, '#ff2244');
      sunGrad.addColorStop(0.5, '#ff5566');
      sunGrad.addColorStop(1, '#aa0022');
    } else {
      sunGrad.addColorStop(0, '#ff4fb6');
      sunGrad.addColorStop(0.5, '#ff8ad8');
      sunGrad.addColorStop(1, '#ffd66e');
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunCx, sunCy, sunRadius, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.shadowColor = this.alert ? '#ff003c' : '#ff2bd6';
    ctx.shadowBlur = 60;
    ctx.fill();
    // Sun "stripes" — horizontal bands across lower half of the sun.
    ctx.globalCompositeOperation = 'destination-out';
    const bandStep = sunRadius / 6;
    for (let i = 0; i < 6; i++) {
      const y = sunCy + i * bandStep + bandStep * 0.4;
      const bandHeight = bandStep * (0.15 + i * 0.08);
      ctx.fillRect(sunCx - sunRadius, y, sunRadius * 2, bandHeight);
    }
    ctx.restore();

    // Horizon glow line.
    const glowGrad = ctx.createLinearGradient(0, horizon - 4, 0, horizon + 4);
    const glow = this.alert ? 'rgba(255, 40, 80,' : 'rgba(255, 60, 200,';
    glowGrad.addColorStop(0, `${glow} 0)`);
    glowGrad.addColorStop(0.5, `${glow} 0.9)`);
    glowGrad.addColorStop(1, `${glow} 0)`);
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, horizon - 4, w, 8);

    // Perspective grid below horizon.
    const gridColor = this.alert ? 'rgba(255, 50, 90, 0.85)' : 'rgba(0, 240, 255, 0.85)';
    const gridSecondary = this.alert ? 'rgba(255, 100, 130, 0.35)' : 'rgba(255, 80, 220, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = gridColor;
    ctx.shadowColor = gridColor;
    ctx.shadowBlur = 8;

    // Horizontal scrolling lines.
    const horizonRows = 24;
    for (let i = 0; i < horizonRows; i++) {
      const t = (i + this.offset / 60) / horizonRows;
      // Non-linear distribution to simulate perspective.
      const y = horizon + Math.pow(t, 2) * (h - horizon);
      if (y > h) {
        continue;
      }
      ctx.strokeStyle = i % 4 === 0 ? gridColor : gridSecondary;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Vertical lines converging at the vanishing point.
    const vpx = w / 2;
    const vpy = horizon;
    const verticalLines = 28;
    ctx.strokeStyle = gridColor;
    for (let i = -verticalLines; i <= verticalLines; i++) {
      const xAtBottom = vpx + (i / verticalLines) * (w * 1.5);
      ctx.beginPath();
      ctx.moveTo(vpx, vpy);
      ctx.lineTo(xAtBottom, h);
      ctx.stroke();
    }

    // Soft top vignette to keep content readable.
    ctx.shadowBlur = 0;
    const topShade = ctx.createLinearGradient(0, 0, 0, horizon);
    topShade.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    topShade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topShade;
    ctx.fillRect(0, 0, w, horizon);
  }
}
