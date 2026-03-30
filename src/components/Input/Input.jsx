import React, { forwardRef, useRef, useLayoutEffect } from 'react';
import './Input.css';

const Input = forwardRef(({ type = 'text', className = '', ...props }, ref) => {
    const internalRef = useRef(null);

    // Синхронізуємо висоту textarea з контентом
    useLayoutEffect(() => {
        if (type === 'textarea' && internalRef.current) {
            const node = internalRef.current;
            node.style.height = 'auto';
            node.style.height = `${node.scrollHeight}px`;
        }
    }, [props.value, type]);

    // Об'єднуємо зовнішній ref (від forwardRef) та внутрішній internalRef
    const setRefs = (node) => {
        internalRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
    };

    const baseClass = type === 'textarea' ? 'Input Input--textarea' : 'Input';
    const combinedClassName = `${baseClass} ${className}`.trim();

    if (type === 'textarea') {
        return <textarea ref={setRefs} className={combinedClassName} {...props} />;
    }

    return <input ref={ref} className={combinedClassName} type={type} {...props} />;
});

export default Input;