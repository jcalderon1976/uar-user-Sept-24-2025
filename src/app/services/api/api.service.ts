import { Injectable, OnDestroy } from '@angular/core';
import { Observable, from } from 'rxjs';
import { FirestoreService } from './firestore.service';
import { Subscription ,Subject} from 'rxjs';
import { doc , QueryDocumentSnapshot, QuerySnapshot, DocumentData ,collection, DocumentSnapshot } from 'firebase/firestore';

import { HistoryRide } from 'src/app/models/historyRides';
import { PaymentMethod } from 'src/app/models/paymentMethod';
import { BaseDatabaseModel } from '../../models/base-dto.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})

export class APIService implements OnDestroy {
  private id!: string;
  private getRideSubscribe!: Subscription;  // Store the subscription
  private lastDoc: QueryDocumentSnapshot<any> | null = null; // Track last document for pagination
  private pageSize = 10; // Number of rides per fetch
  private hasMoreData = true; // Track if more data exists
  private destroy$ = new Subject<void>();

  constructor(
    private firestore: FirestoreService ,
    private auth: AuthService

  ) { }
 
  ngOnDestroy(): void {
    // Emitir valor para romper todas las suscripciones
    this.destroy$.next();
    this.destroy$.complete();
     // Unsubscribe to avoid memory leaks
     if (this.getRideSubscribe) {
      this.getRideSubscribe.unsubscribe();
    }
  }

  logIn(username: string, password: string): Observable<any> {
    
    return new Observable((observer) => {
    this.auth.login(username, password)
       .then(user => {
         observer.next({ id: user.uid });
       }).catch(err => {
         observer.error(err);
       }); 
   });  

  }

  loginWithGoogle(): Observable<any> {
    
  return new Observable((observer) => {
  this.auth.loginWithGoogle()
     .then(user => {
       observer.next({ id: user.uid });
     }).catch(err => {
       observer.error(err);
     }); 
 });  

  }

  loginMicrosoft(): Observable<any> {
    
  return new Observable((observer) => {
  this.auth.loginMicrosoft()
     .then(user => {   //observer.next({ id: user.uid });
     }).catch(err => { observer.error(err);
     }); 
 });  

  }

  loginApple(): Observable<any> {
    
  return new Observable((observer) => {
  this.auth.loginApple()
     .then(user => { //  observer.next({ id: user.uid });
     }).catch(err => { observer.error(err);
     }); 
 });  

  }

  updateToken(id: string) {
    this.id = id;
    this.firestore.setUserId(id);
  }

  getUser(): Observable<any> {
    if(this.id){
       console.log('[ api.services.getUser() ]- User id =>'+ this.id);
       return from(this.firestore.getOne('clients', this.id));
    }
    console.log('[ api.services.getUser() ]-> return from(Promise.resolve(null))  <----- ERROR');
    return from(Promise.resolve(null));
  }
 
  getRide(rideId: any) : Observable<any> {
    if(rideId){
     return from(this.firestore.getOne('rides', rideId));
    } 
    return from(Promise.resolve(null));
  }

  setRideRejected2(rideId: any): Observable<any> {
    console.log('setRideRejected Start');
    console.dir(rideId);
       
    return this.updateRideData(rideId, { user_rejected: true });
    
  }
  setRideRejected(rideId: any): Observable<any> {

    console.log('setRideRejected Start');
    return this.updateRideData(rideId, { user_rejected: true })
            
  }

  updateRideData(rideId :any, data : any): Observable<any> {
    return from(this.firestore.update('rides', rideId, data));
  }
  getRideHistory(userId : string, orderByField : string): Observable<any> {
    return this.firestore.runHistoryQuery('rides', { field: 'clientId', operation: '==', searchKey: userId, orderby: orderByField });
  }

  loadMoreRides(userId: string, orderByField: string): Observable<any> {
    
    return this.firestore.loadMoreRides(userId, orderByField);
  }

  getRideHistoryPaginated( userId : string, orderByField: string, limitCount: number, lastDoc: DocumentSnapshot<any> | null  ): Observable<HistoryRide[]> {
    return this.firestore.getHistoryPaginated<HistoryRide>(userId, 'rides', orderByField, limitCount, lastDoc );
  }
 
