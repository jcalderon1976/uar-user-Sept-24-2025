import { Injectable } from '@angular/core';
import { APIService } from '../api/api.service';
import { AuthService } from '../api/auth.service';
import { Preferences } from '@capacitor/preferences';
import { User } from '../../models/user';
import { LoadingController, ToastController } from '@ionic/angular';
import { Camera } from '@capacitor/camera';
import { UtilService } from '../../services/util/util.service';
import { AppStorage } from '../../services/api/app-storage.service';

@Injectable()
export class InitUserProvider {
  public loggedInUser!: User;
  public camera = Camera;
  public storage = Preferences;

  constructor(
    private api: APIService,
    private auth: AuthService,  
    private loadingCtrl: LoadingController,
    public util: UtilService,
    private toastCtrl: ToastController,
    private store: AppStorage
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


  async setLoggedInUser(user: User) {
   
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
    await this.storage.set({ key: 'id', value:user.id });
    console.dir('SetLoggedinUser', this.loggedInUser);
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

}
