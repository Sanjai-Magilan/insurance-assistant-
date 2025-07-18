#!/bin/bash

# Insurance Assistant - Vercel Deployment Script

echo "🚀 Deploying Insurance Assistant to Vercel..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "📂 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit for Vercel deployment"
fi

# Deploy to Vercel
echo "🔄 Starting Vercel deployment..."
vercel --prod

echo "✅ Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Set up environment variables in Vercel dashboard:"
echo "   - GROQ_API_KEY: Your GROQ API key"
echo "   - NODE_ENV: production"
echo ""
echo "2. Your app should be available at the provided Vercel URL"
echo "3. Test all interfaces: Chat, Plans, Claim Assessment"
echo ""
echo "🔗 Useful links:"
echo "- Vercel Dashboard: https://vercel.com/dashboard"
echo "- GROQ Console: https://console.groq.com/"
