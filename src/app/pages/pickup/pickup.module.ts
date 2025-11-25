import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleMapsModule } from '@angular/google-maps';
import { IonicModule } from '@ionic/angular';

import { PickupPageRoutingModule } from './pickup-routing.module';

import { PickupPage } from './pickup.page';
import { ChatModalComponent } from '../../components/chat-modal/chat-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,GoogleMapsModule,
    PickupPageRoutingModule
  ],
  declarations: [PickupPage, ChatModalComponent]
})
export class PickupPageModule {}
