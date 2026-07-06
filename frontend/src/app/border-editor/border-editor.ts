import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ProcessedFile {
  id: string;
  name: string;
  imgElement: HTMLImageElement;
  width: number;
  height: number;
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
            // Append loaded files to uploader state
            this.uploadedFiles.update(current => [...current, ...loadedList]);
            this.imageLoaded.set(true);
            
            // Default active element preview rendering (wait for DOM/ViewChild canvas initialization)
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

    // Calculate extra padding needed for shadows to avoid clipping
    let shadowPaddingLeft = 0;
    let shadowPaddingRight = 0;
    let shadowPaddingTop = 0;
    let shadowPaddingBottom = 0;

    if (this.shadowEnabled()) {
      const blur = this.shadowBlur();
      const ox = this.shadowOffsetX();
      const oy = this.shadowOffsetY();

      // Shadow extends outwards by blur radius + offset direction
      shadowPaddingLeft = Math.max(0, blur - ox);
      shadowPaddingRight = Math.max(0, blur + ox);
      shadowPaddingTop = Math.max(0, blur - oy);
      shadowPaddingBottom = Math.max(0, blur + oy);
    }

    // Set canvas dimensions to include original image size + borders + shadow padding
    const targetWidth = img.width + (bX * 2) + shadowPaddingLeft + shadowPaddingRight;
    const targetHeight = img.height + (bY * 2) + shadowPaddingTop + shadowPaddingBottom;

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Draw background/border color offset by the left/top shadow padding
    ctx.fillStyle = this.borderColor();
    ctx.fillRect(
      shadowPaddingLeft, 
      shadowPaddingTop, 
      img.width + (bX * 2), 
      img.height + (bY * 2)
    );

    // Prepare clipping path for border radius + shadow if enabled
    ctx.save();

    if (this.shadowEnabled()) {
      ctx.shadowColor = this.shadowColor();
      ctx.shadowBlur = this.shadowBlur();
      ctx.shadowOffsetX = this.shadowOffsetX();
      ctx.shadowOffsetY = this.shadowOffsetY();
    }

    // Image coordinates offset by shadow padding and border width
    const imgX = shadowPaddingLeft + bX;
    const imgY = shadowPaddingTop + bY;

    // Clip rounded corners on inner image if radius > 0
    const radius = this.borderRadius();
    if (radius > 0) {
      ctx.beginPath();
      // Draw rounded rectangle around inner image position
      ctx.roundRect(imgX, imgY, img.width, img.height, radius);
      ctx.closePath();
      // Fill shadow underneath if shadow enabled
      if (this.shadowEnabled()) {
        ctx.fillStyle = '#000000'; // Shadow fallback shape
        ctx.fill();
      }
      ctx.clip();
    } else {
      // Flat rectangle shape for shadow fallback when radius is 0
      if (this.shadowEnabled()) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(imgX, imgY, img.width, img.height);
      }
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
  exportAllImages(): void {
    const files = this.uploadedFiles();
    if (files.length === 0) return;

    // Create a temporary canvas in memory to render and export consecutively
    const tempCanvas = document.createElement('canvas');
    files.forEach((file) => {
      this.renderImageToCanvas(file, tempCanvas);
      this.downloadCanvas(tempCanvas, file.name);
    });
  }

  private downloadFile(file: ProcessedFile): void {
    if (!this.previewCanvas) return;
    this.downloadCanvas(this.previewCanvas.nativeElement, file.name);
  }

  private downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
    const mimeType = this.exportFormat() === 'png' ? 'image/png' : 'image/jpeg';
    const quality = this.exportFormat() === 'png' ? undefined : (this.jpegQuality() / 100);

    const dataUrl = canvas.toDataURL(mimeType, quality);
    const link = document.createElement('a');
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
    
    link.download = `${nameWithoutExt}_bordered.${this.exportFormat()}`;
    link.href = dataUrl;
    link.click();
  }

  resetEditor(): void {
    this.uploadedFiles.set([]);
    this.activeFileIndex.set(0);
    this.imageLoaded.set(false);
  }
}
