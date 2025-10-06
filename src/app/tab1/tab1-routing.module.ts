import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { Tab1Page } from './tab1.page';
import { NgxPayPalModule } from 'ngx-paypal';
const routes: Routes = [
  { path: '',  component: Tab1Page,  },
  { path: 'confirmRide', loadChildren: () => import('../pages/confirmRide/confirmRide.module').then(m => m.confirmRidePageModule) }, // /tabs/tab1/pagina3
  { path: 'pickup',  loadChildren: () => import('../pages/pickup/pickup.module').then( m => m.PickupPageModule)  },
];

@NgModule({
  imports: [RouterModule.forChild(routes),NgxPayPalModule],
  exports: [RouterModule]
})
export class Tab1PageRoutingModule {}
