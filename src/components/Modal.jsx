import React, { useState, useEffect, useRef } from 'react';

export default function Modal({ title, message, type, defaultValue, onConfirm, onCancel, showInput }) {
  const [inputValue, setInputValue] = useState(defaultValue || '');
  const inputRef = useRef(null);
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    } else if (!showInput && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [showInput]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (onCancel) onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm(showInput ? inputValue : true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onCancel, onConfirm, showInput, inputValue]);

  const isAlert = !onCancel;

  return (
    <div className="modal__overlay" onClick={() => onCancel && onCancel()}>
      <div className={`modal__card modal__card--${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3>{title}</h3>
          <button className="modal__close" onClick={() => onCancel && onCancel()}>&times;</button>
        </div>
        <div className="modal__body">
          <p>{message}</p>
          {showInput && (
            <input
              ref={inputRef}
              type="text"
              className="field"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Введіть значення..."
            />
          )}
        </div>
        <div className="modal__footer">
          {onCancel && (
            <button className="btn btn--ghost" onClick={onCancel}>
              Скасувати
            </button>
          )}
          <button 
            ref={confirmButtonRef}
            className={`btn ${type === 'error' ? 'btn--danger' : 'btn--primary'}`} 
            onClick={() => onConfirm(showInput ? inputValue : true)}
          >
            {isAlert ? 'ОК' : 'Підтвердити'}
          </button>
        </div>
      </div>
    </div>
  );
}