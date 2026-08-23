import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
}

export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: ButtonProps) {
  const cls = ['btn', variant === 'secondary' ? 'secondary' : '', variant === 'ghost' ? 'ghost' : '', size === 'sm' ? 'small' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button className={cls} {...rest} />;
}
