import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { NavController } from '@ionic/angular';
import { RideService } from '../../services/ride/ride.service';
import { PlacetoPayService } from '../../services/api/placetopay.service';
import { User } from '../../models/user';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-payment-methods',
  templateUrl: './payment-methods.page.html',
  styleUrls: ['./payment-methods.page.scss'],
  standalone: false,
})
export class PaymentMethodsPage implements OnInit {

  @ViewChild('toolbar', { read: ElementRef }) toolbarRef!: ElementRef;
  
  public totalFare!: number;
  public tripTime!: number;
  public reference!: string; 
  public clientName!:string;
  public loggedInUser!: User;


  constructor(private navCtrl: NavController,
              public rideService: RideService,
              private p2p: PlacetoPayService,
              private router: Router, 
              private route: ActivatedRoute,
             ) { }
  

  ngAfterViewInit() {
    
  }

  ngOnInit() {
    
    this.totalFare = this.rideService.getFare();
    this.tripTime = this.rideService.duration;
    this.clientName = this.rideService.userProvider.loggedInUser.name;
    this.loggedInUser = this.rideService.userProvider.loggedInUser;

  }

  selectedMethod: string = '';

  paymentMethods = [
    {
      id: 'creditCard',
      type: 'creditCard',
      icon: 'assets/cards/creditcard.png',
    },
    {
      id: 'paypal',
      type: 'PayPal',
      icon: 'assets/cards/paypal.png',
    },
    
    {
      id: 'cash',
      type: 'Cash',
      icon: 'assets/cards/cash.png',
    }
  ];

  selectMethod(id: string) {
    this.selectedMethod = id;
    localStorage.setItem('metodoPago', id);
    
   switch(id){
        case 'creditCard':{
          this.pagar(id);
          break;
        }
        default: {
          this.goBack(id);
          break;
        }
      }
  }
  
  goBack(id: string) {

   
    
    this.navCtrl.back();

    
  }

  async pagar(id: string) {
    try {
     
      this.reference = '1-1224-1741825443'; //this.rideService.userProvider.loggedInUser.rideId
      this.totalFare = this.rideService.getFare();
      this.tripTime = this.rideService.duration;
      this.clientName = this.rideService.userProvider.loggedInUser.name;
      
      const res: any = await this.p2p.createPaymentSession(this.reference, this.totalFare, this.loggedInUser , this.rideService.rideInfo.clientId, 
        this.rideService.rideInfo.driverId.toString(),
        this.rideService.rideInfo.id);////clientId, driverId , rideId:
     
      if (res?.processUrl) {
        window.location.href = res.processUrl;
        //window.open(res.processUrl, '_blank');
      }
    } catch (err) {
      console.error('Error al crear sesión de pago', err);
    }
 }

}
