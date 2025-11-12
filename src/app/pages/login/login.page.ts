import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/api/auth.service';
import { UtilService } from '../../services/util/util.service';  
import { APIService } from 'src/app/services/api/api.service';    
import { Router } from '@angular/router';
import { Subscription ,Subject } from 'rxjs';
import { InitUserProvider } from '../../services/inituser/inituser.service';
import { BiometricAuthService } from '../../services/biometric/biometric-auth.service';
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
              private biometricAuth: BiometricAuthService,
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
    // Verificar si la autenticación biométrica está disponible
    await this.checkBiometricAvailability();
  }

  /**
   * Verifica si la autenticación biométrica está disponible y hay credenciales guardadas
   */
  async checkBiometricAvailability() {
    try {
      this.biometricAvailable = await this.biometricAuth.isBiometricAvailable();
      
      if (this.biometricAvailable) {
        this.biometricType = await this.biometricAuth.getBiometryType();
        const hasCredentials = await this.biometricAuth.hasStoredCredentials();
        const isEnabled = await this.biometricAuth.isBiometricEnabled();
        
        // Mostrar botón solo si hay credenciales guardadas y está habilitado
        this.showBiometricButton = hasCredentials && isEnabled;
        
        console.log('Biometric available:', this.biometricAvailable);
        console.log('Biometric type:', this.biometricType);
        console.log('Show biometric button:', this.showBiometricButton);
      }
    } catch (error) {
      console.error('Error checking biometric availability:', error);
    }
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
            next: (responseUser) => {
                console.log('🟢 GOT USER FROM FIRESTORE:', responseUser);
                
                if (!responseUser) {
                  console.error('❌ User data is NULL');
                  this.utilService.presentAlert('Error', 'User data not found. Please try again.', 'OK');
                  this.clearSpinner();
                  return;
                }
                
                console.log('🔹 Setting logged in user...');
                this.userProvider.setLoggedInUser(responseUser);
                console.log('✅ User set successfully');
                
                this.clearSpinner();
                console.log('🔹 Navigating to /tabs...');
                
                // Guardar credenciales para autenticación biométrica (si está disponible)
                this.saveBiometricCredentials(this.user.email, this.user.password);
                
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
            this.userSubscription =  this.api.getUser().subscribe((responseUser: any) => {
                if (!responseUser) {
                  this.utilService.presentAlert('Error', 'User data not found. Please try again.', 'OK');
                  this.clearSpinner();
                  return;
                }
                this.userProvider.setLoggedInUser(responseUser);
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
            this.userSubscription =  this.api.getUser().subscribe((responseUser: any) => {
                if (!responseUser) {
                  this.utilService.presentAlert('Error', 'User data not found. Please try again.', 'OK');
                  this.clearSpinner();
                  return;
                }
                this.userProvider.setLoggedInUser(responseUser);
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
            this.userSubscription =  this.api.getUser().subscribe((responseUser: any) => {
                if (!responseUser) {
                  this.utilService.presentAlert('Error', 'User data not found. Please try again.', 'OK');
                  this.clearSpinner();
                  return;
                }
                this.userProvider.setLoggedInUser(responseUser);
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

  /**
   * Guarda las credenciales para autenticación biométrica
   */
  async saveBiometricCredentials(email: string, password: string) {
    try {
      if (!this.biometricAvailable) {
        console.log('Biometric not available, skipping credential save');
        return;
      }

      // Preguntar al usuario si quiere habilitar Face ID/Touch ID
      const biometricName = this.biometricType === 'faceId' ? 'Face ID' : 
                           this.biometricType === 'touchId' ? 'Touch ID' : 'autenticación biométrica';
      
      const biometricIcon = this.biometricType === 'faceId' ? '👤' : 
                           this.biometricType === 'touchId' ? '👆' : '🔒';
      
      const shouldEnable = await this.presentBiometricEnableAlert(biometricName, biometricIcon);

      if (shouldEnable) {
        await this.biometricAuth.saveCredentials(email, password);
        await this.biometricAuth.setBiometricEnabled(true);
        console.log('Credenciales biométricas guardadas');
        
        // Actualizar la visibilidad del botón
        this.showBiometricButton = true;
        
        // Mostrar mensaje de éxito
        await this.utilService.presentAlert(
          '✅ ¡Listo!',
          `${biometricName} ha sido configurado exitosamente. La próxima vez podrás iniciar sesión más rápido.`,
          'Entendido'
        );
      }
    } catch (error) {
      console.error('Error saving biometric credentials:', error);
    }
  }

  /**
   * Muestra un alert personalizado para habilitar biometría
   */
  async presentBiometricEnableAlert(biometricName: string, icon: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      (document.activeElement as HTMLElement)?.blur();
      
      const alert = await this.alertController.create({
        header: `${icon} ${biometricName}`,
        message: `<div style="text-align: center; padding: 10px;">
                    <p style="font-size: 16px; margin-bottom: 15px;">
                      ¿Deseas usar <strong>${biometricName}</strong> para iniciar sesión más rápido y de forma segura?
                    </p>
                    <p style="font-size: 14px; color: #666;">
                      Tus credenciales se guardarán de forma encriptada en tu dispositivo.
                    </p>
                  </div>`,
        backdropDismiss: false,
        buttons: [
          {
            text: 'Ahora no',
            role: 'cancel',
            cssClass: 'alert-button-cancel',
            handler: () => {
              resolve(false);
            }
          },
          {
            text: `Sí, usar ${biometricName}`,
            role: 'confirm',
            cssClass: 'alert-button-ok',
            handler: () => {
              resolve(true);
            }
          }
        ],
        cssClass: 'custom-alert-card biometric-alert'
      });
      
      await alert.present();
    });
  }

  /**
   * Inicia sesión usando autenticación biométrica
   */
  async loginWithBiometric() {
    try {
      this.setSpinner();
      console.log('🔵 BIOMETRIC LOGIN - Starting biometric authentication');

      // Obtener credenciales usando autenticación biométrica
      const credentials = await this.biometricAuth.loginWithBiometric();

      if (!credentials) {
        console.log('❌ Biometric authentication failed or cancelled');
        this.clearSpinner();
        return;
      }

      console.log('✅ Biometric authentication successful, logging in...');
      
      // Usar las credenciales obtenidas para hacer login
      this.api.logIn(credentials.email, credentials.password)
        .subscribe({
          next: async (res) => {
            console.log('🟢 LOGIN SUCCESS with biometric');
            
            await this.userProvider.setToken(res['id']);
            
            this.userSubscription = this.api.getUser().subscribe({
              next: (responseUser) => {
                if (!responseUser) {
                  this.utilService.presentAlert('Error', 'User data not found. Please try again.', 'OK');
                  this.clearSpinner();
                  return;
                }
                
                this.userProvider.setLoggedInUser(responseUser);
                this.clearSpinner();
                this.router.navigate(['/tabs']);
              },
              error: (err) => {
                console.error('❌ Error getting user from Firestore:', err);
                this.utilService.presentAlert('Error', 'Failed to load user data: ' + err.message, 'OK');
                this.clearSpinner();
              }
            });
          },
          error: async (err) => {
            console.error('❌ LOGIN FAILED with biometric credentials:', err);
            
            // Si las credenciales guardadas ya no son válidas, eliminarlas
            await this.biometricAuth.deleteCredentials();
            this.showBiometricButton = false;
            
            this.utilService.presentAlert(
              'Error', 
              'Las credenciales guardadas ya no son válidas. Por favor, inicia sesión manualmente.', 
              'OK'
            );
            this.clearSpinner();
          }
        });
    } catch (error: any) {
      console.error('❌ EXCEPTION in biometric login:', error);
      this.utilService.presentAlert('Error', 'Error en autenticación biométrica: ' + error.message, 'OK');
      this.clearSpinner();
    }
  }

  /**
   * Deshabilita la autenticación biométrica
   */
  async disableBiometric() {
    try {
      const confirm = await this.utilService.presentConfirm(
        'Deshabilitar Autenticación Biométrica',
        '¿Estás seguro de que deseas deshabilitar la autenticación biométrica?',
        'Sí, deshabilitar',
        'Cancelar'
      );

      if (confirm) {
        await this.biometricAuth.deleteCredentials();
        this.showBiometricButton = false;
        this.utilService.presentAlert('Éxito', 'Autenticación biométrica deshabilitada', 'OK');
      }
    } catch (error) {
      console.error('Error disabling biometric:', error);
      this.utilService.presentAlert('Error', 'Error al deshabilitar autenticación biométrica', 'OK');
    }
  }
  

   
}
