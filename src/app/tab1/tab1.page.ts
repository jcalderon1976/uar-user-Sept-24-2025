import { Component, Input,  ViewChild} from '@angular/core';
import { UtilService } from '../services/util/util.service';
import { environment } from '../../environments/environment';
import { User } from '../models/user';
import { RideService } from '../services/ride/ride.service';
import { InitUserProvider } from '../services/inituser/inituser.service';
import { SetLocationComponent } from '../../app/components/set-location/set-location.component';
import { GoogleMap, MapDirectionsRenderer,  MapInfoWindow } from '@angular/google-maps';
import { Observable } from 'rxjs';
import { IonSearchbar } from '@ionic/angular';
import { Router } from '@angular/router';




declare const paypal: any; // 👈 Esto es importante

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,

})

export class Tab1Page    {
  @Input() country!: string;
  @ViewChild(GoogleMap, { static: false }) googlemap!: GoogleMap;
  @ViewChild(MapInfoWindow, { static: false }) info!: MapInfoWindow;
  @ViewChild('destinationSearchbar', { static: false }) searchbar!: IonSearchbar;
  @ViewChild(MapDirectionsRenderer) mapDirectionsRenderer!: MapDirectionsRenderer;


  // Map and UI variables
  directionsResults$!: Observable<google.maps.DirectionsResult | undefined>;
  routeLeg!: google.maps.DirectionsLeg;
  endLocation!: google.maps.LatLngLiteral;
   
  public loggedInUser!: User;
  public lat: any;
  public lng: any;
  public color = ['black', 'black', 'black'];
  public items: { 'background-color'?: string }[] = [{}, {}, {}];
  public origin: any;
  public destination: any;
  public locatedCountry!: string;
  destinationIconUrl = 'assets/images/pin.png';
  public paymentMethodSelected!: string;
  public paymentMethodDescription!: string;
  public orderId!: string; // Stores the order ID for cancellation
  public rideId!: any;

 
  constructor(
    public rideService: RideService,
    private userProvider: InitUserProvider,
    private util: UtilService,
    private router: Router,
   ) {    
  }
  /*
        Paso #1 constructor
        Paso #2 ngOnInit
        Paso #3 ngAfterViewInit
        Paso #4 ionViewWillEnter
        Paso #5 ionViewDidEnter
  */
  async ionViewWillEnter() {
    this.searchbar?.setFocus();
    this.Reset();
  }
    
  ionViewWillLeave() {
    // 👇 Esto borra el foco antes de que el tab se oculte
    (document.activeElement as HTMLElement)?.blur();
  }

  //Reset
  async Reset() {

    this.rideId == null;
    this.loggedInUser = this.userProvider.getUserData();
    await this.rideService.resetRideSettings(); 
    
  }

  async searchModal(name: string,  open: string) {

    this.rideService.locationType = name;

    if (open === 'modal') {
      const modal = await this.util.createModal(SetLocationComponent, { country: this.locatedCountry ? this.locatedCountry : environment.COUNTRY }, "MyModal" );
      await modal.present();
      //await modal.onDidDismiss();

      modal.onWillDismiss().then(async (result) => {
          if(result.data.searchCompleted){
            this.router.navigate(['/tabs/tab1/confirmRide']);
          }
      });
    }

  }

  
  

  
}
