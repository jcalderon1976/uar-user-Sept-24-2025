import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import {
  ActionSheetController,
  AlertController,
  LoadingController,
  ModalController,
  NavController,
  ToastController
} from '@ionic/angular';
import { environment } from 'src/environments/environment';
declare let google: any;

@Injectable({
  providedIn: 'root'
})
export class UtilService {
  private coordinates: { latitude: number; longitude: number } | null = null;

  constructor(
    private toastCtrl: ToastController,
    private alertController: AlertController,
    private modalCtrl: ModalController,
    private actionSheetCtrl: ActionSheetController,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController
  ) {}

  async presentAlert(header: string, message: string, buttonText: string = 'OK' ) : Promise<string> {
    (document.activeElement as HTMLElement)?.blur();
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [
        {
          text: buttonText,
          role: 'cancel',
          cssClass: 'alert-button-custom'
        }
      ],
      cssClass: 'custom-alert-card'
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role ?? '';
   }  


    async presentAlert2( header: string, message: string, okHandler?: () => void, cancelHandler?: () => void, buttonText: string = 'OK' ) {
      (document.activeElement as HTMLElement)?.blur();
      const alert = await this.alertController.create({
        header,
        message,
        backdropDismiss: false,          // ⛔️ no cerrar por clic fuera
        buttons: [
          {
            text: 'No',
            role: 'cancel',
            cssClass: 'alert-button-cancel',
            
            handler: () => {
              if (cancelHandler) cancelHandler();
            }
          },
          {
            text: buttonText,
            role: 'confirm',
            cssClass: 'alert-button-ok',
            handler: () => {
              if (okHandler) okHandler();
            }
          }
        ],
        cssClass: 'custom-alert-card'
      });
    
      await alert.present();
    }

    /**
     * Muestra una alerta de confirmación y retorna true si el usuario confirma
     */
    async presentConfirm(header: string, message: string, okButtonText: string = 'OK', cancelButtonText: string = 'Cancelar'): Promise<boolean> {
      (document.activeElement as HTMLElement)?.blur();
      const alert = await this.alertController.create({
        header,
        message,
        backdropDismiss: false,
        buttons: [
          {
            text: cancelButtonText,
            role: 'cancel',
            cssClass: 'alert-button-cancel'
          },
          {
            text: okButtonText,
            role: 'confirm',
            cssClass: 'alert-button-ok'
          }
        ],
        cssClass: 'custom-alert-card'
      });
    
      await alert.present();
      const { role } = await alert.onDidDismiss();
      return role === 'confirm';
    }

    

  async showToast(message: string) {
    (document.activeElement as HTMLElement)?.blur();
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom'
    });
    await toast.present();
  }

  async createLoader(message: string): Promise<HTMLIonLoadingElement> {
    return await this.loadingCtrl.create({ 
      message,
      cssClass: 'my-loading',
      showBackdrop: true,       // (por defecto true)
      backdropDismiss: false
     });
  }

  validateEmail(email: string): boolean {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  }

  goToNew(route: string) {
    this.navCtrl.navigateRoot(route);
  }

  goBack(route: string) {
    this.navCtrl.navigateBack(route);
  }

  goForward(route: string) {
    this.navCtrl.navigateForward(route);
  }

  async createModal(component: any, componentProps?: any, cssClass?: string): Promise<HTMLIonModalElement> {

    (document.activeElement as HTMLElement)?.blur(); // 👈 remueve foco del botón actual
    return await this.modalCtrl.create({
      component,
      cssClass,
      componentProps,
      backdropDismiss: false,           // <- clave: deshabilita clic fuera         
    });
  }

  async createActionSheet(button1: any, button2?: any, button3?: any) {
    (document.activeElement as HTMLElement)?.blur();
    const buttons = [button1, button2, button3].filter(Boolean); // Elimina undefined
    return await this.actionSheetCtrl.create({ buttons });
  }

  latLngConverterSQL(locations: any[]) {
    return locations.map((location: any) => ({
      ...location,
      origin: { lat: location.origin_lat, lng: location.origin_lng },
      destination: { lat: location.destination_lat, lng: location.destination_lng }
    }));
  }

  async getCurrentLatLng() {
    this.resetCoordinates();
    
    // Solicitar permisos de ubicación (obligatorio en Android)
    try {
      const permissions = await Geolocation.checkPermissions();
      console.log('📋 Permisos de ubicación:', permissions);
      
      if (permissions.location !== 'granted') {
        console.log('🔐 Solicitando permisos de ubicación...');
        const requestResult = await Geolocation.requestPermissions();
        console.log('✅ Resultado de solicitud de permisos:', requestResult);
        
        if (requestResult.location !== 'granted') {
          throw new Error('Permiso de ubicación denegado');
        }
      }
      
      const position = await Geolocation.getCurrentPosition();
      this.coordinates = position.coords;
      console.log('Coordinates:', this.coordinates);
    } catch (error) {
      console.error('❌ Error obteniendo ubicación:', error);
      throw error;
    }
  }

  resetCoordinates() {
    this.coordinates = null;
    console.log('Coordinates reset');
  }

  getCoordinates() {
    return this.coordinates;
  }

  async getGooglePlaceAutoCompleteList(searchText: string, geolocation: any, country: string) {
    const service = new google.maps.places.AutocompleteService();
    return await new Promise((resolve) => {
      service.getPlacePredictions(
        {
          input: searchText,
          componentRestrictions: { country: country || environment.COUNTRY }
        },
        (predictions: any) => resolve(predictions)
      );
    });
  }

  async getGeoCodedAddress(lat: number, lng: number) {
    let block, street, building, country, full_address = '';

    const geocoder = new google.maps.Geocoder();
    const latlng = new google.maps.LatLng(lat, lng);
    const request = { location: latlng };

    await new Promise((resolve) => {
      geocoder.geocode(request, (results: any, status: any) => {
        if (status === google.maps.GeocoderStatus.OK && results?.length > 0) {
          const components = results[0].address_components;
          components.forEach((comp: any) => {
            const types = comp.types;
            if (types.includes('route')) full_address += ` ${comp.short_name}`;
            if (types.includes('sublocality')) full_address += ` ${comp.short_name}`;
            if (types.includes('locality')) full_address += ` ${comp.short_name}`;
            if (types.includes('country')) {
              country = comp.short_name;
              environment.COUNTRY = country;
              full_address += `, ${country}`;
            }
            if (types.includes('postal_code')) full_address += ` ${comp.short_name}`;
          });

          block = components[0]?.long_name;
          building = components[1]?.short_name;
          street = components[2]?.short_name;
        }
        resolve(true);
      });
    });

    return { block, street, building, country, full_address };
  }
}
