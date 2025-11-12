import { Injectable } from '@angular/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { Preferences } from '@capacitor/preferences';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root'
})
export class BiometricAuthService {
  private readonly CREDENTIALS_KEY = 'biometric_credentials';
  private readonly BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
  // Clave para encriptar - en producción, deberías usar una clave más segura
  private readonly ENCRYPTION_KEY = 'UAR_BIOMETRIC_KEY_2024';

  constructor() {}

  /**
   * Verifica si el dispositivo soporta autenticación biométrica
   */
  async isBiometricAvailable(): Promise<boolean> {
    try {
      const result = await BiometricAuth.checkBiometry();
      return result.isAvailable;
    } catch (error) {
      console.error('Error checking biometry availability:', error);
      return false;
    }
  }

  /**
   * Obtiene el tipo de biometría disponible (Face ID, Touch ID, etc)
   */
  async getBiometryType(): Promise<string> {
    try {
      const result = await BiometricAuth.checkBiometry();
      if (result.isAvailable && result.biometryType) {
        return String(result.biometryType);
      }
      return 'none';
    } catch (error) {
      console.error('Error getting biometry type:', error);
      return 'none';
    }
  }

  /**
   * Autentica al usuario usando biometría
   */
  async authenticate(reason: string = 'Inicia sesión con tu rostro'): Promise<boolean> {
    try {
      await BiometricAuth.authenticate({
        reason: reason,
        cancelTitle: 'Cancelar',
        allowDeviceCredential: true,
        iosFallbackTitle: 'Usar contraseña',
        androidTitle: 'Autenticación',
        androidSubtitle: 'UAR App',
        androidConfirmationRequired: false
      });
      return true;
    } catch (error: any) {
      console.error('Biometric authentication failed:', error);
      
      // Manejo específico de errores
      if (error.code === 'userCancel') {
        console.log('Usuario canceló la autenticación');
      } else if (error.code === 'biometryLockout') {
        console.log('Biometría bloqueada - demasiados intentos fallidos');
      } else if (error.code === 'biometryNotAvailable') {
        console.log('Biometría no disponible');
      }
      
      return false;
    }
  }

  /**
   * Encripta las credenciales
   */
  private encryptCredentials(email: string, password: string): string {
    const data = JSON.stringify({ email, password });
    return CryptoJS.AES.encrypt(data, this.ENCRYPTION_KEY).toString();
  }

  /**
   * Desencripta las credenciales
   */
  private decryptCredentials(encryptedData: string): { email: string; password: string } | null {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.ENCRYPTION_KEY);
      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error('Error decrypting credentials:', error);
      return null;
    }
  }

  /**
   * Guarda las credenciales encriptadas
   */
  async saveCredentials(email: string, password: string): Promise<void> {
    try {
      const encryptedData = this.encryptCredentials(email, password);
      await Preferences.set({
        key: this.CREDENTIALS_KEY,
        value: encryptedData
      });
      console.log('Credenciales guardadas exitosamente');
    } catch (error) {
      console.error('Error saving credentials:', error);
      throw error;
    }
  }

  /**
   * Recupera las credenciales guardadas (requiere autenticación biométrica)
   */
  async getCredentials(): Promise<{ email: string; password: string } | null> {
    try {
      const { value } = await Preferences.get({ key: this.CREDENTIALS_KEY });
      
      if (!value) {
        console.log('No hay credenciales guardadas');
        return null;
      }

      return this.decryptCredentials(value);
    } catch (error) {
      console.error('Error getting credentials:', error);
      return null;
    }
  }

  /**
   * Elimina las credenciales guardadas
   */
  async deleteCredentials(): Promise<void> {
    try {
      await Preferences.remove({ key: this.CREDENTIALS_KEY });
      await Preferences.remove({ key: this.BIOMETRIC_ENABLED_KEY });
      console.log('Credenciales eliminadas exitosamente');
    } catch (error) {
      console.error('Error deleting credentials:', error);
      throw error;
    }
  }

  /**
   * Verifica si hay credenciales guardadas
   */
  async hasStoredCredentials(): Promise<boolean> {
    try {
      const { value } = await Preferences.get({ key: this.CREDENTIALS_KEY });
      return value !== null && value !== '';
    } catch (error) {
      console.error('Error checking stored credentials:', error);
      return false;
    }
  }

  /**
   * Habilita/deshabilita la autenticación biométrica
   */
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    try {
      await Preferences.set({
        key: this.BIOMETRIC_ENABLED_KEY,
        value: enabled.toString()
      });
    } catch (error) {
      console.error('Error setting biometric enabled:', error);
      throw error;
    }
  }

  /**
   * Verifica si la autenticación biométrica está habilitada
   */
  async isBiometricEnabled(): Promise<boolean> {
    try {
      const { value } = await Preferences.get({ key: this.BIOMETRIC_ENABLED_KEY });
      return value === 'true';
    } catch (error) {
      console.error('Error checking biometric enabled:', error);
      return false;
    }
  }

  /**
   * Realiza el flujo completo de login con biometría
   */
  async loginWithBiometric(): Promise<{ email: string; password: string } | null> {
    try {
      // 1. Verificar si hay credenciales guardadas
      const hasCredentials = await this.hasStoredCredentials();
      if (!hasCredentials) {
        console.log('No hay credenciales guardadas para login biométrico');
        return null;
      }

      // 2. Autenticar con biometría
      const authenticated = await this.authenticate('Inicia sesión con tu rostro');
      if (!authenticated) {
        console.log('Autenticación biométrica fallida');
        return null;
      }

      // 3. Obtener credenciales
      const credentials = await this.getCredentials();
      return credentials;
    } catch (error) {
      console.error('Error in biometric login flow:', error);
      return null;
    }
  }
}

