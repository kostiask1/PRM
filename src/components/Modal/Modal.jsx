import { useState, useEffect, useRef } from 'react';
import Button from '../Button/Button';
import Input from '../Input/Input';
import './Modal.css';

export default function Modal({ title, message, type, defaultValue, onConfirm, onCancel, showInput, children, showFooter = true }) {
  const [inputValue, setInputValue] = useState(defaultValue || '');
  const inputRef = useRef(null);
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    if (!children) { // Only manage focus for standard modals
      if (showInput && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      } else if (!showInput && confirmButtonRef.current) {
        confirmButtonRef.current.focus();
      }
    }
  }, [showInput]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (!children) onConfirm(showInput ? inputValue : true); // Only confirm on Enter for standard modals
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onCancel, onConfirm, showInput, inputValue]);

  function handleClose() {
    if (onCancel) {
      onCancel();
    } else {
      onConfirm();
    }
  }

  const isAlert = !onCancel;

  return (
    <div className="Modal__overlay" onClick={handleClose}>
      <div className={`Modal__card Modal__card--${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="Modal__header">
          <h3>{title}</h3>
          <button className="Modal__close" onClick={() => onCancel && onCancel()}>&times;</button>
        </div>
        <div className="Modal__body">
          {children ? children : (
            <>
              <p>{message}</p>
              {showInput && (
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Введіть значення..."
                />
              )}
            </>
          )}
        </div>
        {showFooter && (
          <div className="Modal__footer">
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>Скасувати</Button>
            )}
            <Button
              ref={confirmButtonRef}
              variant={type === 'error' ? 'danger' : 'primary'}
              onClick={() => onConfirm(showInput ? inputValue : true)}
            >{isAlert ? 'ОК' : 'Підтвердити'}</Button>
          </div>
        )}
      </div>
    </div>
  );
}