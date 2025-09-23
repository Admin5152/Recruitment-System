import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import emailjs, { EmailJSResponseStatus } from 'emailjs-com';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

// NOTE: pdfjs and tesseract will be dynamically imported when needed (browser only)

@Component({
  selector: 'app-application-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HttpClientModule],
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
    resume: null as File | null,
  };

  resumeText: string | null = null;
  resumeFileName: string | null = null;
  isExtracting = false;

  constructor(private router: Router, private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  // Handle file upload and extract text
  async onFileChange(event: any) {
    if (!isPlatformBrowser(this.platformId)) {
      this.resumeText = 'Extraction is only available in the browser environment.';
      return;
    }
    const file: File | undefined = event?.target?.files?.[0];
    this.resumeText = null;

    if (!file) {
      this.formData.resume = null;
      this.resumeFileName = null;
      return;
    }

    // Accept larger files. Hard cap at 20MB to avoid extreme memory usage
    const MAX_BYTES = 20 * 1024 * 1024; // 20MB
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    console.log(`[Resume] Selected file: name="${file.name}", size=${sizeMB}MB, type=${file.type}`);
    if (file.size > MAX_BYTES) {
      const msg = `The selected PDF is too large (${sizeMB}MB). Maximum allowed is 20MB.`;
      console.warn('[Resume] ' + msg);
      this.formData.resume = null;
      this.resumeFileName = null;
      this.resumeText = msg;
      return;
    }

    const lower = file.name.toLowerCase();
    if (!(lower.endsWith('.pdf') || file.type === 'application/pdf')) {
      this.formData.resume = null;
      this.resumeFileName = null;
      this.resumeText = 'Only PDF files are supported for text extraction.';
      return;
    }

    this.formData.resume = file;
    this.resumeFileName = file.name;
    this.isExtracting = true;

    try {
      const t0 = performance.now();
      console.log('[Resume] Extraction started (OCR.Space)...');
      this.resumeText = await this.extractTextWithOcrSpace(file);
      const t1 = performance.now();
      console.log(`[Resume] Extraction finished in ${((t1 - t0) / 1000).toFixed(2)}s. Characters extracted: ${this.resumeText?.length ?? 0}`);
    } catch (err) {
      console.error('Resume extraction failed', err);
      this.resumeText = 'Failed to extract text from the uploaded PDF.';
    } finally {
      this.isExtracting = false;
    }
  }

  // Upload the PDF to OCR.Space and parse the result
  private async extractTextWithOcrSpace(file: File): Promise<string> {
    if (!isPlatformBrowser(this.platformId)) return 'Extraction is only available in the browser.';

    // IMPORTANT: Put your OCR.Space API key here or in an environment variable.
    // For example, read from window.ngEnvironment?.ocrSpaceApiKey if you inject it at runtime.
    const apiKey = (window as any)?.ngEnvironment?.ocrSpaceApiKey || '';
    if (!apiKey) {
      console.warn('[Resume] OCR.Space API key is not set. Provide it via window.ngEnvironment.ocrSpaceApiKey.');
    }

    const endpoint = 'https://api.ocr.space/parse/image';
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('apikey', apiKey);
    form.append('language', 'eng');
    form.append('isOverlayRequired', 'false');
    // Set scale/OCREngine if desired. OCREngine=2 is often better.
    form.append('OCREngine', '2');

    console.log('[Resume] Posting to OCR.Space...');
    let res: any;
    try {
      res = await lastValueFrom(
        this.http.post(endpoint, form).pipe(
          timeout(60000)
        )
      );
    } catch (e: any) {
      console.error('[Resume] OCR.Space request failed or timed out', e);
      throw new Error('OCR request failed or timed out');
    }

    if (!res) {
      throw new Error('Empty OCR response');
    }

    // OCR.Space success code is 1
    if (res.OCRExitCode !== 1 && res.IsErroredOnProcessing) {
      const msg = res.ErrorMessage || res.ErrorDetails || 'OCR.Space reported an error.';
      console.warn('[Resume] OCR.Space error:', msg);
      return `OCR failed: ${Array.isArray(msg) ? msg.join('; ') : msg}`;
    }

    const results = res.ParsedResults as Array<any> | undefined;
    if (!results || !results.length) {
      console.warn('[Resume] OCR.Space returned no ParsedResults');
      return 'No text could be extracted from the PDF.';
    }

    const combined = results.map(r => r.ParsedText || '').join('\n').trim();
    return combined || 'No text could be extracted from the PDF.';
  }

  onSubmit() {
    // Step 1: Validate required fields
    if (!this.formData.fullName || !this.formData.email || !this.formData.position) {
      alert(' Please fill in all required fields!');
      return;
    }

    // Step 2: Save to localStorage (for dashboard tracking)
    const applications = JSON.parse(localStorage.getItem('applications') || '[]');

    const newApplication = {
      id: Date.now(),
      fullName: this.formData.fullName,
      email: this.formData.email,
      phone: this.formData.phone,
      position: this.formData.position,
      experience: this.formData.experience,
      coverLetter: this.formData.coverLetter,
      resumeFileName: this.resumeFileName,
      resumeText: this.resumeText || 'No resume text extracted',
      submittedAt: new Date().toISOString()
    };

    applications.push(newApplication);
    localStorage.setItem('applications', JSON.stringify(applications));

    // Step 3: Prepare data for EmailJS
    const templateParams: any = {
      fullName: this.formData.fullName,
      email: this.formData.email,
      phone: this.formData.phone,
      position: this.formData.position,
      experience: this.formData.experience,
      coverLetter: this.formData.coverLetter,
      resume_filename: this.resumeFileName || 'No file name',
      resume_text: this.resumeText || 'No resume text extracted'
    };

    // Step 4: Send email via EmailJS (only text, no attachments)
    emailjs
      .send(
        'service_jg3yiuh', // your service ID
        'template_94yjym3', // your template ID
        templateParams,
        'bNjvm2lanWsXymhbG' // your public key
      )
      .then(
        (response: EmailJSResponseStatus) => {
          alert(' Application submitted and email sent (resume text included)!');
          console.log('SUCCESS!', response.status, response.text);
          this.router.navigate(['/dashboard']);
        },
        (error) => {
          alert(' Application saved, but email failed to send.');
          console.error('FAILED...', error);
          this.router.navigate(['/dashboard']);
        }
      );
  }
}