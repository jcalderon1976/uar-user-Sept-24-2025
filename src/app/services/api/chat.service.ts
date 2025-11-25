import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, where, 
         onSnapshot, Timestamp, doc, updateDoc, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { InitUserProvider } from '../inituser/inituser.service';
import { getDoc, increment, setDoc } from 'firebase/firestore';

export interface Message {
  id?: string;
  chatId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  text: string;
  timestamp: Date | any;
  read: boolean;
  type: 'text' | 'image' | 'audio';
  rideID?: string;
  clientId?: string;
  driverId?: string;
}

export interface Chat {
  id?: string;
  participants: string[];
  participantNames: { [key: string]: string };
  participantUser?: string;
  participantDriver?: string;
  lastMessage: string;
  lastMessageTime: Date | any;
  unreadCount: { [key: string]: number } | number;
  rideId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  
  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private userProvider: InitUserProvider
  ) {}

  // Crear o obtener un chat entre usuario y conductor basado en rideId
  async getOrCreateChatByRide(rideId: string, driverId: string, driverName: string, clientId: string, clientName: string): Promise<string> {
    const user = this.userProvider.getUserData();
    if (!user || !user.id) throw new Error('No user logged in');

    // Usar rideId como chatId (único por ride)
    let chatId = rideId;
    
    // Verificar si el chat ya existe
    const chatRef = doc(this.firestore, `chats/${chatId}`);
    const chatDoc = await getDoc(chatRef);

    if (!chatDoc.exists()) {
      // Crear nuevo chat
      const chat: Chat = {
        participants: [clientId, driverId],
        participantNames: {
          [clientId]: clientName,
          [driverId]: driverName
        },
        participantUser: clientId,
        participantDriver: driverId,
        lastMessage: '',
        lastMessageTime: Timestamp.fromDate(new Date()),
        unreadCount: {
          [clientId]: 0,
          [driverId]: 0
        },
        rideId: rideId
      };
      
      await setDoc(chatRef, chat);
    }

    return chatId;
  }

  // Crear o obtener un chat entre dos usuarios (método original para compatibilidad)
  async getOrCreateChat(receiverId: string, receiverName: string): Promise<string> {
    const user = this.userProvider.getUserData();
    if (!user || !user.id) throw new Error('No user logged in');

    const chatId = this.generateChatId(user.id, receiverId);
    
    // Verificar si el chat ya existe
    const chatRef = doc(this.firestore, `chats/${chatId}`);
    const chatDoc = await getDoc(chatRef);

    if (!chatDoc.exists()) {
      // Crear nuevo chat
      const chat: Chat = {
        participants: [user.id, receiverId],
        participantNames: {
          [user.id]: user.name || 'Usuario',
          [receiverId]: receiverName
        },
        lastMessage: '',
        lastMessageTime: Timestamp.fromDate(new Date()),
        unreadCount: {
          [user.id]: 0,
          [receiverId]: 0
        }
      };
      
      await setDoc(chatRef, chat);
    }

    return chatId;
  }

  // Enviar mensaje con información del ride
  async sendMessage(chatId: string, receiverId: string, text: string, rideId?: string, clientId?: string, driverId?: string) {
    const user = this.userProvider.getUserData();
    if (!user || !user.id) throw new Error('No user logged in');

    const message: Omit<Message, 'id'> = {
      chatId,
      senderId: user.id,
      senderName: user.name || 'Usuario',
      receiverId,
      text,
      timestamp: new Date(),
      read: false,
      type: 'text',
      rideID: rideId,
      clientId: clientId,
      driverId: driverId
    };

    // Agregar mensaje a la colección
    const messagesRef = collection(this.firestore, 'messages');
    await addDoc(messagesRef, {
      ...message,
      timestamp: Timestamp.fromDate(message.timestamp)
    });

    // Actualizar último mensaje en el chat
    const chatRef = doc(this.firestore, `chats/${chatId}`);
    const updateData: any = {
      lastMessage: text,
      lastMessageTime: Timestamp.fromDate(new Date())
    };
    
    // Actualizar unreadCount
    if (typeof receiverId === 'string') {
      updateData[`unreadCount.${receiverId}`] = increment(1);
    }
    
    await updateDoc(chatRef, updateData);
  }

  // Obtener mensajes en tiempo real
  getMessages(chatId: string): Observable<Message[]> {
    const messagesRef = collection(this.firestore, 'messages');
    // Solo usar where, sin orderBy para evitar necesidad de índice compuesto
    const q = query(
      messagesRef,
      where('chatId', '==', chatId)
    );

    return new Observable(observer => {
      const unsubscribe = onSnapshot(
        q, 
        (snapshot) => {
          const messages: Message[] = [];
          snapshot.forEach(doc => {
            try {
              const data = doc.data();
              const timestamp = data['timestamp']?.toDate 
                ? data['timestamp'].toDate() 
                : (data['timestamp'] ? new Date(data['timestamp']) : new Date());
              
              messages.push({
                id: doc.id,
                chatId: data['chatId'] || chatId,
                senderId: data['senderId'] || '',
                senderName: data['senderName'] || 'Usuario',
                receiverId: data['receiverId'] || '',
                text: data['text'] || '',
                timestamp: timestamp,
                read: data['read'] || false,
                type: data['type'] || 'text'
              } as Message);
            } catch (error) {
              console.error('Error al procesar mensaje:', error, doc.data());
            }
          });
          
          // Ordenar mensajes por timestamp en el cliente (ascendente)
          messages.sort((a, b) => {
            const timeA = a.timestamp.getTime();
            const timeB = b.timestamp.getTime();
            return timeA - timeB;
          });
          
          observer.next(messages);
        },
        (error) => {
          console.error('Error en suscripción de mensajes:', error);
          observer.error(error);
        }
      );

      return () => unsubscribe();
    });
  }

  // Obtener lista de chats del usuario
  getUserChats(): Observable<Chat[]> {
    const user = this.userProvider.getUserData();
    if (!user || !user.id) return new Observable(obs => obs.next([]));

    const chatsRef = collection(this.firestore, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', user.id)
    );

    return collectionData(q, { idField: 'id' }) as Observable<Chat[]>;
  }

  // Marcar mensajes como leídos
  async markAsRead(chatId: string) {
    const user = this.userProvider.getUserData();
    if (!user || !user.id) return;

    const chatRef = doc(this.firestore, `chats/${chatId}`);
    await updateDoc(chatRef, {
      [`unreadCount.${user.id}`]: 0
    });
  }

  private generateChatId(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join('_');
  }
}