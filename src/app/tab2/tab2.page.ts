import {
  Component,
  ViewChild,
  OnInit,
  AfterViewInit,
  ElementRef,
} from '@angular/core';
import { InitUserProvider } from '../services/inituser/inituser.service';
import { UtilService } from '../services/util/util.service';
import { APIService } from '../services/api/api.service';
import { IonInfiniteScroll, ModalController } from '@ionic/angular';
import { User } from '../models/user';
import { HistoryRide } from '../models/historyRides';
import { RideDetailsPage } from '../pages/ride-details/ride-details.page';
import { firstValueFrom } from 'rxjs';
import { RideService } from '../services/ride/ride.service';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit {
  @ViewChild(IonInfiniteScroll, { static: false })
  infiniteScroll!: IonInfiniteScroll;

  public rides: HistoryRide[] = [];
  public loader!: HTMLIonLoadingElement;
  private lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  private pageSize = 5;
  loadingMore = false;
  userId!: string;

  constructor(
    private api: APIService,
    private userProvider: InitUserProvider,
    private util: UtilService,
    private ride: RideService,
    public modalController: ModalController
  ) {}

  ionViewWillLeave() {
    // 👇 Esto borra el foco antes de que el tab se oculte
    (document.activeElement as HTMLElement)?.blur();
  }

  ngAfterViewInit() {
   
  }

  ngOnInit() {
    const loggedInUser: User = this.userProvider.getUserData(); //get user data from provider

    if (loggedInUser && loggedInUser.id) {
      this.userId = loggedInUser.id; // Get the user ID (token)
      this.loadHistory(loggedInUser.id); // Load the history
    } else {
      console.error('User data is not available');
    }
  }

  /** Show Loader */
  async showLoader() {
    this.loader = await this.util.createLoader('Loading history ...');
    await this.loader.present();
  }

  /** Dismiss Loader */
  async dismissLoader() {
    if (this.loader) {
      await this.loader.dismiss();
      (document.activeElement as HTMLElement)?.blur(); // 👈 evita el warning
    }
  }

  async loadHistory(userId: any) {
    try {
      await this.showLoader(); // Para la carga inicial, usamos getHistory que ya aplica el límite
      await this.getHistory(userId);
      await this.dismissLoader();
    } catch (error) {
      console.warn('No rides found o error:', error);
      this.rides = []; // Asegúrate que se vacíe si no hay
    } finally {
      await this.dismissLoader(); // 🔥 Siempre cerrar loader
    }
  }

  async getHistory(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.api
        .getRideHistoryPaginated(
          userId,
          'createdAt',
          this.pageSize,
          this.lastDoc
        )
        .subscribe(
          async (rides: HistoryRide[]) => {
            if (rides.length > 0) {
              // 1. Convierte primero (esto NO tiene direcciones aún)
              this.rides = this.util.latLngConverterSQL(rides);

              // 2. Actualiza las direcciones
              await this.updateRides(rides);

              // 3. Asigna a this.rides después que todo esté listo
              this.rides = rides;

              // 4. Actualiza lastDoc
              this.lastDoc = rides[rides.length - 1][
                '__snapshot__'
              ] as QueryDocumentSnapshot<DocumentData>; // ✅ Asegurar el tipo correcto

              resolve();
            } else {
              reject('No rides found');
            }
          },
          (error) => {
            reject(error);
          }
        );
    });
  }

  async loadMore(event: any) {
    if (this.loadingMore) return;
    this.loadingMore = true;

    try {
      const moreRides = await firstValueFrom(
        this.api.getRideHistoryPaginated(
          this.userId,
          'createdAt',
          this.pageSize,
          this.lastDoc
        )
      );

      if (moreRides && moreRides.length > 0) {
        // 🔸 Actualiza direcciones antes de asignar
        await this.updateRides(moreRides);

        this.rides = [...this.rides, ...moreRides];
        this.lastDoc = moreRides[moreRides.length - 1][
          '__snapshot__'
        ] as QueryDocumentSnapshot<DocumentData>; // ✅ Asegurar el tipo correcto
      } else {
        event.target.disabled = true;
      }

      event.target.complete();
    } catch (error) {
      console.error('Error loading more rides:', error);
    }

    this.loadingMore = false;
  }

  /** Update Rides with Address Info */
  async updateRides(rides: HistoryRide[]) {
    for (const ride of rides) {
      try {
        // Get the origin address using your ride service
        const originPromise = await firstValueFrom(this.ride.getOrigin(ride));
        if (originPromise.results?.length) {
          ride.origin_address = originPromise.results[0].formatted_address;
        }
        // Get the destination address using your ride service
        const destinationRes = await firstValueFrom(
          this.ride.getDestination(ride)
        );
        if (destinationRes.results?.length) {
          ride.destination_address =
            destinationRes.results[0].formatted_address;
        }
      } catch (err) {
        console.error('Error updating ride addresses:', err);
      }
    }
  }

  /** Dismiss and Navigate Home */
  dismiss() {
    this.util.goToNew('/home');
  }

  /** Infinite Scroll Example */
  loadData(event: any) {
    setTimeout(() => {
      event.target.complete();
      event.target.disabled = true;
    }, 20);
  }

  /** Show Ride Details in Modal */
  async showInfo(ride: HistoryRide) {
    const detailModal = await this.util.createModal(RideDetailsPage, {  historyRide: ride }); // Pass the object here
    await detailModal.present();
  }
}
