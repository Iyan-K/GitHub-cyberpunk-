import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsService } from './core/settings.service';
import { AlertStateService } from './core/alert-state.service';
import { SettingsComponent } from './components/settings/settings.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { RetroGridComponent } from './components/retro-grid/retro-grid.component';

type View = 'settings' | 'dashboard';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SettingsComponent, DashboardComponent, RetroGridComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly settings = inject(SettingsService);
  readonly alertState = inject(AlertStateService);

  readonly view = signal<View>(this.settings.isConfigured ? 'dashboard' : 'settings');

  showSettings(): void {
    this.view.set('settings');
  }

  onSettingsSaved(): void {
    this.view.set('dashboard');
  }

  onSettingsCancelled(): void {
    if (this.settings.isConfigured) {
      this.view.set('dashboard');
    }
  }
}
