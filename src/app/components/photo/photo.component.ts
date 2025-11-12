import { Component, OnInit } from '@angular/core';
import { PhotoService } from '../../services/util/photo.service'; 
import { CommonModule } from '@angular/common';
import { User } from '../../models/user'; // Adjusted the path to match the relative location
import { APIService} from 'src/app/services/api/api.service';
import { Subscription ,Subject } from 'rxjs';
import { InitUserProvider } from 'src/app/services/inituser/inituser.service';

@Component({
  selector: 'app-photo',
  templateUrl: './photo.component.html',
  styleUrls: ['./photo.component.scss'],
  standalone: false,
})
export class PhotoComponent  implements OnInit {

  imageUrl: string | null = null;
  public loggedInUser!: User;
  private userSubscription!: Subscription;  // Store the subscription
  private destroy$ = new Subject<void>();

  constructor(private camaraService: PhotoService ,
              private apiService: APIService,
              private userProvider: InitUserProvider, // Inyectar el servicio de usuario
)// Inyectar el servicio de cámara
 { }

 ngOnDestroy(): void {
  // Emitir valor para romper todas las suscripciones
  this.destroy$.next();
  this.destroy$.complete();

   // Unsubscribe to avoid memory leaks
   if (this.userSubscription) {
    this.userSubscription.unsubscribe();
  }
  
}

 async ngOnInit() {

  this.loggedInUser = this.userProvider.getUserData();
  this.imageUrl = this.loggedInUser.profile_img?.toString() || 'https://firebasestorage.googleapis.com/v0/b/uar-platform.firebasestorage.app/o/photos%2FuserDefault.png?alt=media&token=ef06263c-9e2a-4e6d-9198-1898fd5c19df';

  this.camaraService.getImageUrl(this.imageUrl)
    .then(url => {
      this.imageUrl = url;
    })
    .catch(err => {
      console.error('Error fetching image URL', err);
      this.imageUrl = 'https://firebasestorage.googleapis.com/v0/b/uar-platform.firebasestorage.app/o/photos%2FuserDefault.png?alt=media&token=ef06263c-9e2a-4e6d-9198-1898fd5c19df'; // Default image if error occurs
    });
    
}

  async tomarFoto() {
    console.log('🎯 Botón de cámara presionado');
    
    try {
      this.userSubscription = this.apiService.getUser().subscribe(async (responseUser: any) => {
        console.log('👤 Usuario obtenido:', responseUser.email);
        
        try {
          console.log('📸 Llamando al servicio de cámara...');
          const result = await this.camaraService.tomarFotoYSubir(responseUser.email);
          
          console.log('✅ Foto subida exitosamente:', result);
          this.imageUrl = result;
          responseUser.profile_img = this.imageUrl;
          
          await this.apiService.updateUser(responseUser.id, responseUser);
          console.log('💾 Usuario actualizado en base de datos');
          
          // Recargar datos del usuario en memoria
          try {
            await this.userProvider.reloadUserData();
            console.log('🔄 Usuario recargado en memoria después de actualizar foto');
          } catch (reloadError) {
            console.error('❌ Error al recargar usuario en memoria:', reloadError);
          }
          
          alert('✅ Foto actualizada exitosamente!');
          
        } catch (err: any) {
          console.error('❌ Error al tomar/subir foto:', err);
          
          let errorMessage = 'Error al capturar la foto';
          
          if (err.message?.includes('denied') || err.message?.includes('denegado')) {
            errorMessage = 'Permisos de cámara denegados. Por favor, habilítalos en Configuración.';
          } else if (err.message?.includes('cancelled') || err.message?.includes('cancelado')) {
            errorMessage = 'Captura de foto cancelada';
          } else if (err.message) {
            errorMessage = err.message;
          }
          
          alert('❌ ' + errorMessage);
        }
      });
    } catch (err) {
      console.error('❌ Error general:', err);
      alert('❌ Error al procesar la solicitud');
    }
  }
  
  async seleccionarFoto() {
    try {
      const blob = await this.camaraService.pickFromGallery();
      const url = await this.camaraService.uploadPhoto(blob);
      console.log('Foto subida desde galería:', url);
      this.imageUrl = url;
      
      // Actualizar en la base de datos
      const user = this.userProvider.getUserData();
      user.profile_img = url;
      await this.apiService.updateUser(user.id, { profile_img: url });
      
      // Recargar datos del usuario en memoria
      try {
        await this.userProvider.reloadUserData();
        console.log('🔄 Usuario recargado en memoria después de seleccionar foto de galería');
      } catch (reloadError) {
        console.error('❌ Error al recargar usuario en memoria:', reloadError);
      }
      
      alert('✅ Foto actualizada exitosamente!');
    } catch (err) {
      console.error('❌ Error al seleccionar/subir foto:', err);
      alert('❌ Error al procesar la foto');
    }
  }


  
  
}
