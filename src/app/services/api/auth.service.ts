import { Injectable } from '@angular/core';
import { Auth, signOut , signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup, reload,updateEmail,
         GoogleAuthProvider ,OAuthProvider , sendEmailVerification ,signInWithRedirect , getAuth, getIdToken, getIdTokenResult, setPersistence, browserLocalPersistence, inMemoryPersistence, indexedDBLocalPersistence, initializeAuth, connectAuthEmulator} from '@angular/fire/auth';
import { FirestoreService } from '../api/firestore.service';
import { Firestore } from '@angular/fire/firestore';
import { User } from '../../models/user';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  popupOpen = false; // prevent multiple popups
  private apiUrl = environment.emailApiUrl; //   'http://localhost:3000';
  private googleProvider = new GoogleAuthProvider();
  private isInitialized = false;


  constructor(private auth: Auth ,
              private http: HttpClient,
              private store: FirestoreService  
  ) {
    this.initializeAuth();
  }

  private async initializeAuth() {
    console.log('🔥 AuthService - Initializing...');
    console.log('Platform:', Capacitor.getPlatform());
    console.log('Is Native:', Capacitor.isNativePlatform());
    
    // Mark as initialized immediately - persistence will be handled by Firebase SDK automatically
    this.isInitialized = true;
    console.log('✅ Auth initialized');
  }

  // ✅ Register a new user
   createAccount(user: User): Promise<any> {

    return new Promise<any>(async (resolved, rejected) => {
    
      await createUserWithEmailAndPassword(this.auth, user.email, user.password)  .then(res => {
      
        if (res.user) {
          resolved(res.user);
        } else {
          rejected(res);
        }
      })
      .catch(err => {
           rejected(err);
      });
      

    
  });
}

  // ✅ Login existing user
  async login(email: string, password: string) {
    console.log('🔷 AuthService.login() - Starting Firebase Auth...');
    console.log('Auth instance:', this.auth ? '✅ Initialized' : '❌ NULL');
    console.log('Is initialized:', this.isInitialized);
    console.log('Attempting login with email:', email);
    console.log('Auth current user:', this.auth.currentUser);
    console.log('Auth config:', this.auth.config);
    
    try {
      console.log('🔹 Calling signInWithEmailAndPassword...');
      console.log('🔹 Timestamp:', new Date().toISOString());
      console.log('🔹 Network status:', navigator.onLine ? 'ONLINE' : 'OFFLINE');
      
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      
      console.log('✅✅✅ Firebase Auth SUCCESS!');
      console.log('User UID:', userCredential.user.uid);
      console.log('User email:', userCredential.user.email);
      console.log('Email verified:', userCredential.user.emailVerified);
      
      return userCredential.user;
    } catch (error: any) {
      console.error('❌❌❌ Login Error:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      console.error('Error name:', error?.name);
      console.error('Error stack:', error?.stack);
      console.error('Full error object:', error);
      throw error;
    }
  }

  // ✅ Google Sign-In Using Firebase
  async loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);
      return result.user; // Return user data
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      throw error;
    }
  }
  // ✅ Microsoft Sign-In Using Firebase
  async loginMicrosoft() {
    
    if (this.popupOpen) return Promise.reject('Popup already open');

    this.popupOpen = true;

    const provider = new OAuthProvider('microsoft.com');
      try {
        const result = await signInWithPopup(this.auth, provider);
        console.log('Logged in successfully:', result.user);
        return result.user;
      } catch (error: any) {
        if (error.code === 'auth/cancelled-popup-request') {
          console.warn('Popup request cancelled.');
        } else {
          console.error('Error during Microsoft login:', error);
        }
        throw error;
      } finally {
        this.popupOpen = false;
      }
  }
  
 // ✅ Apple Sign-In Using Firebase
  async loginApple() {
    try {
      const provider = new OAuthProvider('apple.com');
      const result = await signInWithPopup(this.auth, provider);
      console.log('Apple login successful:', result.user);
      return result.user;
    } catch (error) {
      console.error('Error during Apple login:', error);
      throw error;
    }
  }

  // ✅ Forgot Password
  async resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error) {
      console.error('Password Reset Error:', error);
      throw error;
    }
  }

  // ✅ Logout
  async logout() {

  //TODO CHECK WHERE IS THE LOG IN ???
    //return this.auth.signOut();
    await signOut(this.auth);
    //await GoogleAuth.signOut();
  }

  sendOTP(email: string) {
    return this.http.post(`${this.apiUrl}/send-otp`, { email });
  }

  verifyOTP(email: string, otp: string) {
    return this.http.post(`${this.apiUrl}/verify-otp`, { email, otp });
  }

  emailVerification(){
    const authentication = getAuth();
    const user = authentication.currentUser;

    if (user) {
      sendEmailVerification(user).then(() => {
        console.log('Correo de verificación enviado');
      }).catch((error) => {
        console.error('Error enviando verificación', error);
      });
    }
  }

  async emailVerified(){

    const authentication = getAuth();
    const user = authentication.currentUser;

    if (user) {
      await reload(user); // Refrescar datos del usuario
      if (user.emailVerified) {
        console.log('Correo verificado ✅');
      } else {
        console.log('Correo aún no verificado ❌');
      }
    }

  }

  changeEmail(user: any , newEmail: string) {
    
    updateEmail(user, newEmail).then(() => {
      console.log('Correo actualizado exitosamente');
      // 🔔 Puedes volver a enviar email de verificación
      sendEmailVerification(user);
    }).catch((error) => {
      console.error('Error actualizando email', error);
    });


  } 


}
