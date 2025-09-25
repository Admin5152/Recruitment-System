import { Routes } from '@angular/router';
import { SignUp } from './pages/sign-up/sign-up';
import { SignIn } from './pages/sign-in/sign-in';
import { ApplicationForm } from './pages/application-form/application-form';
import { Dashboard } from './pages/dashboard/dashboard';
import { Home } from './pages/home/home';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'sign-up', component: SignUp },
  { path: 'sign-in', component: SignIn },
  { path: 'apply', component: ApplicationForm },
  { path: 'dashboard', component: Dashboard },
  { path: 'hr', loadComponent: () => import('./pages/hr/hr').then(m => m.HRPage) },
  { path: 'jobs', loadComponent: () => import('./pages/jobs/jobs').then(m => m.JobsPage) },
  { path: '**', redirectTo: '' } // fallback
];
