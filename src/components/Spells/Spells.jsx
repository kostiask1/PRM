import React, { useState, useEffect, useMemo } from 'react';
import Panel from '../Panel/Panel';
import Input from '../Input/Input';
import ListCard from '../ListCard/ListCard';
import SpellCard from '../SpellCard/SpellCard';
import './Spells.css';

const SPELL_CACHE = new Map();

export default function Spells() {
    const [allSpells, setAllSpells] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedSpell, setSelectedSpell] = useState(null);
    const [spellDetail, setSpellDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    useEffect(() => {
        const fetchAllSpells = async () => {
            setLoading(true);
            try {
                const res = await fetch('https://www.dnd5eapi.co/api/2014/spells');
                const data = await res.json();
                setAllSpells(data.results || []);
            } catch (err) {
                console.error("Failed to fetch spells", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAllSpells();
    }, []);

    const filteredSpells = useMemo(() => {
        if (!search) return allSpells;
        const lowSearch = search.toLowerCase();
        return allSpells.filter(s => s.name.toLowerCase().includes(lowSearch));
    }, [allSpells, search]);

    useEffect(() => {
        if (selectedSpell) {
            const fetchDetail = async () => {
                if (SPELL_CACHE.has(selectedSpell.index)) {
                    setSpellDetail(SPELL_CACHE.get(selectedSpell.index));
                    return;
                }
                setDetailLoading(true);
                try {
                    const res = await fetch(`https://www.dnd5eapi.co${selectedSpell.url}`);
                    const data = await res.json();
                    SPELL_CACHE.set(selectedSpell.index, data);
                    setSpellDetail(data);
                } catch (err) {
                    console.error("Error fetching spell detail", err);
                } finally {
                    setDetailLoading(false);
                }
            };
            fetchDetail();
        }
    }, [selectedSpell]);

    return (
        <Panel className="Spells">
            <div className="Panel__header">
                <div>
                    <h2>Заклинання</h2>
                    <p className="muted">Каталог заклинань D&D 5e (SRD)</p>
                </div>
            </div>
            <div className="Panel__body Spells__body">
                <div className="Spells__search">
                    <Input 
                        placeholder="Пошук заклинання..." 
                        value={search} 
                        onChange={(e) => setSearch(e.target.value)} 
                    />
                </div>
                <div className="Spells__content">
                    <div className="Spells__list">
                        {loading && <p className="muted" style={{ textAlign: 'center' }}>Завантаження списку...</p>}
                        {filteredSpells.map(spell => (
                            <ListCard
                                key={spell.index}
                                active={selectedSpell?.index === spell.index}
                                onClick={() => setSelectedSpell(spell)}
                            >
                                <div className="ListCard__title">{spell.name}</div>
                            </ListCard>
                        ))}
                    </div>
                    <div className="Spells__detail">
                        {detailLoading ? (
                            <p className="muted">Завантаження деталей...</p>
                        ) : spellDetail ? (
                            <SpellCard spell={spellDetail} />
                        ) : (
                            <p className="muted">Оберіть заклинання зі списку, щоб переглянути опис.</p>
                        )}
                    </div>
                </div>
            </div>
        </Panel>
    );
}