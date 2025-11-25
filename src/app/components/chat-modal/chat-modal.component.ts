import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ChatService, Message } from '../../services/api/chat.service';
import { Subscription } from 'rxjs';
import { InitUserProvider } from '../../services/inituser/inituser.service';

@Component({
  selector: 'app-chat-modal',
  templateUrl: './chat-modal.component.html',
  styleUrls: ['./chat-modal.component.scss'],
  standalone: false,
})
export class ChatModalComponent implements OnInit, OnDestroy {
  @Input() rideId!: string;
  @Input() driverId!: string;
  @Input() driverName!: string;
  @Input() clientId!: string;
  @Input() clientName!: string;

  messages: Message[] = [];
  newMessage: string = '';
  chatId: string = '';
  messagesSubscription?: Subscription;
  currentUserId: string = '';

  constructor(
    private modalController: ModalController,
    private chatService: ChatService,
    private userProvider: InitUserProvider
  ) {}

  async ngOnInit() {
    const user = this.userProvider.getUserData();
    this.currentUserId = user?.id || '';
    
    // Crear o obtener el chat
    try {
      this.chatId = await this.chatService.getOrCreateChatByRide(
        this.rideId,
        this.driverId,
        this.driverName,
        this.clientId,
        this.clientName
      );

      // Suscribirse a los mensajes
      this.messagesSubscription = this.chatService.getMessages(this.chatId).subscribe(
        (messages) => {
          this.messages = messages;
          // Scroll al final después de un pequeño delay para asegurar que el DOM se actualice
          setTimeout(() => this.scrollToBottom(), 100);
        }
      );

      // Marcar mensajes como leídos
      await this.chatService.markAsRead(this.chatId);
    } catch (error) {
      console.error('Error inicializando chat:', error);
    }
  }

  ngOnDestroy() {
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }
  }

  async sendMessage() {
    if (!this.newMessage.trim() || !this.chatId) return;

    try {
      await this.chatService.sendMessage(
        this.chatId,
        this.currentUserId === this.clientId ? this.driverId : this.clientId,
        this.newMessage.trim(),
        this.rideId,
        this.clientId,
        this.driverId
      );
      this.newMessage = '';
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    }
  }

  closeModal() {
    this.modalController.dismiss();
  }

  isMyMessage(message: Message): boolean {
    return message.senderId === this.currentUserId;
  }

  formatTime(timestamp: Date | any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes}m`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  private scrollToBottom() {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
}

