import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

interface JobDef {
  id: number;
  title: string;
  typeKey: 'frontend' | 'backend' | 'projectManager' | 'dataAnalyst' | 'uiux' | 'custom';
  description: string;
  required: string[];
  optional: string[];
  createdAt: string;
  pinned?: boolean;
}

@Component({
  selector: 'app-hr',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './hr.html',
  styleUrls: ['./hr.css']
})
export class HRPage {
[x: string]: any;
  // Job templates (same vocabulary used for scoring)
  readonly jobKeywords = {
    frontend: {
      label: 'Frontend',
      required: ['HTML', 'CSS', 'JavaScript', 'Angular', 'React'],
      optional: ['TypeScript', 'Tailwind', 'Next.js', 'Vue']
    },
    backend: {
      label: 'Backend',
      required: ['Node.js', 'Express', 'Django', 'SQL', 'API'],
      optional: ['MongoDB', 'PostgreSQL', 'Redis', 'Microservices', 'Docker']
    },
    projectManager: {
      label: 'Project Manager',
      required: ['Agile', 'Scrum', 'Leadership', 'Project Planning', 'Budgeting'],
      optional: ['Jira', 'Risk Management', 'Stakeholder Communication']
    },
    dataAnalyst: {
      label: 'Data Analyst',
      required: ['SQL', 'Excel', 'Python', 'Data Visualization', 'Statistics'],
      optional: ['Power BI', 'Tableau', 'Machine Learning', 'Pandas']
    },
    uiux: {
      label: 'UI/UX',
      required: ['Wireframing', 'Prototyping', 'User Research', 'Figma', 'Adobe XD'],
      optional: ['Sketch', 'InVision', 'Usability Testing', 'Design Thinking']
    }
  } as const;

  // New job form
  newJob: {
    title: string;
    typeKey: JobDef['typeKey'];
    description: string;
    requiredCSV: string;
    optionalCSV: string;
  } = {
    title: '',
    typeKey: 'frontend',
    description: '',
    requiredCSV: '',
    optionalCSV: ''
  };

  jobs: JobDef[] = [];
  applications: any[] = [];

