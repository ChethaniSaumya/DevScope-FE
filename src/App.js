// App.js - Part 1: Imports and State Management

import React, { useState, useEffect, useCallback } from 'react';
import {
    Play,
    Square,
    Settings,
    Plus,
    Trash2,
    Wallet,
    Users,
    Bell,
    Target,
    Activity,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Copy,
    ExternalLink,
    Coins,
    TrendingUp,
    Clock
} from 'lucide-react';
import './App.css';

const API_BASE = 'https://devscope-be.onrender.com/api';

function App() {
    // State management
    const [botStatus, setBotStatus] = useState({
        isRunning: false,
        stats: {
            primaryAdmins: 0,
            secondaryAdmins: 0, // ADD THIS LINE
            usedCommunities: 0,
            processedTokens: 0,
            isFirebaseLoaded: false // ADD THIS LINE
        }
    });

    const [originalSettings, setOriginalSettings] = useState({
        privateKey: '',
        tokenPageDestination: 'neo_bullx',
        enableAdminFilter: true,
        enableCommunityReuse: true,
        snipeAllTokens: false,
        detectionOnlyMode: true
    });

    const [buttonMessages, setButtonMessages] = useState({
        basicSettings: '',
        filterSettings: ''
    });

    const [globalSettingsMessage, setGlobalSettingsMessage] = useState('');
    const [hasGlobalSettingsChanged, setHasGlobalSettingsChanged] = useState(false);

    const [activeTab, setActiveTab] = useState('dashboard');
    const [websocket, setWebsocket] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [notifications, setNotifications] = useState([]);
    const [detectedTokens, setDetectedTokens] = useState([]);
    const [copiedStates, setCopiedStates] = useState({});

    const [demoTemplates, setDemoTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(0);
    const [customWallet, setCustomWallet] = useState('');
    const [customTwitter, setCustomTwitter] = useState('');

    const [usedCommunities, setUsedCommunities] = useState([]);
    const [showCommunityModal, setShowCommunityModal] = useState(false);
    const [customCommunity, setCustomCommunity] = useState('');


    const STORAGE_KEYS = {
        SETTINGS: 'devscope_settings',
        GLOBAL_SNIPE: 'devscope_global_snipe',
        FILTER_SETTINGS: 'devscope_filter_settings'
    };

    const loadFromLocalStorage = (key, defaultValue = null) => {
        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                console.log(`📁 Loaded ${key} from localStorage:`, parsed);
                return parsed;
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
        }
        return defaultValue;
    };


    const [settings, setSettings] = useState(() => {
        // Load settings from localStorage on app start
        const savedSettings = loadFromLocalStorage(STORAGE_KEYS.SETTINGS, {
            privateKey: '',
            tokenPageDestination: 'neo_bullx',
            enableAdminFilter: true,
            enableCommunityReuse: true,
            snipeAllTokens: false,
            detectionOnlyMode: true,
            globalSnipeSettings: {
                amount: 0.01,
                fees: 10,
                mevProtection: true,
                soundNotification: 'default.wav'
            }
        });

        // Load global snipe settings separately for better organization
        const savedGlobalSnipe = loadFromLocalStorage(STORAGE_KEYS.GLOBAL_SNIPE);
        if (savedGlobalSnipe) {
            savedSettings.globalSnipeSettings = savedGlobalSnipe;
        }

        return savedSettings;
    });

    const SOUND_OPTIONS = [
        { value: 'default.wav', label: '🔊 System Beep (Default)', file: 'default.wav' },
        { value: 'success.wav', label: '✅ Success Tone', file: 'success.wav' },
        { value: 'alert.wav', label: '⚠️ Alert Tone', file: 'alert.wav' },
        { value: 'chime.wav', label: '🔔 Chime Tone', file: 'chime.wav' },
        { value: 'none', label: '🔇 No Sound', file: null }
    ];

    const previewSound = (soundFile) => {
        console.log('🔊 previewSound called with:', soundFile);
        console.log('🔊 Function parameters check:', {
            soundFile,
            type: typeof soundFile,
            isNone: soundFile === 'none',
            isEmpty: !soundFile
        });

        if (soundFile === 'none' || !soundFile) {
            console.log('🔇 No sound or none selected, returning early');
            addNotification('info', '🔇 No sound selected');
            return;
        }

        console.log('🔊 Starting sound preview process...');

        try {
            console.log('🔊 Checking for Electron API...');
            console.log('🔊 window.electronAPI exists:', !!window.electronAPI);

            // For Electron app - use electronAPI if available
            if (window.electronAPI && window.electronAPI.playSound) {
                console.log('🔊 Using Electron API to play sound');
                window.electronAPI.playSound(soundFile);
                addNotification('success', `🔊 Playing ${soundFile}`);
                return;
            }

            console.log('🔊 Using web browser audio...');
            console.log('🔊 Sound file to play:', soundFile);

            // For web browser - use system notification sound or beep
            if (soundFile === 'default.wav') {
                console.log('🔊 Playing default system beep...');

                // Check AudioContext support
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                console.log('🔊 AudioContext support:', !!AudioContextClass);

                if (!AudioContextClass) {
                    console.error('❌ AudioContext not supported');
                    addNotification('error', '❌ Audio not supported in this browser');
                    return;
                }

                // Use system beep for default
                const context = new AudioContextClass();
                console.log('🔊 AudioContext created:', context);
                console.log('🔊 AudioContext state:', context.state);

                // Resume context if suspended (required by some browsers)
                if (context.state === 'suspended') {
                    console.log('🔊 Resuming suspended AudioContext...');
                    context.resume().then(() => {
                        console.log('🔊 AudioContext resumed successfully');
                        playBeep(context);
                    }).catch(err => {
                        console.error('❌ Failed to resume AudioContext:', err);
                        addNotification('error', '❌ Failed to initialize audio');
                    });
                } else {
                    playBeep(context);
                }

                function playBeep(ctx) {
                    try {
                        console.log('🔊 Creating oscillator and gain nodes...');
                        const oscillator = ctx.createOscillator();
                        const gainNode = ctx.createGain();

                        oscillator.connect(gainNode);
                        gainNode.connect(ctx.destination);

                        oscillator.frequency.value = 800;
                        oscillator.type = 'sine';
                        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

                        console.log('🔊 Starting oscillator...');
                        oscillator.start(ctx.currentTime);
                        oscillator.stop(ctx.currentTime + 0.5);

                        console.log('🔊 System beep played successfully');
                        addNotification('success', `🔊 Playing system beep`);
                    } catch (beepError) {
                        console.error('❌ Error in playBeep function:', beepError);
                        addNotification('error', '❌ Failed to generate beep');
                    }
                }

            } else {
                console.log('🔊 Attempting to play HTML5 audio file:', soundFile);
                console.log('🔊 Audio file path:', `/sounds/${soundFile}`);

                // Try to play HTML5 audio from public folder
                const audio = new Audio(`/sounds/${soundFile}`);
                console.log('🔊 Audio element created:', audio);

                audio.volume = 0.5;
                console.log('🔊 Audio volume set to:', audio.volume);

                // Add event listeners for debugging
                audio.addEventListener('loadstart', () => console.log('🔊 Audio: loadstart'));
                audio.addEventListener('loadeddata', () => console.log('🔊 Audio: loadeddata'));
                audio.addEventListener('canplay', () => console.log('🔊 Audio: canplay'));
                audio.addEventListener('play', () => console.log('🔊 Audio: play event'));
                audio.addEventListener('ended', () => console.log('🔊 Audio: ended'));
                audio.addEventListener('error', (e) => console.error('❌ Audio error event:', e));

                console.log('🔊 Calling audio.play()...');

                audio.play().then(() => {
                    console.log('✅ Audio.play() promise resolved successfully');
                    addNotification('success', `🔊 Playing ${soundFile}`);
                }).catch(error => {
                    console.error('❌ Audio.play() promise rejected:', error);
                    console.log('🔊 Falling back to system beep...');

                    // Fallback to system beep
                    try {
                        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                        if (!AudioContextClass) {
                            console.error('❌ AudioContext not supported for fallback');
                            addNotification('error', '❌ Audio not supported');
                            return;
                        }

                        const context = new AudioContextClass();
                        console.log('🔊 Fallback AudioContext created');

                        if (context.state === 'suspended') {
                            console.log('🔊 Resuming suspended fallback AudioContext...');
                            context.resume().then(() => {
                                playFallbackBeep(context);
                            }).catch(err => {
                                console.error('❌ Failed to resume fallback AudioContext:', err);
                            });
                        } else {
                            playFallbackBeep(context);
                        }

                        function playFallbackBeep(ctx) {
                            const oscillator = ctx.createOscillator();
                            const gainNode = ctx.createGain();

                            oscillator.connect(gainNode);
                            gainNode.connect(ctx.destination);

                            oscillator.frequency.value = 600;
                            oscillator.type = 'square';
                            gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
                            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

                            oscillator.start(ctx.currentTime);
                            oscillator.stop(ctx.currentTime + 0.3);

                            console.log('🔊 Fallback beep played');
                            addNotification('info', `🔊 Playing fallback beep (${soundFile} not found)`);
                        }
                    } catch (fallbackError) {
                        console.error('❌ Fallback beep also failed:', fallbackError);
                        addNotification('error', '❌ All audio methods failed');
                    }
                });
            }
        } catch (error) {
            console.error('❌ Top-level sound preview error:', error);
            console.error('❌ Error stack:', error.stack);
            addNotification('error', '❌ Failed to preview sound');
        }
    };

    const saveToLocalStorage = (key, data) => {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            console.log(`💾 Saved ${key} to localStorage:`, data);
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            addNotification('error', '❌ Failed to save settings locally');
        }
    };

    const clearLocalStorage = () => {
        try {
            Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            addNotification('success', '🗑️ All settings cleared from local storage');
        } catch (error) {
            console.error('Failed to clear localStorage:', error);
        }
    };

    // WebSocket connection
    const connectWebSocket = useCallback(() => {
        try {
            const ws = new WebSocket('wss://devscope-be.onrender.com');

            ws.onopen = () => {
                console.log('WebSocket connected');
                setConnectionStatus('connected');
                setWebsocket(ws);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setConnectionStatus('disconnected');
                setWebsocket(null);
                setTimeout(connectWebSocket, 3000);
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                setConnectionStatus('error');
            };

        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            setConnectionStatus('error');
        }
    }, []);


    // Add this useEffect to fetch demo templates
    useEffect(() => {
        fetchDemoTemplates();
    }, []);

    useEffect(() => {
        fetchStatus();
        fetchLists();
        fetchDetectedTokens();
        fetchUsedCommunities(); // Add this line
        connectWebSocket();

        return () => {
            if (websocket) {
                websocket.close();
            }
        };
    }, [connectWebSocket]);

    // Add these functions to your App component
    const fetchDemoTemplates = async () => {
        try {
            const data = await apiCall('/demo/templates');
            setDemoTemplates(data.templates);
        } catch (error) {
            console.error('Failed to fetch demo templates');
        }
    };

    const injectDemoToken = async (customData = {}) => {
        try {
            const payload = {
                templateIndex: selectedTemplate,
                customWallet: customWallet || null,
                customTwitter: customTwitter || null,
                customCommunity: customCommunity || null, // ADD THIS LINE
            };

            if (customData && typeof customData === 'object' && !customData.target) {
                Object.assign(payload, customData);
            }

            await apiCall('/demo/inject-token', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            addNotification('success', '🧪 Demo token injected successfully');
        } catch (error) {
            addNotification('error', '❌ Failed to inject demo token');
            console.error('Demo injection error:', error);
        }
    };

    const injectDemoBatch = async () => {
        try {
            await apiCall('/demo/inject-batch', {
                method: 'POST',
                body: JSON.stringify({
                    count: 5,
                    delay: 3000
                })
            });
            addNotification('success', '🧪 Injecting 5 demo tokens with 3s delay');
        } catch (error) {
            addNotification('error', '❌ Failed to inject demo batch');
        }
    };

    const injectFromList = async (listType) => {
        try {
            await apiCall('/demo/inject-from-list', {
                method: 'POST',
                body: JSON.stringify({
                    listType,
                    templateIndex: selectedTemplate
                })
            });
            addNotification('success', `🧪 Demo token injected using ${listType} entry`);
        } catch (error) {
            addNotification('error', `❌ Failed to inject from ${listType}`);
        }
    };

    // Lists state
    const [lists, setLists] = useState({
        primary_admins: [],
        secondary_admins: []
    });

    // Form states
    const [showAddForm, setShowAddForm] = useState({ type: null, show: false });
    const [formData, setFormData] = useState({
        address: '',
        username: '',
        amount: 0.01,
        fees: 10,
        mevProtection: true,
        soundNotification: 'default.wav'
    });
    // App.js - Part 2: WebSocket and Message Handling


    const [secondaryPopup, setSecondaryPopup] = useState({
        show: false,
        tokenData: null
    });

    
    // Auto-play sound when secondary popup appears
    useEffect(() => {
        if (secondaryPopup.show && secondaryPopup.tokenData) {
            console.log('🔔 Secondary popup opened, auto-playing notification sound...');
            console.log('🔔 Token data:', secondaryPopup.tokenData);
            console.log('🔔 Token config:', secondaryPopup.tokenData.config);
            console.log('🔔 Global sound setting:', settings.globalSnipeSettings.soundNotification);

            // Use the token's specific sound notification or fall back to global setting
            const soundToPlay = secondaryPopup.tokenData.config?.soundNotification || settings.globalSnipeSettings.soundNotification;
            console.log('🔔 Sound selected to auto-play:', soundToPlay);

            // Small delay to ensure popup is fully rendered
            const timeoutId = setTimeout(() => {
                console.log('🔔 Calling previewSound with:', soundToPlay);
                previewSound(soundToPlay);
            }, 300);

            // Cleanup timeout on unmount
            return () => clearTimeout(timeoutId);
        }
    }, [secondaryPopup.show, secondaryPopup.tokenData?.tokenAddress, settings.globalSnipeSettings.soundNotification]);

    const fetchUsedCommunities = async () => {
        try {
            const data = await apiCall('/firebase/used-communities');
            setUsedCommunities(data.communities || []);
            addNotification('success', `📊 Loaded ${data.communities.length} used communities from Firebase`);
        } catch (error) {
            console.error('Failed to fetch used communities');
            addNotification('error', '❌ Failed to fetch used communities from Firebase');
        }
    };

    const clearUsedCommunities = async () => {
        try {
            await apiCall('/firebase/used-communities', { method: 'DELETE' });
            setUsedCommunities([]);
            addNotification('success', '🗑️ All used communities cleared from Firebase');
        } catch (error) {
            addNotification('error', '❌ Failed to clear used communities');
        }
    };

    const removeUsedCommunity = async (communityId) => {
        try {
            await apiCall(`/firebase/used-communities/${communityId}`, { method: 'DELETE' });
            setUsedCommunities(prev => prev.filter(c => c.id !== communityId));
            addNotification('success', `🗑️ Community ${communityId} removed from Firebase`);
        } catch (error) {
            addNotification('error', '❌ Failed to remove community');
        }
    };

    const testFirebaseConnection = async () => {
        try {
            const data = await apiCall('/test-firebase');
            addNotification('success', '✅ Firebase connection successful!');
        } catch (error) {
            addNotification('error', '❌ Firebase connection failed');
        }
    };

    const handleWebSocketMessage = (data) => {
        switch (data.type) {
            case 'bot_status':
                setBotStatus(prev => ({ ...prev, isRunning: data.data.isRunning }));
                break;

            // ADD THESE NEW CASES:
            case 'admin_list_updated':
                // Refresh lists when admin lists are updated
                fetchLists();
                // Update stats
                setBotStatus(prev => ({
                    ...prev,
                    stats: { ...prev.stats, ...data.data.stats }
                }));
                addNotification('success', `✅ ${data.data.listType.replace('_', ' ')} ${data.data.action} and synced to Firebase`);
                break;

            case 'admin_lists_synced':
                // Refresh lists when synced from Firebase
                fetchLists();
                setBotStatus(prev => ({
                    ...prev,
                    stats: { ...prev.stats, ...data.data.stats }
                }));
                addNotification('success', '🔄 Admin lists synchronized from Firebase');
                break;

            case 'admin_list_cleared':
                // Refresh lists when cleared
                fetchLists();
                setBotStatus(prev => ({
                    ...prev,
                    stats: { ...prev.stats, ...data.data.stats }
                }));
                addNotification('info', `🗑️ ${data.data.listType.replace('_', ' ')} cleared from Firebase`);
                break;

            case 'snipe_success':
                addNotification('success', `🎯 Token sniped successfully: ${data.data.tokenAddress.substring(0, 8)}...`);
                if (data.data.openTokenPage && data.data.tokenPageUrl) {
                    if (window.electronAPI && window.electronAPI.openExternalURL) {
                        window.electronAPI.openExternalURL(data.data.tokenPageUrl);
                        addNotification('info', '🌐 Token page opened in external browser');
                    } else {
                        window.open(data.data.tokenPageUrl, '_blank');
                        addNotification('info', '🌐 Token page opened in new tab');
                    }
                }
                break;

            case 'snipe_error':
                addNotification('error', `❌ Snipe failed: ${data.data.error}`);
                break;

            case 'secondary_notification':
                addNotification('info', `🔔 Token found in secondary list: ${data.data.tokenAddress.substring(0, 8)}...`);
                if (data.data.soundNotification && window.electronAPI) {
                    window.electronAPI.playSound(data.data.soundNotification);
                }
                break;

            case 'secondary_popup_trigger':
                // Show popup modal with token details
                setSecondaryPopup({
                    show: true,
                    tokenData: data.data.tokenData,
                    globalSettings: data.data.globalSnipeSettings
                });
                addNotification('info', `🔔 Secondary match found: ${data.data.tokenData.tokenAddress.substring(0, 8)}...`);
                break;

            case 'token_detected':
                setDetectedTokens(prev => {
                    // Check if token already exists
                    const exists = prev.some(token => token.tokenAddress === data.data.tokenAddress);
                    if (exists) {
                        console.log(`Token ${data.data.tokenAddress} already exists, skipping duplicate`);
                        return prev; // Don't add duplicate
                    }
                    return [data.data, ...prev.slice(0, 99)];
                });

                const matchTypeText = {
                    'primary_wallet': '🎯 Primary Wallet',
                    'primary_admin': '🎯 Primary Admin',
                    'secondary_wallet': '🔔 Secondary Wallet',
                    'secondary_admin': '🔔 Secondary Admin',
                    'snipe_all': '⚡ Snipe All',
                    'no_filters': '📢 No Filters'
                };

                // Enhanced notification with Twitter type info
                const twitterInfo = data.data.twitterType === 'community'
                    ? `(Community ${data.data.twitterCommunityId})`
                    : data.data.twitterHandle
                        ? `(@${data.data.twitterHandle})`
                        : '';

                addNotification('success',
                    `${matchTypeText[data.data.matchType] || '📊'} Token detected: ${data.data.tokenAddress.substring(0, 8)}... ${twitterInfo} from ${data.data.platform}`
                );
                break;

            case 'platform_status':
                console.log('Platform status:', data.data);
                break;

            default:
                console.log('Unknown message type:', data.type);
        }
    };

    const clearGlobalSettingsMessage = (delay = 3000) => {
        setTimeout(() => {
            setGlobalSettingsMessage('');
        }, delay);
    };

    const syncAdminListsFromFirebase = async () => {
        try {
            await apiCall('/firebase/sync-admin-lists', { method: 'POST' });
            addNotification('success', '🔄 Admin lists synchronized from Firebase');
        } catch (error) {
            addNotification('error', '❌ Failed to sync admin lists from Firebase');
        }
    };

    const clearAdminListFromFirebase = async (listType) => {
        try {
            await apiCall(`/firebase/admin-lists/${listType}`, { method: 'DELETE' });
            await fetchLists(); // Refresh the lists
            addNotification('success', `🗑️ All ${listType.replace('_', ' ')} cleared from Firebase`);
        } catch (error) {
            addNotification('error', `❌ Failed to clear ${listType} from Firebase`);
        }
    };

    const getFirebaseAdminLists = async () => {
        try {
            const data = await apiCall('/firebase/admin-lists');
            addNotification('success', `📥 Firebase admin lists loaded: ${data.stats.primaryCount} primary, ${data.stats.secondaryCount} secondary`);
            return data;
        } catch (error) {
            addNotification('error', '❌ Failed to load admin lists from Firebase');
        }
    };

    const addNotification = (type, message) => {
        const notification = {
            id: Date.now(),
            type,
            message,
            timestamp: new Date().toLocaleTimeString()
        };
        setNotifications(prev => [notification, ...prev.slice(0, 49)]);
    };
    // App.js - Part 3: Utility Functions and API Calls

    // Enhanced utility functions with notifications

    const copyToClipboard = (text, label = 'Text', itemId = null) => {
        try {
            navigator.clipboard.writeText(text);

            // Show success notification with custom message
            addNotification('success', `📋 ${label} copied to clipboard`);

            // Handle visual feedback for specific items
            if (itemId) {
                setCopiedStates(prev => ({ ...prev, [itemId]: true }));
                setTimeout(() => {
                    setCopiedStates(prev => ({ ...prev, [itemId]: false }));
                }, 2000);
            }
        } catch (error) {
            addNotification('error', '❌ Failed to copy to clipboard');
            console.error('Copy failed:', error);
        }
    };

    const viewToken = (token) => {
        let url;

        // Simple check: if pool is 'bonk', use letsbonk.fun
        if (token.pool === 'bonk') {
            url = `https://letsbonk.fun/token/${token.tokenAddress}`;
        } else {
            url = `https://pump.fun/${token.tokenAddress}`;
        }

        console.log('TOKEN DEBUG:', {
            pool: token.pool,
            tokenAddress: token.tokenAddress,
            finalURL: url
        });

        // Open the URL
        if (window.electronAPI && window.electronAPI.openExternalURL) {
            window.electronAPI.openExternalURL(url);
        } else {
            window.open(url, '_blank');
        }

        addNotification('success', `🌐 Opening token page: ${url}`);
    };

    // Format numbers for display
    const formatNumber = (num) => {
        if (!num || num === 0) return '0';
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(2) + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        } else if (num < 1) {
            return num.toFixed(6);
        }
        return num.toFixed(2);
    };

    const formatSol = (amount) => {
        if (!amount || amount === 0) return '0.0000';
        return parseFloat(amount).toFixed(4);
    };

    // API calls
    const apiCall = async (endpoint, options = {}) => {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            addNotification('error', `API Error: ${error.message}`);
            throw error;
        }
    };

    const fetchStatus = async () => {
        try {
            const data = await apiCall('/status');
            setBotStatus(data);
            setSettings(data.settings);
            setOriginalSettings(data.settings);
        } catch (error) {
            console.error('Failed to fetch status');
        }
    };

    const fetchLists = async () => {
        try {
            const listTypes = ['primary_admins', 'secondary_admins'];
            const listData = {};

            for (const listType of listTypes) {
                const data = await apiCall(`/lists/${listType}`);
                listData[listType] = data.list || [];
            }

            setLists(listData);
        } catch (error) {
            console.error('Failed to fetch lists');
        }
    };

    const fetchDetectedTokens = async () => {
        try {
            const data = await apiCall('/detected-tokens');
            setDetectedTokens(data.tokens || []);
            addNotification('info', '🔄 Detected tokens refreshed');
        } catch (error) {
            console.error('Failed to fetch detected tokens');
            addNotification('error', '❌ Failed to refresh detected tokens');
        }
    };

    const clearDetectedTokens = async () => {
        try {
            await apiCall('/detected-tokens', { method: 'DELETE' });
            setDetectedTokens([]);
            addNotification('success', '🗑️ All detected tokens cleared successfully');
        } catch (error) {
            addNotification('error', '❌ Failed to clear detected tokens');
        }
    };

    const snipeDetectedToken = async (tokenAddress) => {
        try {
            await apiCall(`/detected-tokens/${tokenAddress}/snipe`, { method: 'POST' });
            addNotification('success', `🎯 Manually sniped token: ${tokenAddress.substring(0, 8)}...`);
        } catch (error) {
            addNotification('error', `❌ Failed to snipe token: ${error.message}`);
        }
    };
    // App.js - Part 4: Settings and Bot Control Functions

    const hasBasicSettingsChanged = () => {
        return settings.privateKey !== originalSettings.privateKey ||
            settings.tokenPageDestination !== originalSettings.tokenPageDestination;
    };

    const hasFilterSettingsChanged = () => {
        return settings.enableAdminFilter !== originalSettings.enableAdminFilter ||
            settings.enableCommunityReuse !== originalSettings.enableCommunityReuse ||
            settings.snipeAllTokens !== originalSettings.snipeAllTokens ||
            settings.detectionOnlyMode !== originalSettings.detectionOnlyMode;
    };

    const clearButtonMessage = (type, delay = 3000) => {
        setTimeout(() => {
            setButtonMessages(prev => ({ ...prev, [type]: '' }));
        }, delay);
    };

    const startBot = async () => {
        try {
            await apiCall('/start', { method: 'POST' });
            addNotification('success', '✅ Bot started successfully');
        } catch (error) {
            addNotification('error', '❌ Failed to start bot');
        }
    };

    const stopBot = async () => {
        try {
            await apiCall('/stop', { method: 'POST' });
            addNotification('info', '⏹️ Bot stopped');
        } catch (error) {
            addNotification('error', '❌ Failed to stop bot');
        }
    };

    const updateSettings = async (newSettings) => {
        try {
            await apiCall('/settings', {
                method: 'POST',
                body: JSON.stringify(newSettings)
            });

            const updatedSettings = { ...settings, ...newSettings };
            setSettings(updatedSettings);

            // Save to localStorage
            saveToLocalStorage(STORAGE_KEYS.SETTINGS, updatedSettings);

            addNotification('success', '✅ Settings updated and saved locally');
            setButtonMessages(prev => ({ ...prev, basicSettings: '✅ Settings saved successfully!' }));
            clearButtonMessage('basicSettings');
        } catch (error) {
            addNotification('error', '❌ Failed to update settings');
            setButtonMessages(prev => ({ ...prev, basicSettings: '❌ Failed to save settings' }));
            clearButtonMessage('basicSettings');
        }
    };

    const updateFilterSettings = async (filterSettings) => {
        try {
            await apiCall('/filter-settings', {
                method: 'POST',
                body: JSON.stringify(filterSettings)
            });

            const updatedSettings = { ...settings, ...filterSettings };
            setSettings(updatedSettings);

            // Save filter settings separately
            saveToLocalStorage(STORAGE_KEYS.FILTER_SETTINGS, filterSettings);
            // Save complete settings
            saveToLocalStorage(STORAGE_KEYS.SETTINGS, updatedSettings);

            addNotification('success', '✅ Filter settings updated and saved locally');
            setButtonMessages(prev => ({ ...prev, filterSettings: '✅ Filter settings saved successfully!' }));
            clearButtonMessage('filterSettings');
        } catch (error) {
            addNotification('error', '❌ Failed to update filter settings');
            setButtonMessages(prev => ({ ...prev, filterSettings: '❌ Failed to save filter settings' }));
            clearButtonMessage('filterSettings');
        }
    };

    const addListItem = async (listType, item) => {
        try {
            await apiCall(`/lists/${listType}`, {
                method: 'POST',
                body: JSON.stringify(item)
            });
            await fetchLists();
            addNotification('success', '✅ Item added to list');
            setShowAddForm({ type: null, show: false });
            resetForm();
        } catch (error) {
            addNotification('error', '❌ Failed to add item');
        }
    };

    const removeListItem = async (listType, id) => {
        try {
            await apiCall(`/lists/${listType}/${id}`, { method: 'DELETE' });
            await fetchLists();
            addNotification('success', '🗑️ Item removed from list');
        } catch (error) {
            addNotification('error', '❌ Failed to remove item');
        }
    };

    const resetForm = () => {
        setFormData({
            address: '',
            username: '',
            amount: 0.01,
            fees: 10,
            mevProtection: true,
            soundNotification: 'default.wav'
        });
    };

    // Effects
    useEffect(() => {
        fetchStatus();
        fetchLists();
        fetchDetectedTokens();
        connectWebSocket();

        return () => {
            if (websocket) {
                websocket.close();
            }
        };
    }, [connectWebSocket]);
    // App.js - Part 5: Render Functions - Status and Dashboard

    // 4. Add global settings API calls
    const updateGlobalSnipeSettings = async (newSettings) => {
        try {
            await apiCall('/global-snipe-settings', {
                method: 'POST',
                body: JSON.stringify(newSettings)
            });

            const updatedGlobalSettings = { ...settings.globalSnipeSettings, ...newSettings };
            const updatedSettings = {
                ...settings,
                globalSnipeSettings: updatedGlobalSettings
            };

            setSettings(updatedSettings);

            // Save global snipe settings separately
            saveToLocalStorage(STORAGE_KEYS.GLOBAL_SNIPE, updatedGlobalSettings);
            // Save complete settings
            saveToLocalStorage(STORAGE_KEYS.SETTINGS, updatedSettings);

            addNotification('success', '✅ Global snipe settings updated and saved locally');
        } catch (error) {
            addNotification('error', '❌ Failed to update global snipe settings');
        }
    };

    const snipeWithGlobalSettings = async (tokenAddress) => {
        try {
            await apiCall(`/snipe-with-global-settings/${tokenAddress}`, { method: 'POST' });
            addNotification('success', `🎯 Token sniped using global settings: ${tokenAddress.substring(0, 8)}...`);
            setSecondaryPopup({ show: false, tokenData: null });
        } catch (error) {
            addNotification('error', `❌ Failed to snipe token: ${error.message}`);
        }
    };

    const renderCommunityManagement = () => (
        <div className="space-y-4 md:space-y-6">
            {/* Firebase Status & Controls */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-4">
                    <div>
                        <h2 className="text-lg md:text-xl font-semibold text-white">Firebase Community Tracking</h2>
                        <p className="text-sm text-gray-400">Manage used Twitter communities to prevent duplicate sniping</p>
                    </div>
                    <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4">
                        <button
                            onClick={fetchUsedCommunities}
                            className="w-full md:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                        >
                            🔄 Refresh
                        </button>
                        <button
                            onClick={clearUsedCommunities}
                            className="w-full md:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                        >
                            🗑️ Clear All
                        </button>
                    </div>
                </div>

                <div className="text-sm text-gray-400">
                    Used communities: <span className="text-white font-semibold">{usedCommunities.length}</span>
                </div>
            </div>

            {/* Used Communities List */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Used Communities</h3>

                {usedCommunities.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-gray-400 mb-4">
                            <Users size={48} className="mx-auto mb-2" />
                            <p>No used communities tracked yet</p>
                            <p className="text-sm">Communities will appear here after tokens are detected</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {usedCommunities.map(community => (
                            <div key={community.id} className="bg-gray-700 rounded-lg p-4">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <h4 className="text-white font-medium">Community {community.communityId}</h4>
                                            <button
                                                onClick={() => copyToClipboard(community.communityId, 'Community ID')}
                                                className="text-blue-400 hover:text-blue-300 text-sm"
                                            >
                                                📋
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                                            <div>
                                                <span className="text-gray-400">Token: </span>
                                                <span className="text-green-400">{community.tokenName || 'Unknown'}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400">Platform: </span>
                                                <span className="text-blue-400">{community.platform || 'Unknown'}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400">Used: </span>
                                                <span className="text-yellow-400">
                                                    {(() => {
                                                        if (community.firstUsedAt) {
                                                            try {
                                                                // Handle Firebase Timestamp
                                                                if (community.firstUsedAt.toDate) {
                                                                    return community.firstUsedAt.toDate().toLocaleString();
                                                                }
                                                                // Handle regular Date object
                                                                if (community.firstUsedAt instanceof Date) {
                                                                    return community.firstUsedAt.toLocaleString();
                                                                }
                                                                // Handle timestamp number
                                                                if (typeof community.firstUsedAt === 'number') {
                                                                    return new Date(community.firstUsedAt).toLocaleString();
                                                                }
                                                                // Handle ISO string
                                                                if (typeof community.firstUsedAt === 'string') {
                                                                    return new Date(community.firstUsedAt).toLocaleString();
                                                                }
                                                            } catch (error) {
                                                                console.error('Error formatting timestamp:', error);
                                                            }
                                                        }
                                                        return 'Just now';
                                                    })()}
                                                </span>
                                            </div>
                                        </div>

                                        {community.tokenAddress && (
                                            <div className="mt-2">
                                                <span className="text-gray-400 text-xs">Token Address: </span>
                                                <code className="text-xs text-white bg-gray-600 px-2 py-1 rounded">
                                                    {community.tokenAddress.substring(0, 12)}...{community.tokenAddress.substring(-8)}
                                                </code>
                                                <button
                                                    onClick={() => copyToClipboard(community.tokenAddress, 'Token address')}
                                                    className="ml-2 text-blue-400 hover:text-blue-300 text-xs"
                                                >
                                                    📋
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => {
                                                const communityUrl = `https://x.com/i/communities/${community.communityId}`;
                                                if (window.electronAPI && window.electronAPI.openExternalURL) {
                                                    window.electronAPI.openExternalURL(communityUrl);
                                                } else {
                                                    window.open(communityUrl, '_blank');
                                                }
                                                addNotification('success', `🌐 Opening community ${community.communityId}`);
                                            }}
                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                                        >
                                            🔗 View
                                        </button>
                                        <button
                                            onClick={() => removeUsedCommunity(community.communityId)}
                                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                                        >
                                            🗑️ Remove
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Community Detection Stats */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Detection Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-700 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-400">{usedCommunities.length}</div>
                        <div className="text-sm text-gray-400">Used Communities</div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-400">
                            {detectedTokens.filter(t => t.twitterType === 'community').length}
                        </div>
                        <div className="text-sm text-gray-400">Community Tokens Detected</div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-purple-400">
                            {detectedTokens.filter(t => t.twitterType === 'individual').length}
                        </div>
                        <div className="text-sm text-gray-400">Individual Account Tokens</div>
                    </div>
                </div>
            </div>

            {/* Twitter Detection Help */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🔍 Twitter Detection Guide</h3>
                <div className="space-y-4">
                    <div className="bg-gray-700 rounded-lg p-4">
                        <h4 className="text-white font-medium mb-2">✅ Individual Twitter Accounts</h4>
                        <div className="text-sm text-gray-300 space-y-1">
                            <p>• <code className="bg-gray-600 px-1 rounded">https://x.com/username</code></p>
                            <p>• <code className="bg-gray-600 px-1 rounded">https://twitter.com/username</code></p>
                            <p>• <code className="bg-gray-600 px-1 rounded">@username</code></p>
                            <p>• <code className="bg-gray-600 px-1 rounded">username</code></p>
                        </div>
                    </div>

                    <div className="bg-gray-700 rounded-lg p-4">
                        <h4 className="text-white font-medium mb-2">🏘️ Twitter Communities</h4>
                        <div className="text-sm text-gray-300 space-y-1">
                            <p>• <code className="bg-gray-600 px-1 rounded">https://x.com/i/communities/1864891560858468809</code></p>
                            <p>• <code className="bg-gray-600 px-1 rounded">https://twitter.com/i/communities/1234567890</code></p>
                            <p className="text-yellow-400 mt-2">⚠️ Community IDs are tracked in Firebase to prevent duplicates</p>
                        </div>
                    </div>

                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                        <h4 className="text-blue-400 font-medium mb-2">💡 Tips for List Management</h4>
                        <div className="text-sm text-blue-300 space-y-1">
                            <p>• For individual accounts, add the username to your admin lists</p>
                            <p>• For communities, add the community ID (numbers) to your admin lists</p>
                            <p>• Primary lists = Auto-snipe | Secondary lists = Notification popup</p>
                            <p>• Enable "Community Reuse Prevention" to avoid duplicate community sniping</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderDemoTab = () => (
        <div className="space-y-4 md:space-y-6">
            {/* Demo Control Panel */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <div className="flex items-center space-x-2 mb-4">
                    <h2 className="text-lg md:text-xl font-semibold text-white">🧪 Demo Token Injection</h2>
                    <div className="px-2 py-1 bg-orange-600 text-white text-xs rounded">
                        TESTING ONLY
                    </div>
                </div>
                <p className="text-sm text-gray-400 mb-6">
                    Inject fake tokens to test your filtering and sniping logic without waiting for real tokens.
                </p>

                {!botStatus.isRunning && (
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
                        <p className="text-red-400">⚠️ Bot must be running to inject demo tokens</p>
                    </div>
                )}

                {/* Template Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Demo Template
                        </label>
                        <select
                            value={selectedTemplate}
                            onChange={(e) => setSelectedTemplate(parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                            disabled={!botStatus.isRunning}
                        >
                            {demoTemplates.map((template, index) => (
                                <option key={index} value={index}>
                                    {template.name} ({template.symbol}) - {template.platform}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Custom Wallet (Optional)
                        </label>
                        <input
                            type="text"
                            value={customWallet}
                            onChange={(e) => setCustomWallet(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="Override creator wallet"
                            disabled={!botStatus.isRunning}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Custom Twitter (Optional)
                        </label>
                        <input
                            type="text"
                            value={customTwitter}
                            onChange={(e) => setCustomTwitter(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="Override Twitter handle"
                            disabled={!botStatus.isRunning}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Custom Twitter Community (Optional)
                        </label>
                        <input
                            type="text"
                            value={customCommunity}
                            onChange={(e) => setCustomCommunity(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="Community ID (e.g., 1234567890)"
                            disabled={!botStatus.isRunning}
                        />
                    </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                        onClick={() => injectDemoToken()}  // <-- Add empty parentheses
                        disabled={!botStatus.isRunning}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                        🧪 Inject Single
                    </button>

                    <button
                        onClick={injectDemoBatch}
                        disabled={!botStatus.isRunning}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                        🚀 Inject Batch (5)
                    </button>

                    <button
                        onClick={() => injectDemoToken({ platform: 'pumpfun' })}
                        disabled={!botStatus.isRunning}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                        🎯 Force Pump.fun
                    </button>

                    <button
                        onClick={() => injectDemoToken({ platform: 'letsbonk' })}
                        disabled={!botStatus.isRunning}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                        🎯 Force LetsBonk
                    </button>
                </div>
            </div>

            {/* Test With Your Lists */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Test With Your Lists</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Inject tokens that will match entries in your lists to test primary/secondary detection
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                        onClick={() => injectFromList('primary_admins')}
                        disabled={!botStatus.isRunning || lists.primary_admins.length === 0}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                        🎯 Primary Wallet
                        <div className="text-xs opacity-75">({lists.primary_admins.length} entries)</div>
                    </button>

                    <button
                        onClick={() => injectFromList('primary_admins')}
                        disabled={!botStatus.isRunning || lists.primary_admins.length === 0}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                        🎯 Primary Admin
                        <div className="text-xs opacity-75">({lists.primary_admins.length} entries)</div>
                    </button>

                    <button
                        onClick={() => injectFromList('secondary_admins')}
                        disabled={!botStatus.isRunning || lists.secondary_admins.length === 0}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                        🔔 Secondary Wallet
                        <div className="text-xs opacity-75">({lists.secondary_admins.length} entries)</div>
                    </button>

                    <button
                        onClick={() => injectFromList('secondary_admins')}
                        disabled={!botStatus.isRunning || lists.secondary_admins.length === 0}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                        🔔 Secondary Admin
                        <div className="text-xs opacity-75">({lists.secondary_admins.length} entries)</div>
                    </button>
                </div>
            </div>

            {/* Demo Templates Info */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Available Demo Templates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {demoTemplates.map((template, index) => (
                        <div
                            key={index}
                            className={`p-3 rounded-lg border-2 transition-colors cursor-pointer ${selectedTemplate === index
                                ? 'border-blue-500 bg-blue-900/20'
                                : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                                }`}
                            onClick={() => setSelectedTemplate(index)}
                        >
                            <div className="flex items-center space-x-2 mb-2">
                                <h4 className="font-semibold text-white">{template.name}</h4>
                                <span className="text-xs px-2 py-1 bg-gray-600 text-white rounded">
                                    {template.symbol}
                                </span>
                            </div>
                            <div className="text-xs text-gray-400 space-y-1">
                                <p>Platform: {template.platform}</p>
                                <p>Twitter: @{template.twitterHandle}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Speed Test Section */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4">⚡ Speed Testing</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Test the speed of your detection and sniping logic
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                        onClick={() => injectDemoBatch()}
                        disabled={!botStatus.isRunning}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                        🔥 Rapid Fire (5 tokens)
                    </button>
                    <button
                        onClick={async () => {
                            for (let i = 0; i < 10; i++) {
                                await injectDemoToken();
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        }}
                        disabled={!botStatus.isRunning}
                        className="px-4 py-2 bg-red-700 hover:bg-red-800 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                        ⚡ Lightning (10 tokens)
                    </button>
                    <button
                        onClick={() => {
                            // Inject one token that should match primary list immediately
                            if (lists.primary_admins.length > 0) {
                                injectFromList('primary_admins');
                                addNotification('info', '🏁 Speed test: Primary wallet token injected!');
                            } else {
                                addNotification('warning', '⚠️ Add wallets to primary list first');
                            }
                        }}
                        disabled={!botStatus.isRunning}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                    >
                        🏁 Speed Test Snipe
                    </button>
                </div>
            </div>
        </div>
    );

    const renderGlobalSnipeSettings = () => (
        <div className="bg-gray-800 rounded-lg p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-semibold text-white">Global Snipe Settings</h2>
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" title="Auto-saved locally"></div>
                    <span className="text-xs text-gray-400">Auto-saved</span>
                </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">
                These settings are used when manually sniping tokens from secondary lists
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Amount (SOL)</label>
                    <input
                        type="number"
                        step="0.001"
                        value={settings.globalSnipeSettings.amount}
                        onChange={(e) => {
                            const newAmount = parseFloat(e.target.value);
                            setSettings(prev => ({
                                ...prev,
                                globalSnipeSettings: {
                                    ...prev.globalSnipeSettings,
                                    amount: newAmount
                                }
                            }));
                            setHasGlobalSettingsChanged(true); // Add this line

                            // Auto-save to localStorage
                            const updatedGlobalSettings = { ...settings.globalSnipeSettings, amount: newAmount };
                            saveToLocalStorage(STORAGE_KEYS.GLOBAL_SNIPE, updatedGlobalSettings);
                        }}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Fees (%)</label>
                    <input
                        type="number"
                        value={settings.globalSnipeSettings.fees}
                        onChange={(e) => {
                            const newFees = parseInt(e.target.value);
                            setSettings(prev => ({
                                ...prev,
                                globalSnipeSettings: {
                                    ...prev.globalSnipeSettings,
                                    fees: newFees
                                }
                            }));

                            setHasGlobalSettingsChanged(true); // Add this line

                            // Auto-save to localStorage
                            const updatedGlobalSettings = { ...settings.globalSnipeSettings, fees: newFees };
                            saveToLocalStorage(STORAGE_KEYS.GLOBAL_SNIPE, updatedGlobalSettings);
                        }}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        checked={settings.globalSnipeSettings.mevProtection}
                        onChange={(e) => {
                            const newMevProtection = e.target.checked;
                            setSettings(prev => ({
                                ...prev,
                                globalSnipeSettings: {
                                    ...prev.globalSnipeSettings,
                                    mevProtection: newMevProtection
                                }
                            }));

                            setHasGlobalSettingsChanged(true); // Add this line

                            // Auto-save to localStorage
                            const updatedGlobalSettings = { ...settings.globalSnipeSettings, mevProtection: newMevProtection };
                            saveToLocalStorage(STORAGE_KEYS.GLOBAL_SNIPE, updatedGlobalSettings);
                        }}
                        className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <label className="text-sm text-gray-300">🛡️ MEV Protection</label>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Sound Notification</label>
                    <div className="flex space-x-2">
                        <select
                            value={settings.globalSnipeSettings.soundNotification}
                            onChange={(e) => {
                                const newSound = e.target.value;
                                setSettings(prev => ({
                                    ...prev,
                                    globalSnipeSettings: {
                                        ...prev.globalSnipeSettings,
                                        soundNotification: newSound
                                    }
                                }));

                                setHasGlobalSettingsChanged(true); // Add this line

                                // Auto-save to localStorage
                                const updatedGlobalSettings = { ...settings.globalSnipeSettings, soundNotification: newSound };
                                saveToLocalStorage(STORAGE_KEYS.GLOBAL_SNIPE, updatedGlobalSettings);

                            }}
                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        >
                            {SOUND_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => previewSound(settings.globalSnipeSettings.soundNotification)}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            title="Preview sound"
                        >
                            🔊
                        </button>
                    </div>
                </div>
            </div>

            {/*<div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                    onClick={() => updateGlobalSnipeSettings(settings.globalSnipeSettings)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                    💾 Save to Server
                </button>

                <button
                    onClick={clearLocalStorage}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                    🗑️ Clear Local Storage
                </button>
            </div>*/}

            <div className="mt-6 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={async () => {
                            try {
                                await updateGlobalSnipeSettings(settings.globalSnipeSettings);
                                setGlobalSettingsMessage('✅ Global snipe settings saved to server!');
                                setHasGlobalSettingsChanged(false);
                                clearGlobalSettingsMessage();
                            } catch (error) {
                                setGlobalSettingsMessage('❌ Failed to save settings to server');
                                clearGlobalSettingsMessage();
                            }
                        }}
                        disabled={!hasGlobalSettingsChanged}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                        💾 Save to Server
                    </button>

                    <button
                        onClick={() => {
                            clearLocalStorage();
                            setGlobalSettingsMessage('🗑️ Local storage cleared successfully!');
                            clearGlobalSettingsMessage();
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                        🗑️ Clear Local Storage
                    </button>
                </div>

                {/* Message display */}
                {globalSettingsMessage && (
                    <div className={`text-sm px-3 py-2 rounded ${globalSettingsMessage.includes('✅')
                        ? 'bg-green-900/20 text-green-400 border border-green-500/30'
                        : globalSettingsMessage.includes('🗑️')
                            ? 'bg-blue-900/20 text-blue-400 border border-blue-500/30'
                            : 'bg-red-900/20 text-red-400 border border-red-500/30'
                        }`}>
                        {globalSettingsMessage}
                    </div>
                )}
            </div>

            {/* Local Storage Status */}
            <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
                <h4 className="text-sm font-semibold text-white mb-2">💾 Local Storage Status</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-gray-300">Settings: Saved</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-gray-300">Filters: Saved</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-gray-300">Global Snipe: Saved</span>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderSecondaryPopup = () => {
        if (!secondaryPopup.show || !secondaryPopup.tokenData) return null;

        const token = secondaryPopup.tokenData;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white">🔔 Secondary Match Found!</h2>
                        <button
                            onClick={() => setSecondaryPopup({ show: false, tokenData: null })}
                            className="text-gray-400 hover:text-white"
                        >
                            ✖️
                        </button>
                    </div>

                    {/* Token Details */}
                    <div className="space-y-4 mb-6">
                        <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-600">
                                {token.uri ? (
                                    <img src={token.uri} alt={token.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Coins className="text-gray-400" size={24} />
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">{token.name || 'Unknown Token'}</h3>
                                <p className="text-gray-300">${token.symbol || 'UNKNOWN'}</p>
                                <p className="text-sm text-gray-400">Matched: @{token.matchedEntity}</p>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-700 p-3 rounded">
                                <p className="text-sm text-gray-400">Platform</p>
                                <p className="text-white font-bold">{token.platform.toUpperCase()}</p>
                            </div>
                            <div className="bg-gray-700 p-3 rounded">
                                <p className="text-sm text-gray-400">Market Cap</p>
                                <p className="text-white font-bold">{formatNumber(token.marketCapSol)} SOL</p>
                            </div>
                        </div>

                        {/* Token Address */}
                        <div className="bg-gray-700 p-3 rounded">
                            <p className="text-sm text-gray-400 mb-2">Token Address:</p>
                            <div className="flex items-center space-x-2">
                                <code className="text-sm font-mono text-white flex-1 break-all">
                                    {token.tokenAddress}
                                </code>
                                <button
                                    onClick={() => copyToClipboard(token.tokenAddress, 'Token address')}
                                    className="text-blue-400 hover:text-blue-300 px-2 py-1"
                                >
                                    📋
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Current Global Snipe Settings Display */}
                    {/* Current Global Snipe Settings Display */}
                    <div className="bg-gray-700 p-4 rounded mb-6">
                        <h4 className="text-lg font-semibold text-white mb-3">Current Global Snipe Settings:</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="text-center">
                                <p className="text-sm text-gray-400">Amount</p>
                                <p className="text-white font-bold">{settings.globalSnipeSettings.amount} SOL</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-400">Fees</p>
                                <p className="text-white font-bold">{settings.globalSnipeSettings.fees}%</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-400">MEV Protection</p>
                                <p className="text-white font-bold">{settings.globalSnipeSettings.mevProtection ? '🛡️ ON' : '❌ OFF'}</p>
                            </div>
                         
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-3 md:flex-row md:space-y-0 md:space-x-4">
                        <button
                            onClick={() => {
                                const url = settings.tokenPageDestination === 'neo_bullx'
                                    ? `https://bullx.io/terminal?chainId=1399811149&address=${token.tokenAddress}`
                                    : `https://axiom.trade/meme/${token.tokenAddress}`;
                                window.open(url, '_blank');
                                addNotification('success', `🌐 Opening token on ${settings.tokenPageDestination === 'neo_bullx' ? 'Neo BullX' : 'Axiom'}`);
                            }}
                            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            🌐 View Token Page
                        </button>

                        <button
                            onClick={() => snipeWithGlobalSettings(token.tokenAddress)}
                            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-bold flex items-center justify-center space-x-2"
                        >
                            <Target size={20} />
                            <span>SNIPE ({settings.globalSnipeSettings.amount} SOL)</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    };
 
    // Render components
    const renderStatusIndicator = () => (
        <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
            <span className="text-xs md:text-sm text-gray-400">
                {connectionStatus === 'connected' ? 'Connected' :
                    connectionStatus === 'error' ? 'Connection Error' : 'Connecting...'}
            </span>
        </div>
    );

    const renderDashboard = () => (
        <div className="space-y-4 md:space-y-6">
            {/* Control Panel - keep existing */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-4">
                    <h2 className="text-lg md:text-xl font-semibold text-white">Bot Control</h2>
                    {renderStatusIndicator()}
                </div>

                <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4">
                    <button
                        onClick={startBot}
                        disabled={botStatus.isRunning}
                        className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        <Play size={16} />
                        <span>Start Bot</span>
                    </button>

                    <button
                        onClick={stopBot}
                        disabled={!botStatus.isRunning}
                        className="flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        <Square size={16} />
                        <span>Stop Bot</span>
                    </button>
                </div>

                {/* Enhanced status with Firebase indicator */}
                <div className="mt-4 flex items-center space-x-4">
                    <div className={`flex items-center space-x-2 ${botStatus.isRunning ? 'text-green-400' : 'text-gray-400'}`}>
                        <Activity size={16} />
                        <span>{botStatus.isRunning ? 'Running' : 'Stopped'}</span>
                    </div>
                    <div className={`flex items-center space-x-2 ${botStatus.stats.isFirebaseLoaded ? 'text-green-400' : 'text-yellow-400'}`}>
                        <span className="text-xs">🔥 Firebase:</span>
                        <span className="text-xs">{botStatus.stats.isFirebaseLoaded ? 'Connected' : 'Loading...'}</span>
                    </div>
                </div>
            </div>

            {/* Enhanced Statistics with Secondary Admins */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                        <Users className="text-purple-400" size={20} />
                        <div>
                            <p className="text-sm text-gray-400">Primary Admins</p>
                            <p className="text-xl font-semibold text-white">{botStatus.stats.primaryAdmins}</p>
                        </div>
                    </div>
                </div>

                {/* ADD THIS NEW CARD FOR SECONDARY ADMINS */}
                <div className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                        <Bell className="text-orange-400" size={20} />
                        <div>
                            <p className="text-sm text-gray-400">Secondary Admins</p>
                            <p className="text-xl font-semibold text-white">{botStatus.stats.secondaryAdmins}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                        <Target className="text-green-400" size={20} />
                        <div>
                            <p className="text-sm text-gray-400">Processed Tokens</p>
                            <p className="text-xl font-semibold text-white">{botStatus.stats.processedTokens}</p>
                        </div>
                    </div>
                </div>

                {/* ADD FIREBASE STATUS CARD */}
                <div className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                        <div className={`w-5 h-5 rounded-full ${botStatus.stats.isFirebaseLoaded ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <div>
                            <p className="text-sm text-gray-400">Firebase Status</p>
                            <p className={`text-sm font-semibold ${botStatus.stats.isFirebaseLoaded ? 'text-green-400' : 'text-yellow-400'}`}>
                                {botStatus.stats.isFirebaseLoaded ? 'Connected' : 'Syncing...'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Notifications - keep existing */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <p className="text-gray-400">No recent activity</p>
                    ) : (
                        notifications.map(notification => (
                            <div key={notification.id} className="flex items-center space-x-3 p-2 bg-gray-700 rounded">
                                {notification.type === 'success' && <CheckCircle className="text-green-400" size={16} />}
                                {notification.type === 'error' && <XCircle className="text-red-400" size={16} />}
                                {notification.type === 'info' && <AlertTriangle className="text-blue-400" size={16} />}
                                <div className="flex-1">
                                    <p className="text-white text-sm">{notification.message}</p>
                                    <p className="text-gray-400 text-xs">{notification.timestamp}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
    // App.js - Part 6: Detected Tokens Render Function

    const renderDetectedTokens = () => (
        <div className="space-y-4 md:space-y-6">
            {/* Header with enhanced filters */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-4">
                    <div>
                        <h2 className="text-lg md:text-xl font-semibold text-white">Enhanced Detected Tokens</h2>
                        <p className="text-sm text-gray-400">Tokens with advanced Twitter detection and community tracking</p>
                    </div>
                    <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4">
                        <button
                            onClick={fetchDetectedTokens}
                            className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                        >
                            🔄 Refresh
                        </button>
                        <button
                            onClick={clearDetectedTokens}
                            className="w-full md:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                        >
                            🗑️ Clear All
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                        <div className="text-white font-semibold">{detectedTokens.length}</div>
                        <div className="text-gray-400">Total Detected</div>
                    </div>
                    <div className="text-center">
                        <div className="text-green-400 font-semibold">
                            {detectedTokens.filter(t => t.twitterType === 'community').length}
                        </div>
                        <div className="text-gray-400">Communities</div>
                    </div>
                    <div className="text-center">
                        <div className="text-blue-400 font-semibold">
                            {detectedTokens.filter(t => t.twitterType === 'individual').length}
                        </div>
                        <div className="text-gray-400">Individuals</div>
                    </div>
                    <div className="text-center">
                        <div className="text-purple-400 font-semibold">
                            {detectedTokens.filter(t => t.matchType.includes('primary')).length}
                        </div>
                        <div className="text-gray-400">Auto-Sniped</div>
                    </div>
                </div>
            </div>

            {/* Enhanced token cards with professional details */}
            <div className="space-y-3 md:space-y-4">
                {detectedTokens.length === 0 ? (
                    <div className="bg-gray-800 rounded-lg p-6 md:p-8 text-center">
                        <Target className="mx-auto text-gray-400 mb-4" size={36} />
                        <h3 className="text-base md:text-lg font-semibold text-white mb-2">No Enhanced Tokens Detected</h3>
                        <p className="text-sm text-gray-400">Start the bot to detect tokens with advanced Twitter analysis</p>
                    </div>
                ) : (
                    detectedTokens.map((token, index) => (
                        <div key={`token_${index}`} className="bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700">

                            {/* Enhanced header with Twitter type indicator */}
                            <div className="bg-gradient-to-r from-gray-750 to-gray-800 p-4 md:p-6">
                                <div className="flex flex-col md:flex-row md:items-start space-y-4 md:space-y-0 md:space-x-4">
                                    {/* Token Image */}
                                    <div className="flex-shrink-0 self-center md:self-start">
                                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden bg-gray-600 border-2 border-gray-500 shadow-lg">
                                            {token.uri ? (
                                                <img
                                                    src={token.uri}
                                                    alt={token.name || 'Token'}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-600">
                                                    <Coins className="text-gray-400" size={24} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Enhanced token info with Twitter data */}
                                    <div className="flex-1 text-center md:text-left space-y-2">
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
                                            <div>
                                                <h3 className="text-xl md:text-2xl font-bold text-white">
                                                    {token.name || 'Unknown Token'}
                                                </h3>
                                                <p className="text-lg text-gray-300 font-mono">
                                                    ${token.symbol || 'UNKNOWN'}
                                                </p>
                                            </div>

                                            {/* Enhanced badges with Twitter type */}
                                            <div className="flex flex-wrap justify-center md:justify-end gap-2">
                                                {/* Twitter Type Badge */}
                                                {token.twitterType && (
                                                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${token.twitterType === 'community'
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-blue-600 text-white'
                                                        }`}>
                                                        {token.twitterType === 'community' ? '🏘️ COMMUNITY' : '👤 INDIVIDUAL'}
                                                    </div>
                                                )}

                                                {/* Match Type Badge */}
                                                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${token.matchType === 'primary_wallet' || token.matchType === 'primary_admin'
                                                    ? 'bg-green-600 text-white'
                                                    : token.matchType === 'secondary_wallet' || token.matchType === 'secondary_admin'
                                                        ? 'bg-yellow-600 text-white'
                                                        : 'bg-purple-600 text-white'
                                                    }`}>
                                                    {token.matchType.replace('_', ' ')}
                                                </div>

                                                {/* Platform Badge */}
                                                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${token.pool === 'pump' ? 'bg-purple-600 text-white' : 'bg-orange-600 text-white'
                                                    }`}>
                                                    {token.pool === 'pump' ? 'PUMP.FUN' : 'LETSBONK.FUN'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* PROFESSIONAL TOKEN DETAILS SECTION */}
                                        <div className="bg-gray-700/50 rounded-lg p-4 mt-4">
                                            <h4 className="text-white font-semibold mb-3 flex items-center">
                                                <TrendingUp className="mr-2" size={16} />
                                                Token Details
                                            </h4>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Market Cap */}
                                                <div className="bg-gray-600/50 rounded-lg p-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-gray-400 text-sm">💰 Market Cap</span>
                                                        <span className="text-green-400 font-bold">
                                                            {formatNumber(token.marketCapSol)} SOL
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        ~${(token.marketCapSol * 180).toFixed(2)} USD
                                                    </div>
                                                </div>

                                                {/* Sol Amount */}
                                                <div className="bg-gray-600/50 rounded-lg p-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-gray-400 text-sm">💎 Sol Amount</span>
                                                        <span className="text-blue-400 font-bold">
                                                            {formatSol(token.solAmount)} SOL
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        Initial liquidity
                                                    </div>
                                                </div>

                                                {/* Token Address - COPYABLE */}
                                                <div className="bg-gray-600/50 rounded-lg p-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-gray-400 text-sm">🏷️ Token Address</span>
                                                        <button
                                                            onClick={() => copyToClipboard(token.tokenAddress, 'Token address', `token_${token.tokenAddress}`)}
                                                            className="text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-900/20 hover:bg-blue-900/40 transition-colors text-xs"
                                                        >
                                                            {copiedStates[`token_${token.tokenAddress}`] ? '✅ Copied!' : '📋 Copy'}
                                                        </button>
                                                    </div>
                                                    <code className="text-xs text-white bg-gray-800 px-2 py-1 rounded block truncate">
                                                        {token.tokenAddress}
                                                    </code>
                                                </div>

                                                {/* Creator Address - COPYABLE */}
                                                <div className="bg-gray-600/50 rounded-lg p-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-gray-400 text-sm">👤 Creator Address</span>
                                                        <button
                                                            onClick={() => copyToClipboard(token.creatorWallet, 'Creator address', `creator_${token.tokenAddress}`)}
                                                            className="text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-900/20 hover:bg-blue-900/40 transition-colors text-xs"
                                                        >
                                                            {copiedStates[`creator_${token.tokenAddress}`] ? '✅ Copied!' : '📋 Copy'}
                                                        </button>
                                                    </div>
                                                    <code className="text-xs text-white bg-gray-800 px-2 py-1 rounded block truncate">
                                                        {token.creatorWallet || 'Unknown'}
                                                    </code>

                                                    {/* CREATOR WALLET MATCH INDICATOR */}
                                                    {token.creatorWallet && (
                                                        <div className="mt-2 flex items-center space-x-2">
                                                            {token.matchType === 'primary_admin' && token.matchedEntity === token.creatorWallet ? (
                                                                <div className="bg-green-900/30 border border-green-500/30 rounded px-2 py-1">
                                                                    <span className="text-green-400 text-xs">✅ Matched in Primary List</span>
                                                                </div>
                                                            ) : token.matchType === 'secondary_admin' && token.matchedEntity === token.creatorWallet ? (
                                                                <div className="bg-yellow-900/30 border border-yellow-500/30 rounded px-2 py-1">
                                                                    <span className="text-yellow-400 text-xs">🔔 Matched in Secondary List</span>
                                                                </div>
                                                            ) : (
                                                                <div className="bg-gray-900/30 border border-gray-500/30 rounded px-2 py-1">
                                                                    <span className="text-gray-400 text-xs">❌ Not in Admin Lists</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Enhanced Twitter information display */}
                                        {(token.twitterHandle || token.twitterCommunityId) && (
                                            <div className="bg-gray-700/50 rounded-lg p-3 mt-4">
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <span className="text-blue-400 font-medium">🐦 Twitter Detection:</span>
                                                </div>

                                                {token.twitterType === 'community' && token.twitterCommunityId && (
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm text-white">Community ID: {token.twitterCommunityId}</p>
                                                            <p className="text-xs text-gray-400">Tracked in Firebase for duplicate prevention</p>

                                                            {/* TWITTER ADMIN MATCH INDICATOR */}
                                                            <div className="mt-1">
                                                                {token.matchType === 'primary_admin' && token.matchedEntity === `Community ${token.twitterCommunityId}` ? (
                                                                    <span className="text-green-400 text-xs bg-green-900/20 px-2 py-1 rounded">✅ Community Detected</span>
                                                                ) : token.matchType === 'secondary_admin' && token.matchedEntity === `Community ${token.twitterCommunityId}` ? (
                                                                    <span className="text-yellow-400 text-xs bg-yellow-900/20 px-2 py-1 rounded">🔔 Community Detected</span>
                                                                ) : (
                                                                    <span className="text-gray-400 text-xs bg-gray-900/20 px-2 py-1 rounded">❌ Community ID is not in lists</span>
                                                                )}
                                                            </div>

                                                        </div>
                                                        <div className="flex space-x-2">
                                                            <button
                                                                onClick={() => copyToClipboard(token.twitterCommunityId, 'Community ID')}
                                                                className="text-blue-400 hover:text-blue-300 px-2 py-1 text-xs"
                                                            >
                                                                📋
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const communityUrl = `https://x.com/i/communities/${token.twitterCommunityId}`;
                                                                    if (window.electronAPI && window.electronAPI.openExternalURL) {
                                                                        window.electronAPI.openExternalURL(communityUrl);
                                                                    } else {
                                                                        window.open(communityUrl, '_blank');
                                                                    }
                                                                    addNotification('success', `🌐 Opening community ${token.twitterCommunityId}`);
                                                                }}
                                                                className="text-blue-400 hover:text-blue-300 px-2 py-1 text-xs"
                                                            >
                                                                🔗
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {token.twitterType === 'individual' && token.twitterHandle && (
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm text-white">@{token.twitterHandle}</p>
                                                            <p className="text-xs text-gray-400">Individual Twitter account</p>

                                                            {/* TWITTER ADMIN MATCH INDICATOR */}
                                                            <div className="mt-1">
                                                                {token.matchType === 'primary_admin' && token.matchedEntity === token.twitterHandle ? (
                                                                    <span className="text-green-400 text-xs bg-green-900/20 px-2 py-1 rounded">✅ Primary Twitter Admin Match</span>
                                                                ) : token.matchType === 'secondary_admin' && token.matchedEntity === token.twitterHandle ? (
                                                                    <span className="text-yellow-400 text-xs bg-yellow-900/20 px-2 py-1 rounded">🔔 Secondary Twitter Admin Match</span>
                                                                ) : (
                                                                    <span className="text-gray-400 text-xs bg-gray-900/20 px-2 py-1 rounded">❌ Twitter Admin Not in Lists</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex space-x-2">
                                                            <button
                                                                onClick={() => copyToClipboard(token.twitterHandle, 'Twitter handle')}
                                                                className="text-blue-400 hover:text-blue-300 px-2 py-1 text-xs"
                                                            >
                                                                📋
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const twitterUrl = `https://twitter.com/${token.twitterHandle}`;
                                                                    if (window.electronAPI && window.electronAPI.openExternalURL) {
                                                                        window.electronAPI.openExternalURL(twitterUrl);
                                                                    } else {
                                                                        window.open(twitterUrl, '_blank');
                                                                    }
                                                                    addNotification('success', `🌐 Opening Twitter: @${token.twitterHandle}`);
                                                                }}
                                                                className="text-blue-400 hover:text-blue-300 px-2 py-1 text-xs"
                                                            >
                                                                🔗
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex flex-col md:flex-row gap-3 mt-4">
                                            <button
                                                onClick={() => viewToken(token)}
                                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                                            >
                                                <ExternalLink size={16} />
                                                <span>{token.pool === 'bonk' ? 'View on LetsBonk.fun' : 'View on Pump.fun'}</span>
                                            </button>

                                            {token.config && (
                                                <button
                                                    onClick={() => snipeDetectedToken(token.tokenAddress)}
                                                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                                                >
                                                    <Target size={16} />
                                                    <span>Manual Snipe</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    // App.js - Part 7: Settings Render Function

    const renderSettings = () => (
        <div className="space-y-4 md:space-y-6">
            {/* Bot Settings */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-semibold text-white mb-4">Bot Settings</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Private Key (Hidden)
                        </label>
                        <input
                            type="password"
                            value={settings.privateKey}
                            onChange={(e) => setSettings(prev => ({ ...prev, privateKey: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter your base58 private key"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Token Page Destination
                        </label>
                        <select
                            value={settings.tokenPageDestination}
                            onChange={(e) => setSettings(prev => ({ ...prev, tokenPageDestination: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="neo_bullx">Neo BullX</option>
                            <option value="axiom">Axiom</option>
                        </select>
                    </div>

                    <div className="flex flex-col space-y-2">
                        <button
                            onClick={() => updateSettings({
                                privateKey: settings.privateKey,
                                tokenPageDestination: settings.tokenPageDestination
                            })}
                            disabled={!hasBasicSettingsChanged()}
                            className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                        >
                            Save Basic Settings
                        </button>
                        {buttonMessages.basicSettings && (
                            <div className={`text-sm px-3 py-2 rounded ${buttonMessages.basicSettings.includes('✅')
                                ? 'bg-green-900/20 text-green-400 border border-green-500/30'
                                : 'bg-red-900/20 text-red-400 border border-red-500/30'
                                }`}>
                                {buttonMessages.basicSettings}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Settings */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-semibold text-white mb-4">Filter Settings</h2>

                <div className="space-y-4">
                    {/* Detection Only Mode Toggle */}
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                        <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0">
                            <div>
                                <h3 className="text-base md:text-lg font-medium text-green-400">🛡️ Detection Only Mode</h3>
                                <p className="text-sm text-green-300">SAFE: Only detect and list tokens, don't buy them</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.detectionOnlyMode}
                                    onChange={(e) => setSettings(prev => ({ ...prev, detectionOnlyMode: e.target.checked }))}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>
                    </div>

                    {/* Snipe All Tokens Toggle */}
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                        <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0">
                            <div>
                                <h3 className="text-base md:text-lg font-medium text-red-400">⚠️ Snipe All New Tokens</h3>
                                <p className="text-sm text-red-300">DANGER: This will snipe EVERY new token (bypasses all filters)</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.snipeAllTokens}
                                    onChange={(e) => setSettings(prev => ({ ...prev, snipeAllTokens: e.target.checked }))}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                            </label>
                        </div>
                    </div>

                    {/* Admin Filter Toggle */}
                    <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0 p-4 bg-gray-700 rounded-lg">
                        <div>
                            <h3 className="text-base md:text-lg font-medium text-white">Enable Admin Filtering</h3>
                            <p className="text-sm text-gray-400">Only detect tokens from wallet addresses or Twitter admins in your lists</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.enableAdminFilter}
                                onChange={(e) => setSettings(prev => ({ ...prev, enableAdminFilter: e.target.checked }))}
                                className="sr-only peer"
                                disabled={settings.snipeAllTokens}
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-disabled:opacity-50"></div>
                        </label>
                    </div>

                    {/* Community Reuse Toggle */}
                    <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0 p-4 bg-gray-700 rounded-lg">
                        <div>
                            <h3 className="text-base md:text-lg font-medium text-white">Prevent Community Reuse</h3>
                            <p className="text-sm text-gray-400">Skip tokens if Twitter community was already used</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.enableCommunityReuse}
                                onChange={(e) => setSettings(prev => ({ ...prev, enableCommunityReuse: e.target.checked }))}
                                className="sr-only peer"
                                disabled={settings.snipeAllTokens}
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-disabled:opacity-50"></div>
                        </label>
                    </div>

                    {/* Current Filter Status */}
                    <div className="mt-6 p-4 bg-gray-700 rounded-lg">
                        <h3 className="text-base md:text-lg font-medium text-white mb-2">Current Filter Status</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center space-x-2">
                                <div className={`w-3 h-3 rounded-full ${settings.detectionOnlyMode ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                <span className="text-gray-300">Detection Only: {settings.detectionOnlyMode ? 'ON' : 'OFF'}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className={`w-3 h-3 rounded-full ${settings.snipeAllTokens ? 'bg-red-500' : 'bg-gray-500'}`}></div>
                                <span className="text-gray-300">Snipe All: {settings.snipeAllTokens ? 'ON' : 'OFF'}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className={`w-3 h-3 rounded-full ${settings.enableAdminFilter ? 'bg-purple-500' : 'bg-gray-500'}`}></div>
                                <span className="text-gray-300">Admin Filter: {settings.enableAdminFilter ? 'ON' : 'OFF'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col space-y-2">
                        <button
                            onClick={() => updateFilterSettings({
                                enableAdminFilter: settings.enableAdminFilter,
                                enableCommunityReuse: settings.enableCommunityReuse,
                                snipeAllTokens: settings.snipeAllTokens,
                                detectionOnlyMode: settings.detectionOnlyMode
                            })}
                            disabled={!hasFilterSettingsChanged()}
                            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                        >
                            Save Filter Settings
                        </button>
                        {buttonMessages.filterSettings && (
                            <div className={`text-sm px-3 py-2 rounded ${buttonMessages.filterSettings.includes('✅')
                                ? 'bg-green-900/20 text-green-400 border border-green-500/30'
                                : 'bg-red-900/20 text-red-400 border border-red-500/30'
                                }`}>
                                {buttonMessages.filterSettings}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    // App.js - Parts 8 & 9: Lists, Forms, and Main Component
    const renderAddForm = (listType) => {
        const isWalletList = true; // Always treat as wallet input now

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg p-4 md:p-6 w-full max-w-md max-h-screen overflow-y-auto border border-gray-600">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base md:text-lg font-semibold text-white">
                            Add to {listType.replace('_', ' ').toUpperCase()}
                        </h3>
                        <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${botStatus.stats.isFirebaseLoaded ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                            <span className="text-xs text-gray-400">
                                {botStatus.stats.isFirebaseLoaded ? 'Will sync to Firebase' : 'Firebase syncing...'}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Wallet Address, Twitter Username, or Community ID
                            </label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    address: e.target.value
                                }))}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g., HJdauMU7e8... or @username or 1234567890"
                            />
                            <div className="mt-2 text-xs text-gray-400">
                                <p>• Wallet: Base58 address (HJdauMU7e8...)</p>
                                <p>• Twitter: @username or username</p>
                                <p>• Community: Numeric ID (1234567890)</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Amount (SOL)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    value={formData.amount}
                                    onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Fees (%)</label>
                                <input
                                    type="number"
                                    value={formData.fees}
                                    onChange={(e) => setFormData(prev => ({ ...prev, fees: parseInt(e.target.value) }))}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={formData.mevProtection}
                                onChange={(e) => setFormData(prev => ({ ...prev, mevProtection: e.target.checked }))}
                                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <label className="text-sm text-gray-300">🛡️ MEV Protection</label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Sound Notification</label>
                            <div className="flex space-x-2">
                                <select
                                    value={formData.soundNotification}
                                    onChange={(e) => setFormData(prev => ({ ...prev, soundNotification: e.target.value }))}
                                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                >
                                    {SOUND_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => previewSound(formData.soundNotification)}
                                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                    title="Preview sound"
                                >
                                    🔊
                                </button>
 
                            </div>
                        </div>

                        {/* Firebase sync preview */}
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                            <div className="flex items-center space-x-2 mb-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <span className="text-blue-400 text-sm font-medium">Firebase Integration</span>
                            </div>
                            <p className="text-blue-300 text-xs">
                                This entry will be automatically saved to Firebase and synced across all instances.
                                {!botStatus.stats.isFirebaseLoaded && ' (Firebase is currently syncing...)'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4 mt-6">
                        <button
                            onClick={() => addListItem(listType, {
                                [isWalletList ? 'address' : 'username']: isWalletList ? formData.address : formData.username,
                                amount: formData.amount,
                                fees: formData.fees,
                                mevProtection: formData.mevProtection,
                                soundNotification: formData.soundNotification
                            })}
                            disabled={!formData.address || !formData.amount || !formData.fees}
                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                        >
                            <span>✅ Add & Save to Firebase</span>
                        </button>
                        <button
                            onClick={() => setShowAddForm({ type: null, show: false })}
                            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                        >
                            ❌ Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderEnhancedListSection = (listType, title, icon) => (
        <div className="bg-gray-800 rounded-lg p-4 md:p-6">
            <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0 mb-4">
                <div className="flex items-center space-x-2">
                    {icon}
                    <h3 className="text-base md:text-lg font-semibold text-white">{title}</h3>
                    <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded-full">
                        {lists[listType].length}
                    </span>
                    {/* Firebase sync indicator */}
                    <div className={`w-2 h-2 rounded-full ${botStatus.stats.isFirebaseLoaded ? 'bg-green-500' : 'bg-yellow-500'}`} title="Firebase Sync Status"></div>
                </div>
                <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2">
                    <button
                        onClick={() => setShowAddForm({ type: listType, show: true })}
                        className="flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-sm"
                    >
                        <Plus size={16} />
                        <span>Add</span>
                    </button>
                    <button
                        onClick={() => clearAdminListFromFirebase(listType)}
                        className="flex items-center space-x-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-sm"
                        disabled={lists[listType].length === 0}
                    >
                        <Trash2 size={16} />
                        <span>Clear All</span>
                    </button>
                </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
                {lists[listType].length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-gray-400 mb-4">
                            {icon}
                            <p className="mt-2">No entries in {title.toLowerCase()}</p>
                            <p className="text-sm">Add wallet addresses, Twitter usernames, or community IDs</p>
                        </div>
                    </div>
                ) : (
                    lists[listType].map(item => (
                        <div key={item.id} className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0 p-3 bg-gray-700 rounded border-l-4 border-purple-500">
                            <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                    <p className="text-white font-medium text-sm md:text-base">
                                        {item.address || item.username || 'Unknown'}
                                    </p>
                                    <button
                                        onClick={() => copyToClipboard(item.address || item.username, 'Entry')}
                                        className="text-blue-400 hover:text-blue-300 text-xs"
                                    >
                                        📋
                                    </button>
                                    {/* Firebase sync indicator for individual items */}
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Synced to Firebase"></div>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs">
                                    <span className="bg-green-600 text-white px-2 py-1 rounded">{item.amount} SOL</span>
                                    <span className="bg-blue-600 text-white px-2 py-1 rounded">{item.fees}% fees</span>
                                    <span className={`px-2 py-1 rounded ${item.mevProtection ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                                        {item.mevProtection ? '🛡️ MEV' : '❌ No MEV'}
                                    </span>
                                    {item.soundNotification && (
                                        <span className="bg-yellow-600 text-white px-2 py-1 rounded">🔊 {item.soundNotification}</span>
                                    )}
                                </div>
                                {item.createdAt && (
                                    <p className="text-gray-400 text-xs mt-1">
                                        Added: {new Date(item.createdAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => removeListItem(listType, item.id)}
                                className="ml-0 md:ml-2 p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors self-end md:self-center"
                                title="Remove from Firebase and local storage"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Enhanced list footer with Firebase info */}
            <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>
                        {lists[listType].length} entries •
                        {botStatus.stats.isFirebaseLoaded ? ' Synced to Firebase' : ' Syncing to Firebase...'}
                    </span>
                    <span className="flex items-center space-x-1">
                        <div className={`w-2 h-2 rounded-full ${botStatus.stats.isFirebaseLoaded ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                        <span>{botStatus.stats.isFirebaseLoaded ? 'Firebase Ready' : 'Firebase Syncing'}</span>
                    </span>
                </div>
            </div>
        </div>
    );


    const renderLists = () => (
        <div className="space-y-4 md:space-y-6">
            {/* Enhanced Firebase Controls */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-4">
                    <div>
                        <h2 className="text-lg md:text-xl font-semibold text-white">Admin Lists Management</h2>
                        <p className="text-sm text-gray-400">Manage Primary (auto-snipe) and Secondary (notify) admin lists with Firebase sync</p>
                    </div>
                    <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4">
                        <button
                            onClick={syncAdminListsFromFirebase}
                            className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                        >
                            🔄 Sync from Firebase
                        </button>
                        <button
                            onClick={getFirebaseAdminLists}
                            className="w-full md:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                        >
                            📥 Load Firebase Data
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                        <div className="text-purple-400 font-semibold">{botStatus.stats.primaryAdmins}</div>
                        <div className="text-gray-400">Primary Admins</div>
                    </div>
                    <div className="text-center">
                        <div className="text-orange-400 font-semibold">{botStatus.stats.secondaryAdmins}</div>
                        <div className="text-gray-400">Secondary Admins</div>
                    </div>
                    <div className="text-center">
                        <div className={`font-semibold ${botStatus.stats.isFirebaseLoaded ? 'text-green-400' : 'text-yellow-400'}`}>
                            {botStatus.stats.isFirebaseLoaded ? 'SYNCED' : 'SYNCING'}
                        </div>
                        <div className="text-gray-400">Firebase Status</div>
                    </div>
                    <div className="text-center">
                        <div className="text-blue-400 font-semibold">{botStatus.stats.primaryAdmins + botStatus.stats.secondaryAdmins}</div>
                        <div className="text-gray-400">Total Entries</div>
                    </div>
                </div>
            </div>

            {/* Enhanced List Sections with Firebase controls */}
            <div className="grid gap-4 md:gap-6">
                {renderEnhancedListSection('primary_admins', 'Primary Admins (Auto-Snipe)', <Users className="text-purple-400" size={20} />)}
                {renderEnhancedListSection('secondary_admins', 'Secondary Admins (Notify)', <Bell className="text-orange-400" size={20} />)}
            </div>

            {showAddForm.show && renderAddForm(showAddForm.type)}
        </div>
    );

    // === END OF PART 8 === //
    // === START OF PART 9: MAIN APP COMPONENT === //

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Mobile-responsive Header */}
            <header className="bg-gray-800 border-b border-gray-700 px-4 md:px-6 py-3 md:py-4">
                <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0">
                    <h1 className="text-xl md:text-2xl font-bold text-white">DevScope Enhanced</h1>
                    <div className="flex flex-wrap items-center gap-2 md:space-x-4">
                        {renderStatusIndicator()}
                        <div className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm ${botStatus.isRunning ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                            }`}>
                            {botStatus.isRunning ? 'RUNNING' : 'STOPPED'}
                        </div>
                        {settings.detectionOnlyMode && (
                            <div className="px-2 md:px-3 py-1 rounded-full text-xs md:text-sm bg-green-600 text-white">
                                DETECTION ONLY
                            </div>
                        )}
                        {settings.enableCommunityReuse && (
                            <div className="px-2 md:px-3 py-1 rounded-full text-xs md:text-sm bg-orange-600 text-white">
                                COMMUNITY TRACKING
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Enhanced Navigation */}
            <nav className="bg-gray-800 border-b border-gray-700 overflow-x-auto">
                <div className="px-4 md:px-6">
                    <div className="flex space-x-4 md:space-x-8 min-w-max">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`py-3 md:py-4 px-2 border-b-2 transition-colors whitespace-nowrap text-sm md:text-base ${activeTab === 'dashboard'
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            📊 Dashboard
                        </button>
                        <button
                            onClick={() => setActiveTab('detected')}
                            className={`py-3 md:py-4 px-2 border-b-2 transition-colors whitespace-nowrap text-sm md:text-base ${activeTab === 'detected'
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            🎯 Detected Tokens
                            {detectedTokens.length > 0 && (
                                <span className="ml-1 md:ml-2 bg-green-600 text-white text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full">
                                    {detectedTokens.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('lists')}
                            className={`py-3 md:py-4 px-2 border-b-2 transition-colors whitespace-nowrap text-sm md:text-base ${activeTab === 'lists'
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            📋 Lists
                        </button>
                        <button
                            onClick={() => setActiveTab('communities')}
                            className={`py-3 md:py-4 px-2 border-b-2 transition-colors whitespace-nowrap text-sm md:text-base ${activeTab === 'communities'
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            🏘️ Communities
                            {usedCommunities.length > 0 && (
                                <span className="ml-1 md:ml-2 bg-yellow-600 text-white text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full">
                                    {usedCommunities.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`py-3 md:py-4 px-2 border-b-2 transition-colors whitespace-nowrap text-sm md:text-base ${activeTab === 'settings'
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            ⚙️ Settings
                        </button>
                        <button
                            onClick={() => setActiveTab('demo')}
                            className={`py-3 md:py-4 px-2 border-b-2 transition-colors whitespace-nowrap text-sm md:text-base ${activeTab === 'demo'
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            🧪 Demo
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content with mobile padding */}
            <main className="p-4 md:p-6">
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'detected' && renderDetectedTokens()}
                {activeTab === 'lists' && renderLists()}
                {activeTab === 'communities' && renderCommunityManagement()}
                {activeTab === 'demo' && renderDemoTab()}
                {activeTab === 'settings' && (
                    <div className="space-y-6">
                        {renderSettings()}
                        {renderGlobalSnipeSettings()}
                    </div>
                )}
            </main>

            {/* Enhanced Popups */}
            {renderSecondaryPopup()}

            {/* Footer Info */}
            <footer className="bg-gray-800 border-t border-gray-700 px-4 md:px-6 py-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
                    <div className="text-xs text-gray-400">
                        DevScope Enhanced v2.1 - Firebase Admin Lists & Advanced Twitter Community Detection
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-gray-400">
                        <div className="flex items-center space-x-1">
                            <span>🎯 Primary:</span>
                            <span className="text-purple-400 font-medium">{botStatus.stats.primaryAdmins}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <span>🔔 Secondary:</span>
                            <span className="text-orange-400 font-medium">{botStatus.stats.secondaryAdmins}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <span>🏘️ Communities:</span>
                            <span className="text-white font-medium">{usedCommunities.length}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <span>🔥 Firebase:</span>
                            <span className={`font-medium ${botStatus.stats.isFirebaseLoaded ? 'text-green-400' : 'text-yellow-400'}`}>
                                {botStatus.stats.isFirebaseLoaded ? 'SYNCED' : 'SYNCING'}
                            </span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <span>📊 Connection:</span>
                            <span className={`font-medium ${connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
                                {connectionStatus.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default App;

