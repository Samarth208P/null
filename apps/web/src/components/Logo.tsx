import { type SVGProps } from 'react';

export interface LogoProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  animated?: boolean;
}

export function Logo({ size = 24, className = '', animated = false, ...props }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`null-logo ${animated ? 'null-logo-animated' : ''} ${className}`}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="null-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--logo-stop-1, #a7b2ff)" />
          <stop offset="50%" stopColor="var(--logo-stop-2, #6366f1)" />
          <stop offset="100%" stopColor="var(--logo-stop-3, #4338ca)" />
        </linearGradient>
        <radialGradient id="null-logo-center-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--logo-glow, #a7b2ff)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="var(--logo-glow, #6366f1)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="null-logo-blades" fill="url(#null-logo-grad)">
        <path className="null-blade null-blade-1" d="M5.6906 6.00001L3.16512 1.62576C4.50811 0.605527 6.18334 0 8 0C8.37684 0 8.74759 0.0260554 9.11056 0.076463L5.6906 6.00001Z" />
        <path className="null-blade null-blade-2" d="M5.11325 9L1.69363 3.07705C0.632438 4.43453 0 6.14341 0 8C0 8.33866 0.0210434 8.67241 0.0618939 9H5.11325Z" />
        <path className="null-blade null-blade-3" d="M4.89635 15.3757C2.93947 14.5512 1.37925 12.9707 0.581517 11H7.42265L4.89635 15.3757Z" />
        <path className="null-blade null-blade-4" d="M8 16C7.62316 16 7.25241 15.9739 6.88944 15.9235L10.3094 10L12.8349 14.3742C11.4919 15.3945 9.81666 16 8 16Z" />
        <path className="null-blade null-blade-5" d="M16 8C16 9.85659 15.3676 11.5655 14.3064 12.9229L10.8868 7H15.9381C15.979 7.32759 16 7.66134 16 8Z" />
        <path className="null-blade null-blade-6" d="M11.1036 0.624326C13.0605 1.44877 14.6208 3.02927 15.4185 5H8.57735L11.1036 0.624326Z" />
      </g>
    </svg>
  );
}
