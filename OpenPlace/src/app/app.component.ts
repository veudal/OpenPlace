import { Component, OnInit, isDevMode } from '@angular/core';
import { Pixel } from './models/Pixel.model';
import { HoverPixel } from './models/HoverPixel';
import Pickr from '@simonwep/pickr';
import { environment } from '../environments/environment';
import { BoardSize } from './interfaces/BoardSize.interface';
import { Leaderboard } from './interfaces/Leaderboard.interface';
import { SignalRService } from './services/signalr.service';
import { ViewSettings } from './interfaces/ViewSettings.interface';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})

export class AppComponent implements OnInit {
  title: string = 'Open Place';

  colorPalette: string[] = ["000000", "000000", "FFFFFF", "0000FF", "00FFFF", "FF0000", "00FF00", "FFFF00", "FF00FF", "7c4dff"];
  defaultColor: string = "FFFFFF";
  username: string | null = localStorage.getItem("username");

  timeoutId: number | null = null;
  zoomLevel: number = 1;

  audio: HTMLAudioElement = new Audio("assets/sfx/place.mp3");
  pickr: Pickr | null = null;

  hoverPixel: HoverPixel = new HoverPixel(-1, -1, "");
  boardArr: Pixel[] = [];
  pixelQueue: Pixel[] = [];
  dimensions: BoardSize = { width: 256, height: 256 };
  minZoom = 1;
  maxZoom = Math.min(this.dimensions.width, this.dimensions.height) / 10;

  originX: number = 0;
  originY: number = 0;
  selectedColor: number = 1;

  sliderValue = 0;
  sliderDragState = false;
  isSliderVisible = false; //Has to be false until board has been loaded
  sliderOptions = {
    ceil: 0,
    vertical: true,
    showSelectionBar: true,
    rightToLeft: true
  };

  canvas: any;
  ctx: any;

  constructor(private signalRService: SignalRService) { }

  async ngOnInit() {
    this.init();
    this.initCanvasEvents();
    this.initWindowResizeEvent();
    this.initSignalR();
    this.initDocumentEvents();
    this.initPaletteContainer();
    this.initColorPicker()
  }


  private initColorPicker() {
    this.pickr = Pickr.create({
      el: '.color-picker',
      theme: 'monolith',
      useAsButton: true,
      position: "top-middle",
      autoReposition: true,
      default: this.colorPalette[0],
      swatches: [
        'rgb(244, 67, 54)',
        'rgb(233, 30, 99)',
        'rgb(156, 39, 176)',
        'rgb(103, 58, 183)',
        'rgb(63, 81, 181)',
        'rgb(33, 150, 243)',
        'rgb(3, 169, 244',
        'rgb(0, 188, 212)',
        'rgb(0, 150, 136)',
        'rgb(76, 175, 80)',
        'rgb(139, 195, 74)',
        'rgb(205, 220, 57)',
        'rgb(255, 235, 59)',
        'rgb(255, 193, 7)'
      ],

      components: {

        preview: true,
        opacity: false,
        hue: true,

        interaction: {
          hex: true,
          rgba: true,
          cancel: false,
          input: true,
          clear: false,
          save: false
        }
      }
    });

    this.pickr.on("hide", () => {
      this.pickr?.applyColor();
    })

    this.pickr.on('change', (color: any) => {
      const hexa = color.toHEXA();
      this.colorPalette[0] = hexa[0] + hexa[1] + hexa[2];
      const c = "#" + this.colorPalette[0];
      const colorDiv = document.getElementById('0-color') as HTMLDivElement;
      colorDiv.style.backgroundColor = c;

      localStorage.setItem("customColor", this.colorPalette[0])
    });
  }

  private async init() {

    // Initialize canvas
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d");
    this.canvas.setAttribute('tabindex', '0');

    await this.loadBoard();
  }

