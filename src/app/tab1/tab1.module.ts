import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule ,ReactiveFormsModule} from '@angular/forms';
import { Tab1PageRoutingModule } from './tab1-routing.module';
import { Tab1Page } from './tab1.page';
import { GoogleMapsModule } from '@angular/google-maps';
import { NgxPayPalModule } from 'ngx-paypal';
import { IonAccordion, IonAccordionGroup, IonItem, IonLabel } from '@ionic/angular';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    Tab1PageRoutingModule,
     ReactiveFormsModule ,
    GoogleMapsModule,
    NgxPayPalModule ,
   // MapComponent   
   
  ],
  declarations: [Tab1Page],
  
})
export class Tab1PageModule {}
