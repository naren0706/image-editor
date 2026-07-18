import { Component, ElementRef, ViewChild, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
export class BorderEditorComponent {
  @ViewChild('previewCanvas', { static: false }) previewCanvas!: ElementRef<HTMLCanvasElement>;

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
    if (files.length === 0 || !files[idx] || !this.previewCanvas) return;

    this.renderImageToCanvas(files[idx], this.previewCanvas.nativeElement);
  }

  // Value change handlers triggering instant preview updates
  onOptionChange(): void {
    this.updateCanvasPreview();
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
    this.processingTitle.set('Exporting Images');
    this.processingProgress.set(0);
    this.processingTotal.set(files.length);
    this.processingCurrentName.set('');
    this.processingCompleted.set(false);
    this.cancelRequested.set(false);

    // Create a temporary canvas in memory to render and export consecutively
    const tempCanvas = document.createElement('canvas');
    
    for (let i = 0; i < files.length; i++) {
      if (this.cancelRequested()) {
        break;
      }

      const file = files[i];
      this.processingCurrentName.set(file.name);

      // Render to temporary canvas
      this.renderImageToCanvas(file, tempCanvas);

      // Save Canvas asynchronously
      await this.downloadCanvasAsync(tempCanvas, file.name);

      this.processingProgress.set(i + 1);

      // Yield control to browser so loader modal repaint is smooth
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.processingCompleted.set(true);
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