  private initCanvasEvents() {
    this.resizeCanvas();
    this.canvas.addEventListener('keydown', (e: KeyboardEvent) => this.handleMovement(e));
    this.canvas.addEventListener("contextmenu", (e: Event) => e.preventDefault());
    this.canvas.addEventListener('wheel', this.zoom.bind(this));
    this.canvas.addEventListener('click', (e: MouseEvent) => this.handleCanvasClick(e));
    this.canvas.addEventListener('mousedown', (e: MouseEvent) => this.getColor(e));
    this.canvas.addEventListener("mousemove", this.onHover.bind(this));
    this.canvas.addEventListener("mouseleave", this.onLeave.bind(this));
    this.canvas.addEventListener('mouseover', (e: MouseEvent) => {
      if (!this.pickr?.isOpen() && e.buttons == 0 && this.sliderDragState == false) {
        this.canvas.focus()
      }
    });
  }

  private initPaletteContainer() {
    const storedColor = localStorage.getItem("customColor");
    if (storedColor !== null) {
      this.colorPalette[0] = storedColor;
    }

    const paletteContainer = document.getElementById('palette-container');
    if (!paletteContainer) return;

    this.colorPalette.forEach((color, i) => {
      const colorDiv = document.createElement('div') as HTMLDivElement;
      colorDiv.style.width = '40px';
      colorDiv.style.height = '40px';
      colorDiv.style.backgroundColor = `#${color}`;
      colorDiv.style.borderRadius = '50%';
      colorDiv.style.cursor = 'pointer';
      colorDiv.style.transition = 'transform 0.2s ease';
      colorDiv.style.border = '2px solid #ffffff';
      colorDiv.style.display = 'inline-block';
      colorDiv.id = i.toString() + "-color";

      if (i == this.selectedColor) {
        colorDiv.style.transform = 'scale(1.3)';
        colorDiv.style.border = '3px solid #0080FF';
      }

      colorDiv.addEventListener('click', () => this.handleColorDivClick(colorDiv));
      colorDiv.addEventListener('mouseover', () => colorDiv.style.transform = 'scale(1.3)');
      colorDiv.addEventListener('mouseout', () => colorDiv.style.transform = 'scale(1)');

      paletteContainer.appendChild(colorDiv);
    });
  }

  private handleColorDivClick(colorDiv: HTMLDivElement) {
    this.selectedColor = parseInt(colorDiv.id.at(0)!);
    document.querySelectorAll('.palette-container div').forEach(c => {
      (c as HTMLElement).style.border = '2px solid #ffffff';
      (c as HTMLElement).style.transform = 'scale(1.0)';
    });
    colorDiv.style.border = '3px solid #0080FF';
    colorDiv.style.transform = 'scale(1.3)';

    if (this.selectedColor == 0) {
      this.pickr?.show();
    }
  }

  private initWindowResizeEvent() {
    window.addEventListener('resize', () => {
      this.zoomLevel = 1;
      this.resizeCanvas();
      this.drawBoard();
    });
  }

  private initSignalR() {

    this.signalRService.startConnection().subscribe(() => {
      this.signalRService.receiveMessage().subscribe((message) => {
        this.receivePixel(message);
      });
    });
  }

  private receivePixel(message: string) {
    const receivedPixel = JSON.parse(message);
    if (receivedPixel.placedBy == "") {
      receivedPixel.placedBy = "Anonymous";
    }

    this.boardArr.push(receivedPixel);

    if (this.sliderValue + 1 == this.boardArr.length) {
      this.drawPixel(receivedPixel.x, receivedPixel.y, receivedPixel.color);
      if (this.isSliderVisible) {
        this.setSliderToMax();
      }
    }
    else {
      this.sliderOptions = {
        ...this.sliderOptions,
        ceil: this.boardArr.length
      };
    }

    this.updateLeaderboard();
  }

  private initDocumentEvents() {
    document.addEventListener('wheel', (e: WheelEvent) => e.preventDefault(), { passive: false });
    document.addEventListener('keydown', (e: KeyboardEvent) => this.handleColorSelection(e));

    document.addEventListener('selectionchange', () => {
      if (document.activeElement?.id == "canvas") {
        window.getSelection()!.removeAllRanges();
      }
    });
  }

