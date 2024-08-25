import { Component, OnInit, isDevMode } from '@angular/core';
import { Client, Databases, Query } from 'appwrite';
import { Pixel } from './models/Pixel.model';
import { HoverPixel } from './models/HoverPixel';
import Pickr from '@simonwep/pickr';
import { environment } from '../environments/environment';
import { BoardSize } from './interfaces/BoardSize.interface';
import { Leaderboard } from './interfaces/Leaderboard.interface'

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
  pixelArr: Pixel[] = [];
  dimensions: BoardSize = { width: 256, height: 256 };
  ;

  originX: number = 0;
  originY: number = 0;
  selectedColor: number = 1;

  sliderValue = 0;
  isSliderVisible = false; //Has to be false until board has been loaded
  sliderOptions = {
    ceil: 0,
    vertical: true,
    showSelectionBar: true,
    rightToLeft: true
  };

  client: Client = new Client();
  databases: Databases = new Databases(this.client);

  canvas: any;
  ctx: any;


  async ngOnInit() {


    this.initialize();

    // Set up event listeners
    this.setupCanvasEvents();
    this.initializePaletteContainer();
    this.initializeColorPicker()
    this.setupWindowResizeEvent();
    this.setupClientSubscription();
    this.setupDocumentEvents();
  }


  private initializeColorPicker() {
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

  private async initialize() {
    // Initialize client and canvas
    this.client.setEndpoint(environment.endpointUrl).setProject(environment.projectId);

    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d");
    this.canvas.setAttribute('tabindex', '0');

    await this.initializeBoard();
    this.isSliderVisible = true;
    this.updateSlider();
  }

  private setupCanvasEvents() {
    this.resizeCanvas();
    this.canvas.addEventListener("contextmenu", (e: Event) => e.preventDefault());
    this.canvas.addEventListener('wheel', this.zoom.bind(this));
    this.canvas.addEventListener("mousemove", this.onHover.bind(this));
    this.canvas.addEventListener("mouseleave", this.onLeave.bind(this));
    this.canvas.addEventListener('mouseover', (e: MouseEvent) => {
      if (!this.pickr?.isOpen() && e.buttons == 0) {
        this.canvas.focus()
      }
    });
  }

  private initializePaletteContainer() {
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

  private setupWindowResizeEvent() {
    window.addEventListener('resize', () => {
      this.zoomLevel = 1;
      this.resizeCanvas();
      this.drawBoard();
    });
  }

  private setupClientSubscription() {
    this.client.subscribe(`databases.${environment.databaseId}.collections.${environment.collectionId}.documents`, response => {
      const { $id, color, placedBy, $updatedAt } = response.payload as { $id: string, color: string, placedBy: string, $updatedAt: string };
      const [x, y] = $id.split("_").map(Number);

      const pixel = this.pixelArr.find(item => item.x === x && item.y === y);
      if (pixel) {
        pixel.color = color;
        pixel.placedBy = placedBy;
        pixel.timestamp = new Date($updatedAt);
      }
      else {
        this.pixelArr.push(new Pixel(x, y, color, placedBy, new Date($updatedAt)));
      }
      this.drawPixel(x, y, color);
      this.updateLeaderboard();
      if (this.isSliderVisible) {
        this.updateSlider();
      }
    });
  }

  private setupDocumentEvents() {
    document.addEventListener('wheel', (e: WheelEvent) => e.preventDefault(), { passive: false });
    document.addEventListener('keydown', (e: KeyboardEvent) => this.handleColorSelection(e));
    this.canvas.addEventListener('keydown', (e: KeyboardEvent) => this.handleMovement(e));
    this.canvas.addEventListener('click', (e: MouseEvent) => this.handleCanvasClick(e));
    this.canvas.addEventListener('mousedown', (e: MouseEvent) => this.getColor(e));

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

    let pixel = this.pixelArr.find(item => item.x === x && item.y === y);
    if (!pixel) {
      if (x < this.dimensions.width && y < this.dimensions.height) {
        pixel = new Pixel(x, y, this.defaultColor, "", new Date(0));
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
    const rect = this.canvas.getBoundingClientRect();
    const x = this.calculateXPosition(e.clientX, rect);
    const y = this.calculateYPosition(e.clientY, rect);
    const pixel = this.getValidPixelOrNull(x, y, this.colorPalette[this.selectedColor], this.username, new Date());

    if (pixel) {
      this.hoverPixel = pixel;
      this.leaveHistoryMode();
      this.drawPixel(pixel.x, pixel.y, pixel.color);
      this.sendPixel(pixel.x, pixel.y, pixel.color, e);
      this.increaseCounter();
    }
  }

  leaveHistoryMode() {
    if (this.sliderValue != this.pixelArr.length) {
      this.sliderValue = this.pixelArr.length;
      this.drawBoard();
    }
  }

  increaseCounter() {
    const storedVal = localStorage.getItem("placedPixels");
    let count = 1;
    if (storedVal) {
      count = parseInt(storedVal,) + 1;
    }
    localStorage.setItem("placedPixels", count.toString());
  }


  async playSound() {
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
    const pixel = this.pixelArr.find(item => item.x === x && item.y === y);

    this.drawHoverPixel(x, y, pixel?.color, false);

    if (pixel) {
      if (!this.isHoverPixelExisting()) {
        return;
      }

      const options: Intl.DateTimeFormatOptions = {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      };
      const text = `(${pixel.x}, ${pixel.y}) ${pixel.placedBy || "Anonymous"}<br/>${pixel.timestamp.toLocaleDateString(undefined, options)}`;
      this.showBubble(text, e.clientX, e.clientY);
    }
    else {
      this.hideBubble(true);
    }
  }


  calculateXPosition(mouse: number, rect: any) {
    return Math.floor((mouse - rect.left) / rect.width * this.dimensions.width / this.zoomLevel + (1 - 1 / this.zoomLevel) * this.originX);
  }

  calculateYPosition(mouse: number, rect: any) {
    return Math.floor((mouse - rect.top) / rect.height * this.dimensions.height / this.zoomLevel + (1 - 1 / this.zoomLevel) * this.originY);
  }

  hideBubble(checkForMessage: boolean) {
    const bubble = document.getElementById("bubble");

    if (checkForMessage && bubble?.innerText.startsWith("Wait")) {
      return;
    }

    if (bubble) {
      bubble.style.visibility = "hidden";
      bubble.style.opacity = "0";
    }
  }

  onLeave() {
    if (this.hoverPixel) {
      if (!this.isHoverPixelExisting()) {
        this.hoverPixel.color = this.defaultColor;
      }

      this.drawPixel(this.hoverPixel.x, this.hoverPixel.y, this.hoverPixel.color);
      this.hoverPixel = new HoverPixel(-1, -1, "")
    }
    this.hideBubble(false);
  }

  isHoverPixelExisting(): boolean {
    //Needed for history due to hoverpixels.
    if (this.isSliderVisible && this.sliderValue != this.pixelArr.length) {
      const i = this.pixelArr.findIndex(item => item.x === this.hoverPixel.x && item.y === this.hoverPixel.y);
      if (this.sliderValue <= i) {
        return false;
      }
    }
    return true;
  }

  drawHoverPixel(x: number, y: number, color: any, force: boolean) {
    if (!this.hoverPixel) {
      this.hoverPixel = new HoverPixel(x, y, color || this.defaultColor);
    }
    else if (this.hoverPixel.x !== x || this.hoverPixel.y !== y || force) {

      if (!this.isHoverPixelExisting()) {
        this.hoverPixel.color = this.defaultColor;
      }
      this.drawPixel(this.hoverPixel.x, this.hoverPixel.y, this.hoverPixel.color);

      this.hoverPixel = new HoverPixel(x, y, color || this.defaultColor);
      this.drawPixel(x, y, this.colorPalette[this.selectedColor]);
    }
  }


  showBubble(text: string, clientX: number, clientY: number) {
    const div = document.getElementById("bubble")!;
    const rect = this.canvas.getBoundingClientRect();

    let yOffset = div.clientHeight;
    if (clientY - rect.top < yOffset) {
      yOffset = 0
    }
    let xOffset = div.clientWidth;
    if (clientX - rect.left < rect.width - xOffset) {
      xOffset = 0
    }

    div.style.visibility = "visible";
    div.style.opacity = "1";
    div.style.left = `${clientX - xOffset}px`;
    div.style.top = `${clientY - yOffset}px`;
    div.innerHTML = text;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(this.hideBubble, 2000);

  }

  async initializeBoard() {

    const limit = 1000;
    let offset = 0;

    let result;
    do {

      result = await this.databases.listDocuments(
        environment.databaseId,
        environment.collectionId,
        [Query.limit(limit),
        Query.offset(offset),
        Query.orderAsc("$updatedAt"),
        ]
      );


      result.documents.forEach(document => {
        const [x, y] = document.$id.split("_").map(Number);
        const { color, placedBy, $updatedAt } = document;
        const pixel = this.getValidPixelOrNull(x, y, color, placedBy, new Date($updatedAt));

        if (pixel) {
          this.pixelArr.push(pixel);
        }
      });

      this.drawBoard();
      this.drawHoverPixel(this.hoverPixel.x, this.hoverPixel.y, this.hoverPixel.color, true)
      this.updateLeaderboard();
      offset += limit;
    }
    while (result.documents.length > 0);

    this.updateLeaderboard();


    try {
      const board = localStorage.getItem("board");
      if (board && JSON.parse(board).length >= this.pixelArr.length) {
        return;
      }
      localStorage.setItem("board", JSON.stringify(this.pixelArr));
    }
    catch {
      console.log("Could not save board array.")
    }
  }


  updateSlider() {
    this.sliderOptions = {
      ceil: this.pixelArr.length,
      vertical: true,
      showSelectionBar: true,
      rightToLeft: true
    };
    this.sliderValue = this.sliderOptions.ceil;
  }

  updateLeaderboard() {
    const leaderboard: Leaderboard[] = [];
    for (const pixel of this.pixelArr) {

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

  onSliderChange(): void {
    this.drawBoard();
  }

  getValidPixelOrNull(x: number, y: number, c: any, placedBy: any, updatedAt: any) {
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

  sendPixel(xCoord: number, yCoord: number, color: string, e: MouseEvent) {
    const pixel = this.pixelArr.find(item => item.x === xCoord && item.y === yCoord);

    if (pixel && pixel.color === color && pixel.placedBy === this.username) {
      return;
    }

    this.playSound();

    const documentId = `${xCoord}_${yCoord}`;
    const data = { color, placedBy: this.username };
    const operation = pixel
      ? this.databases.updateDocument(environment.databaseId, environment.collectionId, documentId, data)
      : this.databases.createDocument(environment.databaseId, environment.collectionId, documentId, data);

    operation.then(() => {
      console.log("Success.");
    }).catch(response => {
      if (response.message.includes("Rate limit")) {
        const now = new Date();
        this.showBubble(`Wait ${60 - now.getSeconds()} seconds.`, e.clientX, e.clientY);
      }
      this.drawBoard();
      console.log(response);
    });
  }


  drawBoard() {
    let count = this.pixelArr.length;

    if (this.isSliderVisible) {
      count = this.sliderValue;
    }

    this.ctx.clearRect(0, 0, this.dimensions.width, this.dimensions.height)

    for (let i = 0; i < count; i++) {
      const p = this.pixelArr[i];
      this.drawPixel(p.x, p.y, p.color);
    }
  }

  drawPixel(x: number, y: number, c: string) {

    if (this.getValidPixelOrNull(x, y, c, null, null) == null) {
      return;
    }

    this.ctx.fillStyle = '#' + c;
    this.ctx.fillRect(x, y, 1, 1);
  }

  resizeCanvas() {


    this.canvas.width = this.dimensions.width;
    this.canvas.height = this.dimensions.height;

    const max = Math.min(window.innerWidth, window.innerHeight / 1.15);
    this.canvas.style.width = max + 'px';
    this.canvas.style.height = max + 'px';

    const container = document.getElementById("palette-container");
    container!.style.width = max + 'px';


  }

  usernameChange(event: Event) {
    const val = (event.target as HTMLInputElement).value
    if (val.length > 16) {
      (event.target as HTMLInputElement).value = this.username || "";
      alert("Username cannot be longer than 16 characters.");
      return;
    }
    this.username = val;
    localStorage.setItem("username", val);
  }

  zoom(e: WheelEvent) {
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
    this.drawHoverPixel(x, y, this.pixelArr.find(p => p.x === x && p.y === y)?.color, false);
  }

  private updateZoomLevel(deltaY: number): void {
    const minZoom = 1;
    const maxZoom = 10;

    if (deltaY < 0) {
      if (this.zoomLevel < maxZoom) {
        this.zoomLevel++;
      }
    }
    else if (this.zoomLevel > minZoom) {
      this.zoomLevel--;
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
  }
}
