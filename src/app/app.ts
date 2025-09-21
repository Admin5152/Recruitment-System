import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';

// ✅ Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  protected readonly title = signal('Recruitment-System');

  // ✅ Track user state
  user = signal<User | null>(null);

  constructor() {
    const firebaseConfig = {
    apiKey: "AIzaSyCJuZAVaSsXCNjlJ7rLdGBOzQzbwHlarJY",
    authDomain: "recruitment-system-529ab.firebaseapp.com",
    projectId: "recruitment-system-529ab",
    storageBucket: "recruitment-system-529ab.firebasestorage.app",
    messagingSenderId: "1074169027032",
    appId: "1:1074169027032:web:9b2345a3e1a6234e217aad",
    measurementId: "G-HFG2NTQJYY"
  };

    // ✅ Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    // ✅ Listen for authentication state changes
    onAuthStateChanged(auth, (currentUser) => {
      this.user.set(currentUser);
      if (currentUser) {
        console.log('✅ User logged in:', currentUser.email);
      } else {
        console.log('🚪 User logged out');
      }
    });
  }}
