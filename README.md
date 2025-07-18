# Insurance Assistant - Vercel Deployment

An intelligent insurance claim assistant with dynamic plan management and AI analysis capabilities.

## 🚀 Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ST-SARAVANAPRIYAN/insurance_assistant)

## 📋 Prerequisites

Before deploying, make sure you have:

1. A [Vercel account](https://vercel.com/signup)
2. A [GROQ API key](https://console.groq.com/) for AI analysis

## 🔧 Environment Variables

Set up the following environment variables in your Vercel project:

```env
GROQ_API_KEY=your-groq-api-key-here
NODE_ENV=production
```

## 📦 Manual Deployment Steps

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy from project directory:
   ```bash
   vercel
   ```

4. Follow the prompts and set environment variables when asked.

### Option 2: Deploy via GitHub Integration

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy automatically on every push

## 🌐 Project Structure

```
insurance-assistant/
├── index.html              # Landing page
├── chat-interface.html     # Chat interface
├── claim-assessment.html   # Claim assessment page
├── chat-server.js          # Main Node.js server
├── package.json            # Dependencies
├── vercel.json            # Vercel configuration
├── src/                   # Source code
│   └── services/          # Backend services
├── data/                  # Insurance plans data
│   ├── plans/            # Plan configurations
│   └── disease-rules.json # Disease rules
└── assets/               # Static assets
```

## 🔑 API Endpoints

- `GET /` - Landing page
- `GET /chat-interface.html` - Chat interface
- `GET /claim-assessment.html` - Claim assessment
- `POST /api/chat` - Chat API
- `POST /api/plans` - Plan management
- `POST /api/claim-assessment` - Claim assessment

## 🛠️ Features

- **AI-Powered Chat**: Intelligent responses using GROQ AI
- **Plan Management**: Dynamic insurance plan loading and management
- **Claim Assessment**: Automated claim eligibility analysis
- **Multi-Interface Support**: Chat, plan management, and claim assessment
- **Real-time Analysis**: Live claim processing and plan recommendations

## 📱 Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/ST-SARAVANAPRIYAN/insurance_assistant.git
   cd insurance_assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Add your GROQ API key to `.env`

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000` in your browser

## 🔧 Configuration

The project uses `vercel.json` for deployment configuration:

- **Functions**: Node.js serverless functions with 30s timeout
- **Routes**: API routes and static file serving
- **Static Files**: HTML, CSS, JS, and data files

## 📚 Dependencies

- **Express.js**: Web framework
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API protection
- **GROQ**: AI analysis engine
- **Multer**: File upload handling

## 🔒 Security Features

- Rate limiting (100 requests per 15 minutes)
- CORS configuration
- Environment variable protection
- Input validation and sanitization

## 📈 Performance

- Optimized for Vercel's edge network
- Static asset caching
- Efficient data loading
- Minimal bundle size

## 🐛 Troubleshooting

### Common Issues:

1. **GROQ API Key Error**: Ensure your API key is correctly set in environment variables
2. **Build Failures**: Check that all dependencies are listed in `package.json`
3. **Function Timeout**: Increase timeout in `vercel.json` if needed
4. **Static Files Not Loading**: Verify file paths are correct

### Getting Help:

- Check Vercel deployment logs
- Verify environment variables are set
- Test locally before deploying
- Check browser console for errors

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

For more information about Vercel deployment, visit the [Vercel Documentation](https://vercel.com/docs).
