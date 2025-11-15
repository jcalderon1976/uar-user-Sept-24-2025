//CORE
import { Component, Input,  ViewChild, OnInit    } from '@angular/core';
import { IonSearchbar } from '@ionic/angular';
import { Router, ActivatedRoute } from '@angular/router';
import { GoogleMap, MapDirectionsRenderer, MapDirectionsService, MapInfoWindow  } from '@angular/google-maps';

import { map, Observable, Subject, first, interval, take, takeUntil } from 'rxjs';
import { environment } from '../../../environments/environment';
//MODEL
import { User } from '../../models/user';
import { Driver} from  '../../models/driver';
import { Ride } from 'src/app/models/ride';
//SERVICE
import { InitUserProvider } from '../../services/inituser/inituser.service';
import { APIService } from '../../services/api/api.service';
import { PlacetoPayService } from '../../services/api/placetopay.service';
import { RideService } from '../../services/ride/ride.service';
import { UtilService } from '../../services/util/util.service';
import { AppStorage } from '../../services/api/app-storage.service';

//Component
import { BookingConfirmationComponent } from '../../components/booking-confirmation/booking-confirmation.component';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-confirmRide',
  templateUrl: './confirmRide.page.html',
  styleUrls: ['./confirmRide.page.scss'],
  standalone: false,
})
export class confirmRidePage implements OnInit {
 
  @Input() country!: string;
  @ViewChild(GoogleMap, { static: false }) googlemap!: GoogleMap;
  @ViewChild(MapInfoWindow, { static: false }) info!: MapInfoWindow;
  @ViewChild('destinationSearchbar', { static: false }) searchbar!: IonSearchbar;
  @ViewChild(MapDirectionsRenderer) mapDirectionsRenderer!: MapDirectionsRenderer;
 
  private destroy$ = new Subject<void>();
  // Map and UI variables
  directionsResults$!: Observable<google.maps.DirectionsResult | undefined>;
  endLocation!: google.maps.LatLngLiteral;
  endIcon!: google.maps.Icon;
  zoom = 20;
  center!: google.maps.LatLngLiteral;
  options: google.maps.MapOptions = {
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    styles: environment.MAP_STYLE,
    disableDoubleClickZoom: true,
    maxZoom: this.zoom,
    disableDefaultUI: true
  };
  markers = [];
  public loggedInUser!: User;
  public rideDriver!: Driver;
  public locatedCountry!: string;
  public rideId!: any;
  ride!: Ride;
  secondsLeft = 10;
  private stop$ = new Subject<void>();

  directionsOpts: google.maps.DirectionsRendererOptions = {
    suppressMarkers: true,
    preserveViewport: true,
    polylineOptions: {
      strokeColor: '#111111',   // negro
      strokeOpacity: 1,
      strokeWeight: 6           // grosor
    }
  };


  constructor(
      public rideService: RideService,
      private userProvider: InitUserProvider,
      private mapDirectionsService: MapDirectionsService,
      private util: UtilService,
      private router: Router,
      private route: ActivatedRoute,
      private api: APIService,
      private p2p: PlacetoPayService,
      private store: AppStorage
    ) {   
      this.ride = {
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
        tow_type: ''
      };
       }

