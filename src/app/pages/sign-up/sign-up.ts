import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../service/auth.service';

@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './sign-up.html',
  styleUrls: ['./sign-up.css']
})
export class SignUp {
  formData = {
    name: '',
    email: '',
    password: ''
  };

  constructor(private router: Router, private authService: AuthService) {}

  async onSubmit() {
    try {
      // Create account in Firebase Auth
      await this.authService.signUp(this.formData.email, this.formData.password);

      // Preserve existing behavior for dashboard profile display
      localStorage.setItem('user', JSON.stringify({ name: this.formData.name, email: this.formData.email, password: this.formData.password }));

      alert('✅ Sign Up successful!');
      this.router.navigate(['/sign-in']);
    } catch (err: any) {
      const message = err?.message || 'Sign up failed';
      alert('❌ ' + message);
    }
  }
}
