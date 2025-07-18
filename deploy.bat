@echo off
REM Insurance Assistant - Vercel Deployment Script for Windows

echo 🚀 Deploying Insurance Assistant to Vercel...

REM Check if Vercel CLI is installed
where vercel >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Vercel CLI not found. Installing...
    npm install -g vercel
)

REM Check if we're in a git repository
if not exist ".git" (
    echo 📂 Initializing git repository...
    git init
    git add .
    git commit -m "Initial commit for Vercel deployment"
)

REM Deploy to Vercel
echo 🔄 Starting Vercel deployment...
vercel --prod

echo ✅ Deployment completed!
echo.
echo 📋 Next steps:
echo 1. Set up environment variables in Vercel dashboard:
echo    - GROQ_API_KEY: Your GROQ API key
echo    - NODE_ENV: production
echo.
echo 2. Your app should be available at the provided Vercel URL
echo 3. Test all interfaces: Chat, Plans, Claim Assessment
echo.
echo 🔗 Useful links:
echo - Vercel Dashboard: https://vercel.com/dashboard
echo - GROQ Console: https://console.groq.com/

pause
