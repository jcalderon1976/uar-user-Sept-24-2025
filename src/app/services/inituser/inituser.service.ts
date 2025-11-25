import { Injectable } from '@angular/core';
import { APIService } from '../api/api.service';
import { AuthService } from '../api/auth.service';
import { Preferences } from '@capacitor/preferences';
import { User } from '../../models/user';
import { LoadingController, ToastController } from '@ionic/angular';
import { Camera } from '@capacitor/camera';
import { UtilService } from '../../services/util/util.service';
import { AppStorage } from '../../services/api/app-storage.service';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class InitUserProvider {
  public loggedInUser!: User;
  public camera = Camera;
  public storage = Preferences;
  // Guardar la imagen del usuario en memoria como blob URL para evitar problemas de CORS
  public userProfileImageBlobUrl: string | null = null;

  constructor(
    private api: APIService,
    private auth: AuthService,  
    private loadingCtrl: LoadingController,
    public util: UtilService,
    private toastCtrl: ToastController,
    private store: AppStorage,
    private http: HttpClient
  ) {
        this.createNewEmptyUser();
  }

  getUserData(): User {
    return this.loggedInUser;
  }

  createNewEmptyUser() {
    
    this.loggedInUser = {
      id: '',
      name: '',
      email: '',
      NewEmail: '',
      phone: '',
      password: '',
      password2: '',
      location_lat: 0,
      location_lng: 0,
      token: '',
      rideId: '',
      location: ''
    };
  }

  load() {
     return new Promise((resolve, reject) => {
      
      this.getToken().then(token => {
        
        if (!token) {
          console.log('[ inituser.load() ]-> (token is null) ');
          resolve(true);
          return;
        } 
        
        console.log('[ inituser.load() ]-> (token) ', token); //SI Token no es null
        this.api.updateToken(token); //actualizo el token si no es null
        
        this.api.getUser().subscribe((user: any) => {  //busco el usuario con el token
          
            console.log('[ inituser.load() ]-> (user) ', user);
            
            if (user) {   this.setLoggedInUser(user); } //si existe el usuario lo seteo}
            
            resolve(true);
            
        }, err => {
          resolve(true);
          console.log(err);
        });
      });
    });  
  }


  async setLoggedInUser(user: User, loadImage: boolean = false) {
   
    console.dir('[ inituser.setLoggedInUser() ]-> (user) ', user);

    Object.assign(this.loggedInUser, user);

    const userId =  await this.getToken();
    
    this.loggedInUser.token = String(userId);
        
    const _rideId = await this.getRideId();
    
    console.log('====================> _rideid=>' );
    
    console.dir(_rideId);
    
    if(_rideId){
      this.loggedInUser.rideId = _rideId;
     }
     if(user?.id){    await this.storage.set({ key: 'id', value:  user.id});}
     else{           await this.storage.set({ key: 'id', value:  userId? userId : ''}); }
    
    // Cargar la imagen del usuario SOLO si se solicita explícitamente (después de autenticación)
    // No cargar durante la carga inicial (load()) para evitar problemas de CORS antes de la autenticación
    if (loadImage) {
      if (user?.profile_img && user.profile_img !== '') {
        await this.loadUserProfileImage(user.profile_img);
      } else {
        // Si no hay imagen, limpiar la URL guardada
        this.clearUserProfileImage();
      }
    }
    
    console.dir('SetLoggedinUser', this.loggedInUser);
  }

  /**
   * Carga la imagen del perfil del usuario desde Firebase Storage y la guarda en memoria como blob URL
   * Esto evita problemas de CORS cuando se usa la imagen en el marcador del mapa
   */
  async loadUserProfileImage(imageUrl: string): Promise<void> {
    try {
      console.log('🖼️ Cargando imagen del perfil del usuario:', imageUrl);
      
      // Validar que la URL sea válida
      if (!imageUrl || imageUrl === '' || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://') && !imageUrl.startsWith('blob:'))) {
        console.warn('⚠️ URL de imagen no válida:', imageUrl);
        this.userProfileImageBlobUrl = null;
        return;
      }
      
      // Limpiar la URL anterior si existe
      this.clearUserProfileImage();
      
      // Verificar si estamos en desarrollo web (puede haber problemas de CORS)
      const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.() || false;
      const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      
      // En desarrollo web con Firebase Storage, es probable que haya problemas de CORS
      if (!isNative && isLocalhost && imageUrl.includes('firebasestorage.googleapis.com')) {
        console.warn('⚠️ Desarrollo web detectado con Firebase Storage - puede haber problemas de CORS');
        console.warn('⚠️ Intentando cargar imagen, pero si falla, se usará la URL original directamente');
      }
      
      // Cargar la imagen usando HttpClient para evitar problemas de CORS
      this.http.get(imageUrl, { responseType: 'blob' }).subscribe({
        next: (blob: Blob) => {
          console.log('✅ Imagen del usuario obtenida como blob');
          // Crear un blob URL que se puede usar sin problemas de CORS
          this.userProfileImageBlobUrl = URL.createObjectURL(blob);
          console.log('✅ Imagen del usuario guardada en memoria:', this.userProfileImageBlobUrl);
        },
        error: (error) => {
          // En desarrollo web, los errores de CORS son esperados
          if (error.status === 0 && !isNative && isLocalhost) {
            console.warn('⚠️ Error de CORS en desarrollo web (esperado)');
            console.warn('⚠️ La imagen se usará directamente desde la URL original');
            console.warn('⚠️ En dispositivos nativos (Android/iOS) esto funcionará correctamente');
          } else {
            console.error('❌ Error cargando imagen del usuario:', error);
          }
          // No establecer userProfileImageBlobUrl en null aquí
          // Dejar que el código use la URL original directamente
          this.userProfileImageBlobUrl = null;
        }
      });
    } catch (error) {
      console.error('❌ Error en loadUserProfileImage:', error);
      // No es crítico - el código puede usar la URL original directamente
      this.userProfileImageBlobUrl = null;
    }
  }

  /**
   * Limpia la imagen del perfil guardada en memoria
   */
  clearUserProfileImage(): void {
    if (this.userProfileImageBlobUrl) {
      URL.revokeObjectURL(this.userProfileImageBlobUrl);
      this.userProfileImageBlobUrl = null;
      console.log('🧹 Imagen del perfil limpiada de memoria');
    }
  }

  /**
   * Obtiene la URL de la imagen del perfil guardada en memoria
   * @returns string | null - La URL del blob o null si no hay imagen
   */
  getUserProfileImageUrl(): string | null {
    return this.userProfileImageBlobUrl;
  }

   async setToken(token: any) {
    this.api.updateToken(token);
    await this.storage.set({ key: 'token', value:token })   //('token', token);
  } 
  async getToken() {
    const token = (await this.storage.get({ key: 'token' })).value;
    if (token === null || token === '') {
      console.log('Token no existe o está vacío');
      return null;
    }
    else{
      return String(token);
    }
  } 

  async getRideId() {
    const rideId = await this.storage.get({ key: 'rideId'});
    console.log('rideId', rideId);
    return rideId.value;
  }

  async setRideId(rideId: any) {
    this.loggedInUser.rideId = rideId;
    console.log('rideId', rideId);
    await this.storage.set({ key: 'rideId', value:rideId }  );
  }

  async clearRideId() {  // TODO
    this.loggedInUser.rideId = '';
    await this.storage.remove({ key: 'rideId'});
    await this.store.remove('p2p_state');
  }

  async logout(): Promise<any> {
    
    // Limpiar la imagen del perfil de memoria
    this.clearUserProfileImage();
    
    await this.createNewEmptyUser();
    await this.clearRideId();
    await this.api.logout().then(res => {
            return this.storage.clear();
    } );
  }

  async setNewEmail(newEmail: string ) {
    this.loggedInUser.NewEmail = newEmail;
    await this.storage.set({ key: 'newEmail', value:newEmail }  );
  }

  // Método para recargar los datos del usuario desde la base de datos
  async reloadUserData(): Promise<User> {
    return new Promise((resolve, reject) => {
      this.api.getUser().subscribe(
        async (user: any) => {
          if (user) {
            // Cargar usuario sin imagen primero
            await this.setLoggedInUser(user, false);
            // Luego cargar la imagen si existe (después de autenticación)
            if (user?.profile_img && user.profile_img !== '') {
              await this.loadUserProfileImage(user.profile_img);
            }
            console.log('Usuario recargado desde la base de datos:', user);
            resolve(user);
          } else {
            reject('No se encontró el usuario');
          }
        },
        (err) => {
          console.error('Error al recargar usuario:', err);
          reject(err);
        }
      );
    });
  }

  /**
   * Actualiza la imagen del perfil del usuario en memoria
   * Útil cuando el usuario actualiza su foto de perfil
   */
  async updateUserProfileImage(newImageUrl: string): Promise<void> {
    await this.loadUserProfileImage(newImageUrl);
  }

}
