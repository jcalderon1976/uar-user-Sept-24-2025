import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { environment } from 'src/environments/environment.prod';
import { User } from '../../models/user';
import { AppStorage } from '../../services/api/app-storage.service';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { emptyP2pTrans, P2pTrans} from '../../models/p2pTrans'

@Injectable({  providedIn: 'root'})


export class PlacetoPayService {
  
  _auth : any;
  transaction!:P2pTrans;

  constructor( private store: AppStorage  ) { } // asegúrate de inicializarlo



  async createPaymentSession(reference: string, amount: number, loggedInUser: User ,clientId: string, driverId: string, rideId: string) { 
    
    const login = environment.PLACE2PAY.login; //'b6d3d73d93c0b6a98f48f7a8fe778fa6';
    const secretKey = environment.PLACE2PAY.secretKey; //'OH5QJ7hQaK84yfn7';
    const seed = new Date().toISOString();
    const document = loggedInUser.id + seed;
    const rawNonce = CryptoJS.lib.WordArray.random(16);
    const nonceBase64 = CryptoJS.enc.Base64.stringify(rawNonce);

    const combined = CryptoJS.lib.WordArray.create(
      rawNonce.words.concat(
        CryptoJS.enc.Utf8.parse(seed).words,
        CryptoJS.enc.Utf8.parse(secretKey).words
      )
    );

    const hash = CryptoJS.SHA256(combined);
    const tranKey = CryptoJS.enc.Base64.stringify(hash);
    const expiration = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const body = {
      auth: {
        login,
        tranKey,
        nonce: nonceBase64,
        seed
      },
      payment: {
        reference: reference,
        description: environment.PLACE2PAY.description,
        amount: {
          currency: environment.PLACE2PAY.currency, //"USD",
          total: amount
        }
      },
      payer: {
        name: loggedInUser.name,
        surname: loggedInUser.name,
        email: loggedInUser.email, // 👈 este es el que llena el input
        documentType: 'CC',
        document: '123456789' , //document,
        mobile: loggedInUser.phone
      },
      fields: [
        { keyword: "Invoice Number", value: reference, displayOn: "both" },
        { keyword: "Company Name", value: environment.PLACE2PAY.companyName, displayOn: "both" },
        { keyword: "Customer Name", value: loggedInUser.name, displayOn: "both" },
        { keyword: "Transaction Id", value: reference, displayOn: "both" },
        { keyword: "RideId", value: rideId, displayOn: "both" },
        { keyword: "ClientId", value: clientId, displayOn: "both" },
        { keyword: "DriverId", value: driverId, displayOn: "both" }
      ],
      locale: "es_PR",
      expiration,
      returnUrl: environment.PLACE2PAY.returnUrl,
      cancelUrl: environment.PLACE2PAY.cancelUrl,
      notificationUrl: environment.PLACE2PAY.notificationUrl,
      ipAddress:  environment.PLACE2PAY.ipAddress,
      userAgent: navigator.userAgent,
      skipResult: environment.PLACE2PAY.skipResult,
    };
   
    return this.startPayment(body,reference, amount, loggedInUser,clientId , driverId , rideId );
  }

  async startPayment(body: any, reference: string, amount: number, loggedInUser: User ,clientId: string, driverId: string, rideId: string): Promise<void>{
    
    try {
      //POST /api/session
      //Este endpoint te permite crear una nueva sesión. En la sesión el usuario podrá completar un pago o suscripción.
      const response = await fetch(environment.PLACE2PAY.SessionEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const json = await response.json();

      if (json?.status?.status === 'OK') {
        
        await this.store.set('p2p_state',  {
          reference,
          amount,
          paymentMethod: 'creditCard',
          origin: 'modal-payment',
          loggedInUser,
          timestamp: Date.now(),
          clientId, 
          driverId , 
          rideId,
          processUrl: json.processUrl,
          requestId : json.requestId,
         // internalReference,
         // receipt
        }); 

        // window.open(json.processUrl, '_blank');
        //window.location.href = json.processUrl;

        if (Capacitor.isNativePlatform()) {
          // Abre en SFSafariViewController/Custom Tabs
          await Browser.open({ url: json.processUrl });
        } else {
          // Web: intenta nueva pestaña
          const w = window.open(json.processUrl, '_blank', 'noopener');
          if (!w) {
            // Fallback si el popup fue bloqueado
            window.location.href = json.processUrl;
          }
        }

      } else {
        console.error('Error al conectar con PlaceToPay', json.status.message);
        console.log(json);
      }
    } catch (err) {
      console.error('Error al conectar con PlaceToPay', err);
    }
  }

  async sessionConsult(requestId: any): Promise<P2pTrans>{
    
    try {
    const login = environment.PLACE2PAY.login; //'b6d3d73d93c0b6a98f48f7a8fe778fa6';
    const secretKey = environment.PLACE2PAY.secretKey; //'OH5QJ7hQaK84yfn7';
    const seed = new Date().toISOString();
    const rawNonce = CryptoJS.lib.WordArray.random(16);
    const nonceBase64 = CryptoJS.enc.Base64.stringify(rawNonce);

    const combined = CryptoJS.lib.WordArray.create(
      rawNonce.words.concat(
        CryptoJS.enc.Utf8.parse(seed).words,
        CryptoJS.enc.Utf8.parse(secretKey).words
      )
    );

    const hash = CryptoJS.SHA256(combined);
    const tranKey = CryptoJS.enc.Base64.stringify(hash);
  
    const auth = {    
        login,
        tranKey,
        nonce: nonceBase64,
        seed
     }

     this._auth = auth;

        // 1) Query session -> obtener internalReference y receipt
        const q = await fetch(`${environment.PLACE2PAY.SessionEndpoint}/${requestId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auth })
        });

        const session = await q.json();
        const pay = session?.payment?.[0];
        const payment = pay ?? {}; // pay puede venir undefined

        const transaction: P2pTrans = emptyP2pTrans({
          requestId,
          amount: payment.amount?.from?.total ?? null,
          currency: payment.amount?.from?.currency ?? null,
          authorization: payment.authorization ?? null,
          franchise: payment.franchise ?? null,
          internalReference: payment.internalReference ?? null,
          issuerName: payment.issuerName ?? null,
          paymentMethod: payment.paymentMethod ?? null,
          paymentMethodName: payment.paymentMethodName ?? null,
          receipt: payment.receipt ?? null,
          refunded: payment.refunded ?? false,
          status: payment.status?.status ?? null,   // según estructura del API
          message: payment.status?.message ?? null, // idem
        });

        return transaction;
        
    }catch(err)  { 
       console.error('Error al conectar con PlaceToPay', err);
       const transaction: P2pTrans = emptyP2pTrans();
       return transaction;
    }
  
  }

  async reverseTransaction(requestId: any): Promise<void>{

    this.sessionConsult(requestId).then(async result => {
     
      // 2) Reverse por internalReference
      const r = await fetch(`${environment.PLACE2PAY.base}/api/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth: this._auth, internalReference: result.internalReference, action: 'reverse' })
      });
      const reverseRes = await r.json();

      
     });



    
  }

}
