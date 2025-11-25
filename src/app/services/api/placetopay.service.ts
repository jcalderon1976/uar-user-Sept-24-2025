import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { environment } from 'src/environments/environment';
import { User } from '../../models/user';
import { AppStorage } from '../../services/api/app-storage.service';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { emptyP2pTrans, P2pTrans} from '../../models/p2pTrans'
import { Router } from '@angular/router';

@Injectable({  providedIn: 'root'})


export class PlacetoPayService {
  
  _auth : any;
  transaction!:P2pTrans;
  private browserListenerAdded = false;

  constructor( 
    private store: AppStorage,
    private router: Router
  ) { 
    this.initializeAppUrlListener();
  }

  /**
   * Inicializa el listener para detectar cuando la app recibe URLs de deep link
   * Esto ocurre cuando PlaceToPay redirige de vuelta a la app
   */
  private initializeAppUrlListener() {
    if (Capacitor.isNativePlatform()) {
      App.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
        console.log('🔗 Deep Link recibido:', event.url);
        
        // Verificar si es una URL de pago
        if (event.url.includes('payment/success') || event.url.includes('payment/cancel')) {
          await this.handlePaymentReturn(event.url);
        }
      });

      // También escuchar cuando el navegador se cierra
      Browser.addListener('browserFinished', async () => {
        console.log('🌐 Navegador cerrado, verificando estado del pago...');
        await this.checkPendingPayment();
      });

