import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/api/auth.service';
import { UtilService } from '../../services/util/util.service';  
import { APIService } from 'src/app/services/api/api.service';    
import { Router } from '@angular/router';
import { Subscription ,Subject } from 'rxjs';
import { InitUserProvider } from '../../services/inituser/inituser.service';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {

  public user: any = { email: '', password: '' };
  // Validation flags
  emailError = false;
  passwordError = false;
  private userSubscription!: Subscription;  // Store the subscription
  public spinner = false;
  public disabled = false;
  private destroy$ = new Subject<void>();
  
  // Biometric authentication
  public biometricAvailable = false;
  public biometricType = 'none';
  public showBiometricButton = false;

  constructor(private authService: AuthService, 
              private utilService: UtilService,
              private api : APIService,
              private router: Router,
              private userProvider: InitUserProvider,
              private alertController: AlertController) {}

  ngOnDestroy(): void {

    // Emitir valor para romper todas las suscripciones
    this.destroy$.next();
    this.destroy$.complete(); 
    // Unsubscribe to avoid memory leaks
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  async ngOnInit() {

  }



  async login() {
     console.log('🔵 LOGIN CLICKED - Starting login process');
     console.log('Email:', this.user.email);
     console.log('Password length:', this.user.password?.length);

     // Reset previous error states
     this.user.emailError = !this.validateEmail(this.user.email);
     this.passwordError = !this.validatePasswords();

     if (this.user.emailError || this.passwordError) {
      console.log('❌ Validation failed');
      this.utilService.presentAlert('Error','Please correct the highlighted errors.','TRY AGAIN');
      return;
    }

    console.log('✅ Validation passed, attempting Firebase login...');
    try {
      this.setSpinner();
      console.log('🔹 Calling api.logIn()...');
      
      this.api.logIn(this.user.email, this.user.password)
      .subscribe({
        next: async (res) => {
          console.log('🟢 LOGIN SUCCESS - Got response:', res);
          console.log('🔹 User ID from Firebase:', res['id']);
          
          console.log('🔹 Setting token...');
          await this.userProvider.setToken(res['id']);
          console.log('✅ Token set successfully');

          console.log('🔹 Getting user from Firestore...');
          this.userSubscription =  this.api.getUser().subscribe({
            next: async (responseUser) => {
                console.log('🟢 GOT USER FROM FIRESTORE:', responseUser);
                
                if (!responseUser) {
                  console.error('❌ User data is NULL');
                  this.utilService.presentAlert('Error', 'User data not found. Please try again.', 'OK');
                  this.clearSpinner();
                  return;
                }
                
                console.log('🔹 Setting logged in user...');
                // Cargar usuario sin imagen primero (para evitar problemas de CORS antes de autenticación)
                await this.userProvider.setLoggedInUser(responseUser, false);
                console.log('✅ User set successfully');
                
                // Ahora cargar la imagen después de la autenticación exitosa
                if (responseUser?.profile_img && responseUser.profile_img !== '') {
                  console.log('🖼️ Cargando imagen del perfil después de autenticación...');
                  await this.userProvider.loadUserProfileImage(responseUser.profile_img);
                }
                
                this.clearSpinner();
                console.log('🔹 Navigating to /tabs...');
                
                this.router.navigate(['/tabs']).then(success => {
                  console.log('✅ Navigation result:', success);
                });
            },
            error: (err) => {
              console.error('❌ Error getting user from Firestore:', err);
              this.utilService.presentAlert('Error', 'Failed to load user data: ' + err.message, 'OK');
              this.clearSpinner();
            }
          });
        },
        error: async (err) => {
          console.error('❌ LOGIN FAILED:', err);
          this.utilService.presentAlert('Error', 'Access Denied!! Invalid Credential ' + ( err.message || err.statusText), 'TRY AGAIN');
          this.clearSpinner();
        }
      });
    } catch (error: any) {
      console.error('❌ EXCEPTION in login():', error);
      this.utilService.presentAlert('Error','Login failed. Check your credentials: ' + error.message,'TRY AGAIN');
      this.clearSpinner();
    }
  }

  async loginWithGoogle() {
    try {
      this.setSpinner();
      this.api.loginWithGoogle()
      .subscribe(
        async res => {
            await this.userProvider.setToken(res['id']);
            this.userSubscription =  this.api.getUser().subscribe(async (responseUser: any) => {
                if (!responseUser) {
                  this.utilService.presentAlert('Error', 'User data not found. Please try again.', 'OK');
                  this.clearSpinner();
                  return;
                }
                await this.userProvider.setLoggedInUser(responseUser, false);
                // Cargar imagen después de autenticación
                if (responseUser?.profile_img && responseUser.profile_img !== '') {
                  await this.userProvider.loadUserProfileImage(responseUser.profile_img);
                }
                this.clearSpinner();
                this.router.navigate(['/tabs']);  // Redirect to home page
              });
        }
        ,async err => {
          this.utilService.presentAlert('Error', 'Google Sign-In Failed. Access Denied!! Invalid Credential ', 'TRY AGAIN');
          this.clearSpinner();
      });
    } catch (error) {
      this.utilService.presentAlert('Error', 'Google Sign-In Failed. Access Denied!! Invalid Credential ', 'TRY AGAIN');
      this.clearSpinner();
    }
  }
  
   async loginWithMicrosoft() {
    try {
      this.setSpinner();
      this.api.loginMicrosoft()
      .subscribe(
        async res => {
            await this.userProvider.setToken(res['id']);
            this.userSubscription =  this.api.getUser().subscribe(async (responseUser: any) => {
                if (!responseUser) {
                  this.utilService.presentAlert('Error', 'User data not found. Please try again.', 'OK');
                  this.clearSpinner();
                  return;
                }
                await this.userProvider.setLoggedInUser(responseUser, false);
                // Cargar imagen después de autenticación
                if (responseUser?.profile_img && responseUser.profile_img !== '') {
                  await this.userProvider.loadUserProfileImage(responseUser.profile_img);
                }
                this.clearSpinner();
                this.router.navigate(['/tabs']);  // Redirect to home page
              });
        }
        ,async err => {
          this.utilService.presentAlert('Error', 'Microsoft Sign-In Failed. Access Denied!! Invalid Credential ', 'TRY AGAIN');
          this.clearSpinner();
      });
    } catch (error) {
      this.utilService.presentAlert('Error', 'Microsoft Sign-In Failed. Access Denied!! Invalid Credential ', 'TRY AGAIN');
      this.clearSpinner();
    }
  }
  async loginWithApple() {
    try {
      this.setSpinner();
      this.api.loginApple()
      .subscribe(
        async res => {
            await this.userProvider.setToken(res['id']);
            this.userSubscription =  this.api.getUser().subscribe(async (responseUser: any) => {
                if (!responseUser) {
                  this.utilService.presentAlert('Error', 'User data not found. Please try again.', 'OK');
                  this.clearSpinner();
                  return;
                }
                await this.userProvider.setLoggedInUser(responseUser, false);
                // Cargar imagen después de autenticación
                if (responseUser?.profile_img && responseUser.profile_img !== '') {
                  await this.userProvider.loadUserProfileImage(responseUser.profile_img);
                }
                this.clearSpinner();
                this.router.navigate(['/tabs']);  // Redirect to home page
              });
        }
        ,async err => {
          this.utilService.presentAlert('Error', 'Apple Sign-In Failed. Access Denied!! Invalid Credential ', 'TRY AGAIN');
          this.clearSpinner();
      });
    } catch (error) {
      this.utilService.presentAlert('Error', 'Apple Sign-In Failed. Access Denied!! Invalid Credential ', 'TRY AGAIN');
      this.clearSpinner();
    }
  }

  
  goToRegister() {
    this.router.navigate(['/register']);
  }

  async forgotPassword() {
    if (!this.user.email) {
      this.utilService.presentAlert('Alert','Enter your email to reset password.','TRY AGAIN');
      return;
    }
    try {
      await this.authService.resetPassword(this.user.email);
      this.utilService.presentAlert('Alert','Password reset email sent.','OK');
    } catch (error) {
      this.utilService.presentAlert('Error','Error sending password reset email.','TRY AGAIN');
    }
  }

 

  validatePasswords(): boolean {
    return  this.user.password.length >= 3;
  }

  validateEmail(email: string): boolean {
    const emailRegex = /\S+@\S+\.\S+/;
    return emailRegex.test(email);
  }

  focusNext(nextInput: any) {
    setTimeout(() => {
      nextInput.setFocus(); // Le da foco al siguiente input
    }, 100);
  }

  submitIfValid() {
    // Si todo está bien, llama a register()
    this.login();
  }

  setSpinner() {
    this.spinner = true;
    this.disabled = true;
  }

  clearSpinner() {
    this.spinner = false;
    this.disabled = false;
  }

  






   
}
