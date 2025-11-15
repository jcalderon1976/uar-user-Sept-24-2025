import { NgModule,NO_ERRORS_SCHEMA , CUSTOM_ELEMENTS_SCHEMA , APP_INITIALIZER} from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { NgxMaskDirective, NgxMaskPipe, provideNgxMask } from 'ngx-mask';
import { GoogleMapsModule } from '@angular/google-maps';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgxPayPalModule } from 'ngx-paypal';
import { IonicStorageModule  } from '@ionic/storage-angular';
import { Drivers } from '@ionic/storage';    

//Routing
import { AppRoutingModule } from './app-routing.module';
//Components
import { AppComponent } from './app.component';
import { BookingConfirmationComponent } from './components/booking-confirmation/booking-confirmation.component';
import { LegalComponent } from './components/legal/legal.component';
import { SettingAccountComponent } from './components/setting-account/setting-account.component';

import { PaymentComponent } from './components/payment/payment.component';
import { CarInfoComponent } from './components/car-info/car-info.component';
import { ChangePasswordComponent } from './components/change-password/change-password.component';
import { ChangeUserComponent } from './components/change-user/change-user.component';
import { CameraUploadComponent } from './components/app-camera-upload/app-camera-upload.component';
import { EditCardComponent } from './components/edit-card/edit-card.component';
import { ChangePaymentComponent } from './components/change-payment/change-payment.component';
import { SetLocationComponent } from './components/set-location/set-location.component';  
import { RequestRideComponent } from  './components/request-ride/request-ride.component';  
import { PhotoComponent } from './components/photo/photo.component';
import { PaymentMethodsComponent} from './components/payment-methods/payment-methods.component'
// AngularFire
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import { provideAuth, getAuth, inMemoryPersistence, indexedDBLocalPersistence, initializeAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

//Environment
import { environment } from '../environments/environment';

//services
import { GmapService } from 'src/app/services/gmap/gmap.service';
import { InitUserProvider } from  './services/inituser/inituser.service';



@NgModule({
  declarations: [
    AppComponent,
    BookingConfirmationComponent,LegalComponent,PaymentComponent,
    CarInfoComponent,ChangePasswordComponent,ChangeUserComponent,SettingAccountComponent,
    EditCardComponent,ChangePaymentComponent,PaymentMethodsComponent,
    SetLocationComponent,RequestRideComponent,
   // MapComponent
  ],
  schemas: [NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule,
    GoogleMapsModule,NgxPayPalModule,
    //,SetLocationComponent,RequestRideComponent,
    NgxMaskDirective,
    NgxMaskPipe,
    FormsModule,
    IonicStorageModule.forRoot({
      name: '__appdb',                 // Nombre de la BD
      storeName: 'keyvaluepairs',      // “tabla/obj store” dentro de la BD
      version: 1,                      // Versión (web)
      description: 'Storage de mi app',// Descripción (web)
      size: 5 * 1024 * 1024,           // Solo WebSQL (legacy)
      driverOrder: [                   // Prioridad de drivers
        Drivers.IndexedDB,             // #1 recomendado en web
        Drivers.LocalStorage,          // fallback seguro
        // Drivers.WebSQL,             // solo si realmente lo necesitas
      ],
    }),
  ],
  //exports: [MapComponent],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideFirebaseApp(() => {
      console.log('🔥 Initializing Firebase App...');
      console.log('Firebase config:', environment.firebase);
      const app = initializeApp(environment.firebase);
      console.log('✅ Firebase App initialized:', app.name);
      return app;
    }),
    provideAuth(() => {
      console.log('🔒 Initializing Firebase Auth...');
      
      const isIOS = (window as any).Capacitor?.getPlatform() === 'ios';
      const app = getApp(); // Get the already initialized app
      
      if (isIOS) {
        console.log('📱 iOS detected - initializing with inMemoryPersistence');
        // Initialize with inMemory persistence to avoid IndexedDB issues in WKWebView
        const auth = initializeAuth(app, {
          persistence: inMemoryPersistence,
          popupRedirectResolver: undefined
        });
        console.log('✅ Firebase Auth initialized with inMemory persistence');
        return auth;
      } else {
        console.log('🌐 Web detected - using default persistence');
        const auth = getAuth(app);
        console.log('✅ Firebase Auth initialized with default persistence');
        return auth;
      }
    }),
    provideFirestore(() => {
      console.log('📄 Initializing Firestore...');
      const firestore = getFirestore();
      console.log('✅ Firestore initialized');
      return firestore;
    }),
    provideNgxMask(),
    GmapService,
    InitUserProvider,
    {
      provide: APP_INITIALIZER,
      useFactory: initUserProviderFactory,
      deps: [InitUserProvider],
      multi: true
    },
    BookingConfirmationComponent,
    SettingAccountComponent,LegalComponent,PaymentComponent,CameraUploadComponent,
    CarInfoComponent,ChangePasswordComponent,ChangeUserComponent,SettingAccountComponent,EditCardComponent,
    ChangePaymentComponent,SetLocationComponent,RequestRideComponent,PhotoComponent,PaymentMethodsComponent
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
//export class MapModule {}
export function initUserProviderFactory(provider: InitUserProvider) {
  return () => provider.load();
}
