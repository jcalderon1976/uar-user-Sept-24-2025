// app-storage.service.ts
import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({ providedIn: 'root' })
export class AppStorage {
  private storageReady!: Promise<void>;
  constructor(private storage: Storage) {
    this.storageReady = this.storage.create().then(() => {});
  }
  private async ensure() { await this.storageReady; }

  async set<T>(k: string, v: T) { await this.ensure(); return this.storage.set(k, v); }
  async get<T>(k: string)       { await this.ensure(); return this.storage.get(k); }
  async remove(k: string)       { await this.ensure(); return this.storage.remove(k); }
}