  // HR filters
  appFilterPosition = '';
  appFilterStatus = '';
  appSortBy: 'score' | 'date' = 'score';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadJobs();
    this.loadApplications();
    // Prefill required/optional from selected template
    this.onTemplateChange();
  }

  private loadJobs() {
    try {
      this.jobs = JSON.parse(localStorage.getItem('jobs') || '[]');
    } catch { this.jobs = []; }
  }

  private saveJobs() {
    try { localStorage.setItem('jobs', JSON.stringify(this.jobs)); } catch {}
  }

  private loadApplications() {
    try {
      this.applications = JSON.parse(localStorage.getItem('applications') || '[]');
      // Initialize local datetime input binding if interview already scheduled
      for (const app of this.applications) {
        if (app.interviewDate) {
          try {
            const d = new Date(app.interviewDate);
            if (!isNaN(d.getTime())) {
              // Format as yyyy-MM-ddTHH:mm for input[type=datetime-local]
              app.interviewDateLocal = new Date(d.getTime() - d.getTimezoneOffset()*60000)
                .toISOString().slice(0,16);
            }
          } catch {}
        }
        // Ensure potential arrays exist
        if (!Array.isArray(app.potentialJobIds)) app.potentialJobIds = [];
        if (!Array.isArray(app.potentialJobTitles)) app.potentialJobTitles = [];
      }
    } catch { this.applications = []; }
  }

  private saveApplications() {
    try { localStorage.setItem('applications', JSON.stringify(this.applications)); } catch {}
  }

  onTemplateChange() {
    const key = this.newJob.typeKey as keyof typeof this.jobKeywords;
    const tpl = (this.jobKeywords as any)[key];
    if (tpl) {
      this.newJob.requiredCSV = tpl.required.join(', ');
      this.newJob.optionalCSV = tpl.optional.join(', ');
      if (!this.newJob.title) this.newJob.title = tpl.label + ' Role';
    }
  }

  addJob() {
    const required = this.newJob.requiredCSV.split(',').map(s => s.trim()).filter(Boolean);
    const optional = this.newJob.optionalCSV.split(',').map(s => s.trim()).filter(Boolean);
    const job: JobDef = {
      id: Date.now(),
      title: this.newJob.title || 'Untitled Job',
      typeKey: this.newJob.typeKey,
      description: this.newJob.description || '',
      required,
      optional,
      createdAt: new Date().toISOString(),
      pinned: false
    };
    this.jobs.unshift(job);
    this.saveJobs();
    // Tag potential fits among existing applications
    this.tagPotentialFitsForJob(job);
    this.saveApplications();
    // Reset
    this.newJob = { title: '', typeKey: 'frontend', description: '', requiredCSV: '', optionalCSV: '' };
    this.onTemplateChange();
  }

  deleteJob(id: number) {
    if (!confirm('Delete this job?')) return;
    this.jobs = this.jobs.filter(j => j.id !== id);
    this.saveJobs();
    // Also remove job id from potential markers
    for (const app of this.applications) {
      if (Array.isArray(app.potentialJobIds)) {
        const idx = app.potentialJobIds.indexOf(id);
        if (idx >= 0) {
          app.potentialJobIds.splice(idx, 1);
          if (Array.isArray(app.potentialJobTitles)) {
            app.potentialJobTitles = app.potentialJobTitles.filter((t: string) => t !== app.title);
          }
        }
      }
    }
    this.saveApplications();
  }

  togglePin(job: JobDef) {
    job.pinned = !job.pinned;
    this.saveJobs();
  }

  // Applications view helpers
  get filteredApplications(): any[] {
    let list = [...this.applications];
    if (this.appFilterPosition) {
      const term = this.appFilterPosition.toLowerCase();
      list = list.filter(a => String(a.position || '').toLowerCase().includes(term));
    }
    if (this.appFilterStatus) {
      const s = this.appFilterStatus.toLowerCase();
      list = list.filter(a => String(a.status || 'pending').toLowerCase() === s);
    }
    if (this.appSortBy === 'score') {
      list.sort((a, b) => (b.scorePercent || 0) - (a.scorePercent || 0));
    } else {
      list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    }
    return list;
  }

  setStatus(app: any, status: 'reviewed' | 'accepted' | 'rejected') {
    app.status = status;
    if (status !== 'accepted') {
      // Clear interview date if status changes away from accepted
      delete app.interviewDate;
      delete app.interviewDateLocal;
    }
    this.saveApplications();
  }

  scheduleInterview(app: any) {
    const raw = String(app.interviewDateLocal || '').trim();
    if (!raw) { alert('Please select a date and time first.'); return; }
    // raw is in local time as yyyy-MM-ddTHH:mm; convert to ISO UTC, preserving local wall time
    const d = new Date(raw);
    if (isNaN(d.getTime())) { alert('Invalid date/time.'); return; }
    app.interviewDate = d.toISOString();
    this.saveApplications();
  }

  clearInterview(app: any) {
    delete app.interviewDate;
    delete app.interviewDateLocal;
    this.saveApplications();
  }

  // --- Potential fit tagging ---
  private appKeywords(app: any): Set<string> {
    const set = new Set<string>();
    const push = (arr?: any[]) => {
      if (Array.isArray(arr)) arr.forEach(v => { if (v) set.add(String(v).toLowerCase()); });
    };
    push(app.matchedRequired);
    push(app.matchedOptional);
    push(app.matchedKeywords);
    // fallback: crude tokenize resumeText
    const text: string = String(app.resumeText || '');
    if (text) {
      text.toLowerCase().split(/[^a-z0-9+#.]+/g).forEach(tok => { if (tok && tok.length >= 2) set.add(tok); });
    }
    // also include position words
    if (app.position) {
      String(app.position).toLowerCase().split(/\s+/g).forEach(tok => set.add(tok));
    }
    return set;
  }

  private isPotentialFit(job: JobDef, app: any): { potential: boolean; requiredHits: number; optionalHits: number } {
    const kws = this.appKeywords(app);
    const req = job.required || [];
    const opt = job.optional || [];
    let requiredHits = 0;
    let optionalHits = 0;
    for (const r of req) if (kws.has(String(r).toLowerCase())) requiredHits++;
    for (const o of opt) if (kws.has(String(o).toLowerCase())) optionalHits++;
    // potential if at least half the required matched or at least 2 required
    const potential = requiredHits >= Math.max(2, Math.ceil(Math.max(1, req.length) / 2));
    return { potential, requiredHits, optionalHits };
  }

  private tagPotentialFitsForJob(job: JobDef) {
    for (const app of this.applications) {
      const { potential } = this.isPotentialFit(job, app);
      if (potential) {
        if (!Array.isArray(app.potentialJobIds)) app.potentialJobIds = [];
        if (!Array.isArray(app.potentialJobTitles)) app.potentialJobTitles = [];
        if (!app.potentialJobIds.includes(job.id)) app.potentialJobIds.push(job.id);
        if (!app.potentialJobTitles.includes(job.title)) app.potentialJobTitles.push(job.title);
      }
    }
  }

  reEvaluatePotentials() {
    // Reset
    for (const app of this.applications) {
      app.potentialJobIds = [];
      app.potentialJobTitles = [];
    }
    for (const job of this.jobs) this.tagPotentialFitsForJob(job);
    this.saveApplications();
  }
}
