import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { confirmRidePage } from './confirmRide.page';

const routes: Routes = [
  {
    path: '',
    component: confirmRidePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class confirmRidePageRoutingModule {}
