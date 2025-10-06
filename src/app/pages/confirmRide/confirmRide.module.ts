import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';
import { IonicModule } from '@ionic/angular';
import { confirmRidePageRoutingModule } from './confirmRide-routing.module';
import { confirmRidePage } from './confirmRide.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,GoogleMapsModule,
    confirmRidePageRoutingModule
  ],
  declarations: [confirmRidePage]
})
export class confirmRidePageModule {}
