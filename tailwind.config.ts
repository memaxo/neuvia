import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: ['class'],
    content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		colors: {
  			spline: {
  				cyan: '#00FFFF',
  				blue: '#0066FF',
  				magenta: '#FF00FF',
  				yellow: '#FFFF00',
  				red: '#FF0000'
  			},
  			navy: {
  				'700': '#222222',
  				'800': '#111111',
  				'900': '#000000'
  			},
  			teal: {
  				'50': '#E6FFFF',
  				'100': '#B3FFFF',
  				'200': '#80FFFF',
  				'300': '#4DFFFF',
  				'400': '#1AFFFF',
  				'500': '#00E5FF',
  				'600': '#00CCFF',
  				'700': '#0099FF',
  				'800': '#0066FF',
  				'900': '#0033FF'
  			},
  			cyan: {
  				'500': '#00FFFF',
  				'600': '#00E5FF'
  			},
  			purple: {
  				'500': '#FF00FF'
  			},
  			orange: {
  				'50': '#FFF3E0',
  				'100': '#FFE0B2',
  				'200': '#FFCC80',
  				'300': '#FFB74D',
  				'400': '#FFA726',
  				'500': '#FF9100',
  				'600': '#FF6D00',
  				'700': '#FF3D00',
  				'800': '#DD2C00',
  				'900': '#BF360C'
  			},
  			slate: {
  				'50': '#FFFFFF',
  				'100': '#F5F5F5',
  				'200': '#EEEEEE',
  				'300': '#E0E0E0',
  				'400': '#BDBDBD',
  				'500': '#9E9E9E',
  				'600': '#757575',
  				'700': '#616161',
  				'800': '#424242',
  				'900': '#212121'
  			},
  			blue: {
  				'50': '#E3F2FD',
  				'100': '#BBDEFB',
  				'200': '#90CAF9',
  				'300': '#64B5F6',
  				'400': '#42A5F5',
  				'500': '#2196F3',
  				'600': '#1E88E5',
  				'700': '#1976D2',
  				'800': '#1565C0',
  				'900': '#0D47A1'
  			},
  			pearl: {
  				'50': '#FFFFFF',
  				'100': '#F5F5F5',
  				'200': '#EEEEEE'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		backgroundImage: {
  			'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
  			'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
  			'gradient-spline': 'linear-gradient(to right, #00FFFF, #0066FF, #FF00FF)'
  		},
  		fontFamily: {
  			sans: [
  				'Roboto',
  				'sans-serif'
  			],
  			mono: [
  				'Roboto Mono',
  				'monospace'
  			]
  		},
  		animation: {
  			'fade-in': 'fadeIn 1s ease-in forwards',
  			'slide-up': 'slideUp 1s ease-out forwards',
  			glow: 'glow 2s ease-in-out infinite'
  		},
  		keyframes: {
  			fadeIn: {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			slideUp: {
  				'0%': {
  					transform: 'translateY(20px)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateY(0)',
  					opacity: '1'
  				}
  			},
  			glow: {
  				'0%, 100%': {
  					opacity: '1'
  				},
  				'50%': {
  					opacity: '0.7'
  				}
  			}
  		},
  		transitionDuration: {
  			'300': '300ms'
  		},
  		boxShadow: {
  			lg: '0 10px 15px -3px rgba(0, 255, 255, 0.1), 0 4px 6px -2px rgba(0, 255, 255, 0.05)',
  			xl: '0 20px 25px -5px rgba(0, 255, 255, 0.1), 0 10px 10px -5px rgba(0, 255, 255, 0.04)',
  			spline: '0 4px 14px 0 rgba(0, 255, 255, 0.3)'
  		}
  	}
  },
  plugins: [],
}
export default config