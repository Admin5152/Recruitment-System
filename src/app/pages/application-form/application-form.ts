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

  // Weighted keywords (can include optional/nice-to-haves too)
  private readonly SKILL_MAP: Record<string, Array<{ kw: string; weight: number }>> = {
    'Frontend Developer': [
      { kw: 'html', weight: 1 },
      { kw: 'css', weight: 1 },
      { kw: 'javascript', weight: 1 },
      { kw: 'typescript', weight: 1 },
      { kw: 'angular', weight: 1 },
      { kw: 'react', weight: 1 },
      { kw: 'vue', weight: 1 }
    ],
    'Backend Developer': [
      { kw: 'node.js', weight: 1 },
      { kw: 'express.js', weight: 1 },
      { kw: 'python', weight: 1 },
      { kw: 'java', weight: 1 },
      { kw: 'spring boot', weight: 1 },
      { kw: 'ruby', weight: 1 }
    ],
    'Full Stack Developer': [
      { kw: 'html', weight: 1 },
      { kw: 'css', weight: 1 },
      { kw: 'javascript', weight: 1 },
      { kw: 'typescript', weight: 1 },
      { kw: 'angular', weight: 1 },
      { kw: 'react', weight: 1 },
      { kw: 'vue', weight: 1 }
    ],
    'UI/UX Designer': [
      { kw: 'ui design', weight: 1 },
      { kw: 'ux design', weight: 1 },
      { kw: 'wireframing', weight: 1 },
      { kw: 'prototyping', weight: 1 },
      { kw: 'figma', weight: 1 }
    ],
    'Project Manager': [
      { kw: 'project management', weight: 1 },
      { kw: 'agile', weight: 1 },
      { kw: 'scrum', weight: 1 },
      { kw: 'leadership', weight: 1 },
      { kw: 'communication', weight: 1 }
    ],
    'Data Analyst': [
      { kw: 'sql', weight: 1 },
      { kw: 'excel', weight: 1 },
      { kw: 'python', weight: 1 },
      { kw: 'data analysis', weight: 1 },
      { kw: 'statistics', weight: 1 }
    ]
  };

  // Required skills derived from home page (exact lists)."All" must be individually matched; "Groups" mean at least one in a group must be present.
  private readonly REQUIRED_ALL: Record<string, string[]> = {
    'Frontend Developer': ['html', 'css', 'javascript', 'typescript'],
    'Backend Developer': [],
    'Full Stack Developer': ['html', 'css', 'javascript', 'typescript'],
    'UI/UX Designer': ['ui design', 'ux design', 'wireframing', 'prototyping', 'figma'],
    'Project Manager': ['project management', 'agile', 'scrum', 'leadership', 'communication'],
    'Data Analyst': ['sql', 'excel', 'python', 'data analysis', 'statistics']
  };

  private readonly REQUIRED_GROUPS: Record<string, string[][]> = {
    // At least one framework: Angular OR React OR Vue
    'Frontend Developer': [[ 'angular', 'react', 'vue' ]],
    // One of these backend stacks
    'Backend Developer': [[ 'node.js', 'express.js', 'python', 'java', 'spring boot', 'ruby' ]],
    // Frontend frameworks for full stack (as per home page list)
    'Full Stack Developer': [[ 'angular', 'react', 'vue' ]],
    'UI/UX Designer': [],
    'Project Manager': [],
    'Data Analyst': []
  };

  // New: Job keywords with required/optional, used for scoring as requested
  private readonly jobKeywords = {
    frontend: {
      required: ['HTML', 'CSS', 'JavaScript', 'Angular', 'React'],
      optional: ['TypeScript', 'Tailwind', 'Next.js', 'Vue']
    },
    backend: {
      required: ['Node.js', 'Express', 'Django', 'SQL', 'API'],
      optional: ['MongoDB', 'PostgreSQL', 'Redis', 'Microservices', 'Docker']
    },
    projectManager: {
      required: ['Agile', 'Scrum', 'Leadership', 'Project Planning', 'Budgeting'],
      optional: ['Jira', 'Risk Management', 'Stakeholder Communication']
    },
    dataAnalyst: {
      required: ['SQL', 'Excel', 'Python', 'Data Visualization', 'Statistics'],
      optional: ['Power BI', 'Tableau', 'Machine Learning', 'Pandas']
    },
    uiux: {
      required: ['Wireframing', 'Prototyping', 'User Research', 'Figma', 'Adobe XD'],
      optional: ['Sketch', 'InVision', 'Usability Testing', 'Design Thinking']
    }
  } as const;

  private positionToKey(pos: string): keyof typeof this.jobKeywords | 'fullstack' | null {
    const p = (pos || '').toLowerCase();
    if (p.includes('front')) return 'frontend';
    if (p.includes('back')) return 'backend';
    if (p.includes('full')) return 'fullstack';
    if (p.includes('project')) return 'projectManager';
    if (p.includes('analyst')) return 'dataAnalyst';
    if (p.includes('ui') || p.includes('ux') || p.includes('designer')) return 'uiux';
    return null;
  }

  // Exact scoring function as requested
  private scoreResume(text: string, position: keyof typeof this.jobKeywords) {
    const { required, optional } = this.jobKeywords[position];
    let score = 0;
    const matchedRequired: string[] = [];
    const matchedOptional: string[] = [];

    const resumeText = (text || '').toLowerCase();

    required.forEach(skill => {
      if (resumeText.includes(skill.toLowerCase())) {
        score += 10;
        matchedRequired.push(skill);
      }
    });

    optional.forEach(skill => {
      if (resumeText.includes(skill.toLowerCase())) {
        score += 5;
        matchedOptional.push(skill);
      }
    });

    const maxScore = required.length * 10 + optional.length * 5;
    const percent = Math.round((score / (maxScore || 1)) * 100);
    return { score, maxScore, percent, matchedRequired, matchedOptional };
  }

  // Wrapper to support Full Stack (combine frontend + backend)
  private scoreByJobKeywords(text: string, posLabel: string) {
    const key = this.positionToKey(posLabel);
    if (!key) {
      return { score: 0, maxScore: 1, percent: 0, matchedRequired: [] as string[], matchedOptional: [] as string[] };
    }
    if (key === 'fullstack') {
      const fe = this.scoreResume(text, 'frontend');
      const be = this.scoreResume(text, 'backend');
      const score = fe.score + be.score;
      const maxScore = fe.maxScore + be.maxScore;
      const percent = Math.round((score / (maxScore || 1)) * 100);
      const matchedRequired = [...fe.matchedRequired, ...be.matchedRequired];
      const matchedOptional = [...fe.matchedOptional, ...be.matchedOptional];
      return { score, maxScore, percent, matchedRequired, matchedOptional };
    }
    return this.scoreResume(text, key);
  }

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

  // Optional: call your backend AI scorer. Backend must keep the OpenAI key server-side.
  // Expected response shape: { score: number (0-100), matchedKeywords: string[], rationale?: string }
  private async scoreWithAIBackend(resumeText: string, position: string): Promise<{ score: number; matchedKeywords: string[]; rationale?: string } | null> {
    try {
      const body = { position, resumeText };
      const res: any = await lastValueFrom(
        this.http.post('/api/score', body).pipe(
          timeout(15000)
        )
      );
      if (!res || typeof res.score !== 'number') return null;
      const matched = Array.isArray(res.matchedKeywords) ? res.matchedKeywords : [];
      return { score: res.score, matchedKeywords: matched, rationale: res.rationale };
    } catch (e) {
      console.warn('[AI] Optional AI scoring failed or is not configured. Falling back to keyword score.', e);
      return null;
    }
  }

  async onSubmit() {
    // Step 1: Validate required fields
    if (!this.formData.fullName || !this.formData.email || !this.formData.position) {
      alert(' Please fill in all required fields!');
      return;
    }

    // Step 2: Save to localStorage (for dashboard tracking)
    const applications = JSON.parse(localStorage.getItem('applications') || '[]');

    // Primary scoring using jobKeywords required/optional lists
    const jobScore = this.scoreByJobKeywords(this.resumeText || '', this.formData.position);

    // Try optional AI scoring (0-100 scale). If available, merge results by taking the higher normalized score
    let finalScore = jobScore.score;
    let finalMax = jobScore.maxScore;
    let finalPercent = jobScore.percent;
    let finalMatched = new Set<string>([...jobScore.matchedRequired, ...jobScore.matchedOptional].map(s => s.toLowerCase()));
    let aiScore: number | undefined;
    let aiRationale: string | undefined;

    const ai = await this.scoreWithAIBackend(this.resumeText || '', this.formData.position);
    if (ai && typeof ai.score === 'number') {
      aiScore = ai.score; // raw 0-100
      aiRationale = ai.rationale;
      const normalized = Math.round((ai.score / 100) * (finalMax || 1));
      if (normalized > finalScore) {
        finalScore = normalized;
        finalPercent = ai.score;
      }
      for (const k of ai.matchedKeywords || []) finalMatched.add(String(k).toLowerCase());
    }

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
      score: finalScore,
      maxScore: finalMax,
      scorePercent: finalPercent,
      fitLevel: finalPercent >= 75 ? 'Strong' : finalPercent >= 50 ? 'Good' : 'Weak',
      matchedKeywords: Array.from(finalMatched),
      // Store detailed matched sets (useful for UI or auditing)
      matchedRequired: jobScore.matchedRequired,
      matchedOptional: jobScore.matchedOptional,
      aiScore,            // optional raw AI score (0-100)
      aiRationale,        // optional explanation from AI
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