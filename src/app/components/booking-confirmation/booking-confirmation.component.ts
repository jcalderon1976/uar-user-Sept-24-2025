import {  Component,  OnInit,  OnDestroy,  ViewChild,  ElementRef,Input,ChangeDetectionStrategy } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { InitUserProvider } from '../../services/inituser/inituser.service';
import { APIService } from '../../services/api/api.service';
import { environment } from '../../../environments/environment';
import { Ride } from '../../models/ride';
import { UtilService } from '../../services/util/util.service';
import { RideService } from '../../services/ride/ride.service';
import { User } from '../../models/user';
//import { PickupPage } from 'src/app/pages/pickup/pickup.page';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { Subscription } from 'rxjs';
import { IonToolbar, IonTitle } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { PaymentMethodsComponent} from '../payment-methods/payment-methods.component';
import { PlacetoPayService } from '../../services/api/placetopay.service';

@Component({
  selector: 'app-booking-confirmation',
  templateUrl: './booking-confirmation.component.html',
  styleUrls: ['./booking-confirmation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class BookingConfirmationComponent implements OnInit, OnDestroy {
  @Input() paymentMethodCall!: string;
  /** Mostrar/ocultar overlay */
  @Input() visible = false;
  /** Mensaje opcional bajo el GIF */
  @Input() message?: string;


  public progress = 10;
  public loaderListenerId: number | null = null;
  public timeoutListenerId: number | undefined;
  public delayAlert: HTMLIonAlertElement | null = null;
  public cancelAlert!: HTMLIonAlertElement;
  public rideId!: string;
  public listenerId: number | null = null;
  public loggedInUser!: User;
  public lat: number;
  public lng: number;
  public pickupAceptept = false;
  private destroy$ = new Subject<void>();
  private getRideSubscription!: Subscription; // Store the subscription
  private setRideSubscription!: Subscription; // Store the subscription
  private paymentMethod!: string;

  constructor(
    private navCtrl: NavController,
    public rideService: RideService,
    private util: UtilService,
    private userProvider: InitUserProvider,
    private api: APIService,
    private router: Router,
    private p2p: PlacetoPayService,
    private modalCtrl: ModalController
  ) {
    this.lat = this.rideService.destination.lat;
    this.lng = this.rideService.destination.lng;
    this._preLoad();
  }

  ngAfterViewInit() {
    
  }

  async ngOnInit() {
    this.pickupAceptept = false;
  }

  ngOnDestroy(): void {
    // Emitir valor para romper todas las suscripciones
    this.destroy$.next();
    this.destroy$.complete();

    // Unsubscribe to avoid memory leaks
    if (this.getRideSubscription) {
      this.getRideSubscription.unsubscribe();
    }
    if (this.setRideSubscription) {
      this.setRideSubscription.unsubscribe();
    }
  }

  async _preLoad() {
    // to redirect to further pages if a booking is active //TODO
    this.loggedInUser = await this.userProvider.getUserData();

    console.log('this.loggedInUser ');
    console.dir(this.loggedInUser);
    console.log('this.userProvider');
    console.dir(this.userProvider);
    const result = await this.userProvider.getRideId();
    this.rideId = result?.toString() || ''; // Convert to string or set to empty string if null
    console.log('rideId');
    console.dir(this.rideId);

    //Verifica si el usuario tiene un viaje activo
    if (this.rideId) {
      console.log('send to booked ride', this.rideId);
      this.load();
    } else {
      this.bookRide().then(() => {
        this.load();
      }); // Book a ride and then load
    }
  }

  async load() {
    
    this.setRideStatusListener();
   }

  setRideStatusListener() {
    if (this.listenerId == null) {
      this.listenerId = <number>(<unknown>setInterval(() => {
        this.checkRideStatus();
      }, 7000));
      console.log('>>> setInterval(7000) SET RIDE STATUS  LISTENER this.listenerId= ' +  this.listenerId +' <<<' );
    }
    if (this.timeoutListenerId == null) {
      this.timeoutListenerId = <number>(<unknown>setTimeout(() => {
        this.api.setRideTimeOut(this.rideId).subscribe(
          (res) => {
            if (res.message[0]) {
              this.clearRideStatusListener();
              this.showTimeOutAlert();
            }
          },
          (err) => console.log(err)
        );
      }, 60000));
      console.log('>>> setTimeout(60000) SET RIDE STATUS  LISTENER his.timeoutListenerId =' + this.timeoutListenerId +' <<<');
    }
  }

  clearRideStatusListener() {
    if (this.listenerId != null) {
      console.log('**CLEAR LISTENER BOOKIN CONFIRMATION** this.listenerId=>' +   this.listenerId );
      clearInterval(this.listenerId);
      this.listenerId = null;
    }
    if (this.loaderListenerId != null) { console.log( '***this.loaderListenerId=>' + this.loaderListenerId );
      clearInterval(this.loaderListenerId);
      this.loaderListenerId = null;
    }
    if (this.timeoutListenerId != null) {
      console.log( '*************this.timeoutListenerId=>' + this.timeoutListenerId );
      clearTimeout(this.timeoutListenerId);
      this.timeoutListenerId = undefined;
    }

   
    (document.activeElement as HTMLElement)?.blur(); // 👈 evita el warning
  }

  async checkRideStatus() {
    console.log('SetLoggedinUser', this.loggedInUser);
    console.log('status check.....');
    console.dir(this.rideId);

    this.api
      .getRide(this.rideId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((ride: Ride) => {

        if (ride && ride['ride_accepted'] && !this.pickupAceptept) {
          
          this.userProvider.setRideId(this.rideId); // Set the ride ID in the user provider
         
          this.clearRideStatusListener();
          
          this.api.getDriver(ride.driverId).subscribe(
            (driver) => {
              Object.assign(this.rideService.driverInfo, driver);
              driver.driverId 
            },
            (err) => console.log(err)
          );
          console.log('RIDER ACCEPTED');
          this.pickupAceptept = true;
          
          ride.id = this.rideId;
          this.rideService.setRideInfo(ride);
          this.GoBackToPage(ride);

        } else {
          console.log('waiting for response from driver'); // TODO
        }

        //check if getRide listener is end
      });
  }

  async GoBackToPage(ride: any) {
    if (ride['ride_accepted'] && !ride['ride_started']) {
      const data = { ride: ride, ride_accepted : true };
      console.log('inside submit: ride = ' + ride);
      this.ngOnDestroy();
      console.log('paymentMethodCall =' + this.paymentMethodCall);

      if(this.paymentMethodCall === 'cash')
      {
        this.router.navigate(['/tabs/tab1/pickup']);
        this.modalCtrl.dismiss(data);
      }
      else if(this.paymentMethodCall === 'p2p')
      {
        try {
          
          const res: any = await this.p2p.createPaymentSession(this.rideService.rideInfo.id, 
                                                               this.rideService.totalFee, 
                                                               this.loggedInUser , 
                                                               this.rideService.rideInfo.clientId, 
                                                               this.rideService.rideInfo.driverId.toString(),
                                                               this.rideService.rideInfo.id);

          this.modalCtrl.dismiss(data);
        } catch (err) {
          console.error('Error al crear sesión de pago', err);
        }
      }
      else
      {
         this.modalCtrl.dismiss(data);
      }
    }
  }

  async showTimeOutAlert() {
    if (!this.delayAlert) {
      this.util
        .presentAlert('Sorry!', environment.DRIVER_DELAY_MSG, 'OK')
        .then(() => {
          this.rideService.resetRideSettings();

           const data = { rideID: this.rideId };
           this.modalCtrl.dismiss(data);
           
        });
    }
  }

  goBack() {
    this.navCtrl.back();
  }

  ionViewWillLeave() {
    this.delayAlert = null;
    this.clearRideStatusListener();
  }

  submit() {
    this.modalCtrl.dismiss();
  }

  async bookRide() {
    console.log('this.rideService ');
    console.dir(this.rideService);

    const rideData: Ride = {
      id: '',
      origin_lat: this.rideService.origin.lat,
      origin_lng: this.rideService.origin.lng,
      destination_lat: this.rideService.destination.lat,
      destination_lng: this.rideService.destination.lng,
      destination_address: this.rideService.destinationAddress,
      tow_type: this.rideService.taxiType,
      driver_rejected: false,
      request_timeout: false,
      ride_accepted: false,
      ride_started: false,
      user_rejected: false,
      ride_completed: false,
      fare: this.rideService.getFare(),
      totalFare: this.rideService.totalFee,
      clientId: this.loggedInUser.id,
      driverId: '',
      distance: this.rideService.tripDistance,
      //waitingTime: this.rideService.waitingTime,
      createdAt: this.rideService.createdAt,
      paymentMethod: this.rideService.getPaymentMethod(),
    };

    console.log('rideData =>');
    console.dir(rideData);

    this.api.bookRide(rideData).subscribe(async (ride: Ride) => {
      (document.activeElement as HTMLElement)?.blur(); // 👈 evita el warning
      console.log('ride', ride);
      this.rideId = ride.id;
      this.rideService.setRideInfoBooking(ride);
    });
  }
}
