import { Component } from '@angular/core';
//import { App } from '@capacitor/app'; // Commented out due to missing module or type declarations
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private router: Router) {
    //this.initializeApp();
  }

/*  initializeApp() {
    App.addListener('appUrlOpen', (event: any) => {
      const url = event.url;
  
      if (url?.startsWith('myapp://payment-response')) {
        // Puedes procesar el retorno, por ejemplo:
        const status = this.getQueryParam(url, 'status'); // función abajo
        console.log('Pago retornado con estado:', status);
        this.router.navigate(['/payment-response'], { queryParams: { status } });
      }
    });
    
  }
 
  getQueryParam(url: string, key: string): string | null {
    const match = url.match(new RegExp(`[?&]${key}=([^&]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  }
 */

  ionViewWillLeave() {
    // 👇 Esto borra el foco antes de que el tab se oculte
    (document.activeElement as HTMLElement)?.blur();
  }
}
