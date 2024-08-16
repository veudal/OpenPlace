import { Component, OnInit } from '@angular/core';
import { Client, Databases, Query } from 'appwrite';
import { Pixel } from './models/Pixel.model';
import { HoverPixel } from './models/HoverPixel';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})

export class AppComponent implements OnInit {
  title: string = 'OpenPlace';

  validColors: string[] = ["000000", "0000FF", "00FFFF", "FF0000", "00FF00", "FFFF00", "FF00FF", "7c4dff", "C0C0C0", "FFFFFF"];
  username: string | null = localStorage.getItem("username");

  previewMode: boolean = true;
  timeoutId: number | null = null;
  zoomLevel: number = 1;

  audio: HTMLAudioElement = new Audio("assets/sfx/place.mp3");

  hoverPixel: HoverPixel = new HoverPixel(-1, -1, "");
  pixelArr: Pixel[] = [];
  dimensions: [number, number] = [256, 256];

  originX: number = 0;
  originY: number = 0;
  selectedColor: number = 0;

  client: Client = new Client();
  databases: Databases = new Databases(this.client);

  projectId: string = "66b7a92b0015300fdc17";
  databaseId: string = "66b7a95f0022a9b7704b";
  collectionId: string = "66b7b0d2000834bbb81c";

  canvas: any;
  ctx: any;


  async ngOnInit() {

    this.initialize();

    // Set up event listeners
    this.setupCanvasEvents();
    this.initializePaletteContainer();
    this.setupWindowResizeEvent();
    this.setupClientSubscription();
    this.setupDocumentEvents();
  }

  private async initialize() {
    // Initialize client and canvas
    this.client.setEndpoint("https://cloud.appwrite.io/v1").setProject(this.projectId);
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d");

    await this.getAllPixels();
    this.drawAllPixels();
  }

  private setupCanvasEvents() {
    this.resizeCanvas();
    this.canvas.addEventListener("contextmenu", (e: Event) => e.preventDefault());
    this.canvas.addEventListener("mousemove", this.onHover.bind(this));
    this.canvas.addEventListener("mouseleave", this.onLeave.bind(this));
    this.canvas.addEventListener('wheel', this.zoom.bind(this));
  }

