import { Component, signal, effect } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {
  isLightTheme = signal<boolean>(false);

  constructor() {
    // Check local storage or document class list to initialize theme state
    const isLight = document.documentElement.classList.contains('light-theme');
    this.isLightTheme.set(isLight);

    // Sync theme shifts with HTML node element
    effect(() => {
      if (this.isLightTheme()) {
        document.documentElement.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
      } else {
        document.documentElement.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
      }
    });
  }

  toggleTheme(): void {
    this.isLightTheme.update(val => !val);
  }
}
