import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';


const routes: Routes = [
  {    path: '',   loadChildren: () => import('./pages/login/login.module').then( m => m.LoginPageModule)}, //import('./tabs/tabs.module').then(m => m.TabsPageModule) //  
  {    path: 'login',  loadChildren: () => import('./pages/login/login.module').then( m => m.LoginPageModule)  },
  {    path: 'tabs',   loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule)  },
  {    path: 'confirmRide',  loadChildren: () => import('./pages/confirmRide/confirmRide.module').then( m => m.confirmRidePageModule)  },
  {    path: 'pickup',  loadChildren: () => import('./pages/pickup/pickup.module').then( m => m.PickupPageModule)  },
  {    path: 'register',  loadChildren: () => import('./pages/register/register.module').then( m => m.RegisterPageModule)  },
  {    path: '**', redirectTo: 'tabs/tab1', pathMatch: 'full' },   
];
@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
