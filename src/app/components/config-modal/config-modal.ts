import { Component, Output, EventEmitter, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GithubConfig } from '../../models/github.models';

@Component({
  selector: 'app-config-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './config-modal.html',
  styleUrl: './config-modal.scss'
})
export class ConfigModalComponent {
  @Output() configSaved = new EventEmitter<GithubConfig>();
  @Output() cancelled = new EventEmitter<void>();

  token = '';
  owner = '';
  repo = '';

  save() {
    if (this.owner && this.repo) {
      this.configSaved.emit({ token: this.token, owner: this.owner, repo: this.repo });
    }
  }

  cancel() {
    this.cancelled.emit();
  }
}