      console.log('✅ Listeners de URL y Browser inicializados');
    }
  }

  /**
   * Maneja el retorno desde PlaceToPay cuando se recibe un deep link
   */
  private async handlePaymentReturn(url: string) {
    try {
      console.log('💳 Procesando retorno de pago...');
      
      // Cerrar el navegador si está abierto
      await Browser.close().catch(() => {});
      
      // Obtener el estado guardado del pago
      const paymentState = await this.store.get('p2p_state');
      
      if (paymentState && paymentState.requestId) {
        // Consultar el estado del pago
        const transaction = await this.sessionConsult(paymentState.requestId);
        
        console.log('📊 Estado de la transacción:', transaction);
        
        // Limpiar el estado guardado
        await this.store.remove('p2p_state');
        
        // Navegar según el resultado
        if (url.includes('payment/success')) {
          if (transaction.status === 'APPROVED') {
            console.log('✅ Pago aprobado');
            this.router.navigate(['/tabs/tab1/pickup'], { 
              queryParams: { paymentStatus: 'success', requestId: transaction.requestId } 
            });
          } else {
            console.log('⚠️ Pago pendiente o rechazado');
            this.router.navigate(['/tabs/tab1/pickup'], { 
              queryParams: { paymentStatus: 'pending', requestId: transaction.requestId } 
            });
          }
        } else if (url.includes('payment/cancel')) {
          console.log('❌ Pago cancelado');
          this.router.navigate(['/tabs/tab1/confirmRide'], { 
            queryParams: { paymentStatus: 'cancelled' } 
          });
        }
      }
    } catch (error) {
      console.error('❌ Error al procesar retorno de pago:', error);
    }
  }

  /**
   * Verifica si hay un pago pendiente cuando el navegador se cierra
   */
  private async checkPendingPayment() {
    try {
      const paymentState = await this.store.get('p2p_state');
      
      if (paymentState && paymentState.requestId) {
        console.log('🔍 Verificando pago pendiente...');
        
        // Esperar un poco antes de consultar (dar tiempo a PlaceToPay)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const transaction = await this.sessionConsult(paymentState.requestId);
        
        console.log('📊 Estado del pago:', transaction);
        
        // Limpiar el estado guardado
        await this.store.remove('p2p_state');
        
        // Navegar según el resultado
        if (transaction.status === 'APPROVED') {
          console.log('✅ Pago completado');
          this.router.navigate(['/tabs/tab1/pickup'], { 
            queryParams: { paymentStatus: 'success', requestId: transaction.requestId } 
          });
        } else if (transaction.status === 'REJECTED') {
          console.log('❌ Pago rechazado');
          this.router.navigate(['/tabs/tab1/confirmRide'], { 
            queryParams: { paymentStatus: 'rejected' } 
          });
        } else {
          console.log('⏳ Pago pendiente');
          this.router.navigate(['/tabs/tab1/pickup'], { 
            queryParams: { paymentStatus: 'pending', requestId: transaction.requestId } 
          });
        }
      }
    } catch (error) {
      console.error('❌ Error al verificar pago pendiente:', error);
    }
  }

  async createPaymentSession(reference: string, amount: number, loggedInUser: User ,clientId: string, driverId: string, rideId: string) { 
    
    const login = environment.PLACE2PAY.login; //'b6d3d73d93c0b6a98f48f7a8fe778fa6';
    const secretKey = environment.PLACE2PAY.secretKey; //'OH5QJ7hQaK84yfn7';
    const seed = new Date().toISOString();
    const document = loggedInUser.id + seed;
    const rawNonce = CryptoJS.lib.WordArray.random(16);
    const nonceBase64 = CryptoJS.enc.Base64.stringify(rawNonce);

    // Configurar URLs según la plataforma
    let returnUrl: string;
    let cancelUrl: string;
    
    if (Capacitor.isNativePlatform()) {
      // En nativo, usar deep links
      returnUrl = 'com.orchids.uar.user://payment/success';
      cancelUrl = 'com.orchids.uar.user://payment/cancel';
    } else {
      // En web, usar URLs HTTP normales
      const baseUrl = window.location.origin;
      returnUrl = `${baseUrl}/tabs/tab1/pickup?paymentStatus=success`;
      cancelUrl = `${baseUrl}/tabs/tab1/confirmRide?paymentStatus=cancelled`;
    }

    const combined = CryptoJS.lib.WordArray.create(
      rawNonce.words.concat(
        CryptoJS.enc.Utf8.parse(seed).words,
        CryptoJS.enc.Utf8.parse(secretKey).words
      )
    );

    const hash = CryptoJS.SHA256(combined);
    const tranKey = CryptoJS.enc.Base64.stringify(hash);
    const expiration = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Separar nombre y apellido con validación robusta
    const fullName = (loggedInUser.name || '').trim();
    const nameParts = fullName.split(' ').filter(part => part.length > 0);
    
    let firstName = 'Usuario';
    let lastName = 'Usuario';
    
    if (nameParts.length > 0) {
      firstName = nameParts[0];
      lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];
    }
    
    // Sanitizar nombres: remover caracteres especiales pero mantener acentos y letras con tilde
    const sanitizeName = (name: string) => {
      // Permitir letras (incluyendo acentos), espacios y guiones
      return name.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-]/g, '').trim();
    };
    
    firstName = sanitizeName(firstName);
    lastName = sanitizeName(lastName);
    
    // Asegurar que los valores tengan al menos 2 caracteres (requerimiento de PlaceToPay)
    if (!firstName || firstName.length < 2) firstName = 'Usuario';
    if (!lastName || lastName.length < 2) lastName = 'Usuario';

    // Validar y formatear email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const userEmail = loggedInUser.email && emailRegex.test(loggedInUser.email) 
      ? loggedInUser.email 
      : 'usuario@example.com';

    // Formatear número de teléfono con código de país (Puerto Rico es +1)
    let mobilePhone = loggedInUser.phone || '';
    // Remover caracteres no numéricos
    mobilePhone = mobilePhone.replace(/\D/g, '');
    // Si no tiene código de país, agregarlo
    if (!mobilePhone.startsWith('1') && mobilePhone.length === 10) {
      mobilePhone = '1' + mobilePhone;
    }
    // Agregar el símbolo +
    if (!mobilePhone.startsWith('+')) {
      mobilePhone = '+' + mobilePhone;
    }
    // Si el teléfono es inválido, usar valor por defecto
    if (mobilePhone.length < 11) {
      mobilePhone = '+19391234567'; // Teléfono de prueba de Puerto Rico
    }

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
        document: '123456789', //document,
        documentType: 'CC',
        name: firstName,
        surname: lastName,
        email: userEmail,
        mobile: mobilePhone
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
      returnUrl: returnUrl,
      cancelUrl: cancelUrl,
      notificationUrl: environment.PLACE2PAY.notificationUrl,
      ipAddress:  environment.PLACE2PAY.ipAddress,
      userAgent: navigator.userAgent,
      skipResult: Capacitor.isNativePlatform() ? false : true,
    };
   
    // Debug: Mostrar datos del payer antes de enviar
    console.log('PlaceToPay - Plataforma:', Capacitor.isNativePlatform() ? 'Nativa' : 'Web');
    console.log('PlaceToPay - URLs:', {
      returnUrl,
      cancelUrl
    });
    console.log('PlaceToPay - Datos del payer:', {
      name: firstName,
      surname: lastName,
      email: userEmail,
      emailOriginal: loggedInUser.email,
      mobile: mobilePhone,
      mobileOriginal: loggedInUser.phone,
      fullName: loggedInUser.name
    });

    return this.startPayment(body,reference, amount, loggedInUser,clientId , driverId , rideId );
  }

  async startPayment(body: any, reference: string, amount: number, loggedInUser: User ,clientId: string, driverId: string, rideId: string): Promise<void>{
    
    try {
      //POST /api/session
      //Este endpoint te permite crear una nueva sesión. En la sesión el usuario podrá completar un pago o suscripción.
      console.log('PlaceToPay - Enviando request a:', environment.PLACE2PAY.SessionEndpoint);
      console.log('PlaceToPay - Usando Capacitor HTTP:', Capacitor.isNativePlatform());
      
      let json: any;
      let status: number;

      // Usar CapacitorHttp para plataformas nativas, fetch para web
      if (Capacitor.isNativePlatform()) {
        const options = {
          url: environment.PLACE2PAY.SessionEndpoint,
          headers: { 'Content-Type': 'application/json' },
          data: body
        };
        console.log('PlaceToPay - Enviando con CapacitorHttp...');
        const response: HttpResponse = await CapacitorHttp.post(options);
        json = response.data;
        status = response.status;
      } else {
        console.log('PlaceToPay - Enviando con fetch...');
        const response = await fetch(environment.PLACE2PAY.SessionEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        status = response.status;
        json = await response.json();
      }

      console.log('PlaceToPay - Response status:', status);
      console.log('PlaceToPay - Response completa:', json);

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
        console.error('❌ PlaceToPay - Error en la respuesta');
        console.error('Status:', json?.status);
        console.error('Mensaje:', json?.status?.message);
        console.error('Response completa:', JSON.stringify(json, null, 2));
        alert('Error al conectar con PlaceToPay: ' + (json?.status?.message || 'Error desconocido'));
      }
    } catch (err) {
      console.error('❌ PlaceToPay - Error en la petición:', err);
      alert('Error al conectar con PlaceToPay: ' + err);
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
        let session: any;
        
        if (Capacitor.isNativePlatform()) {
          const options = {
            url: `${environment.PLACE2PAY.SessionEndpoint}/${requestId}`,
            headers: { 'Content-Type': 'application/json' },
            data: { auth }
          };
          const response: HttpResponse = await CapacitorHttp.post(options);
          session = response.data;
        } else {
          const q = await fetch(`${environment.PLACE2PAY.SessionEndpoint}/${requestId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth })
          });
          session = await q.json();
        }
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
      let reverseRes: any;
      
      if (Capacitor.isNativePlatform()) {
        const options = {
          url: `${environment.PLACE2PAY.base}/api/transaction`,
          headers: { 'Content-Type': 'application/json' },
          data: { auth: this._auth, internalReference: result.internalReference, action: 'reverse' }
        };
        const response: HttpResponse = await CapacitorHttp.post(options);
        reverseRes = response.data;
      } else {
        const r = await fetch(`${environment.PLACE2PAY.base}/api/transaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ auth: this._auth, internalReference: result.internalReference, action: 'reverse' })
        });
        reverseRes = await r.json();
      }

      console.log('Reverse transaction result:', reverseRes);
     });
  }

}
