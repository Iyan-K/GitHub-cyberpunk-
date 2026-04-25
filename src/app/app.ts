import { Component } from '@angular/core';
import { DashboardComponent } from './components/dashboard/dashboard';

@Component({
  selector: 'app-root',
  imports: [DashboardComponent],
  template: '<app-dashboard></app-dashboard>',
  styles: []
})
export class App {}
