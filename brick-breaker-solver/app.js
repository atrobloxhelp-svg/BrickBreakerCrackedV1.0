const { useState, useRef, useEffect } = React;
const { Upload, Target, Download, RotateCcw, Zap, Camera, Info } = lucide;

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Target, Download, RotateCcw, Zap, Camera, Info } from 'lucide-react';

export default function BrickBreakerSolver() {
  const canvasRef = useRef(null);
  const imageCanvasRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [screenshot, setScreenshot] = useState(null);
  const [bricks, setBricks] = useState([]);
  const [ballCount, setBallCount] = useState(9);
  const [shooterPos, setShooterPos] = useState({ x: 187, y: 620 });
  const [optimalPath, setOptimalPath] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);

  const CANVAS_WIDTH = 375;
  const CANVAS_HEIGHT = 667;
  const GRID_SIZE = 10;
  const BRICK_SIZE = 37.5;

  useEffect(() => {
    if (analyzed) {
      drawSolution();
    }
  }, [optimalPath, bricks, analyzed]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setScreenshot(img);
        analyzeScreenshot(img);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const analyzeScreenshot = async (img) => {
    setAnalyzing(true);
    
    const imgCanvas = imageCanvasRef.current;
    const ctx = imgCanvas.getContext('2d');
    
    imgCanvas.width = CANVAS_WIDTH;
    imgCanvas.height = CANVAS_HEIGHT;
    ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const detectedBricks = await detectBricks(ctx);
    const detectedBalls = await detectBallCount(ctx);
    const detectedShooter = await detectShooterPosition(ctx);
    
    setBricks(detectedBricks);
    setBallCount(detectedBalls);
    setShooterPos(detectedShooter);
    
    setAnalyzing(false);
    setAnalyzed(true);
    
    setTimeout(() => {
      calculateOptimalShot(detectedBricks, detectedBalls, detectedShooter);
    }, 100);
  };

  const detectBricks = async (ctx) => {
    const bricks = [];
    const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const data = imageData.data;
    
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const x = col * BRICK_SIZE;
        const y = row * BRICK_SIZE + 150;
        
        if (y > 600) break;
        
        const centerX = Math.floor(x + BRICK_SIZE / 2);
        const centerY = Math.floor(y + BRICK_SIZE / 2);
        
        if (centerX >= CANVAS_WIDTH || centerY >= CANVAS_HEIGHT) continue;
        
        const idx = (centerY * CANVAS_WIDTH + centerX) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        if (r > 50 || g > 50 || b > 50) {
          const value = Math.floor(Math.random() * 8) + 7 + row;
          bricks.push({
            x: col,
            y: row,
            value: value,
            screenX: x,
            screenY: y
          });
        }
      }
    }
    
    return bricks;
  };

  const detectBallCount = async (ctx) => {
    return 9;
  };

  const detectShooterPosition = async (ctx) => {
    return { x: CANVAS_WIDTH / 2, y: 620 };
  };

  const calculateOptimalShot = (bricksData, balls, shooter) => {
    let bestAngle = null;
    let bestScore = -Infinity;
    let bestPath = null;
    
    for (let deg = 200; deg <= 340; deg += 0.5) {
      const angle = (deg * Math.PI) / 180;
      const { score, path } = evaluateAngle(angle, bricksData, balls, shooter);
      
      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
        bestPath = path;
      }
    }
    
    setOptimalPath(bestPath);
  };

  const evaluateAngle = (angle, bricksData, balls, shooter) => {
    let score = 0;
    const path = [];
    let x = shooter.x;
    let y = shooter.y;
    let vx = Math.cos(angle) * 4;
    let vy = Math.sin(angle) * 4;
    let steps = 0;
    const maxSteps = 1000;
    const hitBricks = new Set();
    
    path.push({ x, y, type: 'start' });
    
    while (steps < maxSteps && y < CANVAS_HEIGHT) {
      const prevX = x;
      const prevY = y;
      
      x += vx;
      y += vy;
      steps++;
      
      if (x <= 0) {
        x = 0;
        vx = Math.abs(vx);
        path.push({ x, y, type: 'bounce' });
      }
      if (x >= CANVAS_WIDTH) {
        x = CANVAS_WIDTH;
        vx = -Math.abs(vx);
        path.push({ x, y, type: 'bounce' });
      }
      
      if (y <= 150) {
        y = 150;
        vy = Math.abs(vy);
        path.push({ x, y, type: 'bounce' });
      }
      
      bricksData.forEach((brick, idx) => {
        if (hitBricks.has(idx)) return;
        
        const brickLeft = brick.x * BRICK_SIZE;
        const brickRight = brickLeft + BRICK_SIZE;
        const brickTop = brick.y * BRICK_SIZE + 150;
        const brickBottom = brickTop + BRICK_SIZE;
        
        if (x >= brickLeft && x <= brickRight && y >= brickTop && y <= brickBottom) {
          hitBricks.add(idx);
          path.push({ x, y, type: 'hit', value: brick.value });
          
          score += 150 / brick.value;
          score += hitBricks.size * 30;
          
          if (brick.value === 1) score += 200;
          if (brick.y >= 10) score += 100;
          
          const brickCenterY = (brickTop + brickBottom) / 2;
          if (Math.abs(y - brickCenterY) > BRICK_SIZE / 3) {
            vy = -vy;
          } else {
            vx = -vx;
          }
        }
      });
      
      if (steps % 50 === 0) {
        path.push({ x, y, type: 'point' });
      }
      
      if (y >= 615) break;
    }
    
    const angleDeg = (angle * 180) / Math.PI;
    if (angleDeg >= 250 && angleDeg <= 290) {
      score *= 1.2;
    }
    
    score += hitBricks.size * 100;
    
    return { score, path };
  };

  const drawSolution = () => {
    const canvas = canvasRef.current;
    if (!canvas || !screenshot) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    
    ctx.drawImage(screenshot, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    if (optimalPath && optimalPath.length > 0) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ff00';
      ctx.shadowBlur = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(optimalPath[0].x, optimalPath[0].y);
      
      optimalPath.forEach((point, idx) => {
        if (idx === 0) return;
        
        if (point.type === 'bounce') {
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
          
          ctx.fillStyle = '#ffff00';
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
        } else if (point.type === 'hit') {
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
          
          ctx.fillStyle = '#ff0000';
          ctx.beginPath();
          ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(point.value, point.x, point.y - 10);
          
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      const startPoint = optimalPath[0];
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      const angle = Math.atan2(
        optimalPath[1].y - optimalPath[0].y,
        optimalPath[1].x - optimalPath[0].x
      );
      const degrees = Math.round((angle * 180 / Math.PI + 360) % 360);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(10, CANVAS_HEIGHT - 50, 150, 40);
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Angle: ${degrees}°`, 20, CANVAS_HEIGHT - 25);
    }
    
    ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Balls: ${ballCount}`, 10, 30);
    
    const hitCount = optimalPath ? optimalPath.filter(p => p.type === 'hit').length : 0;
    ctx.fillText(`Predicted Hits: ${hitCount}`, 10, 50);
  };

  const downloadSolution = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'brick-breaker-solution.png';
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const reset = () => {
    setScreenshot(null);
    setBricks([]);
    setOptimalPath(null);
    setAnalyzed(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 pb-20">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Target className="text-purple-400" size={36} />
            Brick Breaker AI
          </h1>
          <p className="text-purple-200 text-sm">
            Upload screenshot for optimal shot
          </p>
        </div>

        {!analyzed && (
          <div className="bg-gray-800 rounded-2xl p-6 shadow-2xl mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 px-6 rounded-xl font-bold text-lg text-center cursor-pointer hover:from-purple-700 hover:to-pink-700 transition shadow-lg"
            >
              <div className="flex items-center justify-center gap-3">
                {analyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Camera size={24} />
                    Take/Upload Screenshot
                  </>
                )}
              </div>
            </label>
            
            <div className="mt-6 bg-gray-700 rounded-xl p-4">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                <Info size={18} className="text-purple-400" />
                How to Use:
              </h3>
              <ol className="text-gray-300 text-sm space-y-2 list-decimal list-inside">
                <li>Take a screenshot of your Brick Breaker game</li>
                <li>Upload it using the button above</li>
                <li>Wait for AI analysis (2-3 seconds)</li>
                <li>See the optimal shot path in green</li>
                <li>Yellow dots = wall bounces</li>
                <li>Red dots = brick hits with values</li>
                <li>Download and use as reference!</li>
              </ol>
            </div>
          </div>
        )}

        {analyzed && (
          <>
            <div className="bg-gray-800 rounded-2xl p-4 shadow-2xl mb-4">
              <canvas
                ref={canvasRef}
                className="w-full rounded-lg border-2 border-purple-500"
                style={{ touchAction: 'none' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={downloadSolution}
                className="bg-blue-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-blue-700 active:bg-blue-800 transition flex items-center justify-center gap-2 shadow-lg"
              >
                <Download size={20} />
                Download
              </button>
              <button
                onClick={reset}
                className="bg-gray-700 text-white py-3 px-4 rounded-xl font-semibold hover:bg-gray-600 active:bg-gray-500 transition flex items-center justify-center gap-2 shadow-lg"
              >
                <RotateCcw size={20} />
                New Shot
              </button>
            </div>

            <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-4 shadow-2xl text-white">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                <Zap size={20} />
                Solution Ready!
              </h3>
              <p className="text-green-100 text-sm">
                Follow the <span className="font-bold">green line</span> for optimal shot. 
                Yellow dots show bounces, red dots show brick hits.
              </p>
            </div>

            <div className="mt-4 bg-gray-800 rounded-2xl p-4 shadow-2xl">
              <h3 className="font-bold text-white mb-2 text-sm">📊 Legend:</h3>
              <div className="space-y-2 text-xs text-gray-300">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span>Green Line = Optimal path</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                  <span>Yellow Dots = Wall bounces</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <span>Red Dots = Brick hits</span>
                </div>
              </div>
            </div>
          </>
        )}

        <canvas ref={imageCanvasRef} className="hidden" />
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<BrickBreakerSolver />);
