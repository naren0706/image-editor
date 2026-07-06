import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard';
import { BorderEditorComponent } from './border-editor/border-editor';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'border-editor', component: BorderEditorComponent },
  { path: '**', redirectTo: 'dashboard' }
];
