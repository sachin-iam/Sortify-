# Sortify - AI-Powered Email Organization Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://python.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green.svg)](https://mongodb.com/)

Sortify is a cutting-edge full-stack application that uses machine learning to automatically categorize and organize emails. It features a stunning 3D glass morphism design with React Three Fiber, providing intelligent email classification, analytics, and export capabilities.

## ✨ Features

- **🔐 Secure OAuth Authentication** - Google OAuth integration
- **🤖 ML-Powered Classification** - BERT-based email categorization
- **📊 Real-time Analytics** - Email insights and performance metrics
- **🔍 Advanced Search & Filtering** - Find emails quickly with smart filters
- **🎨 3D Glass Design** - Modern UI with React Three Fiber and glass morphism
- **📱 Responsive Design** - Works perfectly on all devices
- **🚀 Docker Support** - Easy deployment with containerization
- **🧪 Comprehensive Testing** - Full test coverage for reliability

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Node.js Server │    │  FastAPI ML     │
│   (Port 3000)   │◄──►│   (Port 5000)   │◄──►│   Service       │
│   Vite + 3D     │    │   Express       │    │  (Port 8000)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │    MongoDB      │
                       │   Atlas Cloud   │
                       └─────────────────┘
```

- **Frontend**: React + Vite with Tailwind CSS and React Three Fiber
- **Backend**: Node.js + Express with security middleware
- **ML Service**: FastAPI with BERT-based email classification
- **Database**: MongoDB Atlas (Cloud)
- **Authentication**: OAuth 2.0 with JWT tokens

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Python** 3.8+ ([Download](https://python.org/))
- **MongoDB Atlas** account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sortify
   ```

2. **Install all dependencies (including Python venv)**
   ```bash
   npm run install:deps
   ```
   
   This command will:
   - Install root npm dependencies
   - Install client (React) dependencies
   - Install server (Node.js) dependencies
   - Create Python virtual environment in `model_service/venv/`
   - Install Python ML dependencies

3. **Environment Setup** _(Already configured)_
   
   The `.env` file in the `server/` directory is already set up with default values.
   You can modify it if needed for custom configuration.

4. **Start the application**
   ```bash
   npm run dev
   ```
   
   This single command starts all three services:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:5000
   - ML Service: http://localhost:8000

**Access the application:**
- 🌐 **Frontend**: http://localhost:3000
- 🔌 **API Server**: http://localhost:5000
- 🤖 **ML Service**: http://localhost:8000

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific tests
npm run test:client
npm run test:server
npm run test:model
```

## 🎨 3D Design Features

- **Glass Morphism**: Backdrop blur effects with transparency
- **3D Icons**: React Three Fiber powered interactive icons
- **Smooth Animations**: Framer Motion for fluid transitions
- **Particle Systems**: Dynamic background elements
- **Depth & Shadows**: Realistic 3D visual effects
- **Responsive 3D**: Adapts to all screen sizes

## 📚 API Documentation

### Server Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/emails` | Get emails with filtering |
| `POST` | `/api/emails` | Create/sync emails |
| `GET` | `/api/analytics` | Email analytics |
| `POST` | `/auth/google` | Google OAuth |

### ML Service Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health |
| `POST` | `/predict` | Classify email |
| `POST` | `/train` | Train model |
| `GET` | `/status` | Model status |

## 🚀 Deployment

### Production Environment

1. **Set Environment Variables**
   ```bash
   NODE_ENV=production
   MONGO_URI=your-production-mongo-uri
   JWT_SECRET=your-super-secret-key
   ```

2. **Build and Deploy**
   ```bash
   npm run build
   npm start
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `npm test`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ by the Sortify Team**
