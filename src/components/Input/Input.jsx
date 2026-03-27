import React, { forwardRef } from 'react';
import './Input.css';

const Input = forwardRef(({ type = 'text', className = '', ...props }, ref) => {
    const baseClass = type === 'textarea' ? 'Input Input--textarea' : 'Input';
    const combinedClassName = `${baseClass} ${className}`.trim();

    if (type === 'textarea') {
        return <textarea ref={ref} className={combinedClassName} {...props} />;
    }

    return <input ref={ref} className={combinedClassName} type={type} {...props} />;
});

export default Input;