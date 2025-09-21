import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import emailjs, { EmailJSResponseStatus } from 'emailjs-com';

@Component({
  selector: 'app-application-form',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './application-form.html',
  styleUrls: ['./application-form.css']
})
export class ApplicationForm {
  formData = {
    fullName: '',
    email: '',
    phone: '',
    position: '',
    experience: '',
    coverLetter: '',
    resume: null as File | null
  };

  resumeBase64: string | null = null;

  constructor(private router: Router) {}

  // Handle file upload (save file + convert to Base64 for EmailJS)
  onFileChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.formData.resume = file;

      const reader = new FileReader();
      reader.onload = () => {
        this.resumeBase64 = (reader.result as string).split(',')[1];
      };
      reader.readAsDataURL(file);
    }
  }

  onSubmit() {
    // ✅ Step 1: Validate required fields
    if (!this.formData.fullName || !this.formData.email || !this.formData.position) {
      alert('❌ Please fill in all required fields!');
      return;
    }

    // ✅ Step 2: Save to localStorage (for dashboard tracking)
    const applications = JSON.parse(localStorage.getItem('applications') || '[]');
    const newApplication = {
      id: Date.now(),
      ...this.formData,
      resumeFileName: this.formData.resume?.name || null,
      submittedAt: new Date().toISOString()
    };
    applications.push(newApplication);
    localStorage.setItem('applications', JSON.stringify(applications));

    // ✅ Step 3: Prepare data for EmailJS
    const templateParams: any = {
      fullName: this.formData.fullName,
      email: this.formData.email,
      phone: this.formData.phone,
      position: this.formData.position,
      experience: this.formData.experience,
      coverLetter: this.formData.coverLetter,
      resume_filename: this.formData.resume?.name || 'No file uploaded'

    };

    if (this.resumeBase64) {
      templateParams.resume = {
        content: this.resumeBase64,
        filename: this.formData.resume?.name || 'resume.pdf',
        type: this.formData.resume?.type || 'application/pdf'
      };
    }

    // ✅ Step 4: Send email via EmailJS
    emailjs.send(
      'service_jg3yiuh',
      'template_94yjym3',
      templateParams,
      'bNjvm2lanWsXymhbG'
    )
    .then((response: EmailJSResponseStatus) => {
      alert('✅ Application submitted and email sent!');
      console.log('SUCCESS!', response.status, response.text);
      this.router.navigate(['/dashboard']);
    }, (error) => {
      alert('⚠️ Application saved, but email failed to send.');
      console.error('FAILED...', error);
      this.router.navigate(['/dashboard']);
    });
  }
}
