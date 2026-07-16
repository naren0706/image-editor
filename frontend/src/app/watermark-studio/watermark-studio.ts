import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface ProcessedFile {
  id: string;
  name: string;
  imgElement: HTMLImageElement;
  width: number;
  height: number;
}

interface TextOverlay {
  id: string;
  text: string;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  color: string;
  fontSize: number; // font size in px
  fontFamily: string;
  opacity: number; // 0 to 1
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  outlineColor: string;
  outlineWidth: number; // 0 to disable
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
}

@Component({
  selector: 'app-watermark-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './watermark-studio.html',
  styleUrl: './watermark-studio.css'
})
export class WatermarkStudioComponent {
  @ViewChild('previewCanvas', { static: false }) previewCanvas!: ElementRef<HTMLCanvasElement>;

  // Expose Math to template for rounding opacity percentage
  Math = Math;

  // Upload State
  uploadedFiles = signal<ProcessedFile[]>([]);
  activeFileIndex = signal<number>(0);
  imageLoaded = signal<boolean>(false);

  // Text Overlays State
  textOverlays = signal<TextOverlay[]>([]);
  activeTextIndex = signal<number | null>(null);

  // Custom Fonts Loader State
  customGoogleFont = '';
  customFontsList = signal<string[]>([]);

  // Export Settings
  exportFormat = signal<'png' | 'jpeg'>('png');
  jpegQuality = signal<number>(95);

  // Canvas Dragging State
  private isDragging = false;
  private draggedIndex: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartPercentX = 0;
  private dragStartPercentY = 0;

