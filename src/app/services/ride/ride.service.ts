import { Injectable, NgZone } from '@angular/core';
import { Observable ,BehaviorSubject, from  } from 'rxjs';
import { Timestamp } from '@angular/fire/firestore';
import { HttpClient } from '@angular/common/http';
import { APIService } from '../api/api.service';
import { environment } from '../../../environments/environment';
import { UtilService } from '../util/util.service';
import { PaypalService } from '../api/paypal.service';
import { InitUserProvider } from '../inituser/inituser.service';
import { Driver } from '../../models/driver';
import { User } from '../../models/user';
import { Ride } from '../../models/ride';
import { GmapService } from 'src/app/services/gmap/gmap.service';
import { Capacitor } from '@capacitor/core';
import { AppStorage } from '../../services/api/app-storage.service';
import { PlacetoPayService } from '../../services/api/placetopay.service';
import { P2pTrans} from '../../models/p2pTrans'

interface GeocodeResponse {  results: { formatted_address: string }[]; }
declare let google: any;
@Injectable({  providedIn: 'root'})



export class RideService {
  public zoom = 15;
  public originAddress: string = '';
  public destinationAddress: string = '';
  public tripDistance!: number;
  public waitingTime!: string;
  public createdAt: any;
  public duration: any;
  public DefaultPaymentMethod: boolean = false;
  public locatedCountry = environment.COUNTRY;
  public locationType = 'pickup';
  public origin: any;
  public destination: any;
  public direction_lat: any; // TODO
  public direction_lng: any; // TODO
  public fare = 0;
  public subtotal = 0;
  public iva = 0;
  public totalFee = 0;
  public base = environment.BASE_FEE;
  public ivaFee = environment.IVA_FEE;
  public farePerKm = environment.FEE;
  public timePerKm = 5;
  public driverInfo: Driver;
  public rideInfo: Ride;
  public markerOptions = environment.MARKER_OPTIONS;
  public renderOptions = environment.RENDER_OPTIONS;
  public screenOptions = environment.SCREEN_OPTIONS;
  public taxiType: string;
  public carImage: string;
  public mapStyle = environment.MAP_STYLE;
  public key = environment.GOOGLE_MAPS_API_KEY;
  public path: any;
  public directionsResults$: Observable<google.maps.DirectionsResult | undefined> = new Observable();
  public lat: number = 0;
  public lng: number = 0;
  public center: google.maps.LatLngLiteral = { lat: 0, lng: 0 };
  public options: google.maps.MapOptions = {
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    styles: environment.MAP_STYLE,
    disableDoubleClickZoom: true,
    maxZoom: this.zoom,
    disableDefaultUI: true,
  };
  public PayPalPaymentMethod = false;
  public orderId!: string;
  public markers: Array<{ lat: number; lng: number;  draggable: boolean; position: google.maps.LatLngLiteral; title: string; icon: { url: string; scaledSize: google.maps.Size ; labelOrigin: google.maps.Point; }; options: { animation: google.maps.Animation; }; }> = [];
  public SelectRide: boolean = true;
  public confirm: boolean = false;
  public RequestRide: boolean = false;
  public PaymentMethod: boolean = false;
  sourceIconUrl = 'assets/images/location3.png';
  defaultUserImageUrl = 'assets/images/userDefault.png';
  sourceLocationSearch!: string;
  transaction!:P2pTrans;
  public loggedInUser!: User;

