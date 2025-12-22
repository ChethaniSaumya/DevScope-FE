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
    Clock,
    AlertCircle,
    CheckCircle2,
    Info
} from 'lucide-react';

import './App.css';
import SnipeTest from './components/SnipeTest';

const API_BASE = 'https://devscope.fun:3002/api';
//const API_BASE = 'https://devscope.fun:3002/api';

const openedTokens = new Set();

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
    const [isSavingGlobalSettings, setIsSavingGlobalSettings] = useState(false);

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
    const [amountUpdateMode, setAmountUpdateMode] = useState('all_existing');
    const [serverGlobalSettings, setServerGlobalSettings] = useState({
        amount: 0,
        fees: 0,
        priorityFee: 0,
        mevProtection: false,
        soundNotification: 'system_beep'
    });
    const [openedTokens, setOpenedTokens] = useState(new Set());

    const [usedCommunities, setUsedCommunities] = useState([]);
    const [usedTweets, setUsedTweets] = useState([]);
    const [customTweet, setCustomTweet] = useState('');
    const [showCommunityModal, setShowCommunityModal] = useState(false);
    const [customCommunity, setCustomCommunity] = useState('');
    const [soundFiles, setSoundFiles] = useState([]);
    const [uploadingSound, setUploadingSound] = useState(false);
    const [isCommunity, setIsCommunity] = useState(false);
    const [twitterSessionStatus, setTwitterSessionStatus] = useState({
        initialized: false,
        loggedIn: false,
        url: '',
        error: null,
        checking: false,
        apiCreditsExhausted: false, // NEW
        apiError: null,             // NEW
        lastApiError: null
    });

    const [popupBlockerModal, setPopupBlockerModal] = useState({
        show: false,
        tokenUrl: '',
        tokenAddress: '',
        reason: ''
    });

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
            enablePrimaryDetection: true,
            enableSecondaryDetection: true,
            detectionOnlyMode: true,
            globalSnipeSettings: {
                amount: 0.01,
                fees: 10,
                mevProtection: true,
                soundNotification: 'default.wav',
                priorityFee: 0.0005
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
        { value: 'none', label: '🔇 No Sound', file: null },
        // Add uploaded sounds
        ...soundFiles.map(file => ({
            value: file.filename,
            label: `🎵 ${file.originalName || file.filename}`,
            file: file.filename,
            isUploaded: true
        }))
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

                // Determine the correct URL path for the audio file
                let audioUrl;

                // Check if it's an uploaded custom sound (contains 'sound-' prefix)
                if (soundFile.includes('sound-')) {
                    console.log('🔊 Playing uploaded custom sound');
                    audioUrl = `${API_BASE}/sounds/${soundFile}`;
                } else {
                    console.log('🔊 Playing built-in sound');
                    audioUrl = `/sounds/${soundFile}`;
                }

                console.log('🔊 Audio file URL:', audioUrl);

                // Try to play HTML5 audio
                const audio = new Audio(audioUrl);
                console.log('🔊 Audio element created:', audio);

                audio.volume = 0.5;
                console.log('🔊 Audio volume set to:', audio.volume);

                // Add event listeners for debugging
                audio.addEventListener('loadstart', () => console.log('🔊 Audio: loadstart'));
                audio.addEventListener('loadeddata', () => console.log('🔊 Audio: loadeddata'));
                audio.addEventListener('canplay', () => console.log('🔊 Audio: canplay'));
                audio.addEventListener('play', () => console.log('🔊 Audio: play event'));
                audio.addEventListener('ended', () => console.log('🔊 Audio: ended'));
                audio.addEventListener('error', (e) => {
                    console.error('❌ Audio error event:', e);
                    console.error('❌ Audio error details:', {
                        error: audio.error,
                        networkState: audio.networkState,
                        readyState: audio.readyState,
                        currentSrc: audio.currentSrc
                    });
                });

                console.log('🔊 Calling audio.play()...');

                audio.play().then(() => {
                    console.log('✅ Audio.play() promise resolved successfully');
                    const soundDisplayName = soundFile.includes('sound-') ?
                        `custom sound (${soundFile})` : soundFile;
                    addNotification('success', `🔊 Playing ${soundDisplayName}`);
                }).catch(error => {
                    console.error('❌ Audio.play() promise rejected:', error);
                    console.log('🔊 Falling back to system beep...');

                    // Fallback to system beep for both built-in and custom sounds
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
                                playFallbackBeep(context, soundFile);
                            }).catch(err => {
                                console.error('❌ Failed to resume fallback AudioContext:', err);
                                addNotification('error', '❌ Failed to play sound');
                            });
                        } else {
                            playFallbackBeep(context, soundFile);
                        }

                        function playFallbackBeep(ctx, originalSoundFile) {
                            const oscillator = ctx.createOscillator();
                            const gainNode = ctx.createGain();

                            oscillator.connect(gainNode);
                            gainNode.connect(ctx.destination);

                            // Different tones for different sound types
                            if (originalSoundFile.includes('success')) {
                                oscillator.frequency.value = 800; // Higher pitch for success
                                gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
                            } else if (originalSoundFile.includes('alert')) {
                                oscillator.frequency.value = 400; // Lower pitch for alerts
                                gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
                            } else if (originalSoundFile.includes('chime')) {
                                oscillator.frequency.value = 1000; // Even higher for chimes
                                gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
                            } else if (originalSoundFile.includes('sound-')) {
                                oscillator.frequency.value = 600; // Custom sound fallback
                                gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
                            } else {
                                oscillator.frequency.value = 600; // Default fallback
                                gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
                            }

                            oscillator.type = 'square';
                            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

                            oscillator.start(ctx.currentTime);
                            oscillator.stop(ctx.currentTime + 0.3);

                            console.log('🔊 Fallback beep played for:', originalSoundFile);

                            const fallbackMessage = originalSoundFile.includes('sound-') ?
                                `🔊 Playing fallback beep (custom sound "${soundFile}" not accessible)` :
                                `🔊 Playing fallback beep ("${soundFile}" not found)`;

                            addNotification('info', fallbackMessage);
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

    // Twitter session management functions
    const checkTwitterSession = async () => {
        try {
            setTwitterSessionStatus(prev => ({ ...prev, checking: true }));
            const response = await apiCall('/twitter-session-status');
            setTwitterSessionStatus({
                ...response,
                checking: false
            });

            if (response.loggedIn) {
                addNotification('success', '✅ Twitter session is active');
            } else {
                addNotification('info', '🔑 Twitter session not active - manual login required');
            }
        } catch (error) {
            setTwitterSessionStatus(prev => ({
                ...prev,
                checking: false,
                error: error.message
            }));
            addNotification('error', 'Failed to check Twitter session status');
        }
    };

    const openTwitterLogin = async () => {
        try {
            setTwitterSessionStatus(prev => ({ ...prev, checking: true }));

            const response = await apiCall('/twitter-open-login', { method: 'POST' });

            addNotification('success', '🔐 Automatic Twitter login successful');

            // Check session status immediately
            setTimeout(() => {
                checkTwitterSession();
            }, 2000);

        } catch (error) {
            addNotification('error', 'Automatic login failed - check server credentials');
            setTwitterSessionStatus(prev => ({ ...prev, checking: false }));
        }
    };

    const openTokenPageWithTiming = async (tokenAddress, url, source) => {
        const browserOpenStart = performance.now();

        // Get timing data from backend response
        const response = await apiCall(`/pair-address/${tokenAddress}`);
        const backendTiming = response.timing;

        if (window.electronAPI && window.electronAPI.openExternalURL) {
            window.electronAPI.openExternalURL(url);
        } else {
            window.open(url, '_blank');
        }

        const browserOpenEnd = performance.now();
        const browserOpenTime = browserOpenEnd - browserOpenStart;

        // Calculate total time from initial detection to browser open
        const totalTime = backendTiming?.totalFromDetection + browserOpenTime;

        console.log(`⏱️ COMPLETE END-TO-END TIMING:`);
        console.log(`   - Token Detection to Processing: ${backendTiming?.detectionToProcessing}ms`);
        console.log(`   - Token Processing Duration: ${backendTiming?.processingTime}ms`);
        console.log(`   - API Request Duration: ${backendTiming?.requestDuration}ms`);
        console.log(`   - Browser Open Duration: ${browserOpenTime.toFixed(2)}ms`);
        console.log(`   - TOTAL: Token Detection to Axiom Open: ${totalTime?.toFixed(2)}ms`);

        return {
            totalTime,
            breakdown: {
                detectionToProcessing: backendTiming?.detectionToProcessing,
                processingTime: backendTiming?.processingTime,
                apiRequestTime: backendTiming?.requestDuration,
                browserOpenTime,
                source
            }
        };
    };

    // WebSocket connection
    const connectWebSocket = useCallback(() => {
        try {
            const ws = new WebSocket('wss://devscope.fun:3002');
            //const ws = new WebSocket('wss://devscope.fun:3002');

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
        checkTwitterSession();
    }, []);

    useEffect(() => {
        fetchStatus();
        fetchLists();
        fetchDetectedTokens();
        fetchUsedCommunities();
        fetchUsedTweets();
        fetchSoundFiles();
        connectWebSocket();

        return () => {
            if (websocket) {
                websocket.close();
            }
        };
    }, []);

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
                customCommunity: customCommunity || null,
                customTweet: customTweet || null, // ADD THIS LINE
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

    const [formData, setFormData] = useState(() => ({
        address: '',
        username: '',
        amount: settings.globalSnipeSettings.amount,
        fees: settings.globalSnipeSettings.fees,
        mevProtection: settings.globalSnipeSettings.mevProtection,
        soundNotification: settings.globalSnipeSettings.soundNotification
    }));
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

    const fetchUsedTweets = async () => {
        try {
            const data = await apiCall('/firebase/used-tweets');
            setUsedTweets(data.tweets || []);
            addNotification('success', `📊 Loaded ${data.tweets.length} used tweets from Firebase`);
        } catch (error) {
            console.error('Failed to fetch used tweets');
            addNotification('error', '❌ Failed to fetch used tweets from Firebase');
        }
    };

    const clearUsedTweets = async () => {
        try {
            await apiCall('/firebase/used-tweets', { method: 'DELETE' });
            setUsedTweets([]);
            addNotification('success', '🗑️ All used tweets cleared from Firebase');
        } catch (error) {
            addNotification('error', '❌ Failed to clear used tweets');
        }
    };

    const removeUsedTweet = async (tweetId) => {
        try {
            await apiCall(`/firebase/used-tweets/${tweetId}`, { method: 'DELETE' });
            setUsedTweets(prev => prev.filter(t => t.id !== tweetId));
            addNotification('success', `🗑️ Tweet ${tweetId} removed from Firebase`);
        } catch (error) {
            addNotification('error', '❌ Failed to remove tweet');
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

    const [insufficientFundsModal, setInsufficientFundsModal] = useState({
        show: false,
        tokenAddress: '',
        needed: 0,
        available: 0,
        shortfall: 0
    });

    // Add to your existing state declarations:
    const [slippageErrorPopup, setSlippageErrorPopup] = useState({
        show: false,
        tokenAddress: '',
        error: '',
        tokenData: null,
        needed: 0,
        currentPrice: 0
    });

    const handleWebSocketMessage = (data) => {
        console.log('📨 WebSocket message received:', data.type, data);

        switch (data.type) {
            case 'bot_status':
                setBotStatus(prev => ({ ...prev, isRunning: data.data.isRunning }));
                break;

            case 'logs':
                console.log('Server log:', data.data);
                break;

            // In handleWebSocketMessage function:
            case 'snipe_error':
                console.log('❌ Snipe error received:', data.data);

                // Check for slippage error specifically
                if (data.data.error && data.data.error.includes('Too much SOL required') ||
                    data.data.error.includes('custom program error: 6002')) {

                    // Show slippage error popup
                    setSlippageErrorPopup({
                        show: true,
                        tokenAddress: data.data.tokenAddress,
                        error: data.data.error,
                        tokenData: data.data.tokenData || null,
                        needed: data.data.needed || 0,
                        currentPrice: data.data.currentPrice || 0
                    });

                    addNotification('error',
                        `💰 Slippage Error: ${data.data.tokenAddress.substring(0, 8)}...\n` +
                        `Token price moved too fast!`
                    );

                } else if (data.data.errorType === 'insufficient_funds') {
                    // Existing insufficient funds handling...
                } else if (data.data.errorType === 'detection_only_mode') {
                    // Existing detection only mode handling...
                } else {
                    // Generic error handling
                    addNotification('error', `❌ Snipe failed: ${data.data.error}`);
                }
                break;

            // In handleWebSocketMessage function, ADD this case:
            case 'transaction_failed':
                console.log('❌ Transaction failed:', data.data);

                // Check if it's a slippage error
                if (data.data.errorCode === 6002 ||
                    (data.data.error && (data.data.error.includes('6002') || data.data.error.includes('Too much SOL required')))) {

                    // Find the token data if we have it
                    const tokenData = detectedTokens.find(t => t.tokenAddress === data.data.tokenAddress);

                    setSlippageErrorPopup({
                        show: true,
                        tokenAddress: data.data.tokenAddress,
                        error: data.data.error,
                        tokenData: tokenData || null,
                        needed: 0,
                        currentPrice: 0
                    });

                    addNotification('error', `❌ Slippage Error: ${data.data.tokenAddress?.substring(0, 8)}...`);
                } else {
                    // Other transaction failures
                    addNotification('error', `❌ Transaction Failed: ${data.data.error || 'Unknown error'}`);
                }
                break;
            case 'open_dual_windows':
                console.log('🚀 DUAL WINDOW OPEN COMMAND RECEIVED');
                /*const window1Url = data.data.window1.url;
                const window2Url = data.data.window2.url;

                // Open first window
                if (window.electronAPI && window.electronAPI.openExternalURL) {
                    window.electronAPI.openExternalURL(window1Url);
                } else {
                    window.open(window1Url, '_blank');
                }

                // Wait 100ms, then open second window
                setTimeout(() => {
                    if (window.electronAPI && window.electronAPI.openExternalURL) {
                        window.electronAPI.openExternalURL(window2Url);
                    } else {
                        window.open(window2Url, '_blank');
                    }
                }, 100);

                console.log('✅ Both windows opened');*/
                break;

            case 'pair_address_not_found':
                console.log('❌ Pair address not found after retries');
                addNotification('error', `❌ Could not find pair address for token after ${data.data.attempts} attempts`);

                // Optionally show a modal or alert
                alert(`Failed to find pair address for token ${data.data.tokenAddress.substring(0, 8)}... after ${data.data.attempts} attempts`);
                break;

            case 'auto_open_token_page':
                console.log('\n' + '='.repeat(80));
                console.log('🚀 AUTO-OPEN TOKEN PAGE MESSAGE RECEIVED');
                console.log('='.repeat(80));
                console.log('📦 Full message data:', JSON.stringify(data.data, null, 2));
                console.log('🔗 Token Page URL:', data.data.tokenPageUrl);
                console.log('🏷️ Address Type:', data.data.addressType);
                console.log('📍 Address:', data.data.address);
                console.log('🦎 Platform:', data.data.platform);
                console.log('❓ Reason:', data.data.reason);
                console.log('='.repeat(80) + '\n');

                const tokenPageUrl = data.data.tokenPageUrl;

                // Check if URL is valid
                if (!tokenPageUrl || !tokenPageUrl.startsWith('http')) {
                    console.error('❌ Invalid URL received:', tokenPageUrl);
                    addNotification('error', '❌ Invalid token page URL received');
                    break;
                }

                // Check if electronAPI exists
                console.log('🔍 Checking for Electron API...');
                console.log('   window.electronAPI exists:', !!window.electronAPI);
                console.log('   window.electronAPI.openExternalURL exists:', !!(window.electronAPI?.openExternalURL));

                setTimeout(() => {
                    if (window.electronAPI && window.electronAPI.openExternalURL) {
                        console.log('🖥️ USING ELECTRON API TO OPEN URL');
                        try {
                            window.electronAPI.openExternalURL(tokenPageUrl);
                            console.log('✅ Electron API call successful');
                            addNotification('success', `🚀 Opening ${data.data.platform || 'token page'} via Electron`);
                        } catch (error) {
                            console.error('❌ Electron API error:', error);
                            addNotification('error', `❌ Failed to open: ${error.message}`);
                        }
                    } else {
                        console.log('🌐 USING BROWSER WINDOW.OPEN()');
                        console.log('   Attempting to open:', tokenPageUrl);

                        try {
                            const newWindow = window.open(tokenPageUrl, '_blank', 'noopener,noreferrer');
                            console.log('   window.open() returned:', newWindow);

                            if (!newWindow || newWindow.closed) {
                                console.error('❌ POPUP BLOCKED BY BROWSER!');
                                console.error('   Browser prevented the popup from opening');

                                addNotification('error', '🚫 Browser blocked popup - Click "Allow" in address bar');

                                setPopupBlockerModal({
                                    show: true,
                                    tokenUrl: tokenPageUrl,
                                    tokenAddress: data.data.tokenAddress,
                                    reason: 'Browser popup blocker is active'
                                });
                            } else {
                                console.log('✅ WINDOW OPENED SUCCESSFULLY');
                                addNotification('success', `🚀 ${data.data.platform || 'Token page'} opened`);
                            }
                        } catch (error) {
                            console.error('❌ window.open() threw error:', error);
                            addNotification('error', `❌ Failed to open window: ${error.message}`);
                        }
                    }
                }, 100);

                break;

            case 'secondary_notification':
                addNotification('info', `🔔 Token found in secondary list: ${data.data.tokenAddress.substring(0, 8)}...`);
                if (data.data.soundNotification && window.electronAPI) {
                    window.electronAPI.playSound(data.data.soundNotification);
                }
                break;

            case 'token_detected':
                console.log('📱 FRONTEND RECEIVED TOKEN DATA:');
                console.log('Platform:', data.data.platform);
                console.log('Has GeckoTerminal Data:', data.data.hasGeckoTerminalData);
                console.log('Full token object received by frontend:', data.data);
                console.log('Name displayed:', data.data.name);
                console.log('Symbol displayed:', data.data.symbol);
                console.log('Image URI:', data.data.uri);
                console.log('Description:', data.data.description);
                console.log('================================================');

                // ✅ CRITICAL FIX: Ensure config is properly included
                const tokenDataWithConfig = {
                    ...data.data,
                    // Make sure config is included and has all required fields
                    config: data.data.config || {
                        amount: settings.globalSnipeSettings.amount,
                        fees: settings.globalSnipeSettings.fees,
                        priorityFee: settings.globalSnipeSettings.priorityFee,
                        mevProtection: settings.globalSnipeSettings.mevProtection,
                        soundNotification: settings.globalSnipeSettings.soundNotification
                    }
                };

                setDetectedTokens(prev => {
                    const exists = prev.some(token => token.tokenAddress === data.data.tokenAddress);
                    if (exists) {
                        console.log(`Token ${data.data.tokenAddress} already exists, skipping duplicate`);
                        return prev;
                    }
                    return [tokenDataWithConfig, ...prev.slice(0, 99)];
                });

                const matchTypeText = {
                    'primary_wallet': '🎯 Primary Wallet',
                    'primary_admin': '🎯 Primary Admin',
                    'secondary_wallet': '🔔 Secondary Wallet',
                    'secondary_admin': '🔔 Secondary Admin',
                    'snipe_all': '⚡ Snipe All',
                    'no_filters': '📢 No Filters'
                };

                const twitterInfo = data.data.twitterType === 'community'
                    ? `(Community ${data.data.twitterCommunityId})`
                    : data.data.twitterHandle
                        ? `(@${data.data.twitterHandle})`
                        : '';

                addNotification('info', `${matchTypeText[data.data.matchType] || '🔍 Match'} ${data.data.name || data.data.symbol} ${twitterInfo}`);

                if (data.data.config && data.data.config.soundNotification && window.electronAPI) {
                    window.electronAPI.playSound(data.data.config.soundNotification);
                }

                // ✅ PRIMARY MATCH HANDLING - Ensure config is passed correctly
                if (data.data.matchType === 'primary_wallet' || data.data.matchType === 'primary_admin') {
                    console.log('🎯 PRIMARY MATCH DETECTED - SHOWING POPUP + AUTO-OPENING WINDOW');

                    if (openedTokens.has(data.data.tokenAddress)) {
                        console.log(`⛔ Already opened browser for ${data.data.tokenAddress}`);
                        break; // ✅ Use 'break' not 'return' since we're in a switch statement
                    }

                    // Mark as opened FIRST
                    setOpenedTokens(prev => new Set(prev).add(data.data.tokenAddress));

                    // NOW define tokenData
                    const tokenData = {
                        ...data.data,
                        config: data.data.config || {
                            amount: settings.globalSnipeSettings.amount,
                            fees: settings.globalSnipeSettings.fees,
                            priorityFee: settings.globalSnipeSettings.priorityFee,
                            mevProtection: settings.globalSnipeSettings.mevProtection,
                            soundNotification: settings.globalSnipeSettings.soundNotification
                        }
                    };

                    // Show popup for ALL primary matches (demo and real)
                    setSecondaryPopup({
                        show: true,
                        tokenData: tokenData,
                        globalSettings: settings.globalSnipeSettings,
                        isPrimary: true
                    });

                    addNotification('info', `🎯 Primary match: ${tokenData.tokenAddress.substring(0, 8)}...`);

                    // For DEMO tokens: Trigger manual snipe
                    if (tokenData.isDemo) {
                        console.log('🧪 DEMO PRIMARY - Triggering snipe');
                        setTimeout(async () => {
                            try {
                                await apiCall(`/snipe-with-global-settings/${tokenData.tokenAddress}`, { method: 'POST' });
                                addNotification('success', `🧪 Demo token sniped: ${tokenData.tokenAddress.substring(0, 8)}...`);
                            } catch (error) {
                                addNotification('error', `❌ Demo snipe failed: ${error.message}`);
                            }
                        }, 100);
                    }

                    // Auto-open window after 500ms (for both demo and real)
                    setTimeout(async () => {
                        let autoOpenUrl;
                        const token = tokenData;

                        // Determine URL based on user's tokenPageDestination setting
                        if (settings.tokenPageDestination === 'axiom') {
                            // For demo tokens, just use token address
                            if (token.isDemo) {
                                autoOpenUrl = `https://axiom.trade/meme/${token.tokenAddress}`;
                                console.log(`🧪 Demo Primary: Opening Axiom with token address`);
                            } else {
                                // For real tokens, fetch bonding curve/pair
                                try {
                                    const response = await fetch(`${API_BASE}/pair-address/${token.tokenAddress}`);
                                    const addressData = await response.json();

                                    if (addressData.success) {
                                        if (addressData.bondingCurveData?.bondingCurveAddress) {
                                            autoOpenUrl = `https://axiom.trade/meme/${addressData.bondingCurveData.bondingCurveAddress}`;
                                            console.log(`✅ Real Primary: Using bonding curve: ${addressData.bondingCurveData.bondingCurveAddress}`);
                                        } else if (addressData.pairData?.pairAddress) {
                                            autoOpenUrl = `https://axiom.trade/meme/${addressData.pairData.pairAddress}`;
                                            console.log(`✅ Real Primary: Using pair address: ${addressData.pairData.pairAddress}`);
                                        } else {
                                            autoOpenUrl = `https://axiom.trade/meme/${token.tokenAddress}`;
                                            console.log(`⚠️ Real Primary: No address found, using token address`);
                                        }
                                    } else {
                                        autoOpenUrl = `https://axiom.trade/meme/${token.tokenAddress}`;
                                    }
                                } catch (error) {
                                    console.error(`❌ Error fetching address:`, error);
                                    autoOpenUrl = `https://axiom.trade/meme/${token.tokenAddress}`;
                                }
                            }
                        } else {
                            // Neo BullX destination
                            autoOpenUrl = `https://neo.bullx.io/terminal?chainId=1399811149&address=${token.tokenAddress}`;
                            console.log(`✅ Primary: Opening Neo BullX`);
                        }

                        console.log(`🔗 PRIMARY AUTO-OPEN URL: ${autoOpenUrl}`);

                        // Open the URL
                        if (window.electronAPI && window.electronAPI.openExternalURL) {
                            window.electronAPI.openExternalURL(autoOpenUrl);
                            console.log('🖥️ Primary: Opened via Electron');
                        } else {
                            const newWindow = window.open(autoOpenUrl, '_blank');
                            if (newWindow) {
                                console.log('✅ Primary: Browser opened');
                            } else {
                                console.error('❌ Primary: Popup blocked');
                                addNotification('warning', '🚫 Auto-open blocked by browser');
                            }
                        }

                        addNotification('success', '🚀 Token page opened automatically!');
                    }, 500);

                    // Clear from opened set after 30 seconds
                    setTimeout(() => {
                        setOpenedTokens(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(data.data.tokenAddress); // ✅ Use data.data.tokenAddress
                            return newSet;
                        });
                    }, 30000);
                }
                break;

            case 'secondary_popup_trigger':
                console.log('🔔 SECONDARY ADMIN MATCH DETECTED');
                console.log('📊 Token data:', data.data.tokenData);

                // ✅ CRITICAL FIX: Ensure config is included
                const tokenData = {
                    ...data.data.tokenData,
                    config: data.data.tokenData.config || {
                        amount: settings.globalSnipeSettings.amount,
                        fees: settings.globalSnipeSettings.fees,
                        priorityFee: settings.globalSnipeSettings.priorityFee,
                        mevProtection: settings.globalSnipeSettings.mevProtection,
                        soundNotification: settings.globalSnipeSettings.soundNotification
                    }
                };

                setSecondaryPopup({
                    show: true,
                    tokenData: tokenData, // ✅ Use tokenData with config
                    globalSettings: data.data.globalSnipeSettings
                });

                addNotification('info', `🔔 Secondary match found: ${tokenData.tokenAddress.substring(0, 8)}...`);

                setTimeout(async () => {
                    let autoOpenUrl;
                    const token = tokenData;

                    // Determine URL based on user's tokenPageDestination setting
                    if (settings.tokenPageDestination === 'axiom') {

                        // Check if it's a Pump.fun token
                        if (token.platform === 'pumpfun' || token.pool === 'pump') {
                            // Use bonding curve for Pump.fun
                            if (token.bondingCurveAddress) {
                                autoOpenUrl = `https://axiom.trade/meme/${token.bondingCurveAddress}`;
                                console.log(`✅ SECONDARY: Using bonding curve: ${token.bondingCurveAddress}`);
                            } else {
                                autoOpenUrl = `https://axiom.trade/meme/${token.tokenAddress}`;
                                console.log(`⚠️ SECONDARY: No bonding curve, using token address`);
                            }
                        }
                        // Check if it's a Let's Bonk token
                        else if (token.platform === 'letsbonk' || token.pool === 'bonk') {
                            console.log(`🦎 SECONDARY: Let's Bonk token, fetching pair address...`);

                            try {
                                const response = await fetch(`${API_BASE}/pair-address/${token.tokenAddress}`);
                                const data = await response.json();

                                if (data.success && data.pairData?.pairAddress) {
                                    autoOpenUrl = `https://axiom.trade/meme/${data.pairData.pairAddress}`;
                                    console.log(`✅ SECONDARY: Using pair address: ${data.pairData.pairAddress}`);
                                } else {
                                    autoOpenUrl = `https://axiom.trade/meme/${token.tokenAddress}`;
                                    console.log(`⚠️ SECONDARY: No pair found, using token address`);
                                }
                            } catch (error) {
                                console.error(`❌ SECONDARY: Error fetching pair:`, error);
                                autoOpenUrl = `https://axiom.trade/meme/${token.tokenAddress}`;
                            }
                        }
                        else {
                            // Unknown platform - use token address
                            autoOpenUrl = `https://axiom.trade/meme/${token.tokenAddress}`;
                            console.log(`⚠️ SECONDARY: Unknown platform, using token address`);
                        }
                    } else {
                        // Neo BullX destination
                        autoOpenUrl = `https://neo.bullx.io/terminal?chainId=1399811149&address=${token.tokenAddress}`;
                        console.log(`✅ SECONDARY: Opening Neo BullX`);
                    }

                    console.log(`🔗 SECONDARY AUTO-OPEN URL: ${autoOpenUrl}`);

                    // Open the URL
                    if (window.electronAPI && window.electronAPI.openExternalURL) {
                        window.electronAPI.openExternalURL(autoOpenUrl);
                        console.log('🖥️ SECONDARY: Opened via Electron');
                    } else {
                        const newWindow = window.open(autoOpenUrl, '_blank');
                        if (newWindow) {
                            console.log('✅ SECONDARY: Browser opened');
                        } else {
                            console.error('❌ SECONDARY: Popup blocked');
                            addNotification('warning', '🚫 Auto-open blocked by browser');
                        }
                    }

                    addNotification('success', '🚀 Token page opened automatically!');
                }, 500);

                break;

            case 'community_admin_match_found':
                console.log('🎯 COMMUNITY ADMIN MATCH FOUND!', data.data);

                const matchTypeIcon = data.data.matchType === 'primary' ? '🎯' : '🔔';
                addNotification('info', `${matchTypeIcon} Community admin match: ${data.data.matchedAdmin.username} in ${data.data.communityId}`);

                break;

            case 'community_scraping_error':
                console.log('❌ COMMUNITY SCRAPING ERROR:', data.data);

                if (data.data.reason === 'session_expired') {
                    addNotification('warning', '🔑 Twitter session expired - please login again');
                } else {
                    addNotification('warning', `❌ Community ${data.data.communityId} scraping failed: ${data.data.reason}`);
                }
                break;

            case 'community_admins_scraped':
                console.log('👑 COMMUNITY ADMINS SCRAPED:', data.data);
                console.table(data.data.admins);
                console.log('📋 Your Primary Admin List:', data.data.yourPrimaryList);
                console.log('📋 Your Secondary Admin List:', data.data.yourSecondaryList);

                console.log('🔍 DETAILED COMPARISON CHECK:');
                data.data.admins.forEach(admin => {
                    const adminLower = admin.username.toLowerCase().trim();
                    const adminWithAt = `@${adminLower}`;

                    const inPrimary = data.data.yourPrimaryList.some(item => {
                        const itemLower = item.toLowerCase().trim();
                        return itemLower === adminLower || itemLower === adminWithAt;
                    });

                    const inSecondary = data.data.yourSecondaryList.some(item => {
                        const itemLower = item.toLowerCase().trim();
                        return itemLower === adminLower || itemLower === adminWithAt;
                    });

                    console.log(`${inPrimary ? '🎯' : inSecondary ? '🔔' : '❌'} @${admin.username} - ${admin.badgeType} ${inPrimary ? '(PRIMARY MATCH!)' : inSecondary ? '(SECONDARY MATCH!)' : '(NO MATCH)'}`);
                });

                addNotification('info', `👑 Community ${data.data.communityId} scraped: ${data.data.totalAdmins} admins found - check console`);
                break;

            case 'twitter_session_check':
                console.log('🔍 Twitter session status:', data.data);
                setTwitterSessionStatus(prev => ({
                    ...prev,
                    ...data.data,
                    checking: false
                }));
                break;

            case 'twitter_login_attempt':
                console.log('🔑 Twitter login attempt:', data.data);
                if (data.data.success) {
                    addNotification('success', `✅ Twitter login successful: ${data.data.url}`);
                    setTwitterSessionStatus(prev => ({
                        ...prev,
                        loggedIn: true,
                        url: data.data.url,
                        error: null,
                        checking: false
                    }));
                } else {
                    addNotification('error', `❌ Twitter login failed: ${data.data.error}`);
                    setTwitterSessionStatus(prev => ({
                        ...prev,
                        loggedIn: false,
                        error: data.data.error,
                        checking: false
                    }));
                }
                break;

            default:
                console.log('Unknown WebSocket message type:', data.type);
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

        // Auto-remove after 5 minutes (300000ms) for all notification types
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
        }, 180000);
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

    const viewToken = async (token) => {
        console.log('🌐 Opening token page for:', token.tokenAddress);
        const viewTokenStart = performance.now();

        let url;

        // Check user's preference for token page destination
        if (settings.tokenPageDestination === 'axiom') {
            // 🔥 OPTIMIZED: Use stored bonding curve directly (no backend call)
            if (token.bondingCurveAddress) {
                console.log(`✅ Using stored bonding curve: ${token.bondingCurveAddress}`);
                url = `https://axiom.trade/meme/${token.bondingCurveAddress}`;

                const urlGenerationTime = performance.now() - viewTokenStart;
                console.log(`⚡ INSTANT URL GENERATION: ${urlGenerationTime.toFixed(2)}ms (from stored bonding curve)`);
            } else {
                // Fallback: use token address directly
                console.log(`⚠️ No stored bonding curve, using token address`);
                url = `https://axiom.trade/meme/${token.tokenAddress}`;
            }
        } else {
            // Neo BullX
            url = `https://neo.bullx.io/terminal?chainId=1399811149&address=${token.tokenAddress}`;
        }

        // Platform-specific overrides
        if (token.pool === 'bonk' && settings.tokenPageDestination !== 'axiom') {
            url = `https://letsbonk.fun/token/${token.tokenAddress}`;
        } else if (token.pool === 'pump' && settings.tokenPageDestination !== 'axiom') {
            url = `https://pump.fun/${token.tokenAddress}`;
        }

        const browserOpenStart = performance.now();

        // Open the URL
        if (window.electronAPI && window.electronAPI.openExternalURL) {
            window.electronAPI.openExternalURL(url);
        } else {
            window.open(url, '_blank');
        }

        const browserOpenTime = performance.now() - browserOpenStart;
        const totalTime = performance.now() - viewTokenStart;

        console.log(`⏱️ COMPLETE MANUAL TOKEN OPEN TIMING:`);
        console.log(`   URL Generation: ${(browserOpenStart - viewTokenStart).toFixed(2)}ms`);
        console.log(`   Browser Open: ${browserOpenTime.toFixed(2)}ms`);
        console.log(`   TOTAL: ${totalTime.toFixed(2)}ms`);

        addNotification('success', `🌐 Opening token page: ${url}`);
    };

    const viewTokenPageFromPopup = async (token) => {
        console.log('🌐 Opening token page from popup for:', token.tokenAddress);

        let url;

        if (settings.tokenPageDestination === 'axiom') {
            // Use stored bonding curve directly
            if (token.bondingCurveAddress) {
                url = `https://axiom.trade/meme/${token.bondingCurveAddress}`;
                console.log(`✅ Using bonding curve: ${token.bondingCurveAddress}`);
            } else {
                url = `https://axiom.trade/meme/${token.tokenAddress}`;
                console.log(`⚠️ Using token address (no bonding curve)`);
            }
        } else {
            url = `https://neo.bullx.io/terminal?chainId=1399811149&address=${token.tokenAddress}`;
        }

        // Platform-specific overrides
        if (token.pool === 'bonk' && settings.tokenPageDestination !== 'axiom') {
            url = `https://letsbonk.fun/token/${token.tokenAddress}`;
        } else if (token.pool === 'pump' && settings.tokenPageDestination !== 'axiom') {
            url = `https://pump.fun/${token.tokenAddress}`;
        }

        // Open URL
        if (window.electronAPI && window.electronAPI.openExternalURL) {
            window.electronAPI.openExternalURL(url);
        } else {
            window.open(url, '_blank');
        }

        addNotification('success', `🌐 Token page opened: ${url}`);
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

            // ✅ NEW: Store server's global settings separately
            if (data.settings.globalSnipeSettings) {
                setServerGlobalSettings(data.settings.globalSnipeSettings);
            }
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

    const hasBasicSettingsChanged = () => {
        return settings.privateKey !== originalSettings.privateKey ||
            settings.tokenPageDestination !== originalSettings.tokenPageDestination;
    };

    // ✅ Add this new helper function
    const hasDetectionSettingsChanged = () => {
        return settings.enablePrimaryDetection !== originalSettings.enablePrimaryDetection ||
            settings.enableSecondaryDetection !== originalSettings.enableSecondaryDetection;
    };

    const hasFilterSettingsChanged = () => {
        return settings.enableAdminFilter !== originalSettings.enableAdminFilter ||
            settings.enableCommunityReuse !== originalSettings.enableCommunityReuse ||
            settings.snipeAllTokens !== originalSettings.snipeAllTokens ||
            settings.detectionOnlyMode !== originalSettings.detectionOnlyMode ||
            settings.bonkTokensOnly !== originalSettings.bonkTokensOnly;
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

            // ✅ UPDATE ORIGINAL SETTINGS
            setOriginalSettings(prev => ({
                ...prev,
                ...newSettings
            }));

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

            // ✅ UPDATE ORIGINAL SETTINGS TO REFLECT SAVED STATE
            setOriginalSettings(prev => ({
                ...prev,
                ...filterSettings
            }));

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
            amount: settings.globalSnipeSettings.amount,
            fees: settings.globalSnipeSettings.fees,
            mevProtection: settings.globalSnipeSettings.mevProtection,
            soundNotification: settings.globalSnipeSettings.soundNotification,
            priorityFee: settings.globalSnipeSettings.priorityFee
        });
    };

    useEffect(() => {
        const fetchCurrentSettings = async () => {
            try {
                const response = await fetch(`${"https://devscope-be.onrender.com"}/api/status`);
                const data = await response.json();

                if (data.settings) {
                    const serverSettings = {
                        privateKey: data.settings.privateKey || '',                              // ✅ ADD
                        tokenPageDestination: data.settings.tokenPageDestination || 'neo_bullx', // ✅ ADD
                        enableAdminFilter: data.settings.enableAdminFilter ?? true,
                        enableCommunityReuse: data.settings.enableCommunityReuse ?? true,
                        snipeAllTokens: data.settings.snipeAllTokens ?? false,
                        detectionOnlyMode: data.settings.detectionOnlyMode ?? true,
                        bonkTokensOnly: data.settings.bonkTokensOnly ?? false,
                        enablePrimaryDetection: data.settings.enablePrimaryDetection ?? true,
                        enableSecondaryDetection: data.settings.enableSecondaryDetection ?? true
                    };

                    // Update both settings and originalSettings
                    setSettings(prev => ({ ...prev, ...serverSettings }));
                    setOriginalSettings(prev => ({ ...prev, ...serverSettings }));

                    console.log('✅ Synced with server settings:', serverSettings);
                }
            } catch (error) {
                console.error('❌ Failed to fetch server settings:', error);
                addNotification('warning', '⚠️ Could not sync with server settings');
            }
        };

        fetchCurrentSettings();
    }, []);

    // Effects
    useEffect(() => {
        fetchStatus();
        fetchLists();
        fetchDetectedTokens();
        // connectWebSocket();

        return () => {
            if (websocket) {
                websocket.close();
            }
        };
    }, [connectWebSocket]);
    // App.js - Part 5: Render Functions - Status and Dashboard

    // 4. Add global settings API calls
    const updateGlobalSnipeSettings = async (newSettings) => {
        console.log('🔧 Sending to server:', newSettings);

        try {
            const response = await apiCall('/global-snipe-settings', {
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
            saveToLocalStorage(STORAGE_KEYS.SETTINGS, updatedSettings);

            // ✅ NEW: Update server settings display from response
            if (response.globalSnipeSettings) {
                setServerGlobalSettings(response.globalSnipeSettings);
            }

            // ✅ ADD THIS: Refresh the admin lists to show updated values
            await fetchLists();

            addNotification('success', '✅ Global snipe settings updated and saved locally');
        } catch (error) {
            addNotification('error', '❌ Failed to update global snipe settings');
        }
    };

    // In App.js - Replace your existing snipeWithGlobalSettings function
    const snipeWithGlobalSettings = async (tokenAddress) => {
        const snipeStart = performance.now();

        try {
            // Get the token data from detectedTokens state
            const tokenData = detectedTokens.find(token => token.tokenAddress === tokenAddress);

            // ✅ CRITICAL FIX: Use individual config if available
            const configToUse = tokenData?.config || settings.globalSnipeSettings;

            console.log('🎯 SNIPE CONFIG DEBUG:');
            console.log('   Token Address:', tokenAddress);
            console.log('   Has Individual Config:', !!tokenData?.config);
            console.log('   Config Source:', tokenData?.config ? 'Individual Admin' : 'Global Settings');
            console.log('   Amount:', configToUse.amount, 'SOL');
            console.log('   Fees:', configToUse.fees, '%');
            console.log('   Priority Fee:', configToUse.priorityFee, 'SOL');
            console.log('   MEV Protection:', configToUse.mevProtection);

            const response = await apiCall(`/snipe-with-global-settings/${tokenAddress}`, {
                method: 'POST',
                body: JSON.stringify({
                    amount: configToUse.amount,
                    fees: configToUse.fees,
                    priorityFee: configToUse.priorityFee,
                    mevProtection: configToUse.mevProtection
                })
            });

            const snipeApiTime = performance.now() - snipeStart;
            console.log(`⏱️ SNIPE API TIME: ${snipeApiTime.toFixed(2)}ms`);

            const sourceText = tokenData?.config ? 'individual admin' : 'global settings';
            addNotification('success', `🎯 Token sniped using ${sourceText}: ${tokenAddress.substring(0, 8)}...`);

            setSecondaryPopup({ show: false, tokenData: null });


            // ✅ AUTOMATICALLY OPEN TOKEN PAGE AFTER SECONDARY SNIPE
            console.log('🌐 Auto-opening token page after secondary snipe...');

            // Use a small delay
            setTimeout(async () => {
                // ⏱️ START BROWSER TIMING FOR SECONDARY SNIPE
                const secondaryBrowserStart = performance.now();

                if (settings.tokenPageDestination === 'axiom') {
                    try {
                        const response = await apiCall(`/pair-address/${tokenAddress}`);

                        if (response.success && response.pairData && response.pairData.pairAddress) {
                            const axiomUrl = `https://axiom.trade/meme/${response.pairData.pairAddress}`;

                            if (window.electronAPI && window.electronAPI.openExternalURL) {
                                window.electronAPI.openExternalURL(axiomUrl);
                            } else {
                                const newWindow = window.open(axiomUrl, '_blank');
                                if (!newWindow || newWindow.closed) {
                                    addNotification('warning', '🚫 Browser blocked popup - Click "Allow" in address bar');
                                }
                            }

                            // ⏱️ LOG SECONDARY SNIPE BROWSER TIMING
                            const browserOpenTime = performance.now() - secondaryBrowserStart;
                            console.log(`⏱️ SECONDARY SNIPE BROWSER TIMING: ${browserOpenTime.toFixed(2)}ms`);
                            console.log(`   Total Snipe Time: ${(performance.now() - snipeStart).toFixed(2)}ms`);

                            addNotification('success', `🌐 Axiom opened automatically with pair: ${response.pairData.pairAddress.substring(0, 8)}...`);
                        } else {
                            const fallbackUrl = `https://axiom.trade/meme/${tokenAddress}`;
                            if (window.electronAPI && window.electronAPI.openExternalURL) {
                                window.electronAPI.openExternalURL(fallbackUrl);
                            } else {
                                const newWindow = window.open(fallbackUrl, '_blank');
                                if (!newWindow || newWindow.closed) {
                                    addNotification('warning', '🚫 Browser blocked popup - Click "Allow" in address bar');
                                }
                            }

                            // ⏱️ LOG FALLBACK BROWSER TIMING
                            const browserOpenTime = performance.now() - secondaryBrowserStart;
                            console.log(`⏱️ SECONDARY SNIPE FALLBACK BROWSER TIMING: ${browserOpenTime.toFixed(2)}ms`);

                            addNotification('warning', '🔍 No Bonding Curve found yet, opening Axiom with token address');
                        }
                    } catch (error) {
                        console.error('Error opening Axiom with pair:', error);
                        addNotification('error', '❌ Error opening token page');
                    }
                } else {
                    // Neo BullX
                    const neoBullxUrl = `https://neo.bullx.io/terminal?chainId=1399811149&address=${tokenAddress}`;
                    if (window.electronAPI && window.electronAPI.openExternalURL) {
                        window.electronAPI.openExternalURL(neoBullxUrl);
                    } else {
                        const newWindow = window.open(neoBullxUrl, '_blank');
                        if (!newWindow || newWindow.closed) {
                            addNotification('warning', '🚫 Browser blocked popup - Click "Allow" in address bar');
                        }
                    }

                    // ⏱️ LOG NEO BULLX BROWSER TIMING
                    const browserOpenTime = performance.now() - secondaryBrowserStart;
                    console.log(`⏱️ SECONDARY SNIPE NEO BULLX BROWSER TIMING: ${browserOpenTime.toFixed(2)}ms`);

                    addNotification('success', `🌐 Neo BullX opened automatically`);
                }
            }, 1000); // 1 second delay for secondary snipes

        } catch (error) {
            // ⏱️ LOG ERROR TIMING - NOW snipeStart IS ACCESSIBLE
            const errorTime = performance.now() - snipeStart;
            console.log(`⏱️ SECONDARY SNIPE ERROR TIME: ${errorTime.toFixed(2)}ms`);

            addNotification('error', `❌ Failed to snipe token: ${error.message}`);
        }
    };

    const uploadSoundFile = async (file) => {
        if (!file) return;

        console.log('🔧 uploadSoundFile called with:', file.name); // ADD THIS

        const formData = new FormData();
        formData.append('soundFile', file);

        try {
            setUploadingSound(true);
            console.log('🔧 Making API call to upload sound...'); // ADD THIS

            const response = await fetch(`${API_BASE}/upload-sound`, {
                method: 'POST',
                body: formData
            });

            console.log('🔧 API response status:', response.status); // ADD THIS

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const result = await response.json();
            console.log('🔧 API response data:', result); // ADD THIS

            // Refresh sound files list
            console.log('🔧 Calling fetchSoundFiles...'); // ADD THIS
            await fetchSoundFiles();

            addNotification('success', `🔊 Sound uploaded: ${result.filename}`);
            return result;
        } catch (error) {
            console.log('🔧 Upload error occurred:', error); // ADD THIS
            addNotification('error', `❌ Upload failed: ${error.message}`);
            throw error;
        } finally {
            setUploadingSound(false);
        }
    };

    const fetchSoundFiles = async () => {
        try {
            const data = await apiCall('/sound-files');
            setSoundFiles(data.files || []);
        } catch (error) {
            console.error('Failed to fetch sound files');
        }
    };

    const deleteSoundFile = async (filename) => {
        try {
            await apiCall(`/sound-files/${filename}`, { method: 'DELETE' });
            await fetchSoundFiles();
            addNotification('success', `🗑️ Sound deleted: ${filename}`);
        } catch (error) {
            addNotification('error', `❌ Failed to delete sound: ${error.message}`);
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

    const renderTweetManagement = () => (
        <div className="space-y-4 md:space-y-6">
            {/* Firebase Status & Controls */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-4">
                    <div>
                        <h2 className="text-lg md:text-xl font-semibold text-white">Firebase Tweet Tracking</h2>
                        <p className="text-sm text-gray-400">Manage used Twitter tweets/status links to prevent duplicate sniping</p>
                    </div>
                    <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-4">
                        <button
                            onClick={fetchUsedTweets}
                            className="w-full md:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                        >
                            🔄 Refresh
                        </button>
                        <button
                            onClick={clearUsedTweets}
                            className="w-full md:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
                        >
                            🗑️ Clear All
                        </button>
                    </div>
                </div>

                <div className="text-sm text-gray-400">
                    Used tweets: <span className="text-white font-semibold">{usedTweets.length}</span>
                </div>
            </div>

            {/* Used Tweets List */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Used Tweets</h3>

                {usedTweets.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-gray-400 mb-4">
                            <div className="text-5xl mb-2">📱</div>
                            <p>No used tweets tracked yet</p>
                            <p className="text-sm">Tweets will appear here after tokens are detected</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {usedTweets.map(tweet => (
                            <div key={tweet.id} className="bg-gray-700 rounded-lg p-4">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <h4 className="text-white font-medium">Tweet ID: {tweet.tweetId}</h4>
                                            <button
                                                onClick={() => copyToClipboard(tweet.tweetId, 'Tweet ID')}
                                                className="text-blue-400 hover:text-blue-300 text-sm"
                                            >
                                                📋
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                                            <div>
                                                <span className="text-gray-400">Author: </span>
                                                <span className="text-blue-400">@{tweet.username || 'Unknown'}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400">Token: </span>
                                                <span className="text-green-400">{tweet.tokenName || 'Unknown'}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400">Platform: </span>
                                                <span className="text-purple-400">{tweet.platform || 'Unknown'}</span>
                                            </div>
                                        </div>

                                        <div className="mt-2 text-sm">
                                            <span className="text-gray-400">Used: </span>
                                            <span className="text-yellow-400">
                                                {(() => {
                                                    if (tweet.firstUsedAt) {
                                                        try {
                                                            if (tweet.firstUsedAt.toDate) {
                                                                return tweet.firstUsedAt.toDate().toLocaleString();
                                                            }
                                                            if (tweet.firstUsedAt instanceof Date) {
                                                                return tweet.firstUsedAt.toLocaleString();
                                                            }
                                                            if (typeof tweet.firstUsedAt === 'number') {
                                                                return new Date(tweet.firstUsedAt).toLocaleString();
                                                            }
                                                            if (typeof tweet.firstUsedAt === 'string') {
                                                                return new Date(tweet.firstUsedAt).toLocaleString();
                                                            }
                                                        } catch (error) {
                                                            console.error('Error formatting timestamp:', error);
                                                        }
                                                    }
                                                    return 'Just now';
                                                })()}
                                            </span>
                                        </div>

                                        {tweet.tokenAddress && (
                                            <div className="mt-2">
                                                <span className="text-gray-400 text-xs">Token Address: </span>
                                                <code className="text-xs text-white bg-gray-600 px-2 py-1 rounded">
                                                    {tweet.tokenAddress.substring(0, 12)}...{tweet.tokenAddress.substring(-8)}
                                                </code>
                                                <button
                                                    onClick={() => copyToClipboard(tweet.tokenAddress, 'Token address')}
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
                                                const tweetUrl = `https://x.com/${tweet.username}/status/${tweet.tweetId}`;
                                                if (window.electronAPI && window.electronAPI.openExternalURL) {
                                                    window.electronAPI.openExternalURL(tweetUrl);
                                                } else {
                                                    window.open(tweetUrl, '_blank');
                                                }
                                                addNotification('success', `🌐 Opening tweet ${tweet.tweetId}`);
                                            }}
                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                                        >
                                            🔗 View
                                        </button>
                                        <button
                                            onClick={() => removeUsedTweet(tweet.tweetId)}
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

            {/* Tweet Detection Stats */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Tweet Detection Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-700 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-400">{usedTweets.length}</div>
                        <div className="text-sm text-gray-400">Used Tweets</div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-400">
                            {detectedTokens.filter(t => t.twitterType === 'tweet').length}
                        </div>
                        <div className="text-sm text-gray-400">Tweet-based Tokens</div>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-purple-400">
                            {usedTweets.filter(t => t.platform === 'pumpfun').length}
                        </div>
                        <div className="text-sm text-gray-400">Pump.fun Tweet Tokens</div>
                    </div>
                </div>
            </div>

            {/* Twitter Detection Guide - Updated */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🔍 Twitter Detection Guide</h3>
                <div className="space-y-4">
                    <div className="bg-gray-700 rounded-lg p-4">
                        <h4 className="text-white font-medium mb-2">📱 Twitter Tweets/Status URLs</h4>
                        <div className="text-sm text-gray-300 space-y-1">
                            <p>• <code className="bg-gray-600 px-1 rounded">https://x.com/username/status/1234567890</code></p>
                            <p>• <code className="bg-gray-600 px-1 rounded">https://twitter.com/username/status/1234567890</code></p>
                            <p className="text-yellow-400 mt-2">⚠️ Tweet IDs are tracked in Firebase to prevent duplicates</p>
                            <p className="text-green-400">✅ Tweet authors are checked against admin lists for matching</p>
                        </div>
                    </div>

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
                        <h4 className="text-blue-400 font-medium mb-2">💡 How Tweet Detection Works</h4>
                        <div className="text-sm text-blue-300 space-y-1">
                            <p>1️⃣ When a token has a tweet URL, the tweet ID is extracted</p>
                            <p>2️⃣ System checks if tweet was already used (prevents duplicates)</p>
                            <p>3️⃣ The tweet author's username is checked against admin lists</p>
                            <p>4️⃣ If author matches primary list = Auto-snipe | Secondary = Notify</p>
                            <p>5️⃣ Tweet ID is saved to Firebase for future duplicate prevention</p>
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

                {/*{!botStatus.isRunning && (
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
                        <p className="text-red-400">⚠️ Bot will be running to inject demo tokens</p>
                    </div>
                )}*/}

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
                        //disabled={!botStatus.isRunning}
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
                            Custom Wallet
                        </label>
                        <input
                            type="text"
                            value={customWallet}
                            onChange={(e) => setCustomWallet(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="Override creator wallet"
                        //disabled={!botStatus.isRunning}
                        />
                    </div>


                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Custom Twitter (Optional)
                        </label>
                        <input
                            type="text"
                            value={customTwitter}
                            onChange={(e) => setCustomTwitter(e.target.value)} // UNCOMMENT THIS LINE
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="Override Twitter handle"
                        // disabled={!botStatus.isRunning} // COMMENT OR REMOVE THIS LINE
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
                        // disabled={!botStatus.isRunning}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Custom Twitter Status/Tweet (Optional)
                        </label>
                        <input
                            type="text"
                            value={customTweet}
                            onChange={(e) => setCustomTweet(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="Tweet URL (e.g., x.com/user/status/123...)"
                        // disabled={!botStatus.isRunning}
                        />
                    </div>

                </div>

                {/* Quick Action Buttons */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                        onClick={() => injectDemoToken()}  // <-- Add empty parentheses
                        // disabled={!botStatus.isRunning}
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

    const renderGlobalSnipeSettings = () => {
        return (
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
                    {/* Amount Input with Radio Buttons */}
                    <div className="md:col-span-2">
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
                                setHasGlobalSettingsChanged(true);

                                // Auto-save to localStorage
                                const updatedGlobalSettings = { ...settings.globalSnipeSettings, amount: newAmount };
                                saveToLocalStorage(STORAGE_KEYS.GLOBAL_SNIPE, updatedGlobalSettings);
                            }}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        />

                        {/* Radio Buttons for Amount Update Mode */}
                        <div className="mt-3 space-y-2 bg-gray-700/50 rounded-lg p-3">
                            <label className="text-xs text-gray-400 block mb-1">
                                ⚙️ When changing amount, apply to:
                            </label>

                            <label className="flex items-start space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="amountUpdateMode"
                                    value="all_existing"
                                    checked={amountUpdateMode === 'all_existing'}
                                    onChange={(e) => {
                                        setAmountUpdateMode(e.target.value);
                                        setHasGlobalSettingsChanged(true);
                                    }}
                                    className="mt-1"
                                />
                                <div>
                                    <span className="text-sm text-white">All existing admins</span>
                                    <p className="text-xs text-gray-400">
                                        Update amounts for {lists.primary_admins.length} primary + {lists.secondary_admins.length} secondary admins
                                    </p>
                                </div>
                            </label>

                            <label className="flex items-start space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="amountUpdateMode"
                                    value="new_only"
                                    checked={amountUpdateMode === 'new_only'}
                                    onChange={(e) => {
                                        setAmountUpdateMode(e.target.value);
                                        setHasGlobalSettingsChanged(true);
                                    }}
                                    className="mt-1"
                                />
                                <div>
                                    <span className="text-sm text-white">Only newly adding admins</span>
                                    <p className="text-xs text-gray-400">Existing admin amounts won't change</p>
                                </div>
                            </label>
                        </div>



                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Slippage (%)</label>
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
                                setHasGlobalSettingsChanged(true);
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
                                setHasGlobalSettingsChanged(true);
                                const updatedGlobalSettings = { ...settings.globalSnipeSettings, mevProtection: newMevProtection };
                                saveToLocalStorage(STORAGE_KEYS.GLOBAL_SNIPE, updatedGlobalSettings);
                            }}
                            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <label className="text-sm text-gray-300">🛡️ MEV Protection</label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Priority Fee (SOL)</label>
                        <input
                            type="number"
                            step="0.0001"
                            value={settings.globalSnipeSettings.priorityFee}
                            onChange={(e) => {
                                const newPriorityFee = parseFloat(e.target.value);
                                setSettings(prev => ({
                                    ...prev,
                                    globalSnipeSettings: {
                                        ...prev.globalSnipeSettings,
                                        priorityFee: newPriorityFee
                                    }
                                }));
                                setHasGlobalSettingsChanged(true);
                                const updatedGlobalSettings = { ...settings.globalSnipeSettings, priorityFee: newPriorityFee };
                                saveToLocalStorage(STORAGE_KEYS.GLOBAL_SNIPE, updatedGlobalSettings);
                            }}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                        />
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
                                    setHasGlobalSettingsChanged(true);
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

                <div className="mt-6 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={async () => {
                                try {
                                    setIsSavingGlobalSettings(true); // START LOADING

                                    // Save global settings
                                    await updateGlobalSnipeSettings(settings.globalSnipeSettings);

                                    // If "all_existing" mode, update all admin amounts
                                    if (amountUpdateMode === 'all_existing') {
                                        const response = await apiCall('/update-existing-admins-amounts', {
                                            method: 'POST',
                                            body: JSON.stringify({
                                                amount: settings.globalSnipeSettings.amount,
                                                fees: settings.globalSnipeSettings.fees,
                                                priorityFee: settings.globalSnipeSettings.priorityFee  // ✅ ADDED THIS
                                            })
                                        });

                                        if (response.success) {
                                            setGlobalSettingsMessage(`✅ Global settings saved! Updated ${response.primaryUpdated + response.secondaryUpdated} admin entries.`);
                                            addNotification('success', `✅ Global settings saved! Updated ${response.primaryUpdated + response.secondaryUpdated} admin entries.`);
                                            await fetchLists();
                                        }
                                    } else {
                                        setGlobalSettingsMessage('✅ Global snipe settings saved! Will apply to new admins only.');
                                        addNotification('success', '✅ Global snipe settings saved! Will apply to new admins only.');
                                    }

                                    setHasGlobalSettingsChanged(false);
                                    clearGlobalSettingsMessage();
                                } catch (error) {
                                    setGlobalSettingsMessage('❌ Failed to save settings to server');
                                    addNotification('error', '❌ Failed to save global settings to server');
                                    clearGlobalSettingsMessage();
                                } finally {
                                    setIsSavingGlobalSettings(false); // END LOADING
                                }
                            }}
                            disabled={!hasGlobalSettingsChanged || isSavingGlobalSettings}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                        >
                            {isSavingGlobalSettings ? (
                                <>
                                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <span>💾</span>
                                    <span>Save to Server</span>
                                    {amountUpdateMode === 'all_existing' && <span className="text-xs">(Update All Admins)</span>}
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => {
                                clearLocalStorage();
                                setGlobalSettingsMessage('🗑️ Local storage cleared successfully!');
                                addNotification('success', '🗑️ Local storage cleared successfully!');
                                clearGlobalSettingsMessage();
                            }}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                        >
                            <span>🗑️</span>
                            <span>Clear Local Storage</span>
                        </button>
                    </div>

                    {/* Save Status Indicator */}
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${hasGlobalSettingsChanged ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
                            <span className={hasGlobalSettingsChanged ? 'text-yellow-400' : 'text-green-400'}>
                                {hasGlobalSettingsChanged ? 'Unsaved changes' : 'All changes saved'}
                            </span>
                        </div>

                        {hasGlobalSettingsChanged && (
                            <span className="text-xs text-gray-400">
                                Click "Save to Server" to apply changes
                            </span>
                        )}
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

                {/* Current Settings Preview */}
                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-400 mb-2">📊 Current Global Settings (Server)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                            <span className="text-gray-400">Amount:</span>
                            <span className="text-white ml-1">{serverGlobalSettings.amount} SOL</span>
                        </div>
                        <div>
                            <span className="text-gray-400">Fees:</span>
                            <span className="text-white ml-1">{serverGlobalSettings.fees}%</span>
                        </div>
                        <div>
                            <span className="text-gray-400">Priority Fee:</span>
                            <span className="text-white ml-1">{serverGlobalSettings.priorityFee} SOL</span>
                        </div>
                        <div>
                            <span className="text-gray-400">MEV Protection:</span>
                            <span className="text-white ml-1">{serverGlobalSettings.mevProtection ? '🛡️ ON' : '❌ OFF'}</span>
                        </div>
                    </div>

                    {/* Show last update time */}
                    <div className="mt-2 text-xs text-gray-400 text-center">
                        💾 Synced with server
                    </div>
                </div>
            </div>
        );
    };
    // Add this new function after renderGlobalSnipeSettings()
    const renderSoundManagement = () => (
        <div className="bg-gray-800 rounded-lg p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold text-white mb-4">🔊 Sound Management</h2>
            <p className="text-sm text-gray-400 mb-6">
                Upload custom notification sounds for your snipe alerts
            </p>

            {/* Upload Section */}
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">Upload New Sound</h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Choose Sound File
                        </label>
                        <input
                            type="file"
                            accept="audio/*,.wav,.mp3,.ogg,.m4a"
                            onChange={async (e) => {
                                const file = e.target.files[0];
                                console.log('🔧 File selected:', file); // ADD THIS LINE
                                if (file) {
                                    console.log('🔧 File details:', {
                                        name: file.name,
                                        size: file.size,
                                        type: file.type
                                    }); // ADD THIS LINE
                                    try {
                                        console.log('🔧 Starting upload...'); // ADD THIS LINE
                                        await uploadSoundFile(file);
                                        e.target.value = ''; // Clear input
                                        console.log('🔧 Upload completed successfully'); // ADD THIS LINE
                                    } catch (error) {
                                        console.error('🔧 Upload error:', error);
                                    }
                                }
                            }}
                            disabled={uploadingSound}
                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Supported formats: WAV, MP3, OGG, M4A (Max 5MB)
                        </p>
                    </div>

                    {uploadingSound && (
                        <div className="flex items-center space-x-2 text-blue-400">
                            <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                            <span className="text-sm">Uploading sound...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Uploaded Sounds List */}
            <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">
                    Uploaded Sounds ({soundFiles.length})
                </h3>

                {soundFiles.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-gray-400 mb-4">
                            <Bell size={48} className="mx-auto mb-2" />
                            <p>No custom sounds uploaded</p>
                            <p className="text-sm">Upload audio files to use as notification sounds</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {soundFiles.map(file => (
                            <div key={file.filename} className="flex items-center justify-between p-3 bg-gray-600 rounded-lg">
                                <div className="flex-1">
                                    <h4 className="text-white font-medium">{file.originalName || file.filename}</h4>
                                    <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                                        <span>Size: {(file.size / 1024).toFixed(1)} KB</span>
                                        <span>Format: {file.mimetype}</span>
                                        <span>Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => previewSound(file.filename)}
                                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                                    >
                                        🔊 Play
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (window.confirm(`Delete "${file.originalName || file.filename}"?`)) {
                                                deleteSoundFile(file.filename);
                                            }
                                        }}
                                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                                    >
                                        🗑️ Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Default Sounds */}
            <div className="bg-gray-700 rounded-lg p-4 mt-4">
                <h3 className="text-lg font-semibold text-white mb-3">Built-in Sounds</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                        { value: 'default.wav', label: '🔊 System Beep' },
                        { value: 'success.wav', label: '✅ Success Tone' },
                        { value: 'alert.wav', label: '⚠️ Alert Tone' },
                        { value: 'chime.wav', label: '🔔 Chime Tone' }
                    ].map(sound => (
                        <div key={sound.value} className="flex items-center justify-between p-2 bg-gray-600 rounded">
                            <span className="text-white text-sm">{sound.label}</span>
                            <button
                                onClick={() => previewSound(sound.value)}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"
                            >
                                🔊 Play
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const performTwitterLogout = async () => {
        try {
            setTwitterSessionStatus(prev => ({ ...prev, checking: true }));

            const response = await apiCall('/twitter-logout', { method: 'POST' });

            // Update status based on actual logout result
            setTwitterSessionStatus(prev => ({
                ...prev,
                loggedIn: false, // Always set to false after logout attempt
                checking: false,
                lastChecked: new Date().toISOString()
            }));

            if (response.loggedOut) {
                addNotification('success', '✅ Successfully logged out from Twitter');
            } else {
                addNotification('warning', '⚠️ Please complete logout manually in browser window');
            }

            // Auto-check status after 3 seconds to confirm
            setTimeout(() => {
                checkTwitterSession();
            }, 3000);

        } catch (error) {
            setTwitterSessionStatus(prev => ({ ...prev, checking: false, error: error.message }));
            addNotification('error', '❌ Failed to logout from Twitter');
        }
    };

    const renderDetectionSettings = () => (
        <div className="bg-gray-800 rounded-lg p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg md:text-xl font-semibold text-white">🎯 Separate Detection Settings</h2>
                {/* Sync indicator */}
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-400">Synced with server</span>
                </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">
                Enable or disable primary and secondary admin detection separately for testing
            </p>

            <div className="space-y-4">
                {/* Primary Detection Toggle */}
                <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0 p-4 bg-gray-700 rounded-lg">
                    <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-base md:text-lg font-medium text-purple-400">🎯 Primary Admin Detection</h3>
                            {settings.enablePrimaryDetection !== originalSettings.enablePrimaryDetection && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">Modified</span>
                            )}
                        </div>
                        <p className="text-sm text-gray-400 mb-2">
                            Auto-snipe tokens from primary admin list {settings.detectionOnlyMode ? '(detection only)' : '(with auto-snipe)'}
                        </p>
                        <div className="flex items-center space-x-4 text-xs">
                            <span className="text-gray-400">
                                Current: <span className={`font-semibold ${settings.enablePrimaryDetection ? 'text-purple-400' : 'text-gray-400'}`}>
                                    {settings.enablePrimaryDetection ? 'ON' : 'OFF'}
                                </span>
                            </span>
                            <span className="text-gray-500">
                                Server: <span className={`font-semibold ${originalSettings.enablePrimaryDetection ? 'text-purple-400' : 'text-gray-400'}`}>
                                    {originalSettings.enablePrimaryDetection ? 'ON' : 'OFF'}
                                </span>
                            </span>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.enablePrimaryDetection}
                            onChange={(e) => setSettings(prev => ({ ...prev, enablePrimaryDetection: e.target.checked }))}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                </div>

                {/* Secondary Detection Toggle */}
                <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0 p-4 bg-gray-700 rounded-lg">
                    <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-base md:text-lg font-medium text-orange-400">🔔 Secondary Admin Detection</h3>
                            {settings.enableSecondaryDetection !== originalSettings.enableSecondaryDetection && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">Modified</span>
                            )}
                        </div>
                        <p className="text-sm text-gray-400 mb-2">
                            Show popup notifications for tokens from secondary admin list
                        </p>
                        <div className="flex items-center space-x-4 text-xs">
                            <span className="text-gray-400">
                                Current: <span className={`font-semibold ${settings.enableSecondaryDetection ? 'text-orange-400' : 'text-gray-400'}`}>
                                    {settings.enableSecondaryDetection ? 'ON' : 'OFF'}
                                </span>
                            </span>
                            <span className="text-gray-500">
                                Server: <span className={`font-semibold ${originalSettings.enableSecondaryDetection ? 'text-orange-400' : 'text-gray-400'}`}>
                                    {originalSettings.enableSecondaryDetection ? 'ON' : 'OFF'}
                                </span>
                            </span>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.enableSecondaryDetection}
                            onChange={(e) => setSettings(prev => ({ ...prev, enableSecondaryDetection: e.target.checked }))}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                    </label>
                </div>

                {/* Detection Status Summary */}
                <div className="mt-6 p-4 bg-gray-700 rounded-lg border-2 border-blue-500/30">
                    <h3 className="text-base font-medium text-white mb-3 flex items-center">
                        <span className="mr-2">📊</span>
                        Server Status Summary
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                            <span className="text-gray-300">Primary Detection</span>
                            <span className={`font-semibold ${originalSettings.enablePrimaryDetection ? 'text-purple-400' : 'text-gray-400'}`}>
                                {originalSettings.enablePrimaryDetection ? '✅ ON' : '❌ OFF'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                            <span className="text-gray-300">Secondary Detection</span>
                            <span className={`font-semibold ${originalSettings.enableSecondaryDetection ? 'text-orange-400' : 'text-gray-400'}`}>
                                {originalSettings.enableSecondaryDetection ? '✅ ON' : '❌ OFF'}
                            </span>
                        </div>
                    </div>

                    {/* Status Explanation */}
                    <div className="mt-3 p-3 bg-gray-600 rounded text-xs">
                        {!originalSettings.enablePrimaryDetection && !originalSettings.enableSecondaryDetection ? (
                            <p className="text-red-400">❌ All admin detection is disabled on server</p>
                        ) : originalSettings.enablePrimaryDetection && !originalSettings.enableSecondaryDetection ? (
                            <p className="text-purple-400">🎯 Only primary detection active on server (auto-snipe)</p>
                        ) : !originalSettings.enablePrimaryDetection && originalSettings.enableSecondaryDetection ? (
                            <p className="text-orange-400">🔔 Only secondary detection active on server (popup notifications)</p>
                        ) : (
                            <p className="text-green-400">✅ Both detection types active on server</p>
                        )}
                    </div>
                </div>

                {/* Unsaved Changes Warning */}
                {(settings.enablePrimaryDetection !== originalSettings.enablePrimaryDetection ||
                    settings.enableSecondaryDetection !== originalSettings.enableSecondaryDetection) && (
                        <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                            <div className="flex items-start space-x-2">
                                <span className="text-yellow-400 text-lg">⚠️</span>
                                <div>
                                    <p className="text-sm text-yellow-300 font-medium">You have unsaved changes</p>
                                    <p className="text-xs text-yellow-400 mt-1">
                                        Click "Save Detection Settings" below to apply your changes to the server
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                <div className="flex flex-col space-y-2">
                    <button
                        onClick={async () => {
                            try {
                                await apiCall('/detection-settings', {
                                    method: 'POST',
                                    body: JSON.stringify({
                                        enablePrimaryDetection: settings.enablePrimaryDetection,
                                        enableSecondaryDetection: settings.enableSecondaryDetection
                                    })
                                });

                                // Add notification to dashboard
                                addNotification('success', '✅ Detection settings updated successfully');

                                // Show inline message below button
                                setButtonMessages(prev => ({ ...prev, detectionSettings: '✅ Detection settings saved successfully!' }));
                                clearButtonMessage('detectionSettings');

                                // ✅ UPDATE ORIGINAL SETTINGS TO REFLECT SAVED STATE
                                setOriginalSettings(prev => ({
                                    ...prev,
                                    enablePrimaryDetection: settings.enablePrimaryDetection,
                                    enableSecondaryDetection: settings.enableSecondaryDetection
                                }));
                            } catch (error) {
                                addNotification('error', '❌ Failed to update detection settings');
                                setButtonMessages(prev => ({ ...prev, detectionSettings: '❌ Failed to save detection settings' }));
                                clearButtonMessage('detectionSettings');
                            }
                        }}
                        disabled={settings.enablePrimaryDetection === originalSettings.enablePrimaryDetection &&
                            settings.enableSecondaryDetection === originalSettings.enableSecondaryDetection}
                        className={`w-full px-4 py-3 rounded-lg transition-all font-medium ${(settings.enablePrimaryDetection !== originalSettings.enablePrimaryDetection ||
                            settings.enableSecondaryDetection !== originalSettings.enableSecondaryDetection)
                            ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {(settings.enablePrimaryDetection !== originalSettings.enablePrimaryDetection ||
                            settings.enableSecondaryDetection !== originalSettings.enableSecondaryDetection)
                            ? '💾 Save Detection Settings'
                            : '✅ All Changes Saved'}
                    </button>

                    {/* Inline success/error message display */}
                    {buttonMessages.detectionSettings && (
                        <div className={`text-sm px-3 py-2 rounded ${buttonMessages.detectionSettings.includes('✅')
                            ? 'bg-green-900/20 text-green-400 border border-green-500/30'
                            : 'bg-red-900/20 text-red-400 border border-red-500/30'
                            }`}>
                            {buttonMessages.detectionSettings}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // Find the renderSecondaryPopup function in App.js and update the "Settings Used for Auto-Snipe" section
    const renderSecondaryPopup = () => {
        if (!secondaryPopup.show || !secondaryPopup.tokenData) return null;

        const token = secondaryPopup.tokenData;
        const isPrimary = secondaryPopup.isPrimary || false;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
                    {/* Header - Different for Primary vs Secondary */}
                    <div className="flex items-center justify-between mb-6">
                        {isPrimary ? (
                            // Primary Admin Header - "Already Sniped"
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                                    <span className="text-2xl">✅</span>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-green-400">Already Sniped!</h2>
                                    <p className="text-green-300">🎯 Primary match - Auto-sniped successfully</p>
                                </div>
                            </div>
                        ) : (
                            // Secondary Admin Header - "Secondary Match Found"
                            <h2 className="text-2xl font-bold text-white">🔔 Secondary Match Found!</h2>
                        )}
                        <button
                            onClick={() => setSecondaryPopup({ show: false, tokenData: null, isPrimary: false })}
                            className="text-gray-400 hover:text-white"
                        >
                            ✖️
                        </button>
                    </div>

                    {/* Already Sniped Banner for Primary */}
                    {isPrimary && (
                        <div className="mb-6 bg-gradient-to-r from-green-900/40 to-green-800/40 border-2 border-green-500 rounded-lg p-4">
                            <div className="flex items-center space-x-3">
                                <div className="text-4xl">🎯</div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-green-400">Auto-Snipe Executed</h3>
                                    <p className="text-sm text-green-300">
                                        This token was automatically sniped using your primary admin settings
                                    </p>
                                    <div className="mt-2 flex items-center space-x-4 text-xs text-green-200">
                                        <span>✅ Trade Submitted</span>
                                        <span>✅ Window Opened</span>
                                        <span>✅ Notification Sent</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

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
                                <p className="text-sm text-gray-400">Matched: {token.matchedEntity}</p>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-700 p-3 rounded">
                                <p className="text-sm text-gray-400">Platform</p>
                                <p className="text-white font-bold">{token.platform?.toUpperCase() || 'UNKNOWN'}</p>
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

                    {/* FIX: Use individual admin config instead of global settings */}
                    <div className="bg-gray-700 p-4 rounded mb-6">
                        <h4 className="text-lg font-semibold text-white mb-3">
                            {isPrimary ? 'Settings Used for Auto-Snipe:' : 'Current Admin Settings:'}
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="text-center">
                                <p className="text-sm text-gray-400">Amount</p>
                                <p className="text-white font-bold">
                                    {token.config?.amount || settings.globalSnipeSettings.amount} SOL
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-400">Fees</p>
                                <p className="text-white font-bold">
                                    {token.config?.fees || settings.globalSnipeSettings.fees}%
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-gray-400">Priority Fee</p>
                                <p className="text-white font-bold">
                                    {token.config?.priorityFee || settings.globalSnipeSettings.priorityFee} SOL
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons - Only show for Secondary */}
                    {!isPrimary && (
                        <div className="flex flex-col space-y-3 md:flex-row md:space-y-0 md:space-x-4">
                            <button
                                onClick={() => snipeWithGlobalSettings(token.tokenAddress)}
                                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-bold flex items-center justify-center space-x-2"
                            >
                                <Target size={20} />
                                <span>SNIPE ({token.config?.amount || settings.globalSnipeSettings.amount} SOL)</span>
                            </button>
                        </div>
                    )}

                    {/* Close button for Primary */}
                    {isPrimary && (
                        <div className="flex justify-center">
                            <button
                                onClick={() => setSecondaryPopup({ show: false, tokenData: null, isPrimary: false })}
                                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderSlippageErrorPopup = () => {
        if (!slippageErrorPopup.show) return null;

        const token = slippageErrorPopup.tokenData || { tokenAddress: slippageErrorPopup.tokenAddress };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto border-2 border-red-500">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center animate-pulse">
                                <span className="text-2xl">💰</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Slippage Error!</h2>
                                <p className="text-red-400">Token price moved too fast for your slippage tolerance</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSlippageErrorPopup({
                                show: false,
                                tokenAddress: '',
                                error: '',
                                tokenData: null,
                                needed: 0,
                                currentPrice: 0
                            })}
                            className="text-gray-400 hover:text-white text-2xl"
                        >
                            ✖️
                        </button>
                    </div>

                    {/* Error Details */}
                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
                        <h3 className="text-lg font-semibold text-red-400 mb-3">⚠️ What Happened</h3>
                        <p className="text-white mb-3">
                            The token price moved significantly between when you initiated the snipe and when the transaction executed.
                            Your slippage setting ({slippageErrorPopup.tokenData?.config?.fees || settings.globalSnipeSettings.fees}%) wasn't enough to cover the price movement.
                        </p>

                        {slippageErrorPopup.needed > 0 && (
                            <div className="grid grid-cols-2 gap-4 mt-3">
                                <div className="bg-gray-700 p-3 rounded">
                                    <p className="text-sm text-gray-400">SOL Needed</p>
                                    <p className="text-red-400 font-bold">{slippageErrorPopup.needed.toFixed(4)} SOL</p>
                                </div>
                                <div className="bg-gray-700 p-3 rounded">
                                    <p className="text-sm text-gray-400">Price Movement</p>
                                    <p className="text-yellow-400 font-bold">
                                        {slippageErrorPopup.currentPrice > 0 ?
                                            `${((slippageErrorPopup.currentPrice / (slippageErrorPopup.tokenData?.config?.amount || settings.globalSnipeSettings.amount) - 1) * 100).toFixed(1)}%`
                                            : 'Unknown'}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="mt-3 p-3 bg-gray-900/50 rounded">
                            <p className="text-sm text-gray-300">
                                <span className="text-red-400 font-medium">Error Code:</span> 6002
                            </p>
                            <p className="text-sm text-gray-300 mt-1">
                                <span className="text-red-400 font-medium">Message:</span> {slippageErrorPopup.error}
                            </p>
                        </div>
                    </div>

                    {/* Token Details (if available) */}
                    {slippageErrorPopup.tokenData && (
                        <div className="bg-gray-700 rounded-lg p-4 mb-6">
                            <h3 className="text-lg font-semibold text-white mb-3">📊 Token Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-400">Token</p>
                                    <p className="text-white font-bold">
                                        {slippageErrorPopup.tokenData.name || 'Unknown'}
                                        ({slippageErrorPopup.tokenData.symbol || 'Unknown'})
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Platform</p>
                                    <p className="text-white font-bold">{slippageErrorPopup.tokenData.platform || 'Unknown'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Attempted Amount</p>
                                    <p className="text-green-400 font-bold">
                                        {slippageErrorPopup.tokenData.config?.amount || settings.globalSnipeSettings.amount} SOL
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Slippage Setting</p>
                                    <p className="text-yellow-400 font-bold">
                                        {slippageErrorPopup.tokenData.config?.fees || settings.globalSnipeSettings.fees}%
                                    </p>
                                </div>
                            </div>

                            {/* Token Address */}
                            <div className="mt-4">
                                <p className="text-sm text-gray-400 mb-2">Token Address:</p>
                                <div className="flex items-center space-x-2">
                                    <code className="text-sm font-mono text-white flex-1 break-all bg-gray-800 p-2 rounded">
                                        {slippageErrorPopup.tokenData.tokenAddress}
                                    </code>
                                    <button
                                        onClick={() => copyToClipboard(slippageErrorPopup.tokenData.tokenAddress, 'Token address')}
                                        className="text-blue-400 hover:text-blue-300 px-3 py-2"
                                    >
                                        📋
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Solutions & Actions */}
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
                        <h3 className="text-lg font-semibold text-blue-400 mb-3">💡 How to Fix This</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-start space-x-2">
                                <span className="text-blue-400 mt-0.5">1.</span>
                                <p className="text-white">Increase your slippage tolerance in Global Snipe Settings</p>
                            </div>
                            <div className="flex items-start space-x-2">
                                <span className="text-blue-400 mt-0.5">2.</span>
                                <p className="text-white">Try sniping again with a higher SOL amount</p>
                            </div>
                            <div className="flex items-start space-x-2">
                                <span className="text-blue-400 mt-0.5">3.</span>
                                <p className="text-white">Wait for the token price to stabilize before trying again</p>
                            </div>
                            <div className="flex items-start space-x-2">
                                <span className="text-blue-400 mt-0.5">4.</span>
                                <p className="text-white">Check if the token is experiencing extreme volatility</p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-center">
                        <button
                            onClick={() => setSlippageErrorPopup({
                                show: false,
                                tokenAddress: '',
                                error: '',
                                tokenData: null,
                                needed: 0,
                                currentPrice: 0
                            })}
                            className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                        >
                            ❌ Close
                        </button>
                    </div>

                    {/* Quick Fix Suggestions */}
                    <div className="mt-4 text-center">
                        <p className="text-xs text-gray-400">
                            💡 <span className="text-yellow-400">Quick Fix:</span> Try increasing slippage to 15-20% for very volatile tokens
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    // 3. COUNTDOWN TIMER COMPONENT
    const PairDetectionCountdown = ({ tokenAddress, onRetry }) => {
        const [countdown, setCountdown] = useState(3);
        const [isActive, setIsActive] = useState(true);

        useEffect(() => {
            if (!isActive) return;

            const timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        setIsActive(false);
                        onRetry();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        }, [isActive, onRetry]);

        if (!isActive) {
            return (
                <div className="flex items-center space-x-2 text-blue-400">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                    <span className="text-sm">🔄 Retrying pair detection...</span>
                </div>
            );
        }

        return (
            <div className="flex items-center space-x-2 text-blue-400">
                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">{countdown}</span>
                </div>
                <span className="text-sm">⏰ Auto-retry in {countdown} seconds...</span>
            </div>
        );
    };

    // 5. AUTO-OPEN WITH ADDRESS (Updated for bonding curves)
    const autoOpenTokenPageWithAddress = async (tokenAddress, url, addressType) => {
        console.log(`🚀 AUTO-OPENING TOKEN PAGE WITH ${addressType.toUpperCase()}`);
        console.log(`🔗 URL: ${url}`);
        console.log(`🎯 Token: ${tokenAddress}`);

        try {
            const popupResult = await attemptPopupWithDetection(url, tokenAddress, `auto-open-with-${addressType}`);

            if (popupResult.success) {
                console.log(`✅ AUTO-OPEN WITH ${addressType.toUpperCase()} SUCCEEDED`);
                addNotification('success', `🚀 Token page auto-opened with ${addressType === 'bonding_curve' ? 'bonding curve' : 'pair address'}!`);

                // Close the popup since we successfully opened the page
                setSecondaryPopup({ show: false, tokenData: null });

            } else {
                console.error(`❌ AUTO-OPEN WITH ${addressType.toUpperCase()} FAILED:`, popupResult.reason);
                addNotification('warning', '🚫 Auto-open blocked - use "View Token Page" button');
                handlePopupBlockedScenario(url, tokenAddress, popupResult.reason, `auto-open-with-${addressType}`);
            }
        } catch (error) {
            console.error(`❌ Error in auto-open with ${addressType}:`, error);
            addNotification('error', `❌ Auto-open error: ${error.message}`);
        }
    };

    // Simple bonding curve status check (no auto-retry, no auto-open)
    const checkBondingCurveStatus = (token) => {
        if (token.bondingCurveAddress) {
            console.log(`✅ Bonding curve available: ${token.bondingCurveAddress}`);
            return 'found';
        } else {
            console.log(`⚠️ No bonding curve stored for token`);
            return 'not_found';
        }
    };

    const reopenTwitterBrowser = async () => {
        try {
            setTwitterSessionStatus(prev => ({ ...prev, checking: true }));

            const response = await apiCall('/twitter-reopen-browser', { method: 'POST' });

            setTwitterSessionStatus({
                initialized: true,
                loggedIn: false,
                url: 'https://twitter.com/login',
                error: null,
                checking: false
            });

            addNotification('success', '🔄 Browser reopened - login page ready');
        } catch (error) {
            setTwitterSessionStatus(prev => ({ ...prev, checking: false, error: error.message }));
            addNotification('error', '❌ Failed to reopen browser');
        }
    };

    // Replace the attemptPopupWithDetection function with this simplified version
    const attemptPopupWithDetection = async (url, tokenAddress, openType) => {
        console.log(`🚀 ATTEMPTING POPUP OPENING (${openType.toUpperCase()})`);

        try {
            // TRY ELECTRON FIRST
            if (window.electronAPI && window.electronAPI.openExternalURL) {
                console.log('🖥️ USING ELECTRON API METHOD');
                window.electronAPI.openExternalURL(url);
                return {
                    success: true,
                    method: 'electron',
                    reason: 'Opened via Electron API'
                };
            }

            // TRY BROWSER - SIMPLIFIED DETECTION
            console.log('🌐 USING BROWSER WINDOW.OPEN() METHOD');
            const newWindow = window.open(url, '_blank');

            // SIMPLE CHECK - if window.open returns null, it's blocked
            if (!newWindow) {
                console.error('❌ POPUP BLOCKED - window.open returned null');
                return {
                    success: false,
                    method: 'browser_blocked',
                    reason: 'Popup blocked by browser'
                };
            }

            // SUCCESS - popup opened
            console.log('✅ POPUP OPENED SUCCESSFULLY');
            return {
                success: true,
                method: 'browser_success',
                reason: 'Opened successfully'
            };

        } catch (openError) {
            console.error('❌ EXCEPTION DURING POPUP ATTEMPT:', openError);
            return {
                success: false,
                method: 'exception',
                reason: `Exception occurred: ${openError.message}`
            };
        }
    };

    const handlePopupBlockedScenario = (url, tokenAddress, reason, openType) => {
        console.error('🚫 POPUP BLOCKED - HANDLING SCENARIO');
        console.error('🔗 Blocked URL:', url);
        console.error('💬 Block reason:', reason);
        console.error('🎯 Open type:', openType);

        // DETERMINE USER-FRIENDLY MESSAGE BASED ON REASON
        let userMessage = '';
        let technicalReason = '';

        if (reason.includes('immediately')) {
            userMessage = 'Chrome blocked the popup immediately';
            technicalReason = 'Browser popup blocker is active';
        } else if (reason.includes('closed immediately')) {
            userMessage = 'Popup was closed right after opening';
            technicalReason = 'Browser detected and closed popup automatically';
        } else if (reason.includes('Exception')) {
            userMessage = 'Browser security prevented opening';
            technicalReason = reason;
        } else {
            userMessage = 'Browser blocked the popup';
            technicalReason = reason;
        }

        // SHOW APPROPRIATE NOTIFICATIONS
        if (openType === 'auto-open') {
            addNotification('warning', '🚫 Auto-open blocked by Chrome - Click "View Token Page" in popup');
            addNotification('info', '💡 Or allow popups for this site to enable auto-opening');
        } else {
            addNotification('error', '🚫 Chrome blocked the popup - Please allow popups for this site');
        }

        // SHOW POPUP BLOCKER GUIDANCE MODAL
        setPopupBlockerModal({
            show: true,
            tokenUrl: url,
            tokenAddress: tokenAddress,
            reason: userMessage,
            technicalReason: technicalReason,
            openType: openType
        });

        console.log('📱 Popup blocker guidance modal triggered');
    };

    // 5. AUTO-OPEN WITH PAIR ADDRESS
    const autoOpenTokenPageWithPairAddress = async (tokenAddress, url) => {
        console.log(`🚀 AUTO-OPENING TOKEN PAGE WITH PAIR ADDRESS`);
        console.log(`🔗 URL: ${url}`);
        console.log(`🎯 Token: ${tokenAddress}`);

        try {
            const popupResult = await attemptPopupWithDetection(url, tokenAddress, 'auto-open-with-pair');

            if (popupResult.success) {
                console.log('✅ AUTO-OPEN WITH PAIR SUCCEEDED');
                addNotification('success', '🚀 Token page auto-opened with pair address!');

                // Close the popup since we successfully opened the page
                setSecondaryPopup({ show: false, tokenData: null });

            } else {
                console.error('❌ AUTO-OPEN WITH PAIR FAILED:', popupResult.reason);
                addNotification('warning', '🚫 Auto-open blocked - use "View Token Page" button');
                handlePopupBlockedScenario(url, tokenAddress, popupResult.reason, 'auto-open-with-pair');
            }
        } catch (error) {
            console.error('❌ Error in auto-open with pair:', error);
            addNotification('error', `❌ Auto-open error: ${error.message}`);
        }
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

    const renderPopupBlockerModal = () => {
        if (!popupBlockerModal.show) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto border-2 border-red-500">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                                <span className="text-2xl">🚫</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Popup Blocked by Browser</h2>
                                <p className="text-red-400">Token page couldn't open automatically</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setPopupBlockerModal({ show: false, tokenUrl: '', tokenAddress: '', reason: '' })}
                            className="text-gray-400 hover:text-white text-2xl"
                        >
                            ✖️
                        </button>
                    </div>

                    {/* Manual Link */}
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
                        <h3 className="text-lg font-semibold text-blue-400 mb-3">🔗 Manual Link (Click to Open)</h3>
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={popupBlockerModal.tokenUrl}
                                readOnly
                                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                            />
                            <button
                                onClick={() => {
                                    window.open(popupBlockerModal.tokenUrl, '_blank');
                                    addNotification('info', '🔗 Manual link clicked - check for new tab');
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            >
                                🌐 Open
                            </button>
                            <button
                                onClick={() => {
                                    copyToClipboard(popupBlockerModal.tokenUrl, 'Token page URL');
                                }}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                            >
                                📋 Copy
                            </button>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-3 md:flex-row md:space-y-0 md:space-x-4">
                        <button
                            onClick={() => {
                                window.open(popupBlockerModal.tokenUrl, '_blank');
                                setPopupBlockerModal({ show: false, tokenUrl: '', tokenAddress: '', reason: '' });
                            }}
                            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-bold"
                        >
                            🌐 Try Opening Again
                        </button>
                        <button
                            onClick={() => {
                                copyToClipboard(popupBlockerModal.tokenUrl, 'Token page URL');
                                setPopupBlockerModal({ show: false, tokenUrl: '', tokenAddress: '', reason: '' });
                            }}
                            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-bold"
                        >
                            📋 Copy Link & Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

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

            <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Recent Activity
                </h3>

                {notifications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No recent activity</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {notifications.map(notification => (
                            <div
                                key={notification.id}
                                className={`p-3 rounded-lg border-l-4 transition-all ${notification.type === 'success'
                                    ? 'bg-green-900/20 border-green-500'
                                    : notification.type === 'error'
                                        ? 'bg-red-900/30 border-red-500'
                                        : notification.type === 'warning'
                                            ? 'bg-yellow-900/20 border-yellow-500'
                                            : 'bg-blue-900/20 border-blue-500'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-0.5">
                                        {notification.type === 'success' && (
                                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        )}
                                        {notification.type === 'error' && (
                                            <AlertCircle className="w-5 h-5 text-red-500" />
                                        )}
                                        {notification.type === 'warning' && (
                                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                                        )}
                                        {notification.type === 'info' && (
                                            <Info className="w-5 h-5 text-blue-500" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        {/* ✅ IMPORTANT: whitespace-pre-line handles the \n newlines */}
                                        <p className={`text-sm whitespace-pre-line break-words ${notification.type === 'error' ? 'text-red-200 font-medium' :
                                            notification.type === 'warning' ? 'text-yellow-200' :
                                                notification.type === 'success' ? 'text-green-200' :
                                                    'text-gray-200'
                                            }`}>
                                            {notification.message}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {notification.timestamp}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
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
                                                {/* Market Cap 
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
                                                </div>*/}

                                                {/* Sol Amount 
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
                                                </div>*/}

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
                                                            {/* TWITTER ADMIN MATCH INDICATOR */}
                                                            <div className="mt-1">
                                                                {token.matchType === 'primary_admin' && token.twitterType === 'community' ? (
                                                                    <div className="bg-green-900/30 border border-green-500/30 rounded px-2 py-1">
                                                                        <span className="text-green-400 text-xs">
                                                                            ✅ Community Admin Match: @{token.matchedEntity}
                                                                        </span>
                                                                    </div>
                                                                ) : token.matchType === 'secondary_admin' && token.twitterType === 'community' ? (
                                                                    <div className="bg-yellow-900/30 border border-yellow-500/30 rounded px-2 py-1">
                                                                        <span className="text-yellow-400 text-xs">
                                                                            🔔 Community Admin Match: @{token.matchedEntity}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="bg-gray-900/30 border border-gray-500/30 rounded px-2 py-1">
                                                                        <span className="text-gray-400 text-xs">
                                                                            ❌ No admin from this community in lists
                                                                        </span>
                                                                    </div>
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
                                                                {token.matchType === 'primary_admin' && token.twitterType === 'individual' ? (
                                                                    <div className="bg-green-900/30 border border-green-500/30 rounded px-2 py-1">
                                                                        <span className="text-green-400 text-xs">
                                                                            ✅ Matched in Primary List: @{token.matchedEntity}
                                                                        </span>
                                                                    </div>
                                                                ) : token.matchType === 'secondary_admin' && token.twitterType === 'individual' ? (
                                                                    <div className="bg-yellow-900/30 border border-yellow-500/30 rounded px-2 py-1">
                                                                        <span className="text-yellow-400 text-xs">
                                                                            🔔 Matched in Secondary List: @{token.matchedEntity}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="bg-gray-900/30 border border-gray-500/30 rounded px-2 py-1">
                                                                        <span className="text-gray-400 text-xs">
                                                                            ❌ Twitter Admin Not in Lists
                                                                        </span>
                                                                    </div>
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
                                        {/* Action Buttons */}
                                        <div className="flex flex-col md:flex-row gap-3 mt-4">
                                            {/* View Token Page Button */}
                                            <button
                                                onClick={() => viewToken(token)}
                                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                                            >
                                                <ExternalLink size={16} />
                                                <span>
                                                    {settings.tokenPageDestination === 'axiom'
                                                        ? 'View on Axiom'
                                                        : token.pool === 'bonk'
                                                            ? 'View on LetsBonk.fun'
                                                            : 'View on Neo BullX'}
                                                </span>
                                            </button>

                                            {/* Axiom Direct Link Button */}
                                            <button
                                                onClick={async () => {
                                                    let axiomUrl;

                                                    // Check if bonding curve is already stored
                                                    if (token.bondingCurveAddress) {
                                                        axiomUrl = `https://axiom.trade/meme/${token.bondingCurveAddress}`;
                                                        console.log(`✅ Using stored bonding curve: ${token.bondingCurveAddress}`);
                                                    } else {
                                                        // Fetch from backend (will get bonding curve for pump.fun or pair address for bonk)
                                                        console.log(`🔍 No stored bonding curve, fetching from backend...`);
                                                        try {
                                                            const response = await fetch(`${API_BASE}/pair-address/${token.tokenAddress}`);
                                                            const data = await response.json();

                                                            if (data.success) {
                                                                if (data.bondingCurveData?.bondingCurveAddress) {
                                                                    // Pump.fun bonding curve
                                                                    axiomUrl = `https://axiom.trade/meme/${data.bondingCurveData.bondingCurveAddress}`;
                                                                    console.log(`✅ Got bonding curve from backend: ${data.bondingCurveData.bondingCurveAddress}`);
                                                                } else if (data.pairData?.pairAddress) {
                                                                    // Let's Bonk pair address from DexScreener
                                                                    axiomUrl = `https://axiom.trade/meme/${data.pairData.pairAddress}`;
                                                                    console.log(`✅ Got pair address from DexScreener: ${data.pairData.pairAddress}`);
                                                                } else {
                                                                    // Fallback to token address
                                                                    axiomUrl = `https://axiom.trade/meme/${token.tokenAddress}`;
                                                                    console.log(`⚠️ No bonding curve or pair found, using token address`);
                                                                }
                                                            } else {
                                                                axiomUrl = `https://axiom.trade/meme/${token.tokenAddress}`;
                                                                console.log(`⚠️ Backend fetch failed, using token address`);
                                                            }
                                                        } catch (error) {
                                                            console.error(`❌ Error fetching address:`, error);
                                                            axiomUrl = `https://axiom.trade/meme/${token.tokenAddress}`;
                                                        }
                                                    }

                                                    // Open the URL
                                                    if (window.electronAPI && window.electronAPI.openExternalURL) {
                                                        window.electronAPI.openExternalURL(axiomUrl);
                                                    } else {
                                                        window.open(axiomUrl, '_blank');
                                                    }

                                                    addNotification('success', `📊 Opening Axiom: ${axiomUrl}`);
                                                }}
                                                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                                                title="Open in Axiom (uses bonding curve or pair address)"
                                            >
                                                <ExternalLink size={16} />
                                                <span>📊 Axiom</span>
                                            </button>

                                            {/* Copy Token Address Button */}
                                            <button
                                                onClick={() => copyToClipboard(token.tokenAddress, 'Token address', `copy_${token.tokenAddress}`)}
                                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                                            >
                                                {copiedStates[`copy_${token.tokenAddress}`] ? (
                                                    <>
                                                        <span>✅</span>
                                                        <span className="hidden md:inline">Copied</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy size={16} />
                                                        <span className="hidden md:inline">Copy Address</span>
                                                    </>
                                                )}
                                            </button>
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
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg md:text-xl font-semibold text-white">Bot Settings</h2>
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-gray-400">Synced with server</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="flex items-center space-x-2 mb-2">
                            <label className="block text-sm font-medium text-gray-300">
                                Private Key (Hidden)
                            </label>
                            {settings.privateKey !== originalSettings.privateKey && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">Modified</span>
                            )}
                        </div>
                        <input
                            type="password"
                            value={settings.privateKey}
                            onChange={(e) => setSettings(prev => ({ ...prev, privateKey: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter your base58 private key"
                        />
                    </div>

                    <div>
                        <div className="flex items-center space-x-2 mb-2">
                            <label className="block text-sm font-medium text-gray-300">
                                Token Page Destination
                            </label>
                            {settings.tokenPageDestination !== originalSettings.tokenPageDestination && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">Modified</span>
                            )}
                        </div>
                        <select
                            value={settings.tokenPageDestination}
                            onChange={(e) => setSettings(prev => ({ ...prev, tokenPageDestination: e.target.value }))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="neo_bullx">Neo BullX</option>
                            <option value="axiom">Axiom</option>
                        </select>
                        <div className="flex items-center space-x-4 mt-2 text-xs">
                            <span className="text-gray-400">
                                Current: <span className="font-semibold text-blue-400">
                                    {settings.tokenPageDestination === 'neo_bullx' ? 'Neo BullX' : 'Axiom'}
                                </span>
                            </span>
                            <span className="text-gray-500">
                                Server: <span className="font-semibold text-blue-400">
                                    {originalSettings.tokenPageDestination === 'neo_bullx' ? 'Neo BullX' : 'Axiom'}
                                </span>
                            </span>
                        </div>
                    </div>

                    <div className="mt-6 p-4 bg-gray-700 rounded-lg border-2 border-blue-500/30">
                        <h3 className="text-base font-medium text-white mb-3 flex items-center">
                            <span className="mr-2">📊</span>
                            Server Status Summary
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                                <span className="text-gray-300">Private Key</span>
                                <span className={`font-semibold ${originalSettings.privateKey ? 'text-green-400' : 'text-red-400'}`}>
                                    {originalSettings.privateKey ? '✅ Set' : '❌ Not Set'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                                <span className="text-gray-300">Token Page</span>
                                <span className="font-semibold text-blue-400">
                                    {originalSettings.tokenPageDestination === 'neo_bullx' ? 'Neo BullX' : 'Axiom'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {hasBasicSettingsChanged() && (
                        <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                            <div className="flex items-start space-x-2">
                                <span className="text-yellow-400 text-lg">⚠️</span>
                                <div>
                                    <p className="text-sm text-yellow-300 font-medium">You have unsaved changes</p>
                                    <p className="text-xs text-yellow-400 mt-1">
                                        Click "Save Basic Settings" below to apply your changes to the server
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col space-y-2">
                        <button
                            onClick={() => updateSettings({
                                privateKey: settings.privateKey,
                                tokenPageDestination: settings.tokenPageDestination
                            })}
                            disabled={!hasBasicSettingsChanged()}
                            className={`w-full px-4 py-3 rounded-lg transition-all font-medium ${hasBasicSettingsChanged()
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {hasBasicSettingsChanged() ? '💾 Save Basic Settings' : '✅ All Changes Saved'}
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

            {renderDetectionSettings()}

            {/* Filter Settings */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg md:text-xl font-semibold text-white">Filter Settings</h2>
                    {/* Sync indicator */}
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-gray-400">Synced with server</span>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Detection Only Mode Toggle */}
                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                        <div className="flex flex-col space-y-3 md:flex-row md:items-center md:justify-between md:space-y-0">
                            <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                    <h3 className="text-base md:text-lg font-medium text-green-400">🛡️ Detection Only Mode</h3>
                                    {settings.detectionOnlyMode !== originalSettings.detectionOnlyMode && (
                                        <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">Modified</span>
                                    )}
                                </div>
                                <p className="text-sm text-green-300 mb-2">SAFE: Only detect and list tokens, don't buy them</p>
                                <div className="flex items-center space-x-4 text-xs">
                                    <span className="text-gray-400">
                                        Current: <span className={`font-semibold ${settings.detectionOnlyMode ? 'text-green-400' : 'text-red-400'}`}>
                                            {settings.detectionOnlyMode ? 'ON' : 'OFF'}
                                        </span>
                                    </span>
                                    <span className="text-gray-500">
                                        Server: <span className={`font-semibold ${originalSettings.detectionOnlyMode ? 'text-green-400' : 'text-red-400'}`}>
                                            {originalSettings.detectionOnlyMode ? 'ON' : 'OFF'}
                                        </span>
                                    </span>
                                </div>
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
                            <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                    <h3 className="text-base md:text-lg font-medium text-red-400">⚠️ Snipe All New Tokens</h3>
                                    {settings.snipeAllTokens !== originalSettings.snipeAllTokens && (
                                        <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">Modified</span>
                                    )}
                                </div>
                                <p className="text-sm text-red-300 mb-2">DANGER: This will snipe EVERY new token (bypasses all filters)</p>
                                <div className="flex items-center space-x-4 text-xs">
                                    <span className="text-gray-400">
                                        Current: <span className={`font-semibold ${settings.snipeAllTokens ? 'text-red-400' : 'text-green-400'}`}>
                                            {settings.snipeAllTokens ? 'ON ⚠️' : 'OFF ✅'}
                                        </span>
                                    </span>
                                    <span className="text-gray-500">
                                        Server: <span className={`font-semibold ${originalSettings.snipeAllTokens ? 'text-red-400' : 'text-green-400'}`}>
                                            {originalSettings.snipeAllTokens ? 'ON ⚠️' : 'OFF ✅'}
                                        </span>
                                    </span>
                                </div>
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
                        <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                                <h3 className="text-base md:text-lg font-medium text-white">Enable Admin Filtering</h3>
                                {settings.enableAdminFilter !== originalSettings.enableAdminFilter && (
                                    <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">Modified</span>
                                )}
                            </div>
                            <p className="text-sm text-gray-400 mb-2">Only detect tokens from wallet addresses or Twitter admins in your lists</p>
                            <div className="flex items-center space-x-4 text-xs">
                                <span className="text-gray-400">
                                    Current: <span className={`font-semibold ${settings.enableAdminFilter ? 'text-purple-400' : 'text-gray-400'}`}>
                                        {settings.enableAdminFilter ? 'ON' : 'OFF'}
                                    </span>
                                </span>
                                <span className="text-gray-500">
                                    Server: <span className={`font-semibold ${originalSettings.enableAdminFilter ? 'text-purple-400' : 'text-gray-400'}`}>
                                        {originalSettings.enableAdminFilter ? 'ON' : 'OFF'}
                                    </span>
                                </span>
                            </div>
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
                        <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                                <h3 className="text-base md:text-lg font-medium text-white">Prevent Community Reuse</h3>
                                {settings.enableCommunityReuse !== originalSettings.enableCommunityReuse && (
                                    <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">Modified</span>
                                )}
                            </div>
                            <p className="text-sm text-gray-400 mb-2">Skip tokens if Twitter community was already used</p>
                            <div className="flex items-center space-x-4 text-xs">
                                <span className="text-gray-400">
                                    Current: <span className={`font-semibold ${settings.enableCommunityReuse ? 'text-green-400' : 'text-gray-400'}`}>
                                        {settings.enableCommunityReuse ? 'ON' : 'OFF'}
                                    </span>
                                </span>
                                <span className="text-gray-500">
                                    Server: <span className={`font-semibold ${originalSettings.enableCommunityReuse ? 'text-green-400' : 'text-gray-400'}`}>
                                        {originalSettings.enableCommunityReuse ? 'ON' : 'OFF'}
                                    </span>
                                </span>
                            </div>
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

                    {/* Server Status Summary */}
                    <div className="mt-6 p-4 bg-gray-700 rounded-lg border-2 border-blue-500/30">
                        <h3 className="text-base font-medium text-white mb-3 flex items-center">
                            <span className="mr-2">📊</span>
                            Server Status Summary
                        </h3>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                                <span className="text-gray-300">Detection Only</span>
                                <span className={`font-semibold ${originalSettings.detectionOnlyMode ? 'text-green-400' : 'text-red-400'}`}>
                                    {originalSettings.detectionOnlyMode ? '✅ ON' : '❌ OFF'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                                <span className="text-gray-300">Snipe All</span>
                                <span className={`font-semibold ${originalSettings.snipeAllTokens ? 'text-red-400' : 'text-green-400'}`}>
                                    {originalSettings.snipeAllTokens ? '⚠️ ON' : '✅ OFF'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                                <span className="text-gray-300">Admin Filter</span>
                                <span className={`font-semibold ${originalSettings.enableAdminFilter ? 'text-purple-400' : 'text-gray-400'}`}>
                                    {originalSettings.enableAdminFilter ? '✅ ON' : '❌ OFF'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                                <span className="text-gray-300">Block Reuse</span>
                                <span className={`font-semibold ${originalSettings.enableCommunityReuse ? 'text-green-400' : 'text-gray-400'}`}>
                                    {originalSettings.enableCommunityReuse ? '✅ ON' : '❌ OFF'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Unsaved Changes Warning */}
                    {hasFilterSettingsChanged() && (
                        <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                            <div className="flex items-start space-x-2">
                                <span className="text-yellow-400 text-lg">⚠️</span>
                                <div>
                                    <p className="text-sm text-yellow-300 font-medium">You have unsaved changes</p>
                                    <p className="text-xs text-yellow-400 mt-1">
                                        Click "Save Filter Settings" below to apply your changes to the server
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="flex flex-col space-y-2">
                        <button
                            onClick={() => updateFilterSettings({
                                enableAdminFilter: settings.enableAdminFilter,
                                enableCommunityReuse: settings.enableCommunityReuse,
                                snipeAllTokens: settings.snipeAllTokens,
                                detectionOnlyMode: settings.detectionOnlyMode,
                                bonkTokensOnly: settings.bonkTokensOnly
                            })}
                            disabled={!hasFilterSettingsChanged()}
                            className={`w-full px-4 py-3 rounded-lg transition-all font-medium ${hasFilterSettingsChanged()
                                ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {hasFilterSettingsChanged() ? '💾 Save Filter Settings' : '✅ All Changes Saved'}
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

    const renderTwitterSession = () => (
        <div className="space-y-4 md:space-y-6">
            {/* Twitter Session Status */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-4">
                    <div>
                        <h2 className="text-lg md:text-xl font-semibold text-white">🐦 Twitter Session Management</h2>
                        <p className="text-sm text-gray-400">Manage Twitter login session for community admin scraping</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${twitterSessionStatus.loggedIn ? 'bg-green-500' :
                            twitterSessionStatus.checking ? 'bg-yellow-500' : 'bg-red-500'
                            }`}></div>
                        <span className="text-sm text-gray-300">
                            {twitterSessionStatus.checking ? 'Checking...' :
                                twitterSessionStatus.loggedIn ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>

                {/* Session Status Display */}
                <div className="bg-gray-700 rounded-lg p-4 mb-4">
                    <h3 className="text-lg font-semibold text-white mb-3">Current Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span className="text-gray-400 text-sm">Scraper Initialized:</span>
                            <div className="flex items-center space-x-2">
                                <span className={`font-medium ${twitterSessionStatus.initialized ? 'text-green-400' : 'text-red-400'}`}>
                                    {twitterSessionStatus.initialized ? '✅ Yes' : '❌ No'}
                                </span>
                            </div>
                        </div>
                        <div>
                            <span className="text-gray-400 text-sm">Logged In:</span>
                            <div className="flex items-center space-x-2">
                                <span className={`font-medium ${twitterSessionStatus.loggedIn ? 'text-green-400' : 'text-red-400'}`}>
                                    {twitterSessionStatus.loggedIn ? '✅ Yes' : '❌ No'}
                                </span>
                            </div>
                        </div>
                        {twitterSessionStatus.url && (
                            <div className="md:col-span-2">
                                <span className="text-gray-400 text-sm">Current URL:</span>
                                <div className="mt-1">
                                    <code className="text-xs bg-gray-600 px-2 py-1 rounded text-white">
                                        {twitterSessionStatus.url}
                                    </code>
                                </div>
                            </div>
                        )}
                        {twitterSessionStatus.error && (
                            <div className="md:col-span-2">
                                <span className="text-red-400 text-sm">Error:</span>
                                <div className="mt-1">
                                    <code className="text-xs bg-red-900/20 border border-red-500/30 px-2 py-1 rounded text-red-400">
                                        {twitterSessionStatus.error}
                                    </code>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <button
                        onClick={checkTwitterSession}
                        disabled={twitterSessionStatus.checking}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        {twitterSessionStatus.checking ? '🔄 Checking...' : '🔍 Check Status'}
                    </button>

                    <button
                        onClick={openTwitterLogin}
                        disabled={twitterSessionStatus.loggedIn}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        {twitterSessionStatus.loggedIn ? '✅ Logged In' : '🌐 Login'}
                    </button>

                    <button
                        onClick={performTwitterLogout}
                        disabled={!twitterSessionStatus.loggedIn || twitterSessionStatus.checking}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        {twitterSessionStatus.checking ? '🔄 Logging out...' : '🚪 Logout'}
                    </button>

                    <button
                        onClick={reopenTwitterBrowser}
                        disabled={twitterSessionStatus.checking}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        {twitterSessionStatus.checking ? '🔄 Opening...' : '🔄 Reopen Browser'}
                    </button>
                </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🎯 Twitter API Status</h3>

                <div className="bg-gray-700 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span className="text-gray-400 text-sm">API Credits:</span>
                            <div className="flex items-center space-x-2">
                                <span className={`font-medium ${twitterSessionStatus.apiCreditsExhausted
                                    ? 'text-red-400'
                                    : twitterSessionStatus.apiError
                                        ? 'text-yellow-400'
                                        : 'text-green-400'
                                    }`}>
                                    {twitterSessionStatus.apiCreditsExhausted ? '❌ Exhausted' :
                                        twitterSessionStatus.apiError ? '⚠️ Error' : '✅ Available'}
                                </span>
                            </div>
                        </div>
                        <div>
                            <span className="text-gray-400 text-sm">API Status:</span>
                            <div className="flex items-center space-x-2">
                                <span className="text-white">
                                    {twitterSessionStatus.apiCreditsExhausted ? 'Needs Recharge' :
                                        twitterSessionStatus.apiError ? 'Has Issues' : 'Active'}
                                </span>
                            </div>
                        </div>
                        {twitterSessionStatus.lastApiError && (
                            <div className="md:col-span-2">
                                <span className="text-red-400 text-sm">Last API Error:</span>
                                <div className="mt-1">
                                    <code className="text-xs bg-red-900/20 border border-red-500/30 px-2 py-1 rounded text-red-400">
                                        {twitterSessionStatus.lastApiError}
                                    </code>
                                </div>
                            </div>
                        )}
                    </div>

                    {twitterSessionStatus.apiCreditsExhausted && (
                        <div className="mt-4 bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                            <h4 className="text-red-400 font-medium mb-2">💳 API Credits Exhausted</h4>
                            <p className="text-red-300 text-sm mb-3">
                                Your Twitter API credits are depleted. Community scraping will fail until you recharge your twitterapi.io account.
                            </p>
                            <button
                                onClick={() => {
                                    if (window.electronAPI && window.electronAPI.openExternalURL) {
                                        window.electronAPI.openExternalURL('https://twitterapi.io/dashboard');
                                    } else {
                                        window.open('https://twitterapi.io/dashboard', '_blank');
                                    }
                                    addNotification('info', '🌐 Opening twitterapi.io dashboard for credit recharge');
                                }}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                            >
                                💳 Recharge API Credits
                            </button>
                        </div>
                    )}

                    {twitterSessionStatus.apiError && !twitterSessionStatus.apiCreditsExhausted && (
                        <div className="mt-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
                            <h4 className="text-yellow-400 font-medium mb-2">⚠️ API Error Detected</h4>
                            <p className="text-yellow-300 text-sm mb-2">
                                There was an issue with the Twitter API: {twitterSessionStatus.apiError}
                            </p>
                            <p className="text-yellow-300 text-sm">
                                Community scraping may be affected. Check your API configuration or try again later.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Updated Instructions */}
            <div className="bg-gray-800 rounded-lg p-4 md:p-6">
                <h3 className="text-lg font-semibold text-white mb-4">📋 How to Setup Twitter Session</h3>
                <div className="space-y-4">
                    <div className="bg-gray-700 rounded-lg p-4">
                        <h4 className="text-white font-medium mb-2">Step 1: Automatic Login</h4>
                        <p className="text-sm text-gray-300 mb-2">
                            Click the "🌐 Login" button. The system will automatically log you in using the credentials configured in the server environment variables.
                        </p>
                        <div className="text-xs text-yellow-400 bg-yellow-900/20 p-2 rounded mt-2">
                            <strong>Note:</strong> Twitter credentials will be configured in the server's .env file (TWITTER_USERNAME and TWITTER_PASSWORD)
                        </div>
                    </div>

                    <div className="bg-gray-700 rounded-lg p-4">
                        <h4 className="text-white font-medium mb-2">Step 2: Verify Login Success</h4>
                        <p className="text-sm text-gray-300 mb-2">
                            After clicking login, the system will automatically attempt to log in. Check the status above - it should show "Logged In: ✅ Yes".
                        </p>
                        <p className="text-sm text-gray-400">
                            If login fails, check that the correct credentials are set in the server environment.
                        </p>
                    </div>

                    <div className="bg-gray-700 rounded-lg p-4">
                        <h4 className="text-white font-medium mb-2">Step 3: Session Verification</h4>
                        <p className="text-sm text-gray-300 mb-2">
                            Use "🔍 Check Status" to verify your session is active at any time. The session persists automatically and is saved for future use.
                        </p>
                        <p className="text-sm text-gray-400">
                            If session expires, simply click "🌐 Login" again for automatic re-authentication.
                        </p>
                    </div>

                    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                        <h4 className="text-green-400 font-medium mb-2">✅ When Session is Active</h4>
                        <ul className="text-sm text-green-300 space-y-1">
                            <li>• Community scraping will work automatically when tokens are detected</li>
                            <li>• The system can access Twitter community moderator pages</li>
                            <li>• Admin detection from communities will function properly</li>
                            <li>• Session data is saved and persists across server restarts</li>
                        </ul>
                    </div>

                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                        <h4 className="text-blue-400 font-medium mb-2">🔧 Troubleshooting</h4>
                        <ul className="text-sm text-blue-300 space-y-1">
                            <li>• If "🌐 Login" fails: Check server credentials in .env file</li>
                            <li>• If session shows "Inactive": Click "🌐 Login" to re-authenticate</li>
                            <li>• If browser crashes: Use "🔄 Reopen Browser" to restart</li>
                            <li>• For manual logout: Use "🚪 Logout" button. Do not logout if it isn't needed (multiple logins logout might ban your account from twitter)</li>
                        </ul>
                    </div>

                </div>
            </div>


        </div>
    );

    const AddFormModal = ({ listType, onClose, onAdd }) => {
        // ✅ Use local state for form data within modal

        const [localFormData, setLocalFormData] = useState({
            address: '',
            username: '',
            amount: settings.globalSnipeSettings.amount,
            fees: settings.globalSnipeSettings.fees,
            mevProtection: settings.globalSnipeSettings.mevProtection,
            soundNotification: settings.globalSnipeSettings.soundNotification,
            priorityFee: settings.globalSnipeSettings.priorityFee  // ✅ ADD THIS LINE
        });

        // ✅ Reset form when modal opens or listType changes
        useEffect(() => {
            setLocalFormData({
                address: '',
                username: '',
                amount: settings.globalSnipeSettings.amount,
                fees: settings.globalSnipeSettings.fees,
                mevProtection: settings.globalSnipeSettings.mevProtection,
                soundNotification: settings.globalSnipeSettings.soundNotification,
                priorityFee: settings.globalSnipeSettings.priorityFee
            });
        }, [listType, settings.globalSnipeSettings]);

        const handleSubmit = () => {
            onAdd(listType, {
                address: localFormData.address,
                amount: localFormData.amount,
                fees: localFormData.fees,
                mevProtection: localFormData.mevProtection,
                soundNotification: localFormData.soundNotification,
                priorityFee: localFormData.priorityFee
            });
        };

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
                                value={localFormData.address}
                                onChange={(e) => setLocalFormData(prev => ({
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
                                    value={localFormData.amount}
                                    onChange={(e) => setLocalFormData(prev => ({
                                        ...prev,
                                        amount: parseFloat(e.target.value) || 0
                                    }))}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Slippage (%)</label>
                                <input
                                    type="number"
                                    value={localFormData.fees}
                                    onChange={(e) => setLocalFormData(prev => ({
                                        ...prev,
                                        fees: parseInt(e.target.value) || 0
                                    }))}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Priority Fee (SOL)</label>
                            <input
                                type="number"
                                step="0.0001"
                                value={localFormData.priorityFee}
                                onChange={(e) => setLocalFormData(prev => ({
                                    ...prev,
                                    priorityFee: parseFloat(e.target.value) || 0
                                }))}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* ✅ MEV Protection - DISABLED (read-only) */}
                        <div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={localFormData.mevProtection}
                                    onChange={(e) => setLocalFormData(prev => ({
                                        ...prev,
                                        mevProtection: e.target.checked
                                    }))}
                                    disabled={true}
                                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <label className="text-sm text-gray-300">🛡️ MEV Protection (From Global Settings)</label>
                            </div>
                            <p className="text-xs text-gray-400 ml-6 mt-1">
                                MEV Protection is inherited from Global Snipe Settings and cannot be changed per-admin.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Sound Notification</label>
                            <div className="flex space-x-2">
                                <select
                                    value={localFormData.soundNotification}
                                    onChange={(e) => setLocalFormData(prev => ({
                                        ...prev,
                                        soundNotification: e.target.value
                                    }))}
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
                                    onClick={() => previewSound(localFormData.soundNotification)}
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
                            onClick={handleSubmit}
                            disabled={!localFormData.address || !localFormData.amount || !localFormData.fees}
                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                        >
                            <span>✅ Add & Save to Firebase</span>
                        </button>
                        <button
                            onClick={onClose}
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
                                    <span className="bg-blue-600 text-white px-2 py-1 rounded">{item.fees}% Slippage</span>
                                    <span className="bg-purple-600 text-white px-2 py-1 rounded">{item.priorityFee || 0} SOL Priority</span>
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
    // ============================================================================
    // SIMPLIFIED DEMO SECTION FOR APP.JS
    // Purpose: Test gRPC blockchain listener with any token address
    // ============================================================================

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

            {showAddForm.show && (
                <AddFormModal
                    listType={showAddForm.type}
                    onClose={() => setShowAddForm({ type: null, show: false })}
                    onAdd={addListItem}
                />
            )}
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
                            onClick={() => setActiveTab('tweets')}
                            className={`py-3 md:py-4 px-2 border-b-2 transition-colors whitespace-nowrap text-sm md:text-base ${activeTab === 'tweets'
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            📱 Tweets
                            {usedTweets.length > 0 && (
                                <span className="ml-1 md:ml-2 bg-blue-600 text-white text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full">
                                    {usedTweets.length}
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

                        {/*<button
                            onClick={() => setActiveTab('demo')}
                            className={`py-3 md:py-4 px-2 border-b-2 transition-colors whitespace-nowrap text-sm md:text-base ${activeTab === 'demo'
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            🧪 Demo
                        </button>

                        <button
                            onClick={() => setActiveTab('twitter')}
                            className={`py-3 md:py-4 px-2 border-b-2 transition-colors whitespace-nowrap text-sm md:text-base ${activeTab === 'twitter'
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            🐦 Twitter Session
                        </button>*/}

                        <button
                            onClick={() => setActiveTab('snipe-test')}
                            className={`py-3 md:py-4 px-2 border-b-2 transition-colors whitespace-nowrap text-sm md:text-base ${activeTab === 'snipe-test'
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            🎯 Snipe Test
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
                {activeTab === 'tweets' && renderTweetManagement()}
                {activeTab === 'demo' && renderDemoTab()}
                {activeTab === 'snipe-test' && <SnipeTest />}
                {activeTab === 'twitter' && renderTwitterSession()}
                {activeTab === 'settings' && (
                    <div className="space-y-6">
                        {renderSettings()}
                        {renderGlobalSnipeSettings()}
                        {renderSoundManagement()}
                    </div>
                )}
            </main>

            {/* Enhanced Popups */}
            {renderSecondaryPopup()}
            {renderPopupBlockerModal()}
            {renderSlippageErrorPopup()}


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
                            <span>📱 Tweets:</span>
                            <span className="text-blue-400 font-medium">{usedTweets.length}</span>
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
