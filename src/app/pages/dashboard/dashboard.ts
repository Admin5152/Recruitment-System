import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

  constructor(private router: Router, @Inject(PLATFORM_ID) private platformId: Object) {}

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
