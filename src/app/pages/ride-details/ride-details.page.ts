import {
  Component,
  OnInit,
  Input,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { NavParams, ModalController } from '@ionic/angular';
import { RideService } from '../../services/ride/ride.service';
import { APIService } from '../../services/api/api.service';
import { environment } from '../../../environments/environment';
import { map, Observable, first } from 'rxjs';
import { MapDirectionsService, GoogleMap } from '@angular/google-maps';
import { Ride } from 'src/app/models/ride';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { GoogleMapsModule } from '@angular/google-maps';
import { HistoryRide } from 'src/app/models/historyRides';

@Component({
  selector: 'app-ride-details',
  templateUrl: './ride-details.page.html',
  styleUrls: ['./ride-details.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, GoogleMapsModule], // ✅ Import FormsModule
})
export class RideDetailsPage implements OnInit, AfterViewInit {
  @ViewChild('googleMap', { static: false }) googleMap!: GoogleMap;
  @Input() historyRide!: HistoryRide;   // tipa según tu modelo
  rideInfo!: Ride;

  public lat!: number;
  public lng!: number;
  public originAddr: any;
  public destinationAddr: any;
  public driver!: string;
  public customer!: string;
  // Variables for Google Maps
  directionsResults$!: Observable<google.maps.DirectionsResult | undefined>;
  position!: google.maps.LatLngLiteral;
  zoom = 10;
  center!: google.maps.LatLngLiteral;
  options: google.maps.MapOptions = {
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    styles: environment.MAP_STYLE,
    disableDoubleClickZoom: true,
    maxZoom: 25,
    disableDefaultUI: true,
  };

  vertices!: google.maps.LatLngLiteral[];
  markers = [];
  infoContent = '';
  private hasFittedBounds = false; // Flag para evitar múltiples ajustes

  constructor(
    public modalController: ModalController,
    private navParams: NavParams, // Access passed data
    private ride: RideService,
    private mapDirectionsService: MapDirectionsService,
    private api: APIService
  ) {}

  ngAfterViewInit() {
    // Esperar a que el mapa esté listo y luego ajustar el zoom
    setTimeout(() => {
      this.fitMapToRoute();
    }, 500);
  }

  ngOnInit() {

    console.log('historyRide', this.historyRide);
    //If this.rideInfo is null????
    this.rideInfo =   this.historyRide; // this.navParams.data['dataFromParent'].componentProps.rideInfo; // this.navParams.get('rideInfo'); // Get the passed object

    console.log('Ride Info:', this.rideInfo);

    // Set the map center to the ride's origin coordinates.
    this.center = {
      lat: this.rideInfo.origin_lat,
      lng: this.rideInfo.origin_lng,
    };

    // Create a directions request for the route between origin and destination.
    const request: google.maps.DirectionsRequest = {
      origin: { lat: this.rideInfo.origin_lat, lng: this.rideInfo.origin_lng },
      destination: {
        lat: this.rideInfo.destination_lat,
        lng: this.rideInfo.destination_lng,
      },
      travelMode: google.maps.TravelMode.DRIVING,
    };
    this.directionsResults$ = this.mapDirectionsService
      .route(request)
      .pipe(map((response) => response.result));
    
    // Suscribirse a los resultados para ajustar el zoom cuando estén disponibles
    this.directionsResults$.pipe(first()).subscribe((result) => {
      if (result) {
        // Esperar un poco para que el mapa se renderice
        setTimeout(() => {
          this.fitMapToRoute();
        }, 300);
      }
    });

    // Subscribe to the origin address from the RideService.
    this.ride.getOrigin(this.rideInfo).subscribe({
      next: (res) => {
        console.log('Origin geocode response:', res);
        if (res && res.results && res.results[0]) {
          this.originAddr = res.results[0].formatted_address;
        }
      },
      error: (err) => console.error('Error obtaining origin address:', err),
    });

    // Subscribe to the destination address from the RideService.
    // A slight delay (10 ms) is applied if necessary.
    setTimeout(() => {
      this.ride.getDestination(this.rideInfo).subscribe({
        next: (res) => {
          console.log('Destination geocode response:', res);
          if (res && res.results && res.results.length) {
            this.destinationAddr = res.results[0].formatted_address;
          }
        },
        error: (err) =>
          console.error('Error obtaining destination address:', err),
      });
    }, 10);

    // Retrieve the driver's details.
    if (this.rideInfo.driverId) {
      this.api.getDriver(this.rideInfo.driverId).subscribe((res) => {
        this.driver = res['name'];
      });
    }

    // Retrieve the customer's details.
    this.api.getUser().subscribe((res) => {
      this.customer = res['name'];
    });
  }

  goBack() {
    this.modalController.dismiss(null, 'cancel');
  }

  cancel() {
    this.modalController.dismiss(null, 'cancel');
  }

  /**
   * Ajusta el zoom del mapa para mostrar toda la ruta
   */
  private fitMapToRoute(): void {
    if (this.hasFittedBounds) {
      return; // Ya se ajustó, no hacerlo de nuevo
    }

    const mapInstance = this.googleMap?.googleMap;
    if (!mapInstance) {
      console.warn('⚠️ Google Map instance no está disponible aún');
      return;
    }

    // Si tenemos resultados de direcciones, usar esos para ajustar el zoom
    this.directionsResults$.pipe(first()).subscribe((result) => {
      if (result && result.routes && result.routes.length > 0) {
        const route = result.routes[0];
        const bounds = new google.maps.LatLngBounds();

        // Agregar todos los puntos de la ruta al bounds
        route.legs?.forEach((leg) => {
          bounds.extend(leg.start_location);
          bounds.extend(leg.end_location);

          // Agregar todos los pasos de la ruta
          leg.steps?.forEach((step) => {
            step.path?.forEach((point) => {
              bounds.extend(point);
            });
          });
        });

        if (!bounds.isEmpty()) {
          mapInstance.fitBounds(bounds, {
            top: 50,
            right: 50,
            bottom: 50,
            left: 50,
          });
          this.hasFittedBounds = true;
          console.log('✅ Zoom ajustado para mostrar toda la ruta');
        }
      } else {
        // Si no hay resultados de direcciones, usar origen y destino
        const bounds = new google.maps.LatLngBounds();
        bounds.extend({
          lat: this.rideInfo.origin_lat,
          lng: this.rideInfo.origin_lng,
        });
        bounds.extend({
          lat: this.rideInfo.destination_lat,
          lng: this.rideInfo.destination_lng,
        });

        if (!bounds.isEmpty()) {
          mapInstance.fitBounds(bounds, {
            top: 50,
            right: 50,
            bottom: 50,
            left: 50,
          });
          this.hasFittedBounds = true;
          console.log('✅ Zoom ajustado usando origen y destino');
        }
      }
    });
  }
}
