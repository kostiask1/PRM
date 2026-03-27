import React from 'react';
import Icon from './Icon';

export default function Button({ 
  children, 
  onClick, 
  variant, // primary, danger, ghost, footer, create
  size, // small
  icon, 
  iconSize = 18,
  type = "button",
  className = "",
  ...props 
}) {
  const classes = [
    'Button',
    variant ? `Button--${variant}` : '',
    size ? `Button--${size}` : '',
    className
  ].filter(Boolean).join(' ');

  const strokeWidth = (variant === 'create' || size === 'small') ? 2.5 : 2;

  return (
    <button type={type} className={classes} onClick={onClick} {...props}>
      {icon && <Icon name={icon} size={iconSize} strokeWidth={strokeWidth} />}
      {children && <span>{children}</span>}
    </button>
  );
}