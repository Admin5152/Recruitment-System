import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit {
  user: any = null;
  applications: any[] = [];
  filterPosition: string = '';
  sortBy: 'date' | 'score' = 'score';

  constructor(private router: Router, @Inject(PLATFORM_ID) private platformId: Object, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) {
      // Running on the server (SSR) – skip localStorage access
      return;
    }
    // Get user data
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        this.user = JSON.parse(storedUser);
      }
    } catch (e) {
      console.warn('[Dashboard] Failed to read user from localStorage', e);
    }

    // Get applications
    try {
      const storedApplications = localStorage.getItem('applications');
      if (storedApplications) {
        this.applications = JSON.parse(storedApplications);
      }
    } catch (e) {
      console.warn('[Dashboard] Failed to read applications from localStorage', e);
    }
  }

  get filteredApplications(): any[] {
    const term = (this.filterPosition || '').trim().toLowerCase();
    if (!term) return this.applications;
    return this.applications.filter(a => (a.position || '').toLowerCase().includes(term));
  }

  get uniquePositions(): string[] {
    const set = new Set<string>();
    for (const a of this.applications) {
      if (a?.position) set.add(String(a.position));
    }
    return Array.from(set).sort((a,b) => a.localeCompare(b));
  }

  get sortedApplications(): any[] {
    const list = [...this.filteredApplications];
    if (this.sortBy === 'score') {
      return list.sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    // default: date desc
    return list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  // Dashboard statistics
  get pendingCount(): number {
    return this.applications.filter(a => (a.status || 'pending') === 'pending').length;
  }

  get interviewsScheduledCount(): number {
    return this.applications.filter(a => a.status === 'accepted' && !!a.interviewDate).length;
  }

  get upcomingInterviewDates(): { id: number; name: string; position: string; when: string; date: Date }[] {
    const items = this.applications
      .filter(a => a.status === 'accepted' && !!a.interviewDate)
      .map(a => ({
        id: a.id,
        name: a.fullName || a.name || 'Candidate',
        position: a.position || '—',
        when: a.interviewDate,
        date: new Date(a.interviewDate)
      }))
      .filter(x => !isNaN(x.date.getTime()));
    // Sort ascending by date
    items.sort((a, b) => a.date.getTime() - b.date.getTime());
    return items;
  }

  // Return resume text with <mark> around matched keywords
  highlightResume(app: any): SafeHtml {
    const text: string = String(app?.resumeText || '');
    const kws: string[] = Array.isArray(app?.matchedKeywords) ? app.matchedKeywords : [];
    if (!text || kws.length === 0) {
      return this.sanitizer.bypassSecurityTrustHtml(this.escapeHtml(text));
    }
    // Build regex to match any of the keywords (case-insensitive), using word-ish boundaries
    const escaped = kws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(^|[^A-Za-z0-9])(${escaped.join('|')})(?=[^A-Za-z0-9]|$)`, 'gi');
    let result = '';
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    const src = text;
    while ((m = regex.exec(src)) !== null) {
      const start = m.index;
      const pre = src.slice(lastIndex, start + m[1].length);
      const word = m[2];
      result += this.escapeHtml(pre) + `<mark>${this.escapeHtml(word)}</mark>`;
      lastIndex = start + m[0].length;
    }
    result += this.escapeHtml(src.slice(lastIndex));
    return this.sanitizer.bypassSecurityTrustHtml(result);
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Map fit level to badge class
  fitBadgeClass(fitLevel?: string): string {
    switch ((fitLevel || '').toLowerCase()) {
      case 'strong': return 'badge-strong';
      case 'good': return 'badge-good';
      default: return 'badge-weak';
    }
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      try { localStorage.removeItem('user'); } catch {}
    }
    this.router.navigate(['/']);
  }

  deleteApplication(id: number) {
    if (confirm('Are you sure you want to delete this application?')) {
      this.applications = this.applications.filter(app => app.id !== id);
      if (isPlatformBrowser(this.platformId)) {
        try { localStorage.setItem('applications', JSON.stringify(this.applications)); } catch {}
      }
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'reviewed': return 'status-reviewed';
      case 'accepted': return 'status-accepted';
      case 'rejected': return 'status-rejected';
      default: return 'status-pending';
    }
  }
}
