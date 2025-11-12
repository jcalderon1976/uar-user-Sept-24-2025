import { Component, ElementRef, HostBinding, OnInit, ViewChild } from '@angular/core';
import { RideService } from '../../services/ride/ride.service';
import { ActivatedRoute, Router } from '@angular/router';
import { InitUserProvider } from '../../services/inituser/inituser.service';
import { APIService } from '../../services/api/api.service';
import { Ride } from '../../models/ride';
import { environment } from '../../../environments/environment';
import { UtilService } from '../../services/util/util.service';
import {  GoogleMap,  MapDirectionsRenderer,  MapDirectionsService,  MapInfoWindow,  MapMarker,} from '@angular/google-maps';
import { GmapService } from 'src/app/services/gmap/gmap.service';
import { map, Observable, Subscription, Subject } from 'rxjs';
import { ModalController, NavController } from '@ionic/angular';
import { TrackService } from 'src/app/services/track/track.service';
import { Driver } from 'src/app/models/driver';
import { Storage } from '@ionic/storage-angular';
import { first } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { take } from 'rxjs/operators';
import { AppStorage } from '../../services/api/app-storage.service';

declare var google: any;

@Component({
  selector: 'app-pickup',
  templateUrl: './pickup.page.html',
  styleUrls: ['./pickup.page.scss'],
  standalone: false,
})
export class PickupPage implements OnInit {
  @ViewChild(GoogleMap) googleMap!: GoogleMap; // ✅ Ensure ViewChild is used properly
  @ViewChild('toolbar', { read: ElementRef }) toolbarRef!: ElementRef;
  imageUrl: string =  'https://firebasestorage.googleapis.com/v0/b/uar-platform.firebasestorage.app/o/photos%2FuserDefault.png?alt=media&token=ef06263c-9e2a-4e6d-9198-1898fd5c19df'; // ✅ Ahora ya puedes usarla en el HTML

  requestId?: string;
  public count = 0;
  public zoom = 8;
  public screenOptions!: google.maps.MapOptions;
  public rideId!: any;
  public driverId!: any;
  public listenerId!: any;
  public origin: { lat: any; lng: any } = { lat: null, lng: null };
  public destination: { lat: any; lng: any } = { lat: null, lng: null };
  public locationPointOriginAddress: string = '../../../assets/images/location2.png';
  public locationPointDestinationAddress: string = '../../../assets/images/pin.png';
  //Variables
  directionsResults$: Observable<google.maps.DirectionsResult | undefined> =
    new Observable<google.maps.DirectionsResult | undefined>();
  position!: google.maps.LatLngLiteral;
  center!: google.maps.LatLngLiteral;
  options: google.maps.MapOptions = {
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    styles: environment.MAP_STYLE,
    disableDoubleClickZoom: true,
    maxZoom: 25,
    disableDefaultUI: true,
  };
  public orderId!: any;
  public rating = 3; // Calificación dinámica (de 1 a 5)
  trackSub!: Subscription;
  source: any = {}; // { lat: 18.3916667, lng: -66.1155749 }; //
  dest: any = {}; // { lat: 18.4078943, lng: -66.1084666 }; //
  driverLocation: any = {}; //= { lat: 18.3916667, lng: -66.1155749 };  // ✅ Driver's starting position
  public driverAcepted: boolean = false;
  private destroy$ = new Subject<void>();

  map!: google.maps.Map;
  markers: google.maps.Marker[] = [];
  towTruckMarker!: google.maps.Marker; // ✅ Store tow truck marker
  originMarker!: google.maps.Marker; // ✅ Store tow truck marker
  public oldPosition!: google.maps.LatLngLiteral; // Store the previous position
  public driverInfo!: Driver;
  isDetailsExpanded = true;

  @HostBinding('class.details-collapsed')
  get detailsCollapsedClass(): boolean {
    return !this.isDetailsExpanded;
  }

