import "./StatusBadge.scss";

export default function StatusBadge({ completed, completedAt, onClick, className = "", type = "campaign" }) {
  const dateStr = completed && completedAt ? new Date(completedAt).toLocaleDateString() : '';
  
  let label = '';
  if (completed) {
    label = `Завершена ${dateStr}`;
  } else {
    label = type === 'campaign' ? 'Активна' : 'В підготовці';
  }

  return (
    <span 
      className={`StatusBadge ${completed ? 'StatusBadge--done' : ''} ${className}`}
      onClick={onClick}
    >
      {label}
    </span>
  );
}