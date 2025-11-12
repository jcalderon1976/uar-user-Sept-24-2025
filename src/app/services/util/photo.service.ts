import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Firestore, doc, setDoc,getDoc, collection, addDoc as firestoreAddDoc } from '@angular/fire/firestore';

@Injectable({
    providedIn: 'root',
})
export class PhotoService {

    imageUrl: string | null = null;

    constructor(private firestore: Firestore) {}
    
    storage = getStorage();
  
    async tomarFotoYSubir(photoName: string): Promise<any> {
        console.log('📸 Iniciando captura de foto...');
        
        try {
          // Verificar permisos primero
          const permissions = await Camera.checkPermissions();
          console.log('📋 Permisos de cámara:', permissions);
          
          if (permissions.camera !== 'granted') {
            console.log('🔐 Solicitando permisos de cámara...');
            const requestResult = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
            console.log('✅ Resultado de solicitud de permisos:', requestResult);
            
            if (requestResult.camera !== 'granted') {
              throw new Error('Permiso de cámara denegado');
            }
          }

          console.log('📷 Abriendo cámara...');
          const image = await Camera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.Base64,
            source: CameraSource.Camera,
            saveToGallery: false,
            correctOrientation: true
          });
        
          console.log('✅ Foto capturada exitosamente');
          
          if (!image.base64String) {
            throw new Error('No se pudo obtener la imagen en formato base64');
          }

          const base64 = image.base64String;
          const fileName = `photos/${photoName}.jpeg`;
          const imageRef = ref(this.storage, fileName);
        
          console.log('🔄 Convirtiendo imagen a blob...');
          const blob = this.base64ToBlob(base64, 'image/jpeg');
          
          console.log('☁️ Subiendo imagen a Firebase Storage...');
          await uploadBytes(imageRef, blob);
          console.log('✅ Imagen subida exitosamente!');
          
          const url = await getDownloadURL(imageRef);
          console.log('🔗 URL de imagen obtenida:', url);
          
          await this.addDoc(collection(this.firestore, 'photos'), { url, created: new Date() });
          console.log('💾 Registro guardado en Firestore');

          return url;

        } catch (err: any) {
          console.error('❌ Error en tomarFotoYSubir:', err);
          console.error('📝 Detalles del error:', {
            message: err.message,
            code: err.code,
            name: err.name
          });
          throw err; // Re-lanzar el error para que el componente lo maneje
        }
      }

    base64ToBlob(base64Data: string, contentType: string): Blob {
        const byteCharacters = atob(base64Data);
        const byteArrays = [];

        for (let i = 0; i < byteCharacters.length; i += 512) {
            const slice = byteCharacters.slice(i, i + 512);
            const byteNumbers = new Array(slice.length);
            for (let j = 0; j < slice.length; j++) {
                byteNumbers[j] = slice.charCodeAt(j);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }

        return new Blob(byteArrays, { type: contentType });
    }

    async pickFromGallery(): Promise<Blob> {
        const image = await Camera.getPhoto({
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Photos,
            quality: 90,
        });
    
        const res = await fetch(image.dataUrl!);
        return await res.blob();
    }

    async uploadPhoto(blob: Blob) {
        const storage = getStorage();
        const filePath = `photos/${Date.now()}.jpeg`;
        const photoRef = ref(storage, filePath);

        await uploadBytes(photoRef, blob)
            .then((snapshot) => {
                console.log('Foto subida!');
            })
            .catch((error) => {
                console.error('Error al subir', error);
            });

        const url = await getDownloadURL(photoRef);

        await this.addDoc(collection(this.firestore, 'photos'), { url, created: new Date() });
        return url;
    }

    private async addDoc(collectionRef: any, data: { url: string; created: Date }): Promise<void> {
        try {
            await firestoreAddDoc(collectionRef, data);
            console.log('Documento agregado a Firestore:', data);
        } catch (error) {
            console.error('Error al agregar documento a Firestore:', error);
        }
    }


    getImageUrl(filePath: string): Promise<string> {
        const imageRef = ref(this.storage, filePath);
        return getDownloadURL(imageRef);
    }

    async uploadPhotoAndSavePath(blob: Blob, userId: string): Promise<void> {
        const fileName = `photos/${Date.now()}.jpeg`;
        const imageRef = ref(this.storage, fileName);
      
        await uploadBytes(imageRef, blob);
      
        // Guarda el path en Firestore bajo el documento del usuario
        const userDocRef = doc(this.firestore, `users/${userId}`);
        await setDoc(userDocRef, {
          photoPath: fileName
        }, { merge: true });
      }


      async loadUserPhoto(userId: string) {
        const userDocRef = doc(this.firestore, `users/${userId}`);
        const docSnap = await getDoc(userDocRef);
      
        if (docSnap.exists()) {
          const data = docSnap.data();
          const path = data['photoPath'];
      
          if (path) {
            this.getImageUrl(path)
              .then(url => {
                this.imageUrl = url;
              });
          }
        } else {
          console.log("No user photo found");
        }
      }

}
function addDoc(arg0: any, arg1: { url: string; created: Date; }) {
    throw new Error('Function not implemented.');
}