  addIdToObject(id : string, obj: Observable<any>) {
    return new Observable((observer) => {
      if (id) {
        obj.subscribe(ref => { 
              const newObj = ref;
              if(newObj){
                 newObj.id = id;
              }
              observer.next(newObj);
             // observer.error({ message: 'No ID' });
        });
      } else {
        observer.error({ message: 'No ID' });
      }
    });
  }

  getDriver(driverId: any): Observable<any> {
    if(driverId){
      return from(this.firestore.getOne('drivers', driverId));
    }
    return from(Promise.resolve(null));
  }

  updateUser(id : any, userData: any): Observable<any> {
    //console.log('updateuser');
    return from(this.firestore.update('clients', id, userData));
  }

  setRideTimeOut(rideId: any): Observable<any> {
    return new Observable((observer) => 
    {
      this.getRideSubscribe = this.getRide(rideId).subscribe(ride => {
        console.log(ride);
        // Asegúrate de que no se vuelve a entrar si ride_accepted ya ha sido actualizado
       
          if (ride && !ride['ride_accepted']) 
          {
               this.updateRideData(rideId, { request_timeout: true }).subscribe(res => {
                                  observer.next({ message: [1] });
                                  // Aquí puedes desuscribirte para evitar el bucle
                                    if (this.getRideSubscribe) {
                                      this.getRideSubscribe.unsubscribe();
                                  }
                                 }, err => {
                                            observer.next({ message: [0] });
                                            // Desuscribirse también en caso de error
                                        if (this.getRideSubscribe) {
                                          this.getRideSubscribe.unsubscribe();
                                      }
                                 });              
          } else {  observer.next({ message: [0] }); 
                    // Desuscribir si la condición no se cumple
                    if (this.getRideSubscribe) {
                      this.getRideSubscribe.unsubscribe();
      }
        }
      }, 
      err => {  
        observer.error(err);
      });
    });
  }

  bookRide(rideData: any): Observable<any> {

    console.log('rideData =>');
    console.dir(rideData);

    const query = this.firestore.create('rides', rideData); // ✅ Modular create()
    return this.snapshotToDataConverter(query);
  }

  snapshotToDataConverter<T>(query: Promise<QueryDocumentSnapshot<T>>): Observable<T & { id: string }> {
    return new Observable((observer) => {
      query
        .then(ref => {
          const obj = ref.data();
          if (obj) {
            const result = { ...obj, id: ref.id };
            observer.next(result);
          } else {
            observer.next({} as T & { id: string }); // Devuelve objeto vacío con id si no hay data
          }
        })
        .catch(err => {
          console.error('Firestore create error:', err);
          observer.error(err);
        });
    });
  }

  signUp(user: any): Observable<any> {
  
    return new Observable((observer) => {
      this.auth.createAccount(user)
        .then(User => {
          console.log(User);
              user.id = User.uid;
              this.firestore.createWithId('clients', user).then(usr => {
                console.log(usr);
                observer.next(user);
              }, err => {
                observer.error(err);
              });
        }).catch(err => {
          observer.error(err);
        });
    });
  
  }

  addPaymentMethod(paymentMethod: any): Observable<any> {
    return this.snapshotToDataConverter(this.firestore.create('PaymentMethod', paymentMethod));
  }

  getPaymentMethod(clientId: string): Observable<any> {
  //return this.addIdToObject(clientId, this.firestore.getOne('PaymentMethod', clientId));
  return this.firestore.runHistoryQuery('PaymentMethod', { field: 'clientId', operation: '==', searchKey: clientId, orderby: 'paymentMethod' });
  }


  async setPaymentMethodDefault(documentId: string, PaymentMethodData: any){
  return await from(this.firestore.update('PaymentMethod', documentId, PaymentMethodData));
  }

   deletePaymentMethod(documentId: string): Promise<void> {
   return    this.firestore.delete('PaymentMethod',documentId)
 
  }


  async updatePassword(email: string, currentPassword : string, newPassword : string){
  try {

    await this.auth.resetPassword(email) ;
  } catch (error) {
    console.log('Error: No se pudo re-autenticar al usuario.');
    console.log('ERROR ' + error)
  }

}

logout() {
  return this.auth.logout();
}


}


