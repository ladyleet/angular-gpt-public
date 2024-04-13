import { Component, computed, signal } from '@angular/core';
import { SERVER_HOST, SERVER_PORT } from '../environment/environment';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  standalone: true,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatCardModule,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  thinking = signal(false);

  question = signal('');

  responseData = signal<any>({ message: 'waiting for a question' });

  response = computed(() => {
    return this.responseData().message;
  });

  async onSubmit(e: Event) {
    e.preventDefault();

    this.thinking.set(true);

    const question = this.question();

    try {
      const response = await fetch(
        `${SERVER_HOST}:${SERVER_PORT}/api/chat?q=${question}`
      );

      const data = await response.json();
      console.log(data);
      this.responseData.set(data);
    } finally {
      this.thinking.set(false);
    }
  }
}
