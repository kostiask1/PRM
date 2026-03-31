import React, { useState, useEffect, useMemo } from 'react';
import Panel from '../Panel/Panel';
import Input from '../Input/Input';
import ListCard from '../ListCard/ListCard';
import SpellCard from '../SpellCard/SpellCard';
import Icon from '../Icon';
import './Spells.css';

const SPELL_CACHE = new Map();

export default function Spells() {
    const [allSpells, setAllSpells] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedSpell, setSelectedSpell] = useState(null);
    const [spellDetail, setSpellDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [sortOrder, setSortOrder] = useState('none'); // 'none', 'asc', 'desc'

    useEffect(() => {
        const fetchAllSpells = async () => {
            setLoading(true);
            try {
                const res = await fetch('https://api.open5e.com/spells/?limit=500');
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

    useEffect(() => {
        const handleSelect = (e) => {
            const identifier = e.detail;
            const found = allSpells.find(s => s.slug === identifier || s.index === identifier);
            if (found) setSelectedSpell(found);
        };
        window.addEventListener('prm:select-spell', handleSelect);
        return () => window.removeEventListener('prm:select-spell', handleSelect);
    }, [allSpells]);

    const displayedSpells = useMemo(() => {
        let result = [...allSpells];
        if (search) {
            const lowSearch = search.toLowerCase();
            result = result.filter(s => s.name.toLowerCase().includes(lowSearch));
        }
        if (sortOrder !== 'none') {
            result.sort((a, b) => {
                const lvlA = a.level_int ?? 0;
                const lvlB = b.level_int ?? 0;
                if (lvlA === lvlB) return a.name.localeCompare(b.name);
                return sortOrder === 'asc' ? lvlA - lvlB : lvlB - lvlA;
            });
        }
        return result;
    }, [allSpells, search, sortOrder]);

    const toggleSort = () => {
        setSortOrder(prev => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none');
    };

    useEffect(() => {
        if (selectedSpell) {
            const fetchDetail = async () => {
                const spellId = selectedSpell.slug || selectedSpell.index;
                if (SPELL_CACHE.has(spellId)) {
                    setSpellDetail(SPELL_CACHE.get(spellId));
                    return;
                }
                setDetailLoading(true);
                try {
                    // Використовуємо dnd5eapi для деталей, якщо це можливо, або залишаємо дані з Open5e
                    const res = await fetch(`https://www.dnd5eapi.co/api/2014/spells/${spellId}`);
                    const data = await res.json();
                    SPELL_CACHE.set(spellId, data);
                    setSpellDetail(data);
                } catch (err) {
                    // Якщо dnd5eapi не має цього заклинання, використовуємо дані з Open5e (вони вже повні)
                    setSpellDetail(selectedSpell);
                    SPELL_CACHE.set(spellId, selectedSpell);
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
                    <button
                        className={`Spells__sort-btn ${sortOrder !== 'none' ? 'is-active' : ''}`}
                        onClick={toggleSort}
                        title="Сортувати за рівнем"
                    >
                        LVL <Icon name={`sort-${sortOrder}`} />
                    </button>
                </div>
                <div className="Spells__content">
                    <div className="Spells__list">
                        {loading && <p className="muted" style={{ textAlign: 'center' }}>Завантаження списку...</p>}
                        {displayedSpells.map(spell => (
                            <ListCard
                                key={spell.slug || spell.index}
                                active={(selectedSpell?.slug || selectedSpell?.index) === (spell.slug || spell.index)}
                                onClick={() => setSelectedSpell(spell)}
                            >
                                <div className="ListCard__title">{spell.name}</div>
                                <div className="ListCard__meta">
                                    {spell.level_int === 0 ? 'Замовляння' : `${spell.level_int}-й рівень`} • {spell.school}
                                </div>
                            </ListCard>
                        ))}
                    </div>
                    <div className="Spells__detail">
                        {detailLoading ? (
                            <p className="muted">Завантаження деталей...</p>
                        ) : spellDetail ? (
                            <SpellCard 
                                spell={spellDetail} 
                                onSpellClick={(s) => {
                                    const slug = typeof s === 'string' ? s.toLowerCase().replace(/\s+/g, '-') : (s.slug || s.index);
                                    const found = allSpells.find(item => item.slug === slug || item.index === slug);
                                    setSelectedSpell(found || { slug });
                                }} 
                            />
                        ) : (
                            <p className="muted">Оберіть заклинання зі списку, щоб переглянути опис.</p>
                        )}
                    </div>
                </div>
            </div>
        </Panel>
    );
}