  private initializePaletteContainer() {
    const paletteContainer = document.getElementById('palette-container');
    if (!paletteContainer) return;

    this.validColors.forEach((color, i) => {
      const colorDiv = document.createElement('div') as HTMLDivElement;
      colorDiv.style.width = '40px';
      colorDiv.style.height = '40px';
      colorDiv.style.backgroundColor = `#${color}`;
      colorDiv.style.borderRadius = '50%';
      colorDiv.style.cursor = 'pointer';
      colorDiv.style.transition = 'transform 0.2s ease';
      colorDiv.style.border = '2px solid #ffffff';
      colorDiv.style.display = 'inline-block';
      colorDiv.id = i.toString();

      if (color === this.validColors[this.selectedColor]) {
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
    this.selectedColor = parseInt(colorDiv.id);
    document.querySelectorAll('.palette-container div').forEach(c => {
      (c as HTMLElement).style.border = '2px solid #ffffff';
      (c as HTMLElement).style.transform = 'scale(1.0)';
    });
    colorDiv.style.border = '3px solid #0080FF';
    colorDiv.style.transform = 'scale(1.3)';
  }

  private setupWindowResizeEvent() {
    window.addEventListener('resize', () => {
      this.zoomLevel = 1;
      this.resizeCanvas();
      this.drawAllPixels();
    });
  }

  private setupClientSubscription() {
    this.client.subscribe(`databases.${this.databaseId}.collections.${this.collectionId}.documents`, response => {
      const { $id, color, placedBy, $updatedAt } = response.payload as { $id: string, color: string, placedBy: string, $updatedAt: string };
      const [x, y] = $id.split("_").map(Number);

      const pixel = this.pixelArr.find(item => item.x === x && item.y === y);
      if (pixel) {
        pixel.color = color;
        pixel.placedBy = placedBy;
        pixel.timestamp = new Date($updatedAt);
      } else {
        this.pixelArr.push(new Pixel(x, y, color, placedBy, new Date($updatedAt)));
      }
      this.drawPixel(x, y, color);
    });
  }

  private setupDocumentEvents() {
    document.addEventListener('wheel', (e: WheelEvent) => e.preventDefault(), { passive: false });
    document.addEventListener('keydown', (e: KeyboardEvent) => this.handleKeydown(e));
    document.addEventListener('click', (e: MouseEvent) => this.handleCanvasClick(e));
  }

  private handleKeydown(e: KeyboardEvent) {
    const key = e.key;
    if (key >= '0' && key <= '9') {
      const index = key === '0' ? 9 : parseInt(key) - 1;
      this.selectedColor = index;
      this.drawHoverPixel(this.hoverPixel?.x ?? 0, this.hoverPixel?.y ?? 0, this.hoverPixel?.color ?? "FFFFFF", true);
      document.querySelectorAll('.palette-container div').forEach(c => {
        (c as HTMLElement).style.border = '2px solid #ffffff';
        (c as HTMLElement).style.transform = 'scale(1.0)';
      });
      const colorDiv = document.getElementById(index.toString())!;
      colorDiv.style.border = '3px solid #0080FF';
      colorDiv.style.transform = 'scale(1.3)';
    }
  }

  private handleCanvasClick(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = this.calculateXPosition(e.clientX, rect);
    const y = this.calculateYPosition(e.clientY, rect);
    const pixel = this.getValidPixelOrNull(x, y, this.validColors[this.selectedColor], this.username, new Date());

    if (pixel) {
      this.previewMode = false;
      this.hoverPixel = pixel;
      this.playSound();
      this.drawPixel(pixel.x, pixel.y, pixel.color);
      this.sendPixel(pixel.x, pixel.y, pixel.color, e);
    }
  }


  async playSound() {
    if (!this.audio.paused) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.audio.play();
  }


  drag(e: any) {

    if (e.buttons & 2) {
      const dx = e.movementX;
      const dy = e.movementY;

      this.originX -= dx / this.zoomLevel;
      this.originY -= dy / this.zoomLevel;
      this.ctx.translate(this.originX, this.originY);
      this.ctx.scale(this.zoomLevel, this.zoomLevel)
      this.ctx.translate(-this.originX, -this.originY);
      this.drawAllPixels();
    }
  }

  onHover(e: MouseEvent) {

    const rect = this.canvas.getBoundingClientRect();

    const x = this.calculateXPosition(e.clientX, rect);
    const y = this.calculateYPosition(e.clientY, rect);
    const pixel = this.pixelArr.find(item => item.x === x && item.y === y);

    this.drawHoverPixel(x, y, pixel?.color, false);

    if (pixel) {
      if (this.previewMode) {
        const placedBy = pixel.placedBy || "Anonymous";
        this.showBubble(`(${pixel.x}, ${pixel.y}) ${placedBy}`, e.clientX, e.clientY);
      }
    }
    else {
      this.hideBubble(true);
    }
  }


  calculateXPosition(mouse: number, rect: any) {
    return Math.floor((mouse - rect.left) / rect.width * this.dimensions[0] / this.zoomLevel + (1 - 1 / this.zoomLevel) * this.originX);
  }

  calculateYPosition(mouse: number, rect: any) {
    return Math.floor((mouse - rect.top) / rect.height * this.dimensions[1] / this.zoomLevel + (1 - 1 / this.zoomLevel) * this.originY);
  }

  hideBubble(checkForMessage: boolean) {
    const bubble = document.getElementById("floating-username");

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
      this.drawPixel(this.hoverPixel.x, this.hoverPixel.y, this.hoverPixel.color);
      this.hoverPixel = new HoverPixel(-1, -1, "")
    }
    this.hideBubble(false);
  }

  drawHoverPixel(x: number, y: number, color: any, force: boolean) {
    if (!this.hoverPixel) {
      this.hoverPixel = new HoverPixel(x, y, color || "FFFFFF");
    }
    else if (this.hoverPixel.x !== x || this.hoverPixel.y !== y || force) {
      this.drawPixel(this.hoverPixel.x, this.hoverPixel.y, this.hoverPixel.color);
      this.hoverPixel = new HoverPixel(x, y, color || "FFFFFF");
      this.drawPixel(x, y, this.validColors[this.selectedColor]);
    }
  }


  showBubble(text: string, clientX: number, clientY: number) {
    const div = document.getElementById("floating-username")!;
    div.className = "bg-red-400 font-bold text-white rounded transition py-1 px-2 animate-[showoff_100ms_ease-in]";
    div.style.visibility = "visible";
    div.style.opacity = "1";
    div.style.left = `${clientX + 25}px`;
    div.style.top = `${clientY - 25}px`;
    div.innerText = text;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(this.hideBubble, 1500);

  }

  async getAllPixels() {
    const result = await this.databases.listDocuments(
      this.databaseId,
      this.collectionId,
      [Query.limit(Number.MAX_SAFE_INTEGER)]
    );

    result.documents.forEach(document => {
      const [x, y] = document.$id.split("_").map(Number);
      const { color, placedBy, $updatedAt } = document;

      const pixel = this.getValidPixelOrNull(x, y, color, placedBy, new Date($updatedAt));
      if (pixel) {
        this.pixelArr.push(pixel);
      }
    });
  }

  getValidPixelOrNull(x: number, y: number, c: any, placedBy: any, updatedAt: any) {
    if (x < 0 || x >= this.dimensions[0] || y < 0 || y >= this.dimensions[1]) {
      return null;
    }
    if (!c) {
      c = "FFFFFF";
    }
    if (!this.validColors.includes(c)) {
      c = this.validColors[0];
    }
    return new Pixel(x, y, c, placedBy, updatedAt);
  }

  sendPixel(xCoord: number, yCoord: number, color: string, e: MouseEvent) {
    const pixel = this.pixelArr.find(item => item.x === xCoord && item.y === yCoord);

    if (pixel && pixel.color === color && pixel.placedBy === this.username) {
      return;
    }

    const documentId = `${xCoord}_${yCoord}`;
    const data = { color, placedBy: this.username };
    const operation = pixel
      ? this.databases.updateDocument(this.databaseId, this.collectionId, documentId, data)
      : this.databases.createDocument(this.databaseId, this.collectionId, documentId, data);

    operation.then(response => {
      console.log(response);
    }).catch(response => {
      if (response.message.includes("Rate limit")) {
        const now = new Date();
        this.showBubble(`Wait ${60 - now.getSeconds()} seconds.`, e.clientX, e.clientY);
        this.drawAllPixels();
      }
      console.log(response);
    });
  }


  drawAllPixels() {
    this.drawHoverPixel(-1, -1, "", false);
    this.ctx.clearRect(0, 0, this.dimensions[0], this.dimensions[1])
    this.pixelArr.forEach((element) => {
      this.drawPixel(element.x, element.y, element.color);
    });
  }

  drawPixel(x: number, y: number, c: string) {

    if (this.getValidPixelOrNull(x, y, c, null, null) == null) {
      return;
    }
    this.ctx.fillStyle = '#' + c;
    this.ctx.fillRect(x, y, 1, 1);
  }

  resizeCanvas() {


    this.canvas.width = this.dimensions[0];
    this.canvas.height = this.dimensions[1];

    const max = Math.min(window.innerWidth, window.innerHeight / 1.15);
    this.canvas.style.width = max + 'px';
    this.canvas.style.height = max + 'px';

    const container = document.getElementById("palette-container");
    container!.style.width = max + 'px';


  }

  usernameChange(event: Event) {
    this.username = (event.target as HTMLInputElement).value;
    localStorage.setItem("username", this.username);
  }

  zoom(e: WheelEvent) {
    this.updateZoomLevel(e.deltaY);
    this.resizeCanvas();

    const rect = this.canvas.getBoundingClientRect();

    this.calculateOrigin(rect, e.clientX, e.clientY);
    this.applyTransformations();

    this.drawAllPixels();

    const x = this.calculateXPosition(e.clientX, rect);
    const y = this.calculateYPosition(e.clientY, rect);
    this.drawHoverPixel(x, y, this.pixelArr.find(p => p.x === x && p.y === y)?.color, false);
  }

  private updateZoomLevel(deltaY: number): void {
    const zoomStep = 0.04;
    const minZoom = 1;
    const maxZoom = 20;
    this.zoomLevel = Math.round(Math.max(minZoom, Math.min(this.zoomLevel - deltaY * zoomStep, maxZoom)));
  }

  private calculateOrigin(rect: DOMRect, clientX: number, clientY: number): void {
    this.originX = Math.round((clientX - rect.left) / rect.width * this.dimensions[0]);
    this.originY = Math.round((clientY - rect.top) / rect.height * this.dimensions[1]);
  }

  private applyTransformations(): void {
    this.ctx.translate(this.originX, this.originY);
    this.ctx.scale(this.zoomLevel, this.zoomLevel);
    this.ctx.translate(-this.originX, -this.originY);
  }
}
