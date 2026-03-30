import React from 'react';
import './SpellCard.css';
import { parseTextWithRolls } from '../../utils/diceParser.jsx';

export default function SpellCard({ spell }) {
    if (!spell) return null;

    return (
        <div className="SpellCard">
            <h3 className="SpellCard__name">{spell.name}</h3>
            <div className="SpellCard__meta">
                {spell.level === 0 ? 'Замовляння' : `${spell.level}-й рівень`}, {spell.school?.name || spell.school}
            </div>
            <div className="SpellCard__props">
                <div><strong>Час накладання:</strong> {spell.casting_time}</div>
                <div><strong>Дистанція:</strong> {spell.range}</div>
                <div><strong>Компоненти:</strong> {spell.components?.join(', ')} {spell.material && `(${spell.material})`}</div>
                <div><strong>Тривалість:</strong> {spell.duration} {spell.concentration && '(Концентрація)'}</div>
            </div>
            <div className="SpellCard__desc">
                {spell.desc?.map((p, i) => <div key={i}>{parseTextWithRolls(p)}</div>)}
                {spell.higher_level?.length > 0 && (
                    <div className="SpellCard__higher">
                        <strong>На вищих рівнях:</strong> {spell.higher_level.map((p, i) => <React.Fragment key={i}>{parseTextWithRolls(p)}</React.Fragment>)}
                    </div>
                )}
            </div>
            <div className="SpellCard__footer">
                <strong>Класи:</strong> {spell.classes ? spell.classes.map(c => c.name).join(', ') : spell.dnd_class}
            </div>
        </div>
    );
}