  constructor(
    private api: APIService,
    private __zone: NgZone,
    private http: HttpClient,
    private util: UtilService,
    public userProvider: InitUserProvider,
    private paypalService: PaypalService,
    private maps: GmapService,
    private p2p: PlacetoPayService,
    private store: AppStorage
    
  ) {
    this.taxiType = "tow";
    this.carImage = "../../assets/images/towTruck.png";
    this.driverInfo = {
      id: 0,
      token: '',
      email: '',
      password: '',
      approved: false,
      available: false,
      location_lat: 0,
      location_lng: 0,
      dob: '',
      gender: '',
      name: '',
      phone: '',
      profile_img: '',
      car_model: '',
      car_brand: '',
      car_year: 1940,
      car_color: '',
      car_license_plate: '',
    };
    this.rideInfo = {
      id: '',
      origin_lat: 0,
      origin_lng: 0,
      origin_address: null,
      destination_lat: 0,
      destination_lng: 0,
      destination_address: '', // fixed typo here
      distance: 0,
      waitingTime: null,
      fare: 0,
      totalFare: 0,
      clientId: '',
      driverId: '',
      driver_rejected: false,
      ride_started: false,
      ride_accepted: false,
      user_rejected: false,
      ride_completed: false,
      request_timeout: false,
      createdAt: Timestamp.fromDate(new Date()), // or any valid Timestamp value
      paymentMethod: '',
      tow_type: '',
      requestId: ''
    };
    
  }

  initializeDirectionsService() {
    google = new google.maps.DirectionsService(); 
  }

 
  async resetRideSettings() {
    
    if (Capacitor.isNativePlatform()) {
      localStorage.clear();
      sessionStorage.clear();
      caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }

    this.sourceLocationSearch = this.locationType === 'pickup' ? this.originAddress  : this.destinationAddress;
    this.locationType = 'pickup';
    this.destinationAddress = '';
    this.destination = null;
    this.directionsResults$ = new Observable<google.maps.DirectionsResult | undefined>();
    this.RequestRide = false;
    this.PaymentMethod = false;
    this.SelectRide = true;
    this.confirm = false;
    this.PayPalPaymentMethod = false;
    this.orderId = '';
    this.setTripDistance(0);
       

    const p2pState = await this.store.get('p2p_state');
    console.log('P2P State:', p2pState);

    if (p2pState) //Si tiene valor, viene de una cancelacion del P2P 
    {
        //hacer un refund de la transaccion de P2P
         this.p2p.reverseTransaction(p2pState.requestId);
         await this.store.remove('p2p_state');
    }

    await this.userProvider.clearRideId();
    this.loggedInUser = this.userProvider.getUserData();
    //let googleMaps: any = await this.maps.loadGoogleMaps();
    //const loader = await this.util.createLoader('Getting your location..');
   // await loader.present();

    try {
      await this.util.getCurrentLatLng().then(async ()=>{

        const result = await this.util.getCoordinates() ;

        if (result) {
          this.lat = result.latitude;
          this.lng = result.longitude;
          this.center = {
            lat: result.latitude,
            lng: result.longitude,
          };
          
          // Crear marcador personalizado con foto del usuario
          // Asegurarse de que loggedInUser esté disponible
          if (!this.loggedInUser) {
            this.loggedInUser = this.userProvider.getUserData();
          }
          // Intentar usar la imagen guardada en memoria primero, luego la URL original
          const imageInMemory = this.userProvider.getUserProfileImageUrl();
          const userImageUrl = imageInMemory || this.loggedInUser?.profile_img || null;
          console.log('👤 Usuario actual:', this.loggedInUser?.name, 'Imagen en memoria:', imageInMemory ? '✅' : '❌', 'Imagen URL:', this.loggedInUser?.profile_img);
          const customIconUrl = await this.createCustomMarkerIcon(userImageUrl);
          
          this.markers = [{
            lat:  result.latitude,
            lng:  result.longitude,
            draggable: true,
            position: this.center,
            title: "test title",
            options: { animation: google.maps.Animation.DROP },
            icon: {
              url: customIconUrl,
              scaledSize: new google.maps.Size(50, 50), // scaled size
              labelOrigin: new google.maps.Point(25, 60)
            } 
          }];
          this.zoom = 20;
          this.options = {
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            styles: environment.MAP_STYLE,
            disableDoubleClickZoom: true,
            maxZoom: this.zoom,
            disableDefaultUI: true,
            fullscreenControl: false,
            streetViewControl: false,
            mapTypeControl: false,
          };

      } else {
        throw new Error('Failed to get coordinates');
      }
      });
      

      await this.setAddress({ lat: this.lat, lng: this.lng }, this.locationType);
      this.locationType = 'destination';
      this.updateUserLocation(this.loggedInUser.id, this.lat, this.lng);

    } catch (error) {
      console.error('Error getting current location:', error);
    } finally {
      //loader.dismiss();
      (document.activeElement as HTMLElement)?.blur(); // 👈 evita el warning
    }


   
  }

