import { useState, useEffect, useRef } from 'react';
import Button from '../Button/Button';
import Input from '../Input/Input';
import './Modal.css';

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
    <div className="Modal__overlay" onClick={() => onCancel && onCancel()}>
      <div className={`Modal__card Modal__card--${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="Modal__header">
          <h3>{title}</h3>
          <button className="Modal__close" onClick={() => onCancel && onCancel()}>&times;</button>
        </div>
        <div className="Modal__body">
          <p>{message}</p>
          {showInput && (
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Введіть значення..."
            />
          )}
        </div>
        <div className="Modal__footer">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Скасувати
            </Button>
          )}
          <Button
            ref={confirmButtonRef}
            variant={type === 'error' ? 'danger' : 'primary'}
            onClick={() => onConfirm(showInput ? inputValue : true)}
          >
            {isAlert ? 'ОК' : 'Підтвердити'}
          </Button>
        </div>
      </div>
    </div>
  );
}