  constructor(
    public  rideService: RideService,
    private userProvider: InitUserProvider,
    private mapDirectionsService: MapDirectionsService,
    private maps: GmapService,
    private api: APIService,
    private modalCtrl: ModalController,
    private util: UtilService,
    private storage: Storage ,
    private track: TrackService,
    private route: ActivatedRoute, 
    private router: Router,
    private http: HttpClient,
    private store: AppStorage
  ) {}


  async ionViewWillEnter() {
    /* // a) leer una sola vez
    this.route.queryParamMap.pipe(take(1)).subscribe(params => {
      this.requestId = params.get('requestId') ?? undefined;
      // tu lógica con requestId...
    });

    // Si usaste NavigationExtras.state en lugar de query params:
    const nav = this.router.getCurrentNavigation();
    const fromState = nav?.extras?.state as { requestId?: string } | undefined;
    if (!this.requestId && fromState?.requestId) {
      this.requestId = fromState.requestId;
    } */

  }

  toggleDetails(): void {
    this.isDetailsExpanded = !this.isDetailsExpanded;
  }


  async ngOnInit() {
      // Verificar si viene de PlaceToPay con parámetros
      this.route.queryParams.subscribe(params => {
        if (params['paymentStatus']) {
          console.log('🎉 Retorno de PlaceToPay - Estado:', params['paymentStatus']);
          console.log('📝 Request ID:', params['requestId']);
          
          // Mostrar mensaje según el estado
          if (params['paymentStatus'] === 'success') {
            this.util.showToast('✅ Pago completado exitosamente');
          } else if (params['paymentStatus'] === 'pending') {
            this.util.showToast('⏳ Pago pendiente de confirmación');
          }
          
          // Limpiar los parámetros de la URL
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true
          });
        }
      });

      await this.calculateRoute();
      this.imageUrl = this.rideService.driverInfo.profile_img?.toString() || this.imageUrl; // Si no hay imagen, usa la imagen por defecto
  }

  ngAfterViewInit() {
    /* setTimeout(() => {
      if (this.googleMap && this.googleMap.googleMap) {
        this.map = this.googleMap.googleMap; // ✅ Correct way to access the Google Map instance
      }
    }, 300); // Small delay to ensure map is initialized
 */
  
  }

   async calculateRoute() {
    
    //Recuperamos el RideId
    this.rideId = await this.userProvider.getRideId();
    console.log('rideId => ' + this.rideId);

      //We need to check if rideId is null. Because maybe is comming from P2P.
      if(this.rideId)
      {
            const p2pState = await this.store.get('p2p_state');
            console.log('P2P State:', p2pState);

              if (p2pState) {
                console.log('Reference:', p2pState.reference);
                console.log('Amount:', p2pState.amount);
                console.log('Payment Method:', p2pState.paymentMethod);
                console.log('Origin:', p2pState.origin);
                console.log('Logged In User:', p2pState.loggedInUser);
                console.log('Timestamp:', p2pState.timestamp);
                this.rideId = p2pState.loggedInUser.rideId;
               } 
               else{
                console.log('No P2P state found in storage.');
               }
            
              
              this.userProvider.setRideId(this.rideId);
        this.api.getRide(this.rideId).pipe(first()).subscribe(async ride => {

                if (p2pState) {
                  ride.paymentMethod = p2pState.paymentMethod;
                }
                else{
                  ride.paymentMethod = 'cash';
                }
                ride.id = this.rideId;
                Object.assign(this.rideService.rideInfo, ride);
                
                //graba los cambio en la base de datos
                await this.rideService.setRideInfo(ride).then(async result => {
                  this.rideService.destinationAddress = ride.destination_address; 
                  this.api.updateRideData(this.rideId, ride);
        
                  this.rideService.origin = this.rideService.origin ?? {
                    lat: Number(ride.origin_lat),
                    lng: Number(ride.origin_lng),
                  }; 
                
                  this.rideService.destination = this.rideService.destination ?? {
                    lat: Number(ride.destination_lat),
                    lng: Number(ride.destination_lng),
                  };

                  this.center = {
                    lat: ride.origin_lat,
                    lng: ride.origin_lng,
                  };
                  this.setRideStatusListener();

                  //Get the driver Location
                  this.driverId = ride['driverId'];

                  if(this.driverId != null && this.driverId != undefined){
                      await this.api.getDriver(this.driverId).subscribe(
                              async driver => {
                                  this.rideService.driverInfo.car_brand = driver.car.make?.toString();
                                  this.rideService.driverInfo.car_model = driver.car.model?.toString();
                                  this.rideService.driverInfo.car_color = driver.car.color?.toString();
                                  this.rideService.driverInfo.car_license_plate = driver.car.plate_number?.toString();
                                  this.imageUrl = driver.profile_img?.toString() || this.imageUrl; // Si no hay imagen, usa la imagen por defecto
                              },
                              err => console.log(err)
                            );
                  } 
                });
                

              });
      }
      else{
        //We need to find the rideId.
      }


    
  }

  // ✅ Function to update marker position (Real-time update)
  updateDriverLocation(newLocation: { lat: number; lng: number }) {
    if (this.towTruckMarker) {
      this.towTruckMarker.setPosition(
        new google.maps.LatLng(newLocation.lat, newLocation.lng)
      );
          this.googleMap.googleMap?.panTo(newLocation); // Smooth pan
    }
  }

  setRideStatusListener() {
    this.listenerId = setInterval(() => {
      this.checkRideStatus();
    }, 1000);
    console.log(
      '>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>setInterval(7000) SET RIDE STATUS LISTENER this.listenerId = ' +
        this.listenerId +
        '<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<'
    );
  }

  clearRideStatusListener() {
    console.log(
      '*************CLEAR LISTENER PICKUP ***************************this.listenerId=>' +
        this.listenerId
    );
    clearInterval(this.listenerId);
    this.listenerId = null;
  }

  async checkRideStatus() {
    console.log('status check.....');
    const user = this.userProvider.getUserData();
    console.log('user->');
    console.dir(user);

    if (user.rideId) {
      this.api.getRide(user.rideId).subscribe(async (ride: Ride) => {
        console.log('api.getRide count' + this.count);
        this.count++;

        Object.assign(this.rideService.rideInfo, ride);
        if (ride['ride_completed'] && this.listenerId) {

          console.log('ride_completed');
          this.clearRideStatusListener();
          this.showCompletedRideAlert();
          this.router.navigate(['/tabs/tab1']);

        } else if (ride['driver_rejected'] && this.listenerId) {

          console.log('driver_rejected');
          this.clearRideStatusListener();
          this.showDriverRejectedAlert();
          this.router.navigate(['/tabs/tab1']);

        } else if (ride['ride_started'] && this.listenerId) {

          console.log('ride started'); //start the ride to destination
          //change the route for the ride route
          await this.fetchRouteInMapRide(this.rideService.rideInfo);
        
        } else if (ride['ride_accepted'] && this.listenerId) {
        
          console.log('ride accepted'); // Driver came to pickup the user
          //Get the driver Location
          this.driverId = ride['driverId'];

           if(this.driverId != null && this.driverId != undefined){
              await this.api.getDriver(this.driverId).subscribe(
                      async driver => {
                         this.imageUrl = driver.profile_img?.toString() || this.imageUrl; // Si no hay imagen, usa la imagen por defecto
                      },
                      err => console.log(err)
                    );
          } 
         
          await this.fetchRouteInMapDriver(this.driverId);
        } else {
          console.log('waiting for response from driver'); // TODO
        }
      });
    }
  }

  cancelRide() {
    this.showUserCanceledRideAlert();
  }

  async showDriverRejectedAlert() {
    this.util
      .presentAlert('Sorry!', environment.DRIVER_REJECTED_MSG, 'OK')
      .then(() => {
        this.rideService.resetRideSettings();
       this.router.navigate(['/tabs/tab1']);
      });
  }

  async showCompletedRideAlert() {
    this.util
      .presentAlert(
        'Servicio fue completado Satifactoriamente!',
        environment.RIDE_COMPLETED_MSG,
        'OK'
      )
      .then(() => {
        this.rideService.resetRideSettings();
       this.router.navigate(['/tabs/tab1']);
      });
  }

  async showUserCanceledRideAlert() {
    this.util
      .presentAlert('Cancel Ride ?', environment.USER_CANCEL_MSG, 'OK')
      .then(() => {
        if (this.rideId == null || this.rideId.length == 0)
          this.rideId = this.userProvider.getRideId().toString();

          this.api.setRideRejected(this.rideId).subscribe(
              (res) => {
                this.clearRideStatusListener();
                this.rideService.resetRideSettings();
                this.router.navigate(['/tabs/tab1']);
              },
              (err) => console.log(err)
            );
      });
  }

  getStars(): boolean[] {
    // Genera un arreglo de booleanos: true para estrellas llenas, false para vacías
    return Array(5)
      .fill(false)
      .map((_, index) => index < this.rating);
  }

  stars(number: number): any[] {
    return Array(number).fill(0);
  }

  ionViewWillLeave() {
    this.clearRideStatusListener();
  }

  ngOnDestroy(): void {
    // Emitir valor para romper todas las suscripciones
    this.destroy$.next();
    this.destroy$.complete();
    if (this.trackSub) this.trackSub.unsubscribe();
  }

  async fetchRouteInMapDriver(driverId: string) {
    //Get the driver Location
    this.driverId = driverId;

    await this.rideService
      .getDriverLocation(this.driverId)
      .then((driver: Driver) => {

        if (driver.location_lat != null && driver.location_lng != null) {
        //Fetch the Route from Google Directions API ,The origin (start), destination, and travel mode are defined.
        const request: google.maps.DirectionsRequest = {
          origin: { lat: driver.location_lat, lng: driver.location_lng },
          destination: {
            lat: this.rideService.origin.lat,
            lng: this.rideService.origin.lng,
          },
          travelMode: google.maps.TravelMode.DRIVING,
        };

        //Google's route() function processes the request.
        this.directionsResults$ = this.mapDirectionsService.route(request).pipe(
          map((response) => {
            const leg = response?.result?.routes?.[0]?.legs?.[0];

            if (response.result && leg) {
              this.addCustomMarkers(
                response?.result?.routes?.[0]?.legs?.[0],
                true,
                driver.location_lat,
                driver.location_lng
              ); //Add Custom Icons
              this.getTimer(response);
              this.fitMapToBounds(response.result.routes?.[0]);

              return response.result;
            } else {
              return;
            }
          })
        );
      }

        //this.updateDriverLocation( this.driverLocation); //Mark the Driver Icon
      });
  }

  async fetchRouteInMapRide(rideInfo: Ride) {
    await this.util.getCurrentLatLng();
    const result = this.util.getCoordinates();
    if (result) {
      rideInfo.origin_lat = result.latitude;
      rideInfo.origin_lng = result.longitude;
    } else {
      console.error('Failed to get coordinates');
      return;
    }

    //Fetch the Route from Google Directions API ,The origin (start), destination, and travel mode are defined.
    const request: google.maps.DirectionsRequest = {
      origin: { lat: rideInfo.origin_lat, lng: rideInfo.origin_lng },
      destination: {
        lat: rideInfo.destination_lat,
        lng: rideInfo.destination_lng,
      },
      travelMode: google.maps.TravelMode.DRIVING,
    };

    //Google's route() function processes the request.
    this.directionsResults$ = this.mapDirectionsService.route(request).pipe(
      map((response) => {
        if (response.result) {
          const route = response.result.routes?.[0];
          const leg = route?.legs?.[0];
          if (leg) {
            this.addCustomMarkers(
              leg,
              false,
              rideInfo.origin_lat,
              rideInfo.origin_lng
            ); //Add Custom Icons
            this.getTimer(response);
            this.fitMapToBounds(route);
          }
        }
        return response.result;
      })
    );
  }

  private getTimer(response: any) {
    this.rideService.tripDistance =
      response.result.routes[0].legs[0].distance.text;
    this.rideService.waitingTime =
      response.result.routes[0].legs[0].duration.text;
  }

  addCustomMarkers(routeLeg: any, isDriver: boolean, lat: any, lnt: any) {
    if (!this.googleMap || !this.googleMap.googleMap) {
      console.error('Google Map instance is not available');
      return;
    }

    const mapInstance = this.googleMap.googleMap;

    // Clear old markers
    this.markers.forEach((marker) => marker.setMap(null));
    this.markers = [];

    // ✅ Tow Truck Marker (Dynamic)
    this.towTruckMarker = new google.maps.Marker({
      position: routeLeg.start_location, // Start at the first location
      map: mapInstance,
      icon: {
        url: this.updateMarker(lat, lnt), //'../../assets/images/towTruck.png',  // 🛠 Replace with tow truck icon
        scaledSize: new google.maps.Size(50, 50),
      },
    });

    // ✅ End Marker (Destination Pin)
    this.originMarker = new google.maps.Marker({
      position: routeLeg.end_location,
      map: mapInstance,
      icon: {
        url: isDriver
          ? '../../assets/images/location2.png'
          : '../../assets/images/pin.png', // 🛠 Replace with actual destination icon
        scaledSize: new google.maps.Size(40, 40),
      },
    });

    // ✅ Add markers to map
    this.markers.push(this.towTruckMarker, this.originMarker);
  }

  updateMarker(newLat: any, newLng: any): string {
    let newPosition = new google.maps.LatLng(newLat, newLng);
    let direction:
      | 'NorthEast'
      | 'NorthWest'
      | 'SouthEast'
      | 'SouthWest'
      | 'default' = 'default';
    if (this.oldPosition) {
      direction = this.getDirection(this.oldPosition, newPosition);
      console.log('Moving:', direction);
    }
    this.oldPosition = newPosition; // Store the new position for next comparison
    const validDirections = [
      'NorthEast',
      'NorthWest',
      'SouthEast',
      'SouthWest',
      'default',
    ] as const;
    const validDirection = validDirections.includes(direction)
      ? direction
      : 'default';
    return this.getMarkerIcon(validDirection);
  }

  getDirection(oldPos: any, newPos: any) {
    let latDiff = newPos.lat() - oldPos.lat();
    let lngDiff = newPos.lng() - oldPos.lng();

    if (Math.abs(latDiff) > Math.abs(lngDiff)) {
      if (latDiff > 0) {
        //north
        return lngDiff > 0 ? 'NorthEast' : 'NorthWest';
      } //South
      else {
        return lngDiff > 0 ? 'SouthEast' : 'SouthWest';
      }
    } else {
      return lngDiff > 0 ? 'SouthEast' : 'SouthWest';
    }
  }

  getMarkerIcon(
    direction: 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest' | 'default'
  ) {
    const icons = {
      NorthEast: '../../assets/images/towTruck-NorthEast.png',
      NorthWest: '../../assets/images/towTruck-NorthWest.png',
      SouthEast: '../../assets/images/towTruck-SouthEast.png',
      SouthWest: '../../assets/images/towTruck-SouthWest.png',
      default: './../assets/images/towTruck.png',
    };

    return icons[direction];
  }

  callDriver(){

  }

  messageDriver(){

  }

  private fitMapToBounds(route?: google.maps.DirectionsRoute) {
    if (!route || !this.googleMap?.googleMap) {
      return;
    }

    const bounds = new google.maps.LatLngBounds();

    route.legs?.forEach((leg) => {
      bounds.extend(leg.start_location);
      bounds.extend(leg.end_location);

      leg.steps?.forEach((step) => {
        step.path?.forEach((point) => bounds.extend(point));
      });
    });

    this.googleMap.googleMap.fitBounds(bounds, {
      top: 60,
      bottom: 220,
      left: 60,
      right: 60,
    });
  }

}

