import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';

interface JobDef {
  id: number;
  title: string;
  description: string;
  required: string[];
  optional: string[];
  createdAt: string;
  pinned?: boolean;
}

@Component({
  selector: 'app-jobs',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './jobs.html',
  styleUrls: ['./jobs.css']
})
export class JobsPage {
  jobs: JobDef[] = [];

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadJobs();
  }

  private loadJobs() {
    try {
      this.jobs = JSON.parse(localStorage.getItem('jobs') || '[]');
    } catch { this.jobs = []; }
  }

  get pinnedJobs(): JobDef[] {
    return (this.jobs || []).filter(j => !!j.pinned);
  }

  get otherJobs(): JobDef[] {
    return (this.jobs || []).filter(j => !j.pinned);
  }
}
