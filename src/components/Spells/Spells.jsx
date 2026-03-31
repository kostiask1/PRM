import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Panel from '../Panel/Panel';
import Input from '../Input/Input';
import ListCard from '../ListCard/ListCard';
import SpellCard from '../SpellCard/SpellCard';
import Icon from '../Icon';
import './Spells.css';

const SPELL_CACHE = new Map();
const SEARCH_CACHE = new Map();

export default function Spells() {
    const [allSpells, setAllSpells] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [selectedSpell, setSelectedSpell] = useState(null);
    const [spellDetail, setSpellDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [sortOrder, setSortOrder] = useState('none'); // 'none', 'asc', 'desc'
    const [nextPage, setNextPage] = useState(null);

    const fetchSpells = useCallback(async (query = '', urlOverride = null) => {
        const url = urlOverride || `https://api.open5e.com/spells/?search=${query}&limit=50`;

        const applyData = (data) => {
            const results = data.results || [];
            setAllSpells(prev => {
                const combined = urlOverride ? [...prev, ...results] : results;
                // Гарантуємо унікальність за slug
                const uniqueMap = new Map(combined.map(s => [s.slug, s]));
                return Array.from(uniqueMap.values());
            });
            setNextPage(data.next);
        };

        if (SEARCH_CACHE.has(url)) {
            applyData(SEARCH_CACHE.get(url));
            return;
        }

        urlOverride ? setLoadingMore(true) : setLoading(true);
        try {
            const res = await fetch(url);
            const data = await res.json();
            SEARCH_CACHE.set(url, data);
            applyData(data);
        } catch (err) {
            console.error("Failed to fetch spells", err);
        } finally {
            urlOverride ? setLoadingMore(false) : setLoading(false);
        }
    }, []);

    useEffect(() => {
        setNextPage(null);
        const timer = setTimeout(() => {
            fetchSpells(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search, fetchSpells]);

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
        if (sortOrder !== 'none') {
            result.sort((a, b) => {
                const lvlA = a.level_int ?? 0;
                const lvlB = b.level_int ?? 0;
                if (lvlA === lvlB) return a.name.localeCompare(b.name);
                return sortOrder === 'asc' ? lvlA - lvlB : lvlB - lvlA;
            });
        }
        return result;
    }, [allSpells, sortOrder]);

    const toggleSort = () => {
        setSortOrder(prev => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none');
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight + 100 && nextPage && !loadingMore) {
            fetchSpells(search, nextPage);
        }
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
                    <div className="Spells__list" onScroll={handleScroll}>
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
                        {loadingMore && <p className="muted" style={{ padding: '10px', textAlign: 'center' }}>Завантаження ще...</p>}
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