import { Component , OnInit } from '@angular/core';
import { GmapService } from '../services/gmap/gmap.service'

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage implements OnInit {

  constructor( private gmap: GmapService) {}

  async ngOnInit() {
       await this.gmap.loadGoogleMaps();
  }

}
