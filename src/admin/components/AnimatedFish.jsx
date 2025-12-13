import React, { useEffect, useRef } from 'react';

const AnimatedFish = () => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const fish = [];
    const numFish = 8;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    class Fish {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = 15 + Math.random() * 20;
        this.angle = Math.random() * Math.PI * 2;
        this.color = `hsl(${180 + Math.random() * 60}, 70%, ${50 + Math.random() * 20}%)`;
      }
      
      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.vy, this.vx));
        
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.7;
        
        // Fish body
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Fish tail
        ctx.beginPath();
        ctx.moveTo(-this.size * 0.7, 0);
        ctx.lineTo(-this.size * 1.3, -this.size * 0.3);
        ctx.lineTo(-this.size * 1.3, this.size * 0.3);
        ctx.closePath();
        ctx.fill();
        
        // Fish eye
        ctx.fillStyle = 'white';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(this.size * 0.3, -this.size * 0.1, this.size * 0.08, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.size * 0.3, -this.size * 0.1, this.size * 0.04, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      }
      
      update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // Gentle swimming motion
        this.vy += Math.sin(Date.now() * 0.001 + this.x * 0.01) * 0.02;
        
        // Boundaries
        if (this.x > canvas.width + this.size * 2) this.x = -this.size * 2;
        if (this.x < -this.size * 2) this.x = canvas.width + this.size * 2;
        if (this.y > canvas.height + this.size) this.y = -this.size;
        if (this.y < -this.size) this.y = canvas.height + this.size;
        
        // Limit vertical speed
        this.vy = Math.max(-1, Math.min(1, this.vy));
      }
    }
    
    // Create fish
    for (let i = 0; i < numFish; i++) {
      fish.push(new Fish());
    }
    
    // Create bubbles
    const bubbles = [];
    const numBubbles = 20;
    
    class Bubble {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + Math.random() * 100;
        this.size = 2 + Math.random() * 4;
        this.speed = 0.5 + Math.random() * 1;
        this.wobble = Math.random() * Math.PI * 2;
      }
      
      draw() {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x + Math.sin(this.wobble) * 10, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      
      update() {
        this.y -= this.speed;
        this.wobble += 0.05;
        
        if (this.y < -10) {
          this.y = canvas.height + 10;
          this.x = Math.random() * canvas.width;
        }
      }
    }
    
    // Create bubbles
    for (let i = 0; i < numBubbles; i++) {
      bubbles.push(new Bubble());
    }
    
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw and update bubbles
      bubbles.forEach(bubble => {
        bubble.update();
        bubble.draw();
      });
      
      // Draw and update fish
      fish.forEach(f => {
        f.update();
        f.draw();
      });
      
      requestAnimationFrame(animate);
    }
    
    animate();
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  );
};

export default AnimatedFish;