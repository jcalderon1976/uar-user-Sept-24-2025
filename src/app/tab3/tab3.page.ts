import { Component, ViewChild, ElementRef } from '@angular/core';
import { InitUserProvider } from '../services/inituser/inituser.service';
import { UtilService } from '../services/util/util.service';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';
import { APIService } from '../services/api/api.service';
import { User } from '../models/user';
import { LegalComponent } from '../components/legal/legal.component';
import { SettingAccountComponent } from '../components/setting-account/setting-account.component';
import { CarInfoComponent } from '../components/car-info/car-info.component';
import { AlertController } from '@ionic/angular';
import { PhotoComponent } from '../components/photo/photo.component';
@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page {
  @ViewChild(PhotoComponent) photoComponent!: PhotoComponent;
  @ViewChild('toolbar', { read: ElementRef }) toolbarRef!: ElementRef;

  public loggedInUser: User;
  public image: string;

  constructor(
    private userProvider: InitUserProvider,
    private alertController: AlertController,
    private util: UtilService,
    private api: APIService,
    private router: Router
  ) {
    this.loggedInUser = this.userProvider.getUserData();
    // Intentar usar la imagen guardada en memoria primero
    const imageInMemory = this.userProvider.getUserProfileImageUrl();
    this.image = imageInMemory || this.loggedInUser.profile_img?.toString() || 'photos/userDefault.png';
  }

  ionViewWillLeave() {
    // 👇 Esto borra el foco antes de que el tab se oculte
    (document.activeElement as HTMLElement)?.blur();
  }

  ngAfterViewInit() {
    const toolbarEl = this.toolbarRef.nativeElement;
    const shadowRoot = toolbarEl.shadowRoot;

    if (shadowRoot) {
      const style = document.createElement('style');
      style.textContent = `
        .toolbar-background {
          background: linear-gradient(45deg, #5305FC, #000000) !important;
        }
      `;
      shadowRoot.appendChild(style);
    }
  }

  async refreshPage() {
    try {
      // Recargar datos desde la base de datos
      await this.userProvider.reloadUserData();
      
      // Actualizar datos locales
      this.loggedInUser = this.userProvider.getUserData();
      
      // Intentar usar la imagen guardada en memoria primero
      const imageInMemory = this.userProvider.getUserProfileImageUrl();
      this.image = imageInMemory || this.loggedInUser.profile_img?.toString() || 'photos/userDefault.png';

      if (this.photoComponent) {
        // Actualizar el componente de foto con la imagen en memoria si está disponible
        this.photoComponent.imageUrl = imageInMemory || this.image;
      }
      
      console.log('Página refrescada con datos actualizados');
    } catch (error) {
      console.error('Error al refrescar página:', error);
      // En caso de error, al menos actualizar desde memoria
      this.loggedInUser = this.userProvider.getUserData();
      const imageInMemory = this.userProvider.getUserProfileImageUrl();
      this.image = imageInMemory || this.loggedInUser.profile_img?.toString() || 'photos/userDefault.png';
    }
  }

  async logoutAction() {
    const alert = await this.alertController.create({
      header: 'Confirm',
      message: environment.LOGOUT_CONFIRMATION,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel', // ✅ Este botón cierra el alert sin acción
          cssClass: 'alert-button-custom',
        },
        {
          text: 'OK',
          handler: () => {
            console.log('OK clicked');
            this.logout();
          },
          cssClass: 'alert-button-custom',
        },
      ],
      cssClass: 'custom-alert-card',
    });
    await alert.present();
  }

  logout() {
    this.userProvider.logout().then((res) => {
      //this.util.goToNew('/loader');
      //this.router.navigate(['/loader']);
      sessionStorage.clear();
      localStorage.clear();
      this.router.navigate(['/login'], { replaceUrl: true });
    });
  }

  async openWallet() {
  
  }

  async openCarInfo() {
    const modal = await this.util.createModal(CarInfoComponent);
    modal.onWillDismiss().then(async (dataReturned) => {
      this.refreshPage();
    });

    return await modal.present();
  }

  async openLegal() {
    const modal = await this.util.createModal(LegalComponent);

    modal.onWillDismiss().then(async (dataReturned) => {
      if (dataReturned != null) {
        this.refreshPage();
      }
    });
    return await modal.present();
  }

  async openSetting() {
    const modal = await this.util.createModal(SettingAccountComponent);

    modal.onWillDismiss().then(async (dataReturned) => {
      this.refreshPage();
    });
    return await modal.present();
  }
}
