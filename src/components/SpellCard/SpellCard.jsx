import React from 'react';
import './SpellCard.css';

export default function SpellCard({ spell }) {
    if (!spell) return null;

    return (
        <div className="SpellCard">
            <h3 className="SpellCard__name">{spell.name}</h3>
            <div className="SpellCard__meta">
                {spell.level === 0 ? 'Замовляння' : `${spell.level}-й рівень`}, {spell.school?.name || spell.school}
            </div>
            <div className="SpellCard__props">
                <p><strong>Час накладання:</strong> {spell.casting_time}</p>
                <p><strong>Дистанція:</strong> {spell.range}</p>
                <p><strong>Компоненти:</strong> {spell.components?.join(', ')} {spell.material && `(${spell.material})`}</p>
                <p><strong>Тривалість:</strong> {spell.duration} {spell.concentration && '(Концентрація)'}</p>
            </div>
            <div className="SpellCard__desc">
                {spell.desc?.map((p, i) => <p key={i}>{p}</p>)}
                {spell.higher_level?.length > 0 && (
                    <div className="SpellCard__higher">
                        <strong>На вищих рівнях:</strong> {spell.higher_level.join(' ')}
                    </div>
                )}
            </div>
            <div className="SpellCard__footer">
                <strong>Класи:</strong> {spell.classes ? spell.classes.map(c => c.name).join(', ') : spell.dnd_class}
            </div>
        </div>
    );
}