import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SquadService } from '../../services/squad.service';
import { SoundMode } from '../../models/github.models';

@Component({
  selector: 'app-squad-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './squad-modal.html',
  styleUrl: './squad-modal.scss'
})
export class SquadModalComponent {
  @Output() closed = new EventEmitter<void>();

  private squad = inject(SquadService);

  audioEnabled = this.squad.audioEnabled;
  soundMode = this.squad.soundMode;
  squadMembers = this.squad.squadMembers;

  newMember = signal('');
  addError = signal('');

  modes: { id: SoundMode; label: string; subtitle: string; vibe: string }[] = [
    { id: 'solo',  label: 'SOLO OPERATOR', subtitle: 'sound_trigger = (author == me)',                  vibe: 'Only care if I broke the build.' },
    { id: 'squad', label: 'SQUAD ONLY',    subtitle: 'sound_trigger = (squad_list.includes(author))',   vibe: 'Only trigger for my immediate team.' },
    { id: 'chaos', label: 'CHAOS MODE',    subtitle: 'sound_trigger = (any_failure)',                   vibe: 'The alarm sounds for everyone. Total mayhem.' },
  ];

  close() {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  selectMode(mode: SoundMode) {
    this.squad.setSoundMode(mode);
  }

  toggleAudio() {
    this.squad.setAudioEnabled(!this.audioEnabled());
  }

  addMember() {
    const value = this.newMember().trim();
    if (!value) return;
    if (!this.squad.addSquadMember(value)) {
      this.addError.set('INVALID OR DUPLICATE HANDLE');
      return;
    }
    this.addError.set('');
    this.newMember.set('');
  }

  onMemberInputKey(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addMember();
    }
  }

  removeMember(login: string) {
    this.squad.removeSquadMember(login);
  }
}
