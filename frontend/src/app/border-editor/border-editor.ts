import { Component, ElementRef, ViewChild, signal, computed, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ProcessedFile {
  id: string;
  name: string;
  imgElement: HTMLImageElement;
  width: number;
  height: number;
  objectUrl?: string;
}

@Component({
  selector: 'app-border-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './border-editor.html',
  styleUrl: './border-editor.css'
})
export class BorderEditorComponent implements OnDestroy {
  @ViewChild('previewCanvas', { static: false }) previewCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('floatingCanvas', { static: false }) floatingCanvas!: ElementRef<HTMLCanvasElement>;

  // Floating Preview Configurations & State
  private observer: IntersectionObserver | null = null;
  isFloatingPreviewVisible = signal<boolean>(false);
  floatingX = signal<number>(20);
  floatingY = signal<number>(80);
  floatingWidth = signal<number>(150);
  floatingHeight = signal<number>(150);

  // Drag and Resize State
  private dragStartX = 0;
  private dragStartY = 0;
  private initialFloatingX = 0;
  private initialFloatingY = 0;
  isDragging = false;

  private resizeStartX = 0;
  private resizeStartY = 0;
  private initialWidth = 0;
  private initialHeight = 0;
  isResizing = false;

  constructor() {
    effect(() => {
      if (this.imageLoaded()) {
        this.setupIntersectionObserver();
      } else {
        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }
        this.isFloatingPreviewVisible.set(false);
      }
    });
  }


  // Upload state
  uploadedFiles = signal<ProcessedFile[]>([]);
  activeFileIndex = signal<number>(0);
  imageLoaded = signal<boolean>(false);

  // Processing / Progress state
  isProcessing = signal<boolean>(false);
  processingTitle = signal<string>('');
  processingProgress = signal<number>(0);
  processingTotal = signal<number>(0);
  processingCurrentName = signal<string>('');
  processingCompleted = signal<boolean>(false);
  cancelRequested = signal<boolean>(false);

  // Computed progress values
  processingPercentage = computed(() => {
    const total = this.processingTotal();
    if (total === 0) return 0;
    return Math.round((this.processingProgress() / total) * 100);
  });

  progressDashoffset = computed(() => {
    const pct = this.processingPercentage();
    const circumference = 314.159265;
    return circumference - (pct / 100) * circumference;
  });

  // Border Configuration Options
  borderMode = signal<'uniform' | 'separate'>('uniform');
  borderWidthUniform = signal<number>(20);
  borderWidthX = signal<number>(20);
  borderWidthY = signal<number>(20);
  borderColor = signal<string>('#ffffff');

  // Advanced Configurations
  borderRadius = signal<number>(0);

  // Shadow Configurations
  shadowEnabled = signal<boolean>(false);
  shadowColor = signal<string>('rgba(0, 0, 0, 0.5)');
  shadowBlur = signal<number>(15);
  shadowOffsetX = signal<number>(5);
  shadowOffsetY = signal<number>(5);

  // Export Settings
  exportFormat = signal<'png' | 'jpeg'>('png');
  jpegQuality = signal<number>(95);

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

  private async loadFiles(files: FileList): Promise<void> {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    this.isProcessing.set(true);
    this.processingTitle.set('Importing Images');
    this.processingProgress.set(0);
    this.processingTotal.set(imageFiles.length);
    this.processingCurrentName.set('');
    this.processingCompleted.set(false);
    this.cancelRequested.set(false);

    const loadedList: ProcessedFile[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      if (this.cancelRequested()) {
        break;
      }

      const file = imageFiles[i];
      this.processingCurrentName.set(file.name);

      try {
        const imgElement = await this.loadImageAsync(file);
        loadedList.push({
          id: crypto.randomUUID(),
          name: file.name,
          imgElement: imgElement,
          width: imgElement.width,
          height: imgElement.height,
          objectUrl: imgElement.src
        });
      } catch (err) {
        console.error('Failed to load image:', file.name, err);
      }

      this.processingProgress.set(i + 1);
      // Yield to allow UI updates and maintain responsiveness
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    if (loadedList.length > 0) {
      this.uploadedFiles.update(current => [...current, ...loadedList]);
      this.imageLoaded.set(true);

      // Default active element preview rendering (wait for DOM/ViewChild canvas initialization)
      setTimeout(() => {
        if (this.uploadedFiles().length > 0) {
          this.updateCanvasPreview();
        }
      }, 100);
    }

    this.processingCompleted.set(true);

    // Auto-close modal after 800ms if not canceled
    if (!this.cancelRequested()) {
      setTimeout(() => {
        this.closeModal();
      }, 800);
    }
  }

  private loadImageAsync(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
      img.src = objectUrl;
    });
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
      const removed = updated.splice(index, 1)[0];
      if (removed && removed.objectUrl) {
        URL.revokeObjectURL(removed.objectUrl);
      }
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

  // Render Engine (Renders parameters to a target HTMLCanvasElement)
  private renderImageToCanvas(file: ProcessedFile, canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = file.imgElement;

    // Calculate borders
    let bX = this.borderWidthUniform();
    let bY = this.borderWidthUniform();
    if (this.borderMode() === 'separate') {
      bX = this.borderWidthX();
      bY = this.borderWidthY();
    }

    // Calculate extra padding needed for shadows to avoid clipping (always 0 to prevent shadows spilling outside the border)
    const shadowPaddingLeft = 0;
    const shadowPaddingRight = 0;
    const shadowPaddingTop = 0;
    const shadowPaddingBottom = 0;

    // Set canvas dimensions to include original image size + borders (without shadow padding)
    const targetWidth = img.width + (bX * 2);
    const targetHeight = img.height + (bY * 2);

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Draw background/border color covering the entire canvas
    ctx.fillStyle = this.borderColor();
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Prepare clipping path for border radius + shadow if enabled
    ctx.save();

    if (this.shadowEnabled()) {
      ctx.shadowColor = this.shadowColor();
      ctx.shadowBlur = this.shadowBlur();
      ctx.shadowOffsetX = this.shadowOffsetX();
      ctx.shadowOffsetY = this.shadowOffsetY();

      // Draw shadow shape under the image
      ctx.fillStyle = '#000000'; // Shadow fallback shape
      const radius = this.borderRadius();
      if (radius > 0) {
        ctx.beginPath();
        ctx.roundRect(bX, bY, img.width, img.height, radius);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(bX, bY, img.width, img.height);
      }

      // Reset shadow properties so the image itself isn't double-shadowed
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Image coordinates offset by border width
    const imgX = bX;
    const imgY = bY;

    // Clip rounded corners on inner image if radius > 0
    const radius = this.borderRadius();
    if (radius > 0) {
      ctx.beginPath();
      ctx.roundRect(imgX, imgY, img.width, img.height, radius);
      ctx.closePath();
      ctx.clip();
    }

    // Draw image inside border frame
    ctx.drawImage(img, imgX, imgY, img.width, img.height);

    ctx.restore();
  }


  // Live Canvas Preview Rendering trigger
  updateCanvasPreview(): void {
    const files = this.uploadedFiles();
    const idx = this.activeFileIndex();
    if (files.length === 0 || !files[idx]) return;

    if (this.previewCanvas) {
      this.renderImageToCanvas(files[idx], this.previewCanvas.nativeElement);
    }
    if (this.floatingCanvas && this.isFloatingPreviewVisible()) {
      this.renderImageToCanvas(files[idx], this.floatingCanvas.nativeElement);
    }
  }

  // Value change handlers triggering instant preview updates
  onOptionChange(): void {
    this.updateCanvasPreview();
  }

  // Floating Preview Helper Methods
  private setupIntersectionObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
    }

    setTimeout(() => {
      if (!this.previewCanvas) return;

      const options = {
        root: null,
        threshold: 0.05
      };

      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const isMobile = window.innerWidth <= 768;
          const shouldBeVisible = isMobile && !entry.isIntersecting;

          if (shouldBeVisible !== this.isFloatingPreviewVisible()) {
            this.isFloatingPreviewVisible.set(shouldBeVisible);
            if (shouldBeVisible) {
              const defaultX = window.innerWidth - this.floatingWidth() - 20;
              this.floatingX.set(Math.max(10, defaultX));
              this.floatingY.set(80);

              setTimeout(() => this.updateCanvasPreview(), 30);
            }
          }
        });
      }, options);

      this.observer.observe(this.previewCanvas.nativeElement);
    }, 300);
  }

  onFloatingDragStart(event: MouseEvent | TouchEvent): void {
    if (this.isResizing) return;
    event.preventDefault();
    this.isDragging = true;

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.initialFloatingX = this.floatingX();
    this.initialFloatingY = this.floatingY();

    const moveListener = (moveEvent: MouseEvent | TouchEvent) => {
      if (!this.isDragging) return;
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const dx = currentX - this.dragStartX;
      const dy = currentY - this.dragStartY;

      let newX = this.initialFloatingX + dx;
      let newY = this.initialFloatingY + dy;

      const maxX = window.innerWidth - this.floatingWidth() - 10;
      const maxY = window.innerHeight - this.floatingHeight() - 10;
      newX = Math.max(10, Math.min(newX, maxX));
      newY = Math.max(10, Math.min(newY, maxY));

      this.floatingX.set(newX);
      this.floatingY.set(newY);
    };

    const endListener = () => {
      this.isDragging = false;
      window.removeEventListener('mousemove', moveListener);
      window.removeEventListener('mouseup', endListener);
      window.removeEventListener('touchmove', moveListener);
      window.removeEventListener('touchend', endListener);
    };

    window.addEventListener('mousemove', moveListener, { passive: false });
    window.addEventListener('mouseup', endListener);
    window.addEventListener('touchmove', moveListener, { passive: false });
    window.addEventListener('touchend', endListener);
  }

  onFloatingResizeStart(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing = true;

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

    this.resizeStartX = clientX;
    this.resizeStartY = clientY;
    this.initialWidth = this.floatingWidth();
    this.initialHeight = this.floatingHeight();

    const moveListener = (moveEvent: MouseEvent | TouchEvent) => {
      if (!this.isResizing) return;
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const dx = currentX - this.resizeStartX;
      const dy = currentY - this.resizeStartY;

      const delta = Math.max(dx, dy);
      let newSize = this.initialWidth + delta;

      newSize = Math.max(100, Math.min(newSize, 350));

      this.floatingWidth.set(newSize);
      this.floatingHeight.set(newSize);

      const maxX = window.innerWidth - newSize - 10;
      const maxY = window.innerHeight - newSize - 10;
      if (this.floatingX() > maxX) this.floatingX.set(Math.max(10, maxX));
      if (this.floatingY() > maxY) this.floatingY.set(Math.max(10, maxY));
    };

    const endListener = () => {
      this.isResizing = false;
      window.removeEventListener('mousemove', moveListener);
      window.removeEventListener('mouseup', endListener);
      window.removeEventListener('touchmove', moveListener);
      window.removeEventListener('touchend', endListener);
    };

    window.addEventListener('mousemove', moveListener, { passive: false });
    window.addEventListener('mouseup', endListener);
    window.addEventListener('touchmove', moveListener, { passive: false });
    window.addEventListener('touchend', endListener);
  }

  cycleFloatingSize(event: MouseEvent): void {
    event.stopPropagation();
    const currentWidth = this.floatingWidth();
    let newWidth = 150;
    if (currentWidth < 150) newWidth = 150;
    else if (currentWidth === 150) newWidth = 220;
    else if (currentWidth === 220) newWidth = 300;
    else newWidth = 100;

    this.floatingWidth.set(newWidth);
    this.floatingHeight.set(newWidth);

    const maxX = window.innerWidth - newWidth - 10;
    const maxY = window.innerHeight - newWidth - 10;
    this.floatingX.set(Math.max(10, Math.min(this.floatingX(), maxX)));
    this.floatingY.set(Math.max(10, Math.min(this.floatingY(), maxY)));

    setTimeout(() => this.updateCanvasPreview(), 30);
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }


  // Single Active Export
  exportImage(): void {
    const files = this.uploadedFiles();
    const idx = this.activeFileIndex();
    if (files.length === 0 || !files[idx]) return;

    this.downloadFile(files[idx]);
  }

  // Bulk Export All Uploaded Files
  async exportAllImages(): Promise<void> {
    const files = this.uploadedFiles();

    if (files.length === 0) return;

    this.isProcessing.set(true);
    this.processingTitle.set('Preparing ZIP');
    this.processingProgress.set(0);
    this.processingTotal.set(files.length);
    this.processingCurrentName.set('');
    this.processingCompleted.set(false);
    this.cancelRequested.set(false);

    const zip = new JSZip();
    const tempCanvas = document.createElement('canvas');

    try {
      for (let i = 0; i < files.length; i++) {

        if (this.cancelRequested()) {
          break;
        }

        const file = files[i];

        this.processingCurrentName.set(file.name);

        // Render image
        this.renderImageToCanvas(file, tempCanvas);

        // Convert canvas to blob
        const blob = await this.canvasToBlob(tempCanvas);

        // Original filename without extension
        const fileName =
          file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

        // Add to zip
        zip.file(`${fileName}.png`, blob);

        this.processingProgress.set(i + 1);

        // Allow UI updates
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      if (!this.cancelRequested()) {
        this.processingTitle.set('Compressing Images...');

        const zipBlob = await zip.generateAsync(
          {
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: {
              level: 6
            }
          },
          (metadata: any) => {
            // Optional: update progress while zipping
            this.processingProgress.set(
              Math.round((metadata.percent / 100) * files.length)
            );
          }
        );

        saveAs(zipBlob, 'Images.zip');
      }

      this.processingCompleted.set(true);
    } catch (err) {
      console.error(err);
    } finally {
      this.isProcessing.set(false);
    }
  }
  private canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create image blob'));
        }
      }, 'image/png');
    });
  }
  private downloadFile(file: ProcessedFile): void {
    if (!this.previewCanvas) return;
    this.downloadCanvasAsync(this.previewCanvas.nativeElement, file.name);
  }

  private downloadCanvasAsync(canvas: HTMLCanvasElement, filename: string): Promise<void> {
    return new Promise((resolve) => {
      const mimeType = this.exportFormat() === 'png' ? 'image/png' : 'image/jpeg';
      const quality = this.exportFormat() === 'png' ? undefined : (this.jpegQuality() / 100);

      // toBlob performs compression off the main thread, greatly improving performance
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;

          link.download = `${nameWithoutExt}_bordered.${this.exportFormat()}`;
          link.href = url;
          link.click();

          // Revoke the temporary Object URL after a delay to ensure download registers
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 150);
        }
        resolve();
      }, mimeType, quality);
    });
  }

  cancelProcessing(): void {
    this.cancelRequested.set(true);
    this.closeModal();
  }

  closeModal(): void {
    this.isProcessing.set(false);
    this.processingCompleted.set(false);
  }

  resetEditor(): void {
    // Revoke all object URLs to prevent memory leaks
    this.uploadedFiles().forEach(file => {
      if (file.objectUrl) {
        URL.revokeObjectURL(file.objectUrl);
      }
    });
    this.uploadedFiles.set([]);
    this.activeFileIndex.set(0);
    this.imageLoaded.set(false);
  }
}
