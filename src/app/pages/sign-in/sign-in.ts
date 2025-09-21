import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../service/auth.service';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './sign-in.html',
  styleUrls: ['./sign-in.css']
})
export class SignIn {
  formData = {
    email: '',
    password: ''
  };

  constructor(private router: Router, private authService: AuthService) {}

  async onSubmit() {
    try {
      // Authenticate with Firebase
      await this.authService.signIn(this.formData.email, this.formData.password);
      alert('✅ Sign In successful!');
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      // Fallback to localStorage login check if Firebase fails (optional)
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user.email === this.formData.email && user.password === this.formData.password) {
          alert('✅ Signed in (local)');
          this.router.navigate(['/dashboard']);
          return;
        }
      }
      const message = err?.message || '❌ Invalid email or password!';
      alert(message);
    }
  }
}