 async resetDriverOnRide(){
  this.rideInfo.driverId =  '';
  this.rideInfo.ride_accepted = false;
  this.rideInfo.ride_completed = false;
  this.rideInfo.ride_started = false;
  this.rideInfo.driver_rejected = false;
 
 }

  /**
   * Wrap the Google Maps geocoder in an Observable.
   */
  getLatLan(address: string): Observable<any> {
    const geocoder = new google.maps.Geocoder();
    return new Observable(observer => {
      geocoder.geocode({ address }, (results: google.maps.GeocoderResult[], status: google.maps.GeocoderStatus) => {
        if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
          observer.next(results[0].geometry.location);
          observer.complete();
        } else {
          console.error('Geocoding error:', status);
          observer.error(new Error("Geocoding failed with status: " + status));
        }
      });
    });
  }

  // Alternative versions using Promises (if needed)
  getOrigin2(rideInfo: any): Promise<any> {
    return new Promise(resolve => {
      this.http
        .get(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${rideInfo.origin.lat},${rideInfo.origin.lng}&key=${this.key}`)
        .subscribe(res => {
          resolve(res);
        });
    });
  }

  /**
   * Get the origin address via Google Geocoding API.
   * Returns an Observable for consistency.
   */
  getOrigin(rideInfo: any): Observable<GeocodeResponse> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${rideInfo.origin_lat},${rideInfo.origin_lng}&key=${this.key}`;
    return this.http.get<GeocodeResponse>(url);
  }

  getDestination2(rideInfo: any): Promise<any> {
    return new Promise(resolve => {
      this.http
        .get(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${rideInfo.destination.lat},${rideInfo.destination.lng}&key=${this.key}`)
        .subscribe(res => {
          resolve(res);
        });
    });
  }

  /**
   * Get the destination address via Google Geocoding API.
   * Returns an Observable.
   */
  getDestination(rideInfo: any): Observable<GeocodeResponse> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${rideInfo.destination_lat},${rideInfo.destination_lng}&key=${this.key}`;
    return this.http.get<GeocodeResponse>(url);
  }

  async setRideInfo(ride: any) {
    
    this.rideInfo = {
      id: '',
      origin_lat: 0,
      origin_lng: 0,
      origin_address: null,
      destination_lat: 0,
      destination_lng: 0,
      destination_address: '',
      distance: 0,
      waitingTime: null,
      fare: 0,
      totalFare:0 ,
      clientId: '',
      driverId: '',
      driver_rejected: false,
      ride_started: false,
      ride_accepted: false,
      user_rejected: false,
      ride_completed: false,
      request_timeout: false,
      createdAt: Timestamp.fromDate(new Date()),
      paymentMethod: 'cash',
      tow_type: '',
      requestId: ''
    };
    
    Object.assign(this.rideInfo, ride);
    await this.setAddress({ lat: ride.origin_lat, lng: ride.origin_lng }, 'pickup');
    await this.setAddress({ lat: ride.destination_lat, lng: ride.destination_lng }, 'destination');
    await this.userProvider.setRideId(ride.id);
    
    this.center = {
      lat: ride.origin_lat,
      lng: ride.origin_lng,
    };
    
    // Crear marcador personalizado con foto del usuario
    // Asegurarse de que loggedInUser esté disponible
    if (!this.loggedInUser) {
      this.loggedInUser = this.userProvider.getUserData();
    }
    // Intentar usar la imagen guardada en memoria primero, luego la URL original
    const imageInMemory = this.userProvider.getUserProfileImageUrl();
    const userImageUrl = imageInMemory || this.loggedInUser?.profile_img || null;
    console.log('👤 Usuario actual (setRideInfo):', this.loggedInUser?.name, 'Imagen en memoria:', imageInMemory ? '✅' : '❌', 'Imagen URL:', this.loggedInUser?.profile_img);
    const customIconUrl = await this.createCustomMarkerIcon(userImageUrl);
    
    this.markers = [{
      lat: ride.origin_lat,
      lng: ride.origin_lng,
      
      draggable: true,
      position: this.center,
      title: "test title",
      icon: {
        url: customIconUrl,
        scaledSize: new google.maps.Size(40, 40),
        labelOrigin: new google.maps.Point(25, 60)
       },
      options: { animation: google.maps.Animation.BOUNCE }
    }];

    this.zoom = 20;
    this.options = {
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: environment.MAP_STYLE,
      disableDoubleClickZoom: true,
      maxZoom: this.zoom,
      disableDefaultUI: true,
    };
  }

  async setRideInfoBooking(ride: any) {
    Object.assign(this.rideInfo, ride);
    await this.setAddress({ lat: ride.origin_lat, lng: ride.origin_lng }, 'pickup');
    await this.setAddress({ lat: ride.destination_lat, lng: ride.destination_lng }, 'destination');
    await this.userProvider.setRideId(ride.id);
    if (ride.driverId) {
      this.api.getDriver(ride.driverId).subscribe(
        async driver => {
          Object.assign(this.driverInfo, driver);
        },
        err => console.log(err)
      );
    }
  }

  checkIfExistingRide(rideId: any) {
    this.api.getRide(rideId).subscribe(async ride => {
      console.log(ride);

      if (ride && !ride['ride_completed'] && !ride['driver_rejected'] && !ride['user_rejected'] && !ride['request_timeout']) {
      
      } else {
        console.log('clear', rideId);
        await this.userProvider.clearRideId();
      }
    }, err => console.log(err));
  }

  updateUserLocation(id: any, lat: number, lng: number) {
    this.api.updateUser(id, { location_lat: lat, location_lng: lng })
      .subscribe(
        res => console.log('location saved', res),
        err => console.log(err)
      );
  }

  async setAddress(location: { lat: number, lng: number }, locationType: string): Promise<string> {
    const address = await this.util.getGeoCodedAddress(location.lat, location.lng);
    if (locationType === 'pickup') {
      this.origin = location;
      this.originAddress = `${address.full_address}`;
      return this.originAddress;
    }
    if (locationType === 'destination') {
      this.destination = location;
      this.destinationAddress = `${address.full_address}`;
      return this.destinationAddress;
    }
    return '';
  }

  async selectTaxiType(name: string, image: string) {
    // Optionally warn if destination or origin is missing.
    this.taxiType = name;
    this.carImage = image; // Fixed: assign the provided image instead of reassigning this.carImage
    // To open a PaymentComponent modal, you might use:
    // const profileModal = await this.util.createModal(PaymentComponent, { taxiType: this.taxiType, carImage: this.carImage }, 'backTransparent');
    // await profileModal.present();
  }

  setTripDistance(distance: number) {
    this.tripDistance = distance; 
  }
  
  getFare(): number {
    return Math.round(this.tripDistance * this.farePerKm);
  }

  getTotalFare(): number{

        this.fare = this.round2(this.getFare());
        this.subtotal =  this.round2(this.fare + this.base);
        this.iva =  this.round2(this.subtotal * this.ivaFee);
        this.totalFee =  this.round2(this.subtotal + this.iva);
        return this.totalFee ;
  }

  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  getTripTime(): number {
    return Math.round(this.tripDistance) * this.timePerKm;
  }

  
  setPayPalMethod(payPalPaymentMethod: boolean) {
    this.PayPalPaymentMethod = payPalPaymentMethod;
  }

  getPayPalPaymentMethod(): boolean {
    return this.PayPalPaymentMethod;
  }

  setPaymentMethod(PaymentMethod: string) {
    
    this.rideInfo.paymentMethod = PaymentMethod;

    if (PaymentMethod === 'paypal') {
      this.setPayPalMethod(true);
    } else {
      this.setPayPalMethod(false);
    }
  }

  getPaymentMethod(): string {
    return this.PayPalPaymentMethod ? 'paypal' : '';
  }

 
  // Function to create the PayPal order (store orderId for later cancellation)
  PayPalcreateOrder(orderId: string): void {
    this.orderId = orderId;
    this.paypalService.setOrderId(orderId);
  }

  // Function to cancel the PayPal order
  async PayPalcancelOrder(orderId: string): Promise<void> {

    //const status = await this.verEstadoOrdenPayPal(orderId);
     // console.log('Estado de la orden:', status); 
       //if(status === 'APPROVED' || status === 'COMPLETED' || status === 'SAVED' ) {
       this.paypalService.cancelOrder(orderId);
     //  }
    
  }

      // Tipos de estados que puede tener una orden:
      // "CREATED"
      // "SAVED"
      // "APPROVED"
      // "VOIDED"
      // "COMPLETED"
      // "PAYER_ACTION_REQUIRED"
  verEstadoOrdenPayPal(orderId: string): string {
    let orderStatus = 'Unknown'; // Default value to ensure a return
    this.paypalService.getOrderDetails(orderId).subscribe({
      next: (data) => {
        console.log('🧾 Estado de la orden:', data);
        orderStatus = (data as any).status;
      },
      error: (err) => {
        console.error('❌ Error al consultar orden PayPal:', err);
        orderStatus = 'Error al consultar estado de la orden';
      }
    });
    return orderStatus; // Return the status
  }

  async getDriverLocation(driverId: string): Promise<Driver>
  {
    if (driverId) {
      await this.api.getDriver(driverId).subscribe(
          async driver => {
            
            Object.assign(this.driverInfo, driver);
            return this.driverInfo;
          },
          err => console.log(err)
        );

    }

    return this.driverInfo;
    
}

async clearRideInfoWhenUserCancel() {


}

/**
 * Crea un marcador personalizado combinando el pin location3.png con la foto del usuario
 * @param userImageUrl URL de la imagen del usuario (profile_img)
 * @returns Promise<string> URL de la imagen combinada (data URL)
 */
async createCustomMarkerIcon(userImageUrl?: string | null): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Primero intentar usar la imagen guardada en memoria (evita problemas de CORS)
      const imageInMemory = this.userProvider.getUserProfileImageUrl();
      if (imageInMemory) {
        console.log('✅ Usando imagen del usuario guardada en memoria (sin problemas de CORS)');
        userImageUrl = imageInMemory;
      } else if (!userImageUrl && this.loggedInUser?.profile_img) {
        // Si no hay imagen en memoria pero hay una URL de perfil, usar esa
        userImageUrl = this.loggedInUser.profile_img;
        console.log('📷 Usando URL de perfil del usuario directamente:', userImageUrl);
      }
      
      // Si estamos en desarrollo web y no hay imagen en memoria, y la URL es de Firebase Storage,
      // intentar usar la URL original (puede fallar por CORS, pero lo intentaremos)
      const isNative = Capacitor.isNativePlatform();
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isNative && isLocalhost && !imageInMemory && userImageUrl && 
          (userImageUrl.includes('firebasestorage.googleapis.com') || userImageUrl.includes('firebase'))) {
        console.log('⚠️ Desarrollo web detectado sin imagen en memoria');
        console.log('⚠️ Intentando usar URL de Firebase directamente (puede fallar por CORS en canvas)');
        // NO forzar null aquí - intentar usar la URL original
        // Si falla, el código manejará el error y usará la imagen por defecto
      }
      
      // Si no hay imagen de usuario, intentar usar la imagen por defecto
      if (!userImageUrl || userImageUrl === '') {
        console.log('📍 No hay imagen de usuario, intentando usar imagen por defecto');
        // Intentar crear marcador con imagen por defecto
        const pinImage = new Image();
        const defaultImage = new Image();
        
        let pinLoaded = false;
        let defaultLoaded = false;
        
        const createWithDefault = () => {
          if (pinLoaded && defaultLoaded) {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              if (!ctx) {
                resolve(this.sourceIconUrl);
                return;
              }
              
              const markerSize = 50;
              canvas.width = markerSize;
              canvas.height = markerSize;
              
              ctx.drawImage(pinImage, 0, 0, markerSize, markerSize);
              
              const photoSize = markerSize * 0.45;
              const photoX = (markerSize - photoSize) / 2;
              const photoY = markerSize * 0.12;
              
              ctx.save();
              ctx.beginPath();
              ctx.arc(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
              ctx.clip();
              ctx.drawImage(defaultImage, photoX, photoY, photoSize, photoSize);
              ctx.restore();
              
              resolve(canvas.toDataURL('image/png'));
            } catch (error) {
              console.error('❌ Error creando marcador con imagen por defecto:', error);
              resolve(this.sourceIconUrl);
            }
          }
        };
        
        const pinPath = this.sourceIconUrl.startsWith('http') 
          ? this.sourceIconUrl 
          : `${window.location.origin}/${this.sourceIconUrl}`;
        
        pinImage.onload = () => {
          pinLoaded = true;
          createWithDefault();
        };
        pinImage.onerror = () => resolve(this.sourceIconUrl);
        pinImage.src = pinPath;
        
        const defaultPath = this.defaultUserImageUrl.startsWith('http') 
          ? this.defaultUserImageUrl 
          : `${window.location.origin}/${this.defaultUserImageUrl}`;
        
        defaultImage.onload = () => {
          defaultLoaded = true;
          createWithDefault();
        };
        defaultImage.onerror = () => resolve(this.sourceIconUrl);
        defaultImage.src = defaultPath;
        
        return;
      }

      console.log('🖼️ Creando marcador personalizado con imagen:', userImageUrl);

      const pinImage = new Image();
      const userImage = new Image();
      
      // Verificar si es un blob URL (imagen en memoria)
      const isBlobUrl = userImageUrl.startsWith('blob:');
      
      // IMPORTANTE: Establecer crossOrigin solo para URLs HTTP/HTTPS (no para blob URLs)
      // Los blob URLs son locales y no requieren crossOrigin
      if (!isBlobUrl && (userImageUrl.startsWith('http://') || userImageUrl.startsWith('https://'))) {
        userImage.crossOrigin = 'anonymous';
      }
      
      // Para el pin local, también establecer crossOrigin si es necesario
      if (this.sourceIconUrl.startsWith('http://') || this.sourceIconUrl.startsWith('https://')) {
        pinImage.crossOrigin = 'anonymous';
      }

      let pinLoaded = false;
      let userLoaded = false;
      let userImageFailed = false;
      let defaultImageLoaded = false;
      const defaultImage = new Image();

      const checkAndCreate = () => {
        if (pinLoaded && (userLoaded || userImageFailed || defaultImageLoaded)) {
          try {
            // Crear canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              console.error('❌ No se pudo obtener el contexto del canvas');
              resolve(this.sourceIconUrl);
              return;
            }

            // Tamaño del marcador final
            const markerSize = 50;
            canvas.width = markerSize;
            canvas.height = markerSize;

            // Dibujar el pin de fondo
            ctx.drawImage(pinImage, 0, 0, markerSize, markerSize);

            // Calcular posición y tamaño de la foto dentro del pin
            const photoSize = markerSize * 0.45; // 45% del tamaño del pin
            const photoX = (markerSize - photoSize) / 2;
            const photoY = markerSize * 0.12; // Posición más arriba para el círculo del pin

            // Determinar qué imagen usar: la del usuario o la por defecto
            let imageToUse: HTMLImageElement | null = null;
            
            if (userLoaded && !userImageFailed && userImage.complete && userImage.naturalWidth > 0) {
              imageToUse = userImage;
              console.log('✅ Usando imagen del usuario');
            } else if (defaultImageLoaded && defaultImage.complete && defaultImage.naturalWidth > 0) {
              imageToUse = defaultImage;
              console.log('✅ Usando imagen por defecto (userDefault.png)');
            }

            // Si hay una imagen para usar, dibujarla
            if (imageToUse) {
              // Crear un círculo para recortar la foto
              ctx.save();
              ctx.beginPath();
              ctx.arc(
                photoX + photoSize / 2,
                photoY + photoSize / 2,
                photoSize / 2,
                0,
                Math.PI * 2
              );
              ctx.clip();

              // Dibujar la foto
              ctx.drawImage(imageToUse, photoX, photoY, photoSize, photoSize);
              ctx.restore();
              
              console.log('✅ Marcador personalizado creado exitosamente');
            } else {
              console.log('⚠️ No hay imagen disponible, usando solo el pin');
            }

            // Convertir canvas a data URL
            const dataUrl = canvas.toDataURL('image/png');
            resolve(dataUrl);
          } catch (error) {
            console.error('❌ Error creando marcador personalizado:', error);
            resolve(this.sourceIconUrl);
          }
        }
      };

      // Cargar imagen del pin
      pinImage.onload = () => {
        console.log('✅ Pin image cargado');
        pinLoaded = true;
        checkAndCreate();
      };
      pinImage.onerror = (error) => {
        console.error('❌ Error cargando pin image:', error);
        resolve(this.sourceIconUrl);
      };
      
      // Usar ruta absoluta para el pin
      const pinPath = this.sourceIconUrl.startsWith('http') 
        ? this.sourceIconUrl 
        : `${window.location.origin}/${this.sourceIconUrl}`;
      pinImage.src = pinPath;

      // Función para cargar la imagen por defecto
      const loadDefaultImage = () => {
        const defaultPath = this.defaultUserImageUrl.startsWith('http') 
          ? this.defaultUserImageUrl 
          : `${window.location.origin}/${this.defaultUserImageUrl}`;
        
        defaultImage.onload = () => {
          console.log('✅ Imagen por defecto cargada exitosamente');
          defaultImageLoaded = true;
          checkAndCreate();
        };
        
        defaultImage.onerror = (error) => {
          console.error('❌ Error cargando imagen por defecto:', error);
          console.warn('⚠️ Se mostrará solo el pin');
          checkAndCreate();
        };
        
        defaultImage.src = defaultPath;
      };

      // Cargar imagen del usuario
      // Si es un blob URL (imagen en memoria), cargarlo directamente sin crossOrigin
      if (isBlobUrl) {
        console.log('✅ Cargando imagen desde blob URL (imagen en memoria)');
        userImage.onload = () => {
          console.log('✅ User image cargada desde blob URL, dimensiones:', userImage.naturalWidth, 'x', userImage.naturalHeight);
          userLoaded = true;
          checkAndCreate();
        };
        userImage.onerror = (error) => {
          console.error('❌ Error cargando imagen desde blob URL:', error);
          console.warn('⚠️ Intentando cargar imagen por defecto...');
          userImageFailed = true;
          userLoaded = false;
          loadDefaultImage();
        };
        userImage.src = userImageUrl;
      } else if (userImageUrl.startsWith('http://') || userImageUrl.startsWith('https://')) {
        const isNative = Capacitor.isNativePlatform();
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // En desarrollo web con Firebase Storage, es probable que haya problemas de CORS
        // Intentar cargar, pero si falla rápidamente, usar el pin por defecto
        if (!isNative && isLocalhost && userImageUrl.includes('firebasestorage.googleapis.com')) {
          console.warn('⚠️ Desarrollo web detectado con Firebase Storage - puede haber problemas de CORS');
          console.warn('⚠️ En dispositivos nativos (Android/iOS) esto funcionará correctamente');
        }
        
        // Intentar cargar directamente primero (más rápido)
        userImage.crossOrigin = 'anonymous';
        
        userImage.onload = () => {
          console.log('✅ User image cargada directamente, dimensiones:', userImage.naturalWidth, 'x', userImage.naturalHeight);
          userLoaded = true;
          checkAndCreate();
        };
        
        userImage.onerror = () => {
          console.warn('⚠️ Error cargando imagen directamente (posible problema de CORS en desarrollo web)');
          console.warn('⚠️ Intentando con HttpClient como fallback...');
          
          // Si falla la carga directa, intentar con HttpClient como fallback
          // Verificar que userImageUrl no sea null o undefined
          if (!userImageUrl) {
            console.warn('⚠️ URL de imagen no válida, intentando cargar imagen por defecto...');
            userImageFailed = true;
            userLoaded = false;
            loadDefaultImage();
            return;
          }
          
          this.http.get(userImageUrl, { responseType: 'blob' }).subscribe({
            next: (blob) => {
              console.log('✅ Imagen obtenida como blob');
              const blobUrl = URL.createObjectURL(blob);
              
              // Crear nueva imagen para el blob
              const blobImage = new Image();
              blobImage.onload = () => {
                console.log('✅ User image cargada desde blob, dimensiones:', blobImage.naturalWidth, 'x', blobImage.naturalHeight);
                URL.revokeObjectURL(blobUrl);
                // Usar la imagen del blob
                userImage.src = blobUrl;
                userLoaded = true;
                checkAndCreate();
              };
              blobImage.onerror = () => {
                console.warn('⚠️ Error cargando imagen desde blob, intentando cargar imagen por defecto...');
                URL.revokeObjectURL(blobUrl);
                userImageFailed = true;
                userLoaded = false;
                // Intentar cargar la imagen por defecto
                loadDefaultImage();
              };
              blobImage.src = blobUrl;
            },
            error: (error) => {
              console.error('❌ Error obteniendo imagen con HttpClient:', error);
              if (error.status === 0) {
                console.warn('⚠️ Problema de CORS detectado - esto es normal en desarrollo web');
                console.warn('⚠️ En dispositivos nativos (Android/iOS) la imagen se cargará correctamente');
              }
              console.warn('⚠️ No se pudo cargar la imagen del usuario, intentando cargar imagen por defecto...');
              userImageFailed = true;
              userLoaded = false;
              // Intentar cargar la imagen por defecto
              loadDefaultImage();
            }
          });
        };
        
        userImage.src = userImageUrl;
      } else {
        // Para imágenes locales, cargar directamente
        userImage.onload = () => {
          console.log('✅ User image cargada (local), dimensiones:', userImage.naturalWidth, 'x', userImage.naturalHeight);
          userLoaded = true;
          checkAndCreate();
        };
        userImage.onerror = (error) => {
          console.error('❌ Error cargando imagen del usuario (local):', error);
          console.warn('⚠️ Intentando cargar imagen por defecto...');
          userImageFailed = true;
          userLoaded = false;
          // Intentar cargar la imagen por defecto
          loadDefaultImage();
        };
        userImage.src = userImageUrl;
      }
      
      // Timeout de seguridad (5 segundos)
      setTimeout(() => {
        if (!userLoaded && !userImageFailed && !defaultImageLoaded) {
          console.warn('⏱️ Timeout cargando imagen del usuario, intentando cargar imagen por defecto...');
          userImageFailed = true;
          loadDefaultImage();
        }
      }, 5000);
      
    } catch (error) {
      console.error('❌ Error en createCustomMarkerIcon:', error);
      resolve(this.sourceIconUrl);
    }
  });
}


}
