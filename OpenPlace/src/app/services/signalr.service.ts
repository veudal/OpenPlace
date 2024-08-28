import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SignalRService {
  private hubConnection: signalR.HubConnection;

  constructor() {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(environment.endpointUrl + "/hub", {
      skipNegotiation: true,
      transport: signalR.HttpTransportType.WebSockets
    }).build();
  }

  startConnection(): Observable<void> {
    return new Observable<void>((observer) => {
      this.hubConnection
        .start()
        .then(() => {
          console.log('Connection established with SignalR hub');
          observer.next();
          observer.complete();
        })
        .catch((error) => {
          console.error('Error connecting to SignalR hub:', error);
          observer.error(error);
        });
    });
  }

  receiveMessage(): Observable<string> {
    return new Observable<string>((observer) => {
      this.hubConnection.on('RM', (message: string) => {
        observer.next(message);
      });
    });
  }

  //sendMessage(message: string): void {
  //  this.hubConnection.invoke('SendMessage', message);
  //}
}
