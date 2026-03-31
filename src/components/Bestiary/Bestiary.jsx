import { useState, useEffect, useCallback, useMemo } from 'react';
import Panel from '../Panel/Panel';
import Input from '../Input/Input';
import Button from '../Button/Button';
import Icon from '../Icon';
import ListCard from '../ListCard/ListCard';
import Notification from '../Notification/Notification';
import MonsterStatBlock from '../MonsterStatBlock/MonsterStatBlock';
import './Bestiary.css';

const SEARCH_CACHE = new Map();
const MONSTER_CACHE = new Map();

export default function Bestiary({ onAddMonster, isEmbedded = false, modal }) {
    const [monsters, setMonsters] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedMonster, setSelectedMonster] = useState(null);
    const [notification, setNotification] = useState(null);
    const [nextPage, setNextPage] = useState(null);
    const [sortOrder, setSortOrder] = useState('none'); // 'none', 'desc', 'asc'

    const fetchMonsters = useCallback(async (query = '', urlOverride = null) => {
        const url = urlOverride || `https://api.open5e.com/monsters/?search=${query}&limit=100`;

        const applyData = (data) => {
            const results = data.results || [];
            setMonsters(prev => {
                const combined = urlOverride ? [...prev, ...results] : results;
                // Використовуємо Map для гарантії унікальності за slug
                const uniqueMap = new Map(combined.map(m => [m.slug, m]));
                return Array.from(uniqueMap.values());
            });
            setNextPage(data.next);
        };

        if (SEARCH_CACHE.has(url)) {
            applyData(SEARCH_CACHE.get(url));
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(url);
            const data = await response.json();
            SEARCH_CACHE.set(url, data);
            applyData(data);
        } catch (error) {
            console.error("Failed to fetch monsters", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setNextPage(null); // Скидаємо посилання на наступну сторінку при новому пошуку
        const timer = setTimeout(() => {
            fetchMonsters(search);
        }, 500); // Debounce search

        return () => clearTimeout(timer);
    }, [search, fetchMonsters]);

    useEffect(() => {
        const initSelection = async () => {
            const params = new URLSearchParams(window.location.search);
            const urlMonsterSlug = params.get('monster');

            if (!urlMonsterSlug) {
                if (monsters.length > 0 && !selectedMonster) {
                    setSelectedMonster(monsters[0]);
                }
                return;
            }

            // Якщо в URL той самий монстр, що вже вибраний - нічого не робимо
            if (selectedMonster?.slug === urlMonsterSlug) return;

            // Шукаємо в поточному завантаженому списку
            const foundInList = monsters.find(m => m.slug === urlMonsterSlug);
            if (foundInList) {
                setSelectedMonster(foundInList);
            } else {
                // Якщо монстра немає в списку, перевіряємо кеш або завантажуємо окремо
                if (MONSTER_CACHE.has(urlMonsterSlug)) {
                    setSelectedMonster(MONSTER_CACHE.get(urlMonsterSlug));
                } else {
                    try {
                        const response = await fetch(`https://api.open5e.com/monsters/${urlMonsterSlug}/`);
                        const data = await response.json();
                        if (data.slug) {
                            MONSTER_CACHE.set(urlMonsterSlug, data);
                            setSelectedMonster(data);
                        }
                    } catch (error) {
                        console.error("Failed to fetch monster detail for URL", error);
                    }
                }
            }
        };

        initSelection();
        
        // Слухаємо кнопки браузера Назад/Вперед
        window.addEventListener('popstate', initSelection);
        return () => window.removeEventListener('popstate', initSelection);
    }, [monsters]); // Видалили selectedMonster?.slug із залежностей

    useEffect(() => {
        if (selectedMonster?.slug) {
            const params = new URLSearchParams(window.location.search);
            if (params.get('monster') !== selectedMonster.slug) {
                params.set('monster', selectedMonster.slug);
                window.history.pushState({}, '', `?${params.toString()}`);
            }
        }
    }, [selectedMonster]);

    const handleCopyName = (name) => {
        navigator.clipboard.writeText(name);
        setNotification(`Ім'я "${name}" скопійовано!`);
    };

    const toggleSort = () => {
        setSortOrder(prev => {
            if (prev === 'none') return 'desc';
            if (prev === 'desc') return 'asc';
            return 'none';
        });
    };

    const parseCR = (cr) => {
        if (typeof cr === 'number') return cr;
        if (!cr || typeof cr !== 'string') return 0;
        if (cr.includes('/')) {
            const [num, den] = cr.split('/').map(Number);
            return num / den;
        }
        return parseFloat(cr) || 0;
    };

    const displayedMonsters = useMemo(() => {
        if (sortOrder === 'none') return monsters;

        return [...monsters].sort((a, b) => {
            const crA = parseCR(a.challenge_rating);
            const crB = parseCR(b.challenge_rating);
            if (crA === crB) {
                return a.name.localeCompare(b.name);
            }
            return sortOrder === 'desc' ? crB - crA : crA - crB;
        });
    }, [monsters, sortOrder]);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollHeight - scrollTop <= clientHeight + 300 && nextPage && !loading) {
            fetchMonsters(search, nextPage);
        }
    };

    const renderBestiaryInner = () => (
        <div className="Bestiary Bestiary__inner">
            <div className="Panel__body">

                <div className="Bestiary__search">
                    <Input placeholder="Пошук монстра..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    <Button
                        className={`Bestiary__sort-btn ${sortOrder !== 'none' ? 'is-active' : ''}`}
                        variant="ghost"
                        onClick={toggleSort}
                        title="Сортувати за CR (Challenge Rating)"
                    >
                        <span className="Bestiary__sort-label">CR</span>
                        <Icon name={`sort-${sortOrder}`} className={`Bestiary__sort-icon state-${sortOrder}`} />
                    </Button>
                </div>

                <div className={`Bestiary__content ${isEmbedded ? 'Bestiary__content--stacked' : ''}`}>
                    <div className="Bestiary__list" onScroll={handleScroll}>
                        {displayedMonsters.map(monster => (
                            <ListCard
                                key={monster.slug}
                                active={selectedMonster?.slug === monster.slug}
                                onClick={() => setSelectedMonster(monster)}
                                onDoubleClick={() => onAddMonster && onAddMonster(monster)}
                                actions={onAddMonster && (
                                    <Button
                                        variant="ghost"
                                        size="small"
                                        icon="plus"
                                        onClick={(e) => { e.stopPropagation(); onAddMonster(monster); }}
                                        title="Додати до зіткнення"
                                    />
                                )}
                            >
                                <div className="ListCard__title">{monster.name}</div>
                                <div className="ListCard__meta">CR {monster.challenge_rating} • {monster.size} {monster.type}</div>
                            </ListCard>
                        ))}
                        {loading && <p className="muted" style={{ padding: '10px', textAlign: 'center' }}>Завантаження...</p>}
                    </div>

                    {selectedMonster && (
                        <div className="Bestiary__detail-container">
                            {onAddMonster && (
                                <Button
                                    variant="primary"
                                    icon="plus"
                                    onClick={() => onAddMonster(selectedMonster)}
                                    className="Bestiary__add-to-encounter-btn"
                                    title="Додати до зіткнення"
                                />
                            )}
                            <MonsterStatBlock
                                monster={selectedMonster}
                                onNameClick={onAddMonster ? (m) => onAddMonster(m) : (m) => handleCopyName(m.name)}
                                nameTitle={onAddMonster ? "Додати до зіткнення" : "Копіювати ім'я"}
                                modal={modal}
                            />
                        </div>
                    )}
                </div>
            </div>
            {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
        </div>
    );

    if (isEmbedded) {
        return (
            <>
                {renderBestiaryInner()}
                {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
            </>
        );
    }

    return (
        <Panel className="Bestiary">
            <div className="Panel__header">
                <div>
                    <h2>Бестіарій</h2>
                    <p className="muted">Каталог монстрів Open5e (SRD)</p>
                </div>
            </div>
            <div className="Panel__body">
                {renderBestiaryInner()}
            </div>
            {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
        </Panel>
    );
}