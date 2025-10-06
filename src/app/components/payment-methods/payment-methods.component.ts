import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { RideService } from '../../services/ride/ride.service';
import { PlacetoPayService } from '../../services/api/placetopay.service';
import { ActivatedRoute } from '@angular/router';
import { User } from '../../models/user';
import { Storage } from '@ionic/storage-angular';
import { UtilService } from '../../services/util/util.service';

//import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';

@Component({
  selector: 'app-payment-methods',
  templateUrl: './payment-methods.component.html',
  styleUrls: ['./payment-methods.component.scss'],
  standalone: false
})
export class PaymentMethodsComponent  implements OnInit {

  @ViewChild('toolbar', { read: ElementRef }) toolbarRef!: ElementRef;
  
  public totalFare!: number;
  public tripTime!: number;
  public reference!: string; // = '1-1224-1741825443'; //$"{company.Id}-{invoice.InvoiceNumber}",
  public clientName!:string;
  public loggedInUser!: User;
  
  constructor(private modalCtrl: ModalController,
              public rideService: RideService,
              private p2p: PlacetoPayService,
              private route: ActivatedRoute,
              private util: UtilService,
              private storage: Storage
             // private iab: InAppBrowser 
             ) { 
            //  this.storage.create(); // asegúrate de inicializarlo
             }
  

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

   switch(id){
        case 'creditCard':{
          this.pagar();
          break;
        }
        default: {
          const data = { value: id};
          console.log('inside submit: data = ' + id);
          this.GoPickupModal();
          break;
        }
      }
  }
  
  async GoPickupModal() {
    
     
     }


  goBack() {
    this.modalCtrl.dismiss();
  }

  async pagar() {
    try {
     
      const  reference = '1-1224-1741825443'; //this.rideService.userProvider.loggedInUser.rideId
      const  totalFare = this.totalFare 
      const  tripTime =  this.tripTime
      const  clientName =  this.clientName
      const res: any = await this.p2p.createPaymentSession(reference, totalFare, this.loggedInUser ,
        this.rideService.rideInfo.clientId, 
        this.rideService.rideInfo.driverId.toString(),
        this.rideService.rideInfo.id);////clientId, driverId , rideId:
        
 
    } catch (err) {
      console.error('Error al crear sesión de pago', err);
    }
 }


}