       ngOnInit() {
        // Verificar si viene de PlaceToPay con parámetros
        this.route.queryParams.subscribe(params => {
          if (params['paymentStatus']) {
            console.log('🎉 Retorno de PlaceToPay - Estado:', params['paymentStatus']);
            
            // Mostrar mensaje según el estado
            if (params['paymentStatus'] === 'cancelled') {
              this.util.showToast('❌ Pago cancelado');
            } else if (params['paymentStatus'] === 'rejected') {
              this.util.showToast('❌ Pago rechazado');
            }
            
            // Limpiar los parámetros de la URL
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: {},
              replaceUrl: true
            });
          }
        });
       }

       start() {
        this.stop();                    // por si estaba corriendo
        this.secondsLeft = 10;
        interval(1000).pipe(
          take(10),                     // 10 emisiones
          map(i => 9 - i),              // 9..0
          takeUntil(this.stop$)
        ).subscribe(v => this.secondsLeft = v);
      }
    
      stop() {
        this.stop$.next();
      }


  async ionViewWillEnter() {
        //instancio el objecto del usuario.
        this.loggedInUser = this.userProvider.getUserData();
        const rideId = this.loggedInUser?.rideId; // puede ser string | null | undefined
        
        //Si viene nulo es por que no hay un request del ride , es nuevo
        if (rideId == null || rideId.trim() === '') 
        {
          await this.drawRoute();
        }
        else{ 
       
          const p2pState = await this.store.get('p2p_state');
          console.log('P2P State:', p2pState);

          if (p2pState) //Si tiene valor, viene de una cancelacion del P2P 
          {
             
              console.log('Reference:', p2pState.reference);
              console.log('Amount:', p2pState.amount);
              console.log('Payment Method:', p2pState.paymentMethod);
              console.log('Origin:', p2pState.origin);
              console.log('Logged In User:', p2pState.loggedInUser);
              console.log('Timestamp:', p2pState.timestamp);
              this.rideId = p2pState.loggedInUser.rideId;
             
              //Para que el driver se entere que el usuario cancelo......
              this.api.setRideRejected(this.rideId).pipe(first()).subscribe(async result => { this.getLocation() }); 
             
              //await this.store.remove('p2p_state');
          } //if (p2pState)

          console.log('this.loggedInUser.rideId =' + rideId)
          this.rideId = rideId;
          this.userProvider.setRideId(this.rideId);
          
        }
  }//ionViewWillEnter()

     async OnInit(){

     }
    
     async getLocation(){

          this.api.getRide(this.rideId).pipe(first()).subscribe(async ride => {
            ride.id = this.rideId;
            Object.assign(this.rideService.rideInfo, ride);

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
          
        await  this.drawRoute();
          
      });//this.api.getRide()

    }

    async drawRoute() {

        const request: google.maps.DirectionsRequest = {
          origin: {
            lat: this.rideService.origin.lat,
            lng: this.rideService.origin.lng,
          },
          destination: {
            lat: this.rideService.destination.lat,
            lng: this.rideService.destination.lng,
          },
          travelMode: google.maps.TravelMode.DRIVING,
        };
    
        this.rideService.directionsResults$ = await this.mapDirectionsService.route(request).pipe(map((response) => response.result));
    
        this.rideService.directionsResults$.subscribe((items) => {
          console.dir(items);
    
          if (items &&
              items.routes &&
              items.routes[0] &&
              items.routes[0].legs &&
              items.routes[0].legs[0]
            ){
                const distanceText =   items?.routes?.[0]?.legs?.[0]?.distance?.text ?? '0 km'; // e.g., "12 km"
                this.rideService.tripDistance = parseFloat( distanceText.substring(0, distanceText.indexOf(' ')) );
                this.rideService.duration = items.routes?.[0]?.legs?.[0]?.duration?.text ?? 'Unknown duration';
                this.rideService.fare = this.rideService.getFare();
                this.rideService.totalFee = this.rideService.getTotalFare();
            }
            
          this.endLocation = {
            lat: this.rideService.destination.lat,
            lng: this.rideService.destination.lng,
          };

          this.endIcon = {
            url: '../../assets/images/pin.png', // 🛠 Change to your destination marker
            scaledSize: new google.maps.Size(50, 50)
          };

          if (
            !this.fitMapToRoute(items?.routes?.[0])
          ) {
            this.fitToMarkers(
              { lat: this.rideService.origin.lat, lng: this.rideService.origin.lng },
              { lat: this.rideService.destination.lat, lng: this.rideService.destination.lng }
            );
          }
        });

  
        this.directionsResults$ = this.mapDirectionsService.route(request).pipe(map(res => res.result));

      // Si necesitas hacer cálculos con el resultado:
      this.directionsResults$.subscribe(items => {
        console.dir(items);
    
        if (items &&
            items.routes &&
            items.routes[0] &&
            items.routes[0].legs &&
            items.routes[0].legs[0]
          ){
              const distanceText =   items?.routes?.[0]?.legs?.[0]?.distance?.text ?? '0 km'; // e.g., "12 km"
              this.rideService.tripDistance = parseFloat( distanceText.substring(0, distanceText.indexOf(' ')) );
              this.rideService.duration = items.routes?.[0]?.legs?.[0]?.duration?.text ?? 'Unknown duration';
              this.rideService.fare = this.rideService.getFare();
              this.rideService.totalFee = this.rideService.getTotalFare();
          }
          
        this.endLocation = {
          lat: this.rideService.destination.lat,
          lng: this.rideService.destination.lng,
        };

        this.endIcon = {
          url: '../../assets/images/pin.png', // 🛠 Change to your destination marker
          scaledSize: new google.maps.Size(50, 50)
        };

        if (
          !this.fitMapToRoute(items?.routes?.[0])
        ) {
          this.fitToMarkers(
            { lat: this.rideService.origin.lat, lng: this.rideService.origin.lng },
            { lat: this.rideService.destination.lat, lng: this.rideService.destination.lng }
          );
        }
      });

    }

    private fitMapToRoute(route?: google.maps.DirectionsRoute): boolean {
      const mapInstance = this.googlemap?.googleMap;

      if (!route || !mapInstance) {
        return false;
      }

      const bounds = new google.maps.LatLngBounds();

      route.legs?.forEach((leg) => {
        bounds.extend(leg.start_location);
        bounds.extend(leg.end_location);

        leg.steps?.forEach((step) => {
          step.path?.forEach((point) => bounds.extend(point));
        });
      });

      if (bounds.isEmpty()) {
        return false;
      }

      mapInstance.fitBounds(bounds, {
        top: 40,
        left: 40,
        right: 40,
        bottom: 280,
      });

      return true;
    }

    fitToMarkers(origin: google.maps.LatLngLiteral, dest: google.maps.LatLngLiteral) {
        const b = new google.maps.LatLngBounds();
        b.extend(origin);
        b.extend(dest);
        this.googlemap.fitBounds(b, { top: 40, right: 40, bottom: 280, left: 40 });
    }


  async resetRide(paymentMethod : string)
  {

    Object.assign(this.rideService.driverInfo, this.rideDriver); //driver null
    this.rideService.resetDriverOnRide();
   
    //Actualizo la base de datos
    Object.assign(this.ride ,this.rideService.rideInfo); //driver null
    this.ride.id = this.rideId;
    this.ride.paymentMethod = paymentMethod;
    this.ride.driverId = '';
    this.ride.driver_rejected = false;
    this.ride.ride_started = false;
    this.ride.ride_accepted = false;
    this.ride.user_rejected = false;
    this.ride.ride_completed = false;
    this.ride.request_timeout = false;
    console.dir('this.ride=>:' + this.ride);
    this.api.updateRideData(this.rideId, this.ride);
  
  }


    async GoCreditCard() {
        
        this.resetRide('p2p');
        
        const modal2 = await this.util.createModal(BookingConfirmationComponent, { paymentMethodCall: 'p2p', visible: true, message:environment.SEARCH_DRIVER_MSG });
        
        modal2.onDidDismiss().then(async (data) => {
          
          /*  if(data.data.ride_accepted)  //Retornar : Necesitamos saber si El driver Acepto o Declino?
            {
                try {
                  const res: any = await this.p2p.createPaymentSession(this.rideService.rideInfo.id, 
                                                                       this.rideService.totalFee, 
                                                                       this.loggedInUser , 
                                                                       this.rideService.rideInfo.clientId, 
                                                                       this.rideService.rideInfo.driverId.toString(),
                                                                       this.rideService.rideInfo.id);
                } catch (err) {
                  console.error('Error al crear sesión de pago', err);
                }
           }*/
           
            document.activeElement && (document.activeElement as HTMLElement).blur();
        });
    
    
    await modal2.present();
      
      
  
    }
  
    CancelBooking(){
        this.showUserCanceledRideAlert();
    }

    async showUserCanceledRideAlert() {
      this.router.navigate(['/tabs/tab1']);
    }

    async BookingCash() {
      this.resetRide('cash');
     
      //if (this.rideService.confirm && !this.rideService.SelectRide) {
        const modal2 = await this.util.createModal(BookingConfirmationComponent,  { paymentMethodCall: 'cash', visible: true, message:environment.SEARCH_DRIVER_MSG });
        
        modal2.onDidDismiss().then((data) => {
          //Retornar : Necesitamos saber si El driver Acepto o Declino?
          document.activeElement && (document.activeElement as HTMLElement).blur();
        
         /*  if(data.data.ride.id && data.data.ride_accepted)
          {
              this.router.navigate(['/tabs/tab1/pickup']);
          } */
        });
    await modal2.present();
    }



}

  
