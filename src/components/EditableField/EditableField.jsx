import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Input from '../Input/Input';

/**
 * Допоміжний компонент для редагування однорядкового тексту по кліку
 */
export default function EditableField({ value, onChange, placeholder, className, type }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <Input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onBlur={() => setIsEditing(false)}
        autoFocus
        className={className}
      />
    );
  }

  return (
    <div className={`EditableField ${className || ''}`} onClick={() => setIsEditing(true)}>
      <div className="MarkdownView">
        {value ? <ReactMarkdown>{value}</ReactMarkdown> : <span className="muted">{placeholder}</span>}
      </div>
    </div>
  );
  return (
    <span className={`EditableField ${className || ''}`} onClick={() => setIsEditing(true)}>
      {value || <span className="muted">{placeholder}</span>}
    </span>
  );
}