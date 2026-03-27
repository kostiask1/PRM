import React, { useState, useEffect, useCallback } from 'react';
import Panel from '../Panel/Panel';
import Input from '../Input/Input';
import ListCard from '../ListCard/ListCard';
import Notification from '../Notification/Notification';
import MonsterStatBlock from '../MonsterStatBlock/MonsterStatBlock';
import './Bestiary.css';

export default function Bestiary({ onAddMonster, isEmbedded = false }) {
    const [monsters, setMonsters] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedMonster, setSelectedMonster] = useState(null);
    const [notification, setNotification] = useState(null);

    const fetchMonsters = useCallback(async (query = '') => {
        setLoading(true);
        try {
            const url = `https://api.open5e.com/monsters/?search=${query}&limit=20`;
            const response = await fetch(url);
            const data = await response.json();
            const results = data.results || [];
            const sorted = [...results].sort((a, b) => (b.armor_class || 0) - (a.armor_class || 0));
            setMonsters(sorted);
        } catch (error) {
            console.error("Failed to fetch monsters", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchMonsters(search);
        }, 500); // Debounce search

        return () => clearTimeout(timer);
    }, [search, fetchMonsters]);

    const handleCopyName = (name) => {
        navigator.clipboard.writeText(name);
        setNotification(`Ім'я "${name}" скопійовано!`);
    };

    const innerContent = (
        <div className="Bestiary Bestiary__inner">
            {!isEmbedded && (
                <div className="Panel__header">
                    <div>
                        <h2>Бестіарій</h2>
                        <p className="muted">Каталог монстрів Open5e (SRD)</p>
                    </div>
                </div>
            )}
            <div className="Panel__body">

                <div className="Bestiary__search">
                    <Input placeholder="Пошук монстра..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>

                <div className={`Bestiary__content ${isEmbedded ? 'Bestiary__content--stacked' : ''}`}>
                    <div className="Bestiary__list">
                        {loading && <p className="muted">Завантаження...</p>}
                        {monsters.map(monster => (
                            <ListCard key={monster.slug} active={selectedMonster?.slug === monster.slug} onClick={() => setSelectedMonster(monster)}>
                                <div className="ListCard__title">{monster.name}</div>
                                <div className="ListCard__meta">CR {monster.challenge_rating} • {monster.size} {monster.type}</div>
                            </ListCard>
                        ))}
                    </div>

                    {selectedMonster && (
                        <MonsterStatBlock
                            monster={selectedMonster}
                            onNameClick={onAddMonster ? (m) => onAddMonster(m) : (m) => handleCopyName(m.name)}
                            nameTitle={onAddMonster ? "Додати до зіткнення" : "Копіювати ім'я"}
                        />
                    )}
                </div>
            </div>
            {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
        </div>
    );

    return isEmbedded ? innerContent : <Panel className="Bestiary">{innerContent}</Panel>;
}