  // File Upload Handlers
  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.loadFiles(input.files);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files) {
      this.loadFiles(event.dataTransfer.files);
    }
  }

  private loadFiles(files: FileList): void {
    const loadedList: ProcessedFile[] = [];
    let loadCounter = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          loadedList.push({
            id: crypto.randomUUID(),
            name: file.name,
            imgElement: img,
            width: img.width,
            height: img.height
          });

          loadCounter++;
          if (loadCounter === files.length || loadCounter === Array.from(files).filter(f => f.type.startsWith('image/')).length) {
            this.uploadedFiles.update(current => [...current, ...loadedList]);
            this.imageLoaded.set(true);

            // Add default text overlay if none exists
            if (this.textOverlays().length === 0) {
              this.addTextOverlay();
            }

            setTimeout(() => {
              if (this.uploadedFiles().length > 0) {
                this.updateCanvasPreview();
              }
            }, 100);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  // Active File Selection
  setActiveFile(index: number): void {
    this.activeFileIndex.set(index);
    setTimeout(() => this.updateCanvasPreview(), 50);
  }

  removeFile(index: number, event: MouseEvent): void {
    event.stopPropagation();
    this.uploadedFiles.update(current => {
      const updated = [...current];
      updated.splice(index, 1);
      return updated;
    });

    if (this.uploadedFiles().length === 0) {
      this.resetEditor();
    } else {
      if (this.activeFileIndex() >= this.uploadedFiles().length) {
        this.activeFileIndex.set(this.uploadedFiles().length - 1);
      }
      this.updateCanvasPreview();
    }
  }

  // Text Overlay Operations
  addTextOverlay(): void {
    const newOverlay: TextOverlay = {
      id: crypto.randomUUID(),
      text: 'Watermark Text',
      xPercent: 50,
      yPercent: 50,
      color: '#ffffff',
      fontSize: 48,
      fontFamily: 'Montserrat',
      opacity: 0.8,
      bold: true,
      italic: false,
      align: 'center',
      outlineColor: '#000000',
      outlineWidth: 3,
      shadowEnabled: false,
      shadowColor: 'rgba(0, 0, 0, 0.5)',
      shadowBlur: 10
    };

    this.textOverlays.update(current => [...current, newOverlay]);
    this.activeTextIndex.set(this.textOverlays().length - 1);
    this.updateCanvasPreview();
  }

  removeTextOverlay(index: number, event: MouseEvent): void {
    event.stopPropagation();
    this.textOverlays.update(current => {
      const updated = [...current];
      updated.splice(index, 1);
      return updated;
    });

    if (this.textOverlays().length === 0) {
      this.activeTextIndex.set(null);
    } else {
      const activeIdx = this.activeTextIndex();
      if (activeIdx !== null && activeIdx >= this.textOverlays().length) {
        this.activeTextIndex.set(this.textOverlays().length - 1);
      }
    }
    this.updateCanvasPreview();
  }

  setActiveTextIndex(index: number): void {
    this.activeTextIndex.set(index);
    this.updateCanvasPreview();
  }

  updateActiveTextProperty(property: keyof TextOverlay, value: any): void {
    const activeIdx = this.activeTextIndex();
    if (activeIdx === null) return;

    this.textOverlays.update(current => {
      const updated = [...current];
      updated[activeIdx] = {
        ...updated[activeIdx],
        [property]: value
      };
      return updated;
    });

    this.updateCanvasPreview();
  }

  loadGoogleFont(): void {
    const fontName = this.customGoogleFont.trim();
    if (!fontName) return;

    // Standardize space encoding for Google Fonts link tag URL
    const apiFontName = fontName.replace(/\s+/g, '+');
    const fontUrl = `https://fonts.googleapis.com/css2?family=${apiFontName}&display=swap`;

    const existingLink = document.head.querySelector(`link[href="${fontUrl}"]`);
    if (!existingLink) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = fontUrl;
      document.head.appendChild(link);
    }

    this.customFontsList.update(list => {
      if (!list.includes(fontName)) {
        return [...list, fontName];
      }
      return list;
    });

    this.updateActiveTextProperty('fontFamily', fontName);
    this.customGoogleFont = '';

    // Await document font loading or fallback to render canvas correctly
    if ('fonts' in document) {
      (document as any).fonts.load(`1em "${fontName}"`).then(() => {
        this.updateCanvasPreview();
      }).catch(() => {
        setTimeout(() => this.updateCanvasPreview(), 800);
      });
    } else {
      setTimeout(() => this.updateCanvasPreview(), 800);
    }
  }

  // Canvas Drag & Drop and Select Handlers
  onCanvasMouseDown(event: MouseEvent): void {
    if (!this.previewCanvas) return;
    const canvas = this.previewCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const mouseY = ((event.clientY - rect.top) / rect.height) * canvas.height;

    const clickedIdx = this.hitTest(mouseX, mouseY, canvas);
    if (clickedIdx !== -1) {
      this.activeTextIndex.set(clickedIdx);
      this.isDragging = true;
      this.draggedIndex = clickedIdx;

      const overlay = this.textOverlays()[clickedIdx];
      this.dragStartX = mouseX;
      this.dragStartY = mouseY;
      this.dragStartPercentX = overlay.xPercent;
      this.dragStartPercentY = overlay.yPercent;

      this.updateCanvasPreview();
    } else {
      // Clicked outside any text overlay, deselect active text
      this.activeTextIndex.set(null);
      this.updateCanvasPreview();
    }
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.previewCanvas) return;
    const canvas = this.previewCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const mouseY = ((event.clientY - rect.top) / rect.height) * canvas.height;

    if (this.isDragging && this.draggedIndex !== null) {
      const deltaX = mouseX - this.dragStartX;
      const deltaY = mouseY - this.dragStartY;

      const deltaPercentX = (deltaX / canvas.width) * 100;
      const deltaPercentY = (deltaY / canvas.height) * 100;

      const overlay = this.textOverlays()[this.draggedIndex];
      if (overlay) {
        this.textOverlays.update(current => {
          const updated = [...current];
          updated[this.draggedIndex!] = {
            ...overlay,
            xPercent: Math.min(100, Math.max(0, Math.round(this.dragStartPercentX + deltaPercentX))),
            yPercent: Math.min(100, Math.max(0, Math.round(this.dragStartPercentY + deltaPercentY)))
          };
          return updated;
        });
        this.updateCanvasPreview();
      }
    } else {
      // Check hover state for cursor icon changes
      const hoverIdx = this.hitTest(mouseX, mouseY, canvas);
      canvas.style.cursor = hoverIdx !== -1 ? 'move' : 'default';
    }
  }

  onCanvasMouseUp(): void {
    this.isDragging = false;
    this.draggedIndex = null;
  }

  // Touch handlers mapping to mouse events for mobile support
  onCanvasTouchStart(event: TouchEvent): void {
    if (event.touches.length === 0) return;
    const touch = event.touches[0];
    const rect = this.previewCanvas.nativeElement.getBoundingClientRect();
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    this.onCanvasMouseDown(mouseEvent);
  }

  onCanvasTouchMove(event: TouchEvent): void {
    if (event.touches.length === 0) return;
    const touch = event.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    this.onCanvasMouseMove(mouseEvent);
    event.preventDefault(); // Prevent page scroll on touch-move over canvas
  }

  onCanvasTouchEnd(): void {
    this.onCanvasMouseUp();
  }

  private hitTest(x: number, y: number, canvas: HTMLCanvasElement): number {
    const ctx = canvas.getContext('2d');
    if (!ctx) return -1;

    const overlays = this.textOverlays();
    for (let i = overlays.length - 1; i >= 0; i--) {
      const overlay = overlays[i];

      const fontStyle = `${overlay.italic ? 'italic ' : ''}${overlay.bold ? 'bold ' : ''}${overlay.fontSize}px "${overlay.fontFamily}", sans-serif`;
      ctx.font = fontStyle;
      ctx.textAlign = overlay.align;
      ctx.textBaseline = 'middle';

      const metrics = ctx.measureText(overlay.text);
      const textWidth = metrics.width;
      const textHeight = overlay.fontSize;

      const oX = (overlay.xPercent / 100) * canvas.width;
      const oY = (overlay.yPercent / 100) * canvas.height;

      let left = oX;
      if (overlay.align === 'center') {
        left = oX - textWidth / 2;
      } else if (overlay.align === 'right') {
        left = oX - textWidth;
      }

      const right = left + textWidth;
      const top = oY - textHeight / 2;
      const bottom = oY + textHeight / 2;

      // Click boundary padding for grab handles
      const padding = Math.max(20, overlay.fontSize * 0.3);
      if (x >= left - padding && x <= right + padding && y >= top - padding && y <= bottom + padding) {
        return i;
      }
    }

    return -1;
  }

  // Render Engine
  private renderImageToCanvas(file: ProcessedFile, canvas: HTMLCanvasElement, exportMode = false): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = file.imgElement;

    // Canvas size is always identical to original image dimensions for lossless rendering
    canvas.width = img.width;
    canvas.height = img.height;

    // Draw main image
    ctx.drawImage(img, 0, 0, img.width, img.height);

    // Draw text overlays
    this.textOverlays().forEach((overlay, idx) => {
      ctx.save();

      const x = (overlay.xPercent / 100) * canvas.width;
      const y = (overlay.yPercent / 100) * canvas.height;

      // Opacity
      ctx.globalAlpha = overlay.opacity;

      // Font Configuration
      const fontStyle = `${overlay.italic ? 'italic ' : ''}${overlay.bold ? 'bold ' : ''}${overlay.fontSize}px "${overlay.fontFamily}", sans-serif`;
      ctx.font = fontStyle;
      ctx.fillStyle = overlay.color;
      ctx.textAlign = overlay.align;
      ctx.textBaseline = 'middle';

      // Shadow / Glow Config
      if (overlay.shadowEnabled) {
        ctx.shadowColor = overlay.shadowColor;
        ctx.shadowBlur = overlay.shadowBlur;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      // Draw Outline (Stroke) first so fill text is cleanly layered on top
      if (overlay.outlineWidth > 0) {
        ctx.strokeStyle = overlay.outlineColor;
        ctx.lineWidth = overlay.outlineWidth;
        ctx.strokeText(overlay.text, x, y);
      }

      // Draw Fill Text
      ctx.fillText(overlay.text, x, y);

      // Render Active Highlight bounding box in preview mode only
      if (!exportMode && idx === this.activeTextIndex()) {
        const metrics = ctx.measureText(overlay.text);
        const textWidth = metrics.width;
        const textHeight = overlay.fontSize;

        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#3b82f6';
        // Stroke scale adapts to large source resolutions so dashed border is visible
        ctx.lineWidth = Math.max(2, canvas.width / 500);
        ctx.setLineDash([5, 5]);

        let boxX = x;
        if (overlay.align === 'center') {
          boxX = x - textWidth / 2;
        } else if (overlay.align === 'right') {
          boxX = x - textWidth;
        }

        const padding = Math.max(10, overlay.fontSize * 0.15);
        ctx.strokeRect(
          boxX - padding,
          y - textHeight / 2 - padding,
          textWidth + padding * 2,
          textHeight + padding * 2
        );
      }

      ctx.restore();
    });
  }

  // Update canvas preview
  updateCanvasPreview(): void {
    const files = this.uploadedFiles();
    const idx = this.activeFileIndex();
    if (files.length === 0 || !files[idx] || !this.previewCanvas) return;

    this.renderImageToCanvas(files[idx], this.previewCanvas.nativeElement, false);
  }

  // Exporters
  exportImage(): void {
    const files = this.uploadedFiles();
    const idx = this.activeFileIndex();
    if (files.length === 0 || !files[idx]) return;

    this.downloadFile(files[idx]);
  }

  exportAllImages(): void {
    const files = this.uploadedFiles();
    if (files.length === 0) return;

    const tempCanvas = document.createElement('canvas');
    files.forEach((file) => {
      this.renderImageToCanvas(file, tempCanvas, true);
      this.downloadCanvas(tempCanvas, file.name);
    });
  }

  private downloadFile(file: ProcessedFile): void {
    if (!this.previewCanvas) return;
    
    // Create a high-res temporary canvas for exporting to strip helper outlines/borders
    const tempCanvas = document.createElement('canvas');
    this.renderImageToCanvas(file, tempCanvas, true);
    this.downloadCanvas(tempCanvas, file.name);
  }

  private downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
    const mimeType = this.exportFormat() === 'png' ? 'image/png' : 'image/jpeg';
    const quality = this.exportFormat() === 'png' ? undefined : (this.jpegQuality() / 100);

    const dataUrl = canvas.toDataURL(mimeType, quality);
    const link = document.createElement('a');
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;

    link.download = `${nameWithoutExt}_watermarked.${this.exportFormat()}`;
    link.href = dataUrl;
    link.click();
  }

  resetEditor(): void {
    this.uploadedFiles.set([]);
    this.activeFileIndex.set(0);
    this.imageLoaded.set(false);
    this.textOverlays.set([]);
    this.activeTextIndex.set(null);
  }
}
