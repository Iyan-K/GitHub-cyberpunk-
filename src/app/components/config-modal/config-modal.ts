import { Component, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GithubConfig } from '../../models/github.models';
import { GithubService } from '../../services/github.service';

@Component({
  selector: 'app-config-modal',
  standalone: true,
  imports: [FormsModule],
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
      this.configSaved.emit({ token: this.token, owner: this.owner, repo: this.repo });
    }
  }

  cancel() {
    this.cancelled.emit();
  }
}
