import { Component, OnInit, OnDestroy, ElementRef, ViewChild, Input, OnChanges } from '@angular/core';
import p5 from 'p5';

@Component({
  selector: 'app-p5-canvas',
  standalone: true,
  template: '<div #canvasContainer class="canvas-container"></div>',
  styles: [`
    .canvas-container {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 0;
    }
    :host ::ng-deep canvas {
      display: block;
    }
  `]
})
export class P5CanvasComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;
  @Input() criticalAlert = false;

  private p5Instance: p5 | null = null;

  ngOnInit() {
    this.createSketch();
  }

  ngOnChanges() {
    // Sketch reads criticalAlert via closure - it will pick up changes automatically
  }

  ngOnDestroy() {
    this.p5Instance?.remove();
  }

  private createSketch() {
    const self = this;
    const sketch = (p: p5) => {
      let scanlineY = 0;
      let particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; color: string; alpha: number }> = [];
      let gridOffset = 0;

      p.setup = () => {
        const cnv = p.createCanvas(p.windowWidth, p.windowHeight);
        cnv.parent(self.canvasContainer.nativeElement);
        p.noFill();
        for (let i = 0; i < 60; i++) {
          particles.push({
            x: p.random(p.width),
            y: p.random(p.height),
            vx: p.random(-0.4, 0.4),
            vy: p.random(-0.6, -0.1),
            size: p.random(1, 3),
            color: p.random() > 0.5 ? '#ff2d78' : '#00f5ff',
            alpha: p.random(80, 200)
          });
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };

      p.draw = () => {
        p.clear();
        const isCritical = self.criticalAlert;

        drawGrid(p, isCritical);
        drawParticles(p, particles, isCritical);
        drawScanlines(p, scanlineY);
        scanlineY = (scanlineY + 1.5) % p.height;
      };

      function drawGrid(p: p5, critical: boolean) {
        const gridSize = 60;
        const horizon = p.height * 0.6;
        gridOffset = (gridOffset + 0.3) % gridSize;

        p.push();
        for (let y = horizon; y < p.height + gridSize; y += gridSize) {
          const t = (y - horizon) / (p.height - horizon);
          const alpha = t * 60;
          if (critical) {
            p.stroke(255, 0, 0, alpha);
          } else {
            p.stroke(0, 245, 255, alpha);
          }
          p.strokeWeight(0.5);
          p.line(0, y, p.width, y);
        }
        const vLines = 12;
        for (let i = 0; i <= vLines; i++) {
          const xRatio = i / vLines;
          const xBottom = xRatio * p.width;
          const xTop = p.width / 2 + (xBottom - p.width / 2) * 0.05;
          const alpha = 40;
          if (critical) {
            p.stroke(255, 30, 30, alpha);
          } else {
            p.stroke(255, 45, 120, alpha);
          }
          p.strokeWeight(0.5);
          p.line(xTop, horizon, xBottom, p.height);
        }
        p.pop();
      }

      function drawParticles(p: p5, parts: typeof particles, critical: boolean) {
        parts.forEach(pt => {
          pt.x += pt.vx;
          pt.y += pt.vy;
          if (pt.y < -5) { pt.y = p.height + 5; pt.x = p.random(p.width); }
          if (pt.x < -5) pt.x = p.width + 5;
          if (pt.x > p.width + 5) pt.x = -5;

          p.push();
          const col = critical ? '#ff3030' : pt.color;
          const c = p.color(col);
          (c as any).setAlpha(pt.alpha);
          p.fill(c);
          p.noStroke();
          p.ellipse(pt.x, pt.y, pt.size, pt.size);
          p.pop();
        });
      }

      function drawScanlines(p: p5, sy: number) {
        p.push();
        p.strokeWeight(1);
        p.stroke(0, 0, 0, 18);
        for (let y = 0; y < p.height; y += 4) {
          p.line(0, y, p.width, y);
        }
        p.stroke(255, 255, 255, 12);
        p.strokeWeight(2);
        p.line(0, sy, p.width, sy);
        p.pop();
      }
    };

    this.p5Instance = new p5(sketch);
  }
}
