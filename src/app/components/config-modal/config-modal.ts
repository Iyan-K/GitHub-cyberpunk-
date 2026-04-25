import { Component, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GithubConfig } from '../../models/github.models';
import { GithubService } from '../../services/github.service';

@Component({
  selector: 'app-config-modal',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './config-modal.html',
  styleUrl: './config-modal.scss'
})
export class ConfigModalComponent implements OnInit {
  @Output() configSaved = new EventEmitter<GithubConfig>();
  @Output() cancelled = new EventEmitter<void>();

  private githubService = inject(GithubService);

  token = '';
  owner = '';
  repo = '';
  validating = false;
  validationError = '';

  ngOnInit() {
    const saved = this.githubService.getConfig();
    if (saved) {
      this.token = saved.token;
      this.owner = saved.owner;
      this.repo = saved.repo;
    }
  }

  save() {
    if (this.owner && this.repo) {
      this.validating = true;
      this.validationError = '';
      const config: GithubConfig = { token: this.token, owner: this.owner, repo: this.repo };
      this.githubService.setConfig(config);
      this.githubService.validateConnection(this.owner, this.repo).subscribe(result => {
        this.validating = false;
        if (result.valid) {
          this.configSaved.emit(config);
        } else {
          this.validationError = result.error || 'Failed to connect to repository.';
        }
      });
    }
  }

  cancel() {
    this.cancelled.emit();
  }
}
