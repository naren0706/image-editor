# Lossless Image Border Editor

A sleek, premium, and powerful web application designed for adding custom borders, drop shadows, and rounded corners to images with 100% pixel quality (lossless). Perfect for designers, content creators, and developers who need high-fidelity image framing.

---

## 🚀 Features

- **Custom Border Sizing:** Choose between uniform margins or separate X/Y sizes.
- **Vibrant Color Customization:** Select any hex color or pick from custom presets.
- **Image Corner Radius:** Instantly add smooth, rounded corners to the inner images.
- **Drop Shadow Effects:** Highly configurable shadow offsets, blur radius, color, and opacity.
- **Inner-Edge Shadow Clipping:** Shadows are automatically clipped inside the border boundary, keeping the final output clean with no leaking margins.
- **Batch Processing & Queue List:** Upload multiple images, manage them in a queue list, preview them individually in real time, and export them in one click.
- **Lossless Exports:** Support for exporting as lossless PNG or adjustable-quality JPEG.
- **Interactive Progress Loader:** Displays a radial loading animation with real-time feedback during bulk imports and exports.

---

## 🛠️ Tech Stack

- **Frontend:** [Angular](https://angular.dev/) (Standalone Components, Signals, Computed properties)
- **Styling:** CSS variables, responsive design, backdrop blurs, and premium dark-mode aesthetics
- **Backend:** Node.js + [Express](https://expressjs.com/) API (with CORS support)
- **Build & Tests:** Vitest & Angular Unit-Testing environment

---

## 📂 Project Structure

```
├── backend/                   # Express backend (running health checks)
│   ├── server.js              # Entrypoint server script
│   └── package.json
├── frontend/                  # Angular Single Page App (SPA)
│   ├── src/
│   │   ├── app/
│   │   │   ├── border-editor/ # Main border editor interface, HTML, and styling
│   │   │   ├── dashboard/     # Landing dashboard page
│   │   │   └── ...
│   └── package.json
└── package.json               # Root scripts to orchestrate backend + frontend
```

---

## ⚡ Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 1. Install Dependencies
Run the installation script in the root directory to set up both frontend and backend packages:
```bash
npm run install:all
```

### 2. Run the Development Servers
Start both the backend API and the frontend Angular server concurrently:
```bash
npm start
```

This will run:
- Frontend: [http://localhost:4200](http://localhost:4200)
- Backend: [http://localhost:3000](http://localhost:3000)

---

## 🧪 Running Tests
To run unit tests in the frontend project:
```bash
cd frontend
npm run test
```

---

## 📦 Building for Production
To bundle the frontend application for production deployment:
```bash
npm run build
```
The compiled output will be written to `frontend/dist/frontend`.