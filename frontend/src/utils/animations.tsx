/**
 * Animation utilities for smooth UI transitions
 */
import React from 'react';

export const animations = {
  // Fade animations
  fadeIn: {
    opacity: 0,
    animation: 'fadeIn 0.3s ease-out forwards'
  },
  
  fadeOut: {
    opacity: 1,
    animation: 'fadeOut 0.3s ease-out forwards'
  },

  // Slide animations
  slideInFromRight: {
    transform: 'translateX(100%)',
    animation: 'slideInFromRight 0.4s ease-out forwards'
  },

  slideInFromLeft: {
    transform: 'translateX(-100%)',
    animation: 'slideInFromLeft 0.4s ease-out forwards'
  },

  slideInFromTop: {
    transform: 'translateY(-100%)',
    animation: 'slideInFromTop 0.4s ease-out forwards'
  },

  slideInFromBottom: {
    transform: 'translateY(100%)',
    animation: 'slideInFromBottom 0.4s ease-out forwards'
  },

  // Scale animations
  scaleIn: {
    transform: 'scale(0.8)',
    opacity: 0,
    animation: 'scaleIn 0.3s ease-out forwards'
  },

  scaleOut: {
    transform: 'scale(1)',
    opacity: 1,
    animation: 'scaleOut 0.3s ease-out forwards'
  },

  // Bounce animation
  bounce: {
    animation: 'bounce 0.6s ease-in-out'
  },

  // Pulse animation for loading states
  pulse: {
    animation: 'pulse 2s infinite'
  },

  // Shake animation for errors
  shake: {
    animation: 'shake 0.5s ease-in-out'
  }
};

// CSS keyframes (to be added to CSS)
export const keyframes = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes slideInFromRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes slideInFromLeft {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes slideInFromTop {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}

@keyframes slideInFromBottom {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes scaleIn {
  from { 
    transform: scale(0.8); 
    opacity: 0; 
  }
  to { 
    transform: scale(1); 
    opacity: 1; 
  }
}

@keyframes scaleOut {
  from { 
    transform: scale(1); 
    opacity: 1; 
  }
  to { 
    transform: scale(0.8); 
    opacity: 0; 
  }
}

@keyframes bounce {
  0%, 20%, 53%, 80%, 100% {
    transform: translate3d(0, 0, 0);
  }
  40%, 43% {
    transform: translate3d(0, -8px, 0);
  }
  70% {
    transform: translate3d(0, -4px, 0);
  }
  90% {
    transform: translate3d(0, -2px, 0);
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-4px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(4px);
  }
}
`;

// React hook for animations
export const useAnimation = (animationType: keyof typeof animations, trigger: boolean = true) => {
  const [style, setStyle] = React.useState<React.CSSProperties>({});

  React.useEffect(() => {
    if (trigger) {
      setStyle(animations[animationType]);
    }
  }, [animationType, trigger]);

  return style;
};

// Animation wrapper component
export const AnimatedWrapper: React.FC<{
  children: React.ReactNode;
  animation: keyof typeof animations;
  trigger?: boolean;
  delay?: number;
  className?: string;
}> = ({ children, animation, trigger = true, delay = 0, className = '' }) => {
  const [shouldAnimate, setShouldAnimate] = React.useState(false);

  React.useEffect(() => {
    if (trigger) {
      const timer = setTimeout(() => {
        setShouldAnimate(true);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [trigger, delay]);

  const animationStyle = shouldAnimate ? animations[animation] : {};

  return (
    <div className={className} style={animationStyle}>
      {children}
    </div>
  );
};

// Page transition wrapper
export const PageTransition: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <AnimatedWrapper animation="fadeIn" className={className}>
      {children}
    </AnimatedWrapper>
  );
};