  private getColor(e: MouseEvent) {
    if (e.button != 2) {
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const x = this.calculateXPosition(e.clientX, rect);
    const y = this.calculateYPosition(e.clientY, rect);

    let pixel = this.findLatestPixel(x, y);
    if (!pixel) {
      if (x < this.dimensions.width && y < this.dimensions.height) {
        pixel = new Pixel(x, y, this.defaultColor, "", "");
      }
      else {
        return;
      }
    }
    let preset = this.colorPalette.indexOf(pixel.color)
    if (preset == -1) {
      preset = 0;
      localStorage.setItem("customColor", pixel.color)
      this.pickr?.setColor("#" + pixel.color, false);
      this.colorPalette[0] = pixel.color;
    }
    this.selectedColor = preset;
    const colorDiv = document.getElementById(preset + "-color")!;
    document.querySelectorAll('.palette-container div').forEach(c => {
      (c as HTMLElement).style.border = '2px solid #ffffff';
      (c as HTMLElement).style.transform = 'scale(1.0)';
    });
    colorDiv.style.border = '3px solid #0080FF';
    colorDiv.style.transform = 'scale(1.3)';

    this.drawHoverPixel(this.hoverPixel.x, this.hoverPixel.y, this.hoverPixel?.color ?? this.defaultColor, true);
  }

  private handleColorSelection(e: KeyboardEvent) {
    if (this.pickr?.isOpen()) {
      return;
    }
    if (e.code.startsWith("Digit")) {
      const key = e.code.slice(5);
      let index = 9;
      if (key != '0') {
        index = parseInt(key) - 1;
      }
      this.selectedColor = index;
      this.drawHoverPixel(this.hoverPixel?.x ?? 0, this.hoverPixel?.y ?? 0, this.hoverPixel?.color ?? this.defaultColor, true);
      document.querySelectorAll('.palette-container div').forEach(c => {
        (c as HTMLElement).style.border = '2px solid #ffffff';
        (c as HTMLElement).style.transform = 'scale(1.0)';
      });
      const colorDiv = document.getElementById(index.toString() + "-color")!;
      colorDiv.style.border = '3px solid #0080FF';
      colorDiv.style.transform = 'scale(1.3)';
      this.pickr?.hide();
    }
  }

  private handleMovement(e: KeyboardEvent) {
    e.preventDefault();
    switch (e.key.toLocaleLowerCase()) {
      case "w":
      case "arrowup":
        this.moveAndRedraw(0, -5);
        break;

      case "a":
      case "arrowleft":
        this.moveAndRedraw(-5, 0);
        break;

      case "s":
      case "arrowdown":
        this.moveAndRedraw(0, 5);
        break;

      case "d":
      case "arrowright":
        this.moveAndRedraw(5, 0);
        break;
    }
  }

  private moveAndRedraw(deltaX: number, deltaY: number) {

    this.resizeCanvas();
    this.originX = Math.min(Math.max(this.originX + deltaX, 0), this.dimensions.width);
    this.originY = Math.min(Math.max(this.originY + deltaY, 0), this.dimensions.height);
    this.applyTransformations();
    this.drawBoard();
  }

  private handleCanvasClick(e: MouseEvent) {
    if (this.sliderValue != this.sliderOptions.ceil) {
      //Exit history mode
      this.setSliderToMax();
      this.drawBoard();

      this.hoverPixel = this.findLatestPixel(this.hoverPixel.x, this.hoverPixel.y) || this.hoverPixel;
      return;
    }


    const rect = this.canvas.getBoundingClientRect();
    const x = this.calculateXPosition(e.clientX, rect);
    const y = this.calculateYPosition(e.clientY, rect);
    const pixel = this.getValidPixelOrNull(x, y, this.colorPalette[this.selectedColor], this.username, new Date());

    if (pixel) {
      this.hoverPixel = pixel;
      this.drawPixel(pixel.x, pixel.y, pixel.color);
      this.sendPixel(pixel.x, pixel.y, pixel.color, e);
    }
  }

  private increaseCounter() {
    const storedVal = localStorage.getItem("placedPixels");
    let count = 1;
    if (storedVal) {
      count = parseInt(storedVal,) + 1;
    }
    localStorage.setItem("placedPixels", count.toString());
  }


  private async playSound() {
    if (!this.audio.paused) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.audio.play();
  }

  onHover(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = this.calculateXPosition(e.clientX, rect);
    const y = this.calculateYPosition(e.clientY, rect);
    const pixel = this.findLatestPixel(x, y);

    this.drawHoverPixel(x, y, pixel?.color, false);

    if (pixel) {
      const options: Intl.DateTimeFormatOptions = {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      };
      const text = `(${pixel.x}, ${pixel.y}) ${pixel.placedBy || "Anonymous"}<br/>${new Date(pixel.timestamp).toLocaleDateString(undefined, options)}`;
      this.showBubble(text, e.clientX, e.clientY);
    }
    else {
      this.hideBubble(true);
    }
  }

  private findLatestPixel(x: number, y: number) {
    let max = this.boardArr.length;
    if (this.isSliderVisible) {
      max = this.sliderValue;
    }
    for (let i = max - 1; i >= 0; i--) {
      const item = this.boardArr[i];
      if (item.x === x && item.y === y) {
        return item;
      }
    }
    return null;
  }


  private calculateXPosition(mouse: number, rect: any) {
    return Math.floor((mouse - rect.left) / rect.width * this.dimensions.width / this.zoomLevel + (1 - 1 / this.zoomLevel) * this.originX);
  }

  private calculateYPosition(mouse: number, rect: any) {
    return Math.floor((mouse - rect.top) / rect.height * this.dimensions.height / this.zoomLevel + (1 - 1 / this.zoomLevel) * this.originY);
  }

  private hideBubble(checkForMessage: boolean) {
    const bubble = document.getElementById("bubble");

    if (checkForMessage && bubble?.innerText.startsWith("Wait")) {
      return;
    }

    if (bubble) {
      bubble.style.visibility = "hidden";
      bubble.style.opacity = "0";
    }
  }

  private onLeave() {
    if (this.hoverPixel) {
      this.drawPixel(this.hoverPixel.x, this.hoverPixel.y, this.hoverPixel.color);
      this.hoverPixel = new HoverPixel(-1, -1, "")
    }
    this.hideBubble(false);
  }

  private drawHoverPixel(x: number, y: number, color: any, force: boolean) {
    if (!this.hoverPixel) {
      this.hoverPixel = new HoverPixel(x, y, color || this.defaultColor);
    }
    else if (this.hoverPixel.x !== x || this.hoverPixel.y !== y || force) {

      this.drawPixel(this.hoverPixel.x, this.hoverPixel.y, this.hoverPixel.color);

      this.hoverPixel = new HoverPixel(x, y, color || this.defaultColor);
      this.drawPixel(x, y, this.colorPalette[this.selectedColor]);
    }
  }


  private showBubble(text: string, clientX: number, clientY: number) {
    const div = document.getElementById("bubble")!;
    const rect = this.canvas.getBoundingClientRect();
    div.innerHTML = text;

    let yOffset = div.clientHeight * 1.3;
    if (clientY - rect.top < yOffset) {
      yOffset = -20
    }
    let xOffset = div.clientWidth * 1.15;
    if (clientX - rect.left < rect.width - xOffset) {
      xOffset = -30
    }

    div.style.visibility = "visible";
    div.style.opacity = "1";
    div.style.left = `${clientX - xOffset}px`;
    div.style.top = `${clientY - yOffset}px`;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(this.hideBubble, 2000);

  }

  private async loadBoard() {

    const limit = 10000;
    let offset = 0;
    let pixels;

    do {

      const result = await fetch(environment.endpointUrl + `/GetRange?offset=${offset}&limit=${limit}`);
      if (!pixels) {
        this.restoreViewSettings();
      }

      pixels = await result.json();

      pixels.forEach((p: Pixel) => {
        if (p.placedBy == "") {
          p.placedBy = "Anonymous";
        }
        this.boardArr.push(p);
      });

      this.drawBoard();
      this.drawHoverPixel(this.hoverPixel.x, this.hoverPixel.y, this.hoverPixel.color, true)
      this.updateLeaderboard();

      offset += limit;
    }
    while (pixels.length == limit);

    this.isSliderVisible = true;
    this.setSliderToMax();

    try {
      const board = localStorage.getItem("board");
      if (board && JSON.parse(board).length >= this.boardArr.length) {
        return;
      }
      localStorage.setItem("board", JSON.stringify(this.boardArr));
    }
    catch {
      console.log("Could not save board array.")
    }
  }


  private setSliderToMax() {

    this.sliderOptions = {
      ...this.sliderOptions,
      ceil: this.boardArr.length
    };
    this.sliderValue = this.sliderOptions.ceil;
  }

  private updateLeaderboard() {
    const leaderboard: Leaderboard[] = [];
    for (const pixel of this.boardArr) {

      const existingEntry = leaderboard.find(item => item.name === pixel.placedBy);
      if (existingEntry) {
        existingEntry.placedPixels++;
      }
      else {
        leaderboard.push({ name: pixel.placedBy, placedPixels: 1 });
      }
    };

    const list = document.getElementById('leaderboard-list')!;
    list.innerHTML = '';
    leaderboard.sort((a, b) => b.placedPixels - a.placedPixels);

    for (let i = 0; i < Math.min(10, leaderboard.length); i++) {
      const position = i + 1;
      const element = document.createElement('li');
      element.className = 'leaderboard-item';

      element.innerHTML = `
        <span class="position">${position}.</span>
        <span class="name">${leaderboard[i].name}</span>
        <span class="score">${leaderboard[i].placedPixels}</span>
        `;
      list.appendChild(element);
    }

  }

  public onSliderChange(): void {
    setTimeout(() => {
      this.drawBoard()
    }, 20);
  }

  public onSliderStart(): void {
    this.sliderDragState = true;
  }

  public onSliderEnd(): void {
    this.sliderDragState = false
  }

  private getValidPixelOrNull(x: number, y: number, c: any, placedBy: any, updatedAt: any) {
    if (x < 0 || x >= this.dimensions.width || y < 0 || y >= this.dimensions.height) {
      return null;
    }

    //Check if hex is valid
    const reg = /^[0-9A-F]{6}$/i;
    if (!c || !reg.test(c)) {
      c = this.defaultColor;
    }
    return new Pixel(x, y, c, placedBy, updatedAt);
  }

  private async sendPixel(x: number, y: number, color: string, e: MouseEvent) {
    const originalPixel = this.findLatestPixel(x, y);

    //Abort task if same pixel by same user already exits.
    if (originalPixel && originalPixel.color === color && originalPixel.placedBy === this.username) {
      return;
    }

    const newPixel = new Pixel(x, y, color, this.username!, "")
    if (this.pixelQueue.includes(newPixel)) {
      return;
    }
    this.pixelQueue.push(newPixel)
    this.playSound();
    if (this.signalRService.getState() == HubConnectionState.Disconnecting || this.signalRService.getState() == HubConnectionState.Disconnected) {
      this.initSignalR();
    }
    try {

      const response = await fetch(environment.endpointUrl + "/SendPixel", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPixel)
      })

      if (response.ok) {
        const index = this.pixelQueue.indexOf(newPixel);
        if (index > -1) {
          this.pixelQueue.splice(index, 1);
        }
        this.increaseCounter();
        console.log('Success.');
      }
      else if (response.status === 429) {
        this.showBubble(`Wait ${response.headers.get("retry-after")} seconds.`, e.clientX, e.clientY);
        this.drawBoard();
      }
    }
    catch (e) {
      this.hoverPixel = originalPixel!;
      this.drawBoard()
      console.log(e);
    }
  }


  private drawBoard() {
    let max = this.boardArr.length;
    if (this.isSliderVisible) {
      max = this.sliderValue;
    }
    this.ctx.clearRect(0, 0, this.dimensions.width, this.dimensions.height)


    for (let i = 0; i < max; i++) {
      const p = this.boardArr[i];
      this.drawPixel(p.x, p.y, p.color);

    }
  }

  private drawPixel(x: number, y: number, c: string) {

    if (this.getValidPixelOrNull(x, y, c, null, null) == null) {
      return;
    }

    this.ctx.fillStyle = '#' + c;
    this.ctx.fillRect(x, y, 1, 1);
  }

  private resizeCanvas() {


    this.canvas.width = this.dimensions.width;
    this.canvas.height = this.dimensions.height;

    const max = Math.min(window.innerWidth, window.innerHeight / 1.15);
    this.canvas.style.width = max + 'px';
    this.canvas.style.height = max + 'px';

    const container = document.getElementById("palette-container");
    container!.style.width = max + 'px';


  }

  public usernameChange(event: Event) {
    const val = (event.target as HTMLInputElement).value
    if (val.length > 16) {
      (event.target as HTMLInputElement).value = this.username || "";
      alert("Username cannot be longer than 16 characters.");
      return;
    }
    this.username = val;
    localStorage.setItem("username", val);
  }

  private zoom(e: WheelEvent) {
    this.updateZoomLevel(e.deltaY);
    this.resizeCanvas();

    const rect = this.canvas.getBoundingClientRect();

    if (e.deltaY < 0) {

      this.calculateOrigin(rect, e.clientX, e.clientY);
    }
    this.applyTransformations();
    this.drawBoardAndHoverPixel(e, rect);
  }

  private drawBoardAndHoverPixel(e: WheelEvent, rect: any) {
    this.drawBoard();
    const x = this.calculateXPosition(e.clientX, rect);
    const y = this.calculateYPosition(e.clientY, rect);
    this.drawHoverPixel(x, y, this.findLatestPixel(x, y)?.color, false);
  }

  private updateZoomLevel(deltaY: number): void {
    if (deltaY < 0) {
      if (this.zoomLevel < this.maxZoom) {
        this.zoomLevel = Math.ceil(this.zoomLevel * 1.5);
      }
    }
    else if (this.zoomLevel > this.minZoom) {
      this.zoomLevel = Math.floor(this.zoomLevel / 1.5);
    }
  }

  private calculateOrigin(rect: DOMRect, clientX: number, clientY: number): void {


    this.originX = Math.floor((clientX - rect.left) / rect.width * this.dimensions.width / this.zoomLevel + (1 - 1 / this.zoomLevel) * this.originX);
    this.originY = Math.floor((clientY - rect.top) / rect.height * this.dimensions.height / this.zoomLevel + (1 - 1 / this.zoomLevel) * this.originY);

    //this.originX = Math.round((clientX - rect.left) / rect.width * this.dimensions.width);
    //this.originY = Math.round((clientY - rect.top) / rect.height * this.dimensions.height);
  }

  private applyTransformations(): void {
    this.ctx.translate(this.originX, this.originY);
    this.ctx.scale(this.zoomLevel, this.zoomLevel);
    this.ctx.translate(-this.originX, -this.originY);

    this.saveViewSettings();
  }

  private saveViewSettings() {
    const settings: ViewSettings = {
      originX: this.originX,
      originY: this.originY,
      zoom: this.zoomLevel
    };
    localStorage.setItem('canvasViewSettings', JSON.stringify(settings));
  }

  private restoreViewSettings() {
    const stored = localStorage.getItem('canvasViewSettings');
    if (!stored) {
      return;
    }
    const settings: ViewSettings = JSON.parse(stored);
    this.originX = settings.originX;
    this.originY = settings.originY;
    this.zoomLevel = settings.zoom;
    this.resizeCanvas();
    this.applyTransformations();
  }
}
