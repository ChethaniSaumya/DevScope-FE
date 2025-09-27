// ========== COMPLETE FIXED SERVER.JS WITH FIREBASE ADMIN LISTS ==========

const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
// Add these imports at the top with other requires
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const https = require('https');

const { chromium } = require('playwright');
const UserAgent = require('user-agents');
const timingLogFile = path.join(__dirname, 'token_timing_log.txt');
const activeScrapingSessions = new Map();
const scrapingResults = new Map();
const SCRAPING_RESULT_CACHE_TIME = 30000;
dotenv.config();

const COMMUNITY_CACHE_FILE = path.join(__dirname, 'usedCommunities.json');
const TWEETS_CACHE_FILE = path.join(__dirname, 'usedTweets.json'); // ADD THIS
const FIREBASE_SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds
const { TokenMetadataExtractor: OriginalExtractor } = require('./token-metadata-extractor');


let tweetCache = {
    tweets: new Map(),
    pendingSync: new Set(),
    lastSyncToFirebase: null
};

// In-memory cache for fastest access
let communityCache = {
    communities: new Map(),
    pendingSync: new Set(),
    lastSyncToFirebase: null
};

//TWITTER FOR LOCALHOST TEST 8.25 
const { loadTwitterCookies, getTwitterHeaders } = require('./import-cookies');
//TWITTER FOR LOCALHOST TEST 8.25 

// Initialize Firebase Admin SDaK
// Initialize Firebase Admin SDzK from environment variables
const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

// 1. SSL Configuration with Enhanced Security
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'ssl/devscope.fun.key')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl/devscope.fun.crt')),
    ca: fs.readFileSync(path.join(__dirname, 'ssl/devscope.fun-ca.crt')),
    // Security best practices
    minVersion: 'TLSv1.2',
    ciphers: [
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384'
    ].join(':'),
    honorCipherOrder: true
};

const secondaryMatchesLogFile = path.join(__dirname, 'secondary_matches_timing.txt');

function logSecondaryMatch(tokenAddress, adminName, processingTime) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] Token: ${tokenAddress} | Admin: ${adminName} | Time: ${processingTime}ms\n`;

    try {
        fs.appendFileSync(secondaryMatchesLogFile, logEntry);
        console.log(`📝 Secondary match logged: ${adminName} - ${processingTime}ms`);
    } catch (error) {
        console.error('Error writing to secondary matches log file:', error);
    }
}

function logAdminMatchTiming(tokenAddress, adminName, matchType, processingTime, browserOpenTime = null) {
    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] Token: ${tokenAddress} | Admin: ${adminName} | Match: ${matchType} | Detection: ${processingTime}ms`;

    if (browserOpenTime !== null) {
        logEntry += ` | BrowserOpen: ${browserOpenTime}ms`;
    }

    logEntry += '\n';

    try {
        fs.appendFileSync(path.join(__dirname, 'admin_timing_debug.txt'), logEntry);
        console.log(`🔍 Admin timing logged: ${adminName} - Detection: ${processingTime}ms${browserOpenTime ? `, Browser: ${browserOpenTime}ms` : ''}`);
    } catch (error) {
        console.error('Error writing to admin timing debug file:', error);
    }
}

// ========== COMPLETE initializeSecondaryMatchesLog FUNCTION ==========
function initializeSecondaryMatchesLog() {
    const header = `=== SECONDARY ADMIN MATCHES TIMING LOG ===\nStarted: ${new Date().toISOString()}\nFormat: [Timestamp] Token: [Address] | Admin: [Name] | Time: [ms]\n\n`;
    try {
        if (!fs.existsSync(secondaryMatchesLogFile)) {
            fs.writeFileSync(secondaryMatchesLogFile, header);
            console.log(`📝 Secondary matches timing log initialized: ${secondaryMatchesLogFile}`);
        }
    } catch (error) {
        console.error('Error initializing secondary matches log file:', error);
    }
}

function testSecondaryMatchLogging() {
    console.log('🔍 Testing secondary match logging...');
    logSecondaryMatch('TEST_TOKEN_ADDRESS_123', 'TEST_ADMIN_NAME', 1234);
    console.log('✅ Test logging completed - check secondary_matches_timing.txt file');
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://devscope-cad93-default-rtdb.firebaseio.com"
});

const db = admin.firestore();

const app = express();
const httpServer = require('http').createServer(app);
const httpsServer = https.createServer(sslOptions, app);

// Create WebSocket servers for both HTTP and HTTPS
const wss = new WebSocket.Server({ server: httpServer });
const wssSecure = new WebSocket.Server({ server: httpsServer });

function logTokenTiming(tokenAddress, tokenName, matchType, matchedEntity, processingTime, platform) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] Token: ${tokenAddress} | Name: ${tokenName || 'Unknown'} | Match: ${matchType || 'no_match'} | Entity: ${matchedEntity || 'None'} | Time: ${processingTime}ms | Platform: ${platform}\n`;

    try {
        fs.appendFileSync(timingLogFile, logEntry);
    } catch (error) {
        console.error('Error writing to timing log file:', error);
    }
}

function initializeTimingLog() {
    const header = `=== TOKEN TIMING LOG ===\nStarted: ${new Date().toISOString()}\n\n`;
    try {
        if (!fs.existsSync(timingLogFile)) {
            fs.writeFileSync(timingLogFile, header);
            console.log(`📝 Token timing log initialized: ${timingLogFile}`);
        }
    } catch (error) {
        console.error('Error initializing timing log file:', error);
    }
}

// Handle WebSocket connections for both servers
function handleWebSocketConnection(ws) {
    console.log('Client connected to WebSocket');
    wsClients.add(ws);

    ws.send(JSON.stringify({
        type: 'bot_status',
        data: { isRunning: botState.isRunning }
    }));

    ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
        wsClients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        wsClients.delete(ws);
    });
}

// Apply the same handler to both WebSocket servers
wss.on('connection', handleWebSocketConnection);
wssSecure.on('connection', handleWebSocketConnection);

app.use(cors());
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3001;
const HELIUS_RPC = process.env.HELIUS_RPC || "https://mainnet.helius-rpc.com/?api-key=82e3e020-5346-402d-a9ec-ab6e0bc4a5e9";
const PUMP_PORTAL_API_KEY = process.env.PUMP_PORTAL_API_KEY;

const TWITTER_CONFIG = {
    username: process.env.TWITTER_USERNAME,
    password: process.env.TWITTER_PASSWORD,
    sessionDir: './session',
    cookiesPath: './session/twitter-cookies.json',
    sessionDurationHours: 24,
    timeouts: {
        navigation: 30000,
        selector: 10000,
        action: 5000
    }
};

function createBlueLogger() {
    return {
        log: (message) => console.log('\x1b[96m%s\x1b[0m', `🔵 ${message}`),
        logBold: (message) => console.log('\x1b[96m\x1b[1m%s\x1b[0m', `🔵 ${message}`),
        separator: () => console.log('\x1b[96m\x1b[1m%s\x1b[0m', '🔵 ═══════════════════════════════════════════════════'),
        success: (message) => console.log('\x1b[96m\x1b[1m%s\x1b[0m', `🔵 ✅ ${message}`),
        error: (message) => console.log('\x1b[96m\x1b[1m%s\x1b[0m', `🔵 ❌ ${message}`),
        warning: (message) => console.log('\x1b[96m\x1b[1m%s\x1b[0m', `🔵 ⚠️ ${message}`),
        info: (message) => console.log('\x1b[96m%s\x1b[0m', `🔵 ℹ️ ${message}`)
    };
}

const connection = new Connection(HELIUS_RPC, {
    commitment: 'processed',
    confirmTransactionInitialTimeout: 30000,
});

const DEMO_TOKEN_TEMPLATES = [
    {
        name: "Macaroni Mouse",
        symbol: "MACARONI",
        uri: "https://eu-dev.uxento.io/data/cmdvcbd2n00jghb190aiy0y8r",
        pool: "bonk",
        platform: "letsbonk",
        twitterHandle: "Rainmaker1973"
    },
    {
        name: "BuuCoin",
        symbol: "MAJINBUU",
        uri: "https://ipfs.io/ipfs/QmTGkzD267qcG32NvyAhxgijxvhtsbRaPUx7WJMNHZDY35",
        pool: "pump",
        platform: "pumpfun",
        twitterHandle: "CryptoMajin"
    },
    {
        name: "Doge Supreme",
        symbol: "DSUP",
        uri: "https://ipfs.io/ipfs/QmSampleDogeImage123",
        pool: "pump",
        platform: "pumpfun",
        twitterHandle: "DogeSupremeTeam"
    },
    {
        name: "Moon Cat",
        symbol: "MCAT",
        uri: "https://ipfs.io/ipfs/QmSampleCatImage456",
        pool: "bonk",
        platform: "letsbonk",
        twitterHandle: "MoonCatOfficial"
    }
];

// Demo wallet addresses for testing
const DEMO_WALLETS = [
    "HaSdFi2wKLTguxuh4PMBgZuAscbMGEF8XnMHgD5vUeGr",
    "HJdauMU7e8tmM7NFDjV9BSoVzZobVS88wnp3TDAfjuE",
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
];

// ========== FIREBASE HELPER FUNCTIONS ==========

async function saveAdminListToFirebase(listType, adminData) {
    try {
        console.log(`🔥 Saving ${listType} to Firebase:`, adminData);

        const docRef = db.collection(listType).doc(adminData.id);
        await docRef.set({
            ...adminData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ SUCCESS: ${listType} entry ${adminData.id} saved to Firebase`);
        return true;
    } catch (error) {
        console.error(`❌ ERROR saving ${listType} to Firebase:`, error);
        return false;
    }
}

async function loadAdminListFromFirebase(listType) {
    try {
        console.log(`📥 Loading ${listType} from Firebase`);

        const snapshot = await db.collection(listType).orderBy('createdAt', 'desc').get();
        const adminList = [];

        snapshot.forEach(doc => {
            adminList.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`✅ Loaded ${adminList.length} entries from Firebase ${listType}`);
        return adminList;
    } catch (error) {
        console.error(`❌ ERROR loading ${listType} from Firebase:`, error);
        return [];
    }
}

async function deleteAdminFromFirebase(listType, adminId) {
    try {
        console.log(`🗑️ Deleting ${adminId} from Firebase ${listType}`);

        await db.collection(listType).doc(adminId).delete();

        console.log(`✅ SUCCESS: ${adminId} deleted from Firebase ${listType}`);
        return true;
    } catch (error) {
        console.error(`❌ ERROR deleting ${adminId} from Firebase ${listType}:`, error);
        return false;
    }
}

const SOUNDS_DIR = path.join(__dirname, 'uploads', 'sounds');

// Ensure sounds directory exists
async function ensureSoundsDir() {
    try {
        await fsPromises.mkdir(SOUNDS_DIR, { recursive: true });
        console.log('📁 Sounds directory created/verified');
    } catch (error) {
        console.error('Error creating sounds directory:', error);
    }
}

// Configure multer for sound uploads
const soundStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
        await ensureSoundsDir();
        cb(null, SOUNDS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `sound-${uniqueSuffix}${ext}`);
    }
});

const uploadSound = multer({
    storage: soundStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'audio/wav', 'audio/wave', 'audio/x-wav',
            'audio/mpeg', 'audio/mp3',
            'audio/ogg', 'audio/vorbis',
            'audio/mp4', 'audio/m4a', 'audio/x-m4a'
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only audio files are allowed.'), false);
        }
    }
});

// Helper function to determine MIME type
function getMimeType(ext) {
    const mimeTypes = {
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/m4a'
    };
    return mimeTypes[ext.toLowerCase()] || 'audio/unknown';
}

// ========== ORIGINAL BOTSTATE CLASS ==========

// ADD THIS TWITTER SCRAPER CLASS
class TwitterCommunityAdminScraper {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.sessionActive = false;
        this.isInitialized = false;
        this.sessionPersistentDataDir = './session/twitter-session';
        this.responseHandler = null;
    }

    async init() {
        if (this.isInitialized) return true;

        try {
            console.log('🤖 Initializing Twitter scraper with persistent session...');
            await this.ensureDirectories();
            const userAgent = new UserAgent({ deviceCategory: 'desktop' });

            // ✅ FIXED: launchPersistentContext returns BrowserContext, not Browser
            this.browser = await chromium.launchPersistentContext(this.sessionPersistentDataDir, {
                headless: true,
                userAgent: userAgent.toString(),
                viewport: { width: 1366, height: 768 },
                args: [
                    '--no-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-extensions',
                    '--no-first-run',
                    '--disable-default-apps'
                ]
            });

            // ✅ FIXED: Get page from the context correctly
            const pages = this.browser.pages();
            this.page = pages[0] || await this.browser.newPage();

            this.isInitialized = true;
            console.log('✅ Twitter scraper initialized with persistent session');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Twitter scraper:', error);
            return false;
        }
    }

    // Add this method to TwitterCommunityAdminScraper class (around line 350)

    /*
    Main Changes:
    
    Added cookie loading functionality:
    javascriptconst cookies = loadTwitterCookies(); // NEW - loads cookies from your import
    
    Added cookie injection into browser:
    javascriptawait this.page.context().addCookies(cookies); // NEW - applies cookies to browser
    */

    async automaticLogin() {
        try {
            console.log('🍪 Loading imported Twitter session from cookies...');

            // Load cookies using the import-cookies helper
            const cookies = loadTwitterCookies();

            if (cookies && cookies.length > 0) {
                // Add cookies to the browser context
                await this.page.context().addCookies(cookies);
                console.log(`✅ Loaded ${cookies.length} cookies from imported session`);

                // Navigate to Twitter home to verify session
                await this.page.goto('https://twitter.com/home', {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000
                });

                await this.page.waitForTimeout(3000);

                // Check if we're logged in
                const currentUrl = this.page.url();
                console.log(`🔍 Current URL after cookie load: ${currentUrl}`);

                // Check login indicators
                const loginIndicators = await this.page.evaluate(() => {
                    const indicators = {
                        notOnLoginPage: !window.location.href.includes('/login') && !window.location.href.includes('/i/flow/login'),
                        onHomePage: window.location.href.includes('/home'),
                        hasNavigation: !!document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
                            !!document.querySelector('[aria-label="Home timeline"]') ||
                            !!document.querySelector('[data-testid="primaryColumn"]'),
                        hasUserAvatar: !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]')
                    };
                    return indicators;
                });

                console.log('🔍 Login indicators:', loginIndicators);

                if (loginIndicators.notOnLoginPage && loginIndicators.onHomePage) {
                    console.log('✅ Session restored successfully using imported cookies');
                    this.sessionActive = true;

                    // Double-check by calling checkSessionStatus
                    const statusCheck = await this.checkSessionStatus();
                    if (statusCheck.loggedIn) {
                        return true;
                    }
                }
            } else {
                console.log('❌ No cookies found, trying traditional login...');
                return await this.fallbackLogin();
            }

        } catch (error) {
            console.error('❌ Session restore failed:', error.message);
            console.log('⚠️ Falling back to traditional login...');
            return await this.fallbackLogin();
        }
    }

    async scrapeCommunityAdminsBrowser(communityId) {
        const startTime = Date.now();
        const TIMEOUT_MS = 3000;
        console.log(`🎯 BROWSER FALLBACK: Community ${communityId} (${TIMEOUT_MS}ms timeout)`);

        try {
            const moderatorsUrl = `https://x.com/i/communities/${communityId}/moderators`;

            await this.page.goto(moderatorsUrl, {
                waitUntil: 'domcontentloaded',
                timeout: TIMEOUT_MS
            });

            const currentUrl = this.page.url();
            if (currentUrl.includes('login') || currentUrl.includes('/i/flow/login')) {
                console.log('❌ Session expired - redirected to login');
                throw new Error('Session expired. Please login manually again.');
            }

            console.log('🎯 ATTEMPTING API INTERCEPTION...');
            const apiAdmins = await this.extractAdminsFromApi(communityId);

            if (apiAdmins && apiAdmins.length > 0) {
                console.log(`✅ API INTERCEPTION SUCCESS: Found ${apiAdmins.length} admin(s)`);
                return apiAdmins;
            }

            console.log('⚠️ API INTERCEPTION FAILED: Falling back to DOM scraping...');
            await this.page.waitForTimeout(1000);

            const adminData = await this.extractAdminsFromDOM();
            console.log(`✅ BROWSER SCRAPING COMPLETED: Found ${adminData.length} admin(s) in ${Date.now() - startTime}ms`);
            return adminData;

        } catch (error) {
            console.error('❌ Browser scraping failed:', error);
            return [];
        }
    }

    async fallbackLogin() {
        // Your existing login code as fallback
        try {
            console.log('🔐 Attempting traditional login...');

            await this.page.goto('https://twitter.com/login', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            await this.page.waitForTimeout(2000);

            // Fill username
            await this.page.fill('input[name="text"]', TWITTER_CONFIG.username);
            await this.page.press('input[name="text"]', 'Enter');

            await this.page.waitForTimeout(3000);

            // Fill password
            await this.page.fill('input[name="password"]', TWITTER_CONFIG.password);
            await this.page.press('input[name="password"]', 'Enter');

            // Wait for any redirect and check success more reliably
            await this.page.waitForTimeout(5000);

            const finalUrl = this.page.url();
            if (!finalUrl.includes('/login') && !finalUrl.includes('/i/flow/login')) {
                console.log('✅ Traditional login successful');
                this.sessionActive = true;
                return true;
            } else {
                console.log('❌ Traditional login failed');
                return false;
            }

        } catch (error) {
            console.error('❌ Traditional login failed:', error.message);
            return false;
        }
    }

    async ensureDirectories() {
        try {
            await fsPromises.access('./session');
        } catch {
            await fsPromises.mkdir('./session', { recursive: true });
        }

        try {
            await fsPromises.access(this.sessionPersistentDataDir);
        } catch {
            await fsPromises.mkdir(this.sessionPersistentDataDir, { recursive: true });
        }
    }

    async checkSessionStatus() {
        if (!this.page) {
            return { loggedIn: false, error: 'Browser not initialized' };
        }

        try {
            const currentUrl = this.page.url();
            console.log(`🔍 Current page URL: ${currentUrl}`);

            // If we're on login page, definitely not logged in
            if (currentUrl.includes('/login') || currentUrl.includes('/i/flow/login')) {
                console.log('❌ On login page - not logged in');
                this.sessionActive = false;
                return { loggedIn: false, url: currentUrl };
            }

            // If we're on home page or any other x.com page (not login), we're logged in
            if (currentUrl.includes('x.com/home') || currentUrl.includes('twitter.com/home')) {
                console.log('✅ On home page - logged in');
                this.sessionActive = true;
                return {
                    loggedIn: true,
                    url: currentUrl,
                    method: 'home_page_url'
                };
            }

            // Additional check - wait a bit for page to load
            await this.page.waitForTimeout(2000);

            // Check for logged-in indicators with multiple strategies
            const loggedInCheck = await this.page.evaluate(() => {
                // Check if we're NOT on login page
                const notOnLogin = !window.location.href.includes('/login') &&
                    !window.location.href.includes('/i/flow/login');

                // Check if we're on home or another authenticated page
                const onHome = window.location.href.includes('/home');

                // If we're on home and not on login, we're logged in
                if (notOnLogin && onHome) {
                    return { method: 'url_check', loggedIn: true };
                }

                // Look for any Twitter navigation elements (they change frequently)
                const hasAnyTwitterElement =
                    !!document.querySelector('[data-testid*="Nav"]') ||
                    !!document.querySelector('[aria-label*="Home"]') ||
                    !!document.querySelector('[role="navigation"]') ||
                    !!document.querySelector('nav');

                if (notOnLogin && hasAnyTwitterElement) {
                    return { method: 'navigation_elements', loggedIn: true };
                }

                // If we're not on login page, assume logged in
                if (notOnLogin) {
                    return { method: 'not_on_login', loggedIn: true };
                }

                return { method: 'default', loggedIn: false };
            });

            console.log(`🔍 Session check result:`, loggedInCheck);

            this.sessionActive = loggedInCheck.loggedIn;
            return {
                loggedIn: loggedInCheck.loggedIn,
                url: currentUrl,
                method: loggedInCheck.method
            };

        } catch (error) {
            console.error('❌ Error checking session status:', error);
            this.sessionActive = false;
            return { loggedIn: false, error: error.message };
        }
    }

    async setupApiInterception() {
        // No longer needed - handler setup moved to extractAdminsFromApi
        return;
    }

    async extractAdminsFromApi(communityId) {
        try {
            const apiAdmins = [];
            let apiResponseReceived = false;

            // Create the response handler function (not as arrow function property)
            const responseHandler = async (response) => {
                const url = response.url();

                if (url.includes('communities') &&
                    (url.includes('moderators') || url.includes('members') || url.includes('users')) &&
                    response.status() === 200) {

                    try {
                        const data = await response.json();
                        apiResponseReceived = true;

                        // Handle different API response formats
                        if (data.users) {
                            data.users.forEach(user => {
                                if (user.role === 'admin' || user.role === 'moderator' || user.is_admin) {
                                    apiAdmins.push({
                                        username: user.screen_name || user.username,
                                        badgeType: user.role === 'admin' ? 'Admin' : 'Mod',
                                        source: 'api_interception'
                                    });
                                }
                            });
                        }

                        // Alternative response format
                        if (data.data && data.data.community && data.data.community.moderators) {
                            data.data.community.moderators.forEach(mod => {
                                if (mod.role === 'admin' || mod.role === 'moderator') {
                                    apiAdmins.push({
                                        username: mod.screen_name || mod.username,
                                        badgeType: mod.role === 'admin' ? 'Admin' : 'Mod',
                                        source: 'api_interception'
                                    });
                                }
                            });
                        }
                    } catch (e) {
                        // JSON parsing failed
                    }
                }
            };

            // Add the response listener
            this.page.on('response', responseHandler);

            // Navigate to the page
            await this.page.goto(`https://x.com/i/communities/${communityId}/moderators`, {
                waitUntil: 'domcontentloaded',
                timeout: 8000
            });

            await this.page.waitForTimeout(1500);

            // Remove the listener
            this.page.off('response', responseHandler);

            if (apiAdmins.length > 0) {
                console.log(`🎯 API interception found ${apiAdmins.length} admin(s)`);
                return apiAdmins;
            }

            return null;

        } catch (error) {
            console.log('API interception failed:', error.message);
            return null;
        }
    }

    async openLoginPage() {
        if (!this.page) {
            throw new Error('Browser not initialized');
        }

        try {
            console.log('🔗 Opening Twitter login page for manual login...');
            await this.page.goto('https://twitter.com/login');
            console.log('✅ Twitter login page opened - admin can now login manually');
            return true;
        } catch (error) {
            console.error('❌ Failed to open login page:', error);
            return false;
        }
    }

    async scrapeCommunityAdmins(communityId) {
        console.log(`🚀 API SCRAPING: Community ${communityId} (replacing browser scraping)`);

        try {
            // ✅ STEP 3A: Use twitterapi.io API instead of browser scraping
            const members = await twitterAPI.getAllCommunityModerators(communityId);

            // ✅ STEP 3B: Transform API response to match your existing format
            // Based on twitterapi.io response structure: userName, name, id, isBlueVerified, etc.
            const transformedAdmins = members.map(member => ({
                username: member.userName,           // ✅ CONFIRMED: "userName" from API docs
                displayName: member.name,            // ✅ CONFIRMED: "name" from API docs
                id: member.id,                       // ✅ CONFIRMED: "id" from API docs
                badgeType: 'Admin',                  // Treat all community members as admins
                source: 'twitter_api',               // Mark as API source
                verified: member.isBlueVerified,     // ✅ CONFIRMED: "isBlueVerified" from API docs
                followers: member.followers,         // ✅ CONFIRMED: "followers" from API docs
                following: member.following,         // ✅ CONFIRMED: "following" from API docs
                location: member.location,           // ✅ CONFIRMED: "location" from API docs
                description: member.description,     // ✅ CONFIRMED: "description" from API docs
                url: member.url,                     // ✅ CONFIRMED: "url" from API docs
                profileImage: member.profilePicture, // ✅ CONFIRMED: "profilePicture" from API docs
                profileBanner: member.coverPicture,  // ✅ CONFIRMED: "coverPicture" from API docs
                canDM: member.canDm,                 // ✅ CONFIRMED: "canDm" from API docs
                protected: false,                    // Not available in twitterapi.io response
                createdAt: member.createdAt,         // ✅ CONFIRMED: "createdAt" from API docs
                favouritesCount: member.favouritesCount, // ✅ CONFIRMED: "favouritesCount" from API docs
                statusesCount: member.statusesCount, // ✅ CONFIRMED: "statusesCount" from API docs
                mediaCount: member.mediaCount        // ✅ CONFIRMED: "mediaCount" from API docs
            }));

            console.log(`✅ API TRANSFORMATION: Converted ${transformedAdmins.length} members to admin format`);

            // ✅ STEP 3C: Filter out invalid usernames (keep your existing validation)
            const validAdmins = transformedAdmins.filter(admin => {
                if (!admin.username || admin.username.length < 1) return false;
                return this.isValidUsernameFast(admin.username);
            });

            console.log(`✅ VALIDATION: ${validAdmins.length} valid admins after filtering`);
            return validAdmins;

        } catch (error) {
            console.error('❌ API scraping failed, falling back to browser scraping:', error);

            // ✅ STEP 3D: Fallback to original browser scraping if API fails
            return await this.scrapeCommunityAdminsBrowser(communityId);
        }
    }


    // 🚀 FAST USERNAME VALIDATION
    isValidUsernameFast(username) {
        if (!username || username.length < 2 || username.length > 15) return false;
        if (!/^[a-zA-Z0-9_]+$/.test(username)) return false;
        const blockedTerms = ['home', 'explore', 'messages', 'follow', 'click', 'search', 'notifications', 'profile', 'settings', 'logout', 'help', 'about', 'privacy', 'terms'];
        if (blockedTerms.includes(username.toLowerCase())) return false;
        return true;
    }

    // Keep your existing parseAdminsFromText for backward compatibility
    parseAdminsFromText(pageText) {
        const admins = [];
        const foundUsernames = new Set(); // Prevent duplicates
        console.log('🔍 Analyzing text for admin patterns...');

        // Helper function to validate usernames and exclude generic terms
        const isValidUsername = (username) => {
            const excludeList = ['admin', 'mod', 'moderator', 'moderators', 'allmoderators',
                'members', 'follow', 'click', 'show', 'more', 'terms', 'privacy', 'cookie',
                'home', 'explore', 'messages'];

            return username &&
                /^[a-zA-Z0-9_]{1,15}$/.test(username) &&
                !excludeList.includes(username.toLowerCase()) &&
                username.length > 2;
        };

        // Split text into words for easier processing
        const words = pageText.split(/\s+/);

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const nextWord = words[i + 1] || '';

            // Pattern 1: "Username Admin" or "Username Mod"
            if (nextWord === 'Admin' || nextWord === 'Mod') {
                const username = word.replace(/[^a-zA-Z0-9_]/g, '');
                if (isValidUsername(username) && !foundUsernames.has(username.toLowerCase())) {
                    admins.push({
                        username: username,
                        badgeType: nextWord,
                        source: 'text_analysis',
                        pattern: 'username_before_badge'
                    });
                    foundUsernames.add(username.toLowerCase());
                    console.log(`👑 FOUND ${nextWord.toUpperCase()}: ${username}`);

                    // Early exit after finding first valid admin/mod
                    break;
                }
            }

            // Pattern 2: "@username" with nearby admin/mod indicators
            if (word.startsWith('@')) {
                const username = word.substring(1).replace(/[^a-zA-Z0-9_]/g, '');
                if (isValidUsername(username) && !foundUsernames.has(username.toLowerCase())) {
                    const nearbyWords = [
                        words[i - 2], words[i - 1], words[i + 1], words[i + 2]
                    ].filter(w => w).join(' ');

                    let badgeType = null;
                    if (nearbyWords.includes('Admin')) badgeType = 'Admin';
                    else if (nearbyWords.includes('Mod')) badgeType = 'Mod';

                    if (badgeType) {
                        admins.push({
                            username: username,
                            badgeType: badgeType,
                            source: 'text_analysis',
                            pattern: '@username_near_badge'
                        });
                        foundUsernames.add(username.toLowerCase());
                        console.log(`👑 FOUND ${badgeType.toUpperCase()}: ${username}`);

                        // Early exit after finding first valid admin/mod
                        break;
                    }
                }
            }

            // Pattern 3: "Admin@username" or "Mod@username"
            if ((word.includes('Admin@') || word.includes('Mod@')) && admins.length === 0) {
                let badgeType = word.includes('Admin@') ? 'Admin' : 'Mod';
                let startPattern = badgeType + '@';

                const startIndex = word.indexOf(startPattern);
                if (startIndex !== -1) {
                    const afterAt = word.substring(startIndex + startPattern.length);
                    let username;

                    if (afterAt.includes('FollowClick')) {
                        username = afterAt.substring(0, afterAt.indexOf('FollowClick'));
                    } else {
                        const usernameMatch = afterAt.match(/^([a-zA-Z0-9_]+)/);
                        username = usernameMatch ? usernameMatch[1] : '';
                    }

                    if (isValidUsername(username) && !foundUsernames.has(username.toLowerCase())) {
                        admins.push({
                            username: username,
                            badgeType: badgeType,
                            source: 'text_analysis',
                            pattern: 'badge@username'
                        });
                        foundUsernames.add(username.toLowerCase());
                        console.log(`👑 FOUND ${badgeType.toUpperCase()}: ${username}`);

                        // Early exit after finding first valid admin/mod
                        break;
                    }
                }
            }

            // Early exit if we found a valid admin/mod
            if (admins.length > 0) break;
        }

        console.log(`🎯 PARSING RESULT: ${admins.length} valid admin(s) found`);
        admins.forEach((admin, index) => {
            console.log(`   ${index + 1}. @${admin.username} (${admin.badgeType})`);
        });

        return admins;
    }

    async extractAdminsFromScreenshot(communityId) {
        console.log('🔸 DIRECT DOM ELEMENT INSPECTION...');

        try {
            // Wait for page to load completely
            await this.page.waitForLoadState('networkidle', { timeout: 10000 });

            // Wait a bit more for dynamic content
            await this.page.waitForTimeout(3000);

            // Direct DOM inspection - exactly like browser dev tools
            const admins = await this.page.evaluate(() => {
                const results = [];

                // Method 1: Look for UserCell components (most reliable)
                const userCells = document.querySelectorAll('[data-testid="UserCell"]');
                console.log(`Found ${userCells.length} UserCell elements`);

                userCells.forEach((cell, index) => {
                    try {
                        // Get username from link
                        const usernameLink = cell.querySelector('a[href^="/"]');
                        if (usernameLink) {
                            const href = usernameLink.getAttribute('href');
                            const username = href.replace('/', '');

                            // Look for admin/mod badges in this cell
                            const cellText = cell.textContent || cell.innerText || '';

                            let badgeType = 'Member';
                            if (cellText.includes('Admin')) {
                                badgeType = 'Admin';
                            } else if (cellText.includes('Mod')) {
                                badgeType = 'Mod';
                            }

                            if (username && username.length > 0) {
                                results.push({
                                    username: username,
                                    badgeType: badgeType,
                                    source: 'direct_dom_usercell',
                                    cellText: cellText.substring(0, 100) // Debug info
                                });
                                console.log(`Found user: ${username} (${badgeType})`);
                            }
                        }
                    } catch (e) {
                        console.log(`Error processing UserCell ${index}:`, e.message);
                    }
                });

                // Method 2: Look for any links that look like usernames
                if (results.length === 0) {
                    const allLinks = document.querySelectorAll('a[href^="/"]');
                    console.log(`Fallback: Found ${allLinks.length} profile links`);

                    allLinks.forEach((link, index) => {
                        try {
                            const href = link.getAttribute('href');
                            const username = href.replace('/', '');

                            // Skip obvious non-usernames
                            if (username.includes('/') || username.length < 2 || username.length > 20) {
                                return;
                            }

                            // Look for admin/mod indicators near this link
                            const parent = link.closest('[role="listitem"], div, article');
                            if (parent) {
                                const parentText = parent.textContent || parent.innerText || '';

                                let badgeType = 'Member';
                                if (parentText.includes('Admin')) {
                                    badgeType = 'Admin';
                                } else if (parentText.includes('Mod')) {
                                    badgeType = 'Mod';
                                }

                                results.push({
                                    username: username,
                                    badgeType: badgeType,
                                    source: 'direct_dom_links',
                                    parentText: parentText.substring(0, 100) // Debug info
                                });
                                console.log(`Fallback found: ${username} (${badgeType})`);
                            }
                        } catch (e) {
                            console.log(`Error processing link ${index}:`, e.message);
                        }
                    });
                }

                // Method 3: Raw text scanning as last resort
                if (results.length === 0) {
                    const pageText = document.body.textContent || document.body.innerText || '';
                    console.log(`Final fallback: scanning ${pageText.length} characters of text`);
                    console.log(`Page text preview: "${pageText.substring(0, 200)}"`);
                }

                return results;
            });

            console.log(`✅ Direct DOM inspection completed! Found ${admins.length} admin(s)`);
            return admins;

        } catch (error) {
            console.error('❌ Direct DOM inspection failed:', error.message);
            return [];
        }
    }

    async debugPageStructure() {
        const elementCount = await this.page.evaluate(() => {
            return {
                userCells: document.querySelectorAll('[data-testid="UserCell"]').length,
                allLinks: document.querySelectorAll('a').length,
                listItems: document.querySelectorAll('[role="listitem"]').length,
                divs: document.querySelectorAll('div').length,
                bodyText: document.body.textContent.length
            };
        });

        console.log('Page structure:', elementCount);
        return elementCount;
    }

    async debugCurrentPage() {
        const url = this.page.url();
        const title = await this.page.title();
        console.log(`🔍 Current URL: ${url}`);
        console.log(`🔍 Page title: "${title}"`);

        // Check if we're redirected or blocked
        if (url.includes('login') || url.includes('suspended') || title.includes('suspended')) {
            console.log('❌ Redirected to login or suspended page');
            return false;
        }

        return true;
    }

    async extractAdminsFromDOM() {
        // ... your existing code unchanged
        console.log('🔧 Using DOM scraping (backup method)...');

        return await this.page.evaluate(() => {
            const userCells = document.querySelectorAll('div[data-testid="UserCell"]');
            const adminData = [];

            userCells.forEach((cell) => {
                const usernameLink = cell.querySelector('a[href^="/"]');

                if (usernameLink) {
                    const username = usernameLink.getAttribute('href').slice(1);

                    const adminBadge = Array.from(cell.querySelectorAll('*')).find(el =>
                        el.textContent && el.textContent.trim() === 'Admin'
                    );

                    const modBadge = Array.from(cell.querySelectorAll('*')).find(el =>
                        el.textContent && el.textContent.trim() === 'Mod'
                    );

                    let badgeType = 'Member';
                    if (adminBadge) {
                        badgeType = 'Admin';
                    } else if (modBadge) {
                        badgeType = 'Mod';
                    }

                    adminData.push({
                        username: username,
                        badgeType: badgeType,
                        source: 'dom_scraping',
                        pattern: 'html_element'
                    });
                }
            });

            return adminData;
        });
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.isInitialized = false;
        }
    }

    async ensureOutputDirectory() {
        try {
            await fsPromises.access('./output');
        } catch {
            await fsPromises.mkdir('./output', { recursive: true });
            console.log('📁 Created output directory');
        }
    }

    async saveTextFile(filePath, content) {
        try {
            await fsPromises.writeFile(filePath, content, 'utf8');
            console.log(`📝 Text saved: ${filePath}`);
        } catch (error) {
            console.error('❌ Failed to save text file:', error);
        }
    }



    // 🚀 FAST USERNAME VALIDATION
    isValidUsernameFast(username) {
        if (!username || username.length < 2 || username.length > 15) return false;

        // Fast regex check - only alphanumeric and underscore
        if (!/^[a-zA-Z0-9_]+$/.test(username)) return false;

        // Block common unwanted terms
        const blockedTerms = ['home', 'explore', 'messages', 'follow', 'click', 'search', 'notifications', 'profile', 'settings', 'logout', 'help', 'about', 'privacy', 'terms'];
        if (blockedTerms.includes(username.toLowerCase())) return false;

        return true;
    }
}

class TwitterAPI {
    constructor() {
        this.apiKey = process.env.TWITTER_API_KEY || 'new1_7a3bda1437e34f0285714e132a6b67d3'; // Your API key
        this.baseURL = 'https://api.twitterapi.io'; // twitterapi.io base URL

        if (!this.apiKey) {
            throw new Error('Twitter API key not found in environment variables');
        }

        console.log(`🔑 Twitter API initialized with key: ${this.apiKey.substring(0, 10)}...`);
        console.log(`🌐 Base URL: ${this.baseURL}`);
    }

    /**
     * Fetch community moderators using twitterapi.io
     * Based on your API response structure with "moderators" array
     */
    async getCommunityModerators(communityId, cursor = null) {
        try {
            console.log(`🎯 API CALL: Fetching moderators for community ${communityId}`);

            // ✅ CORRECT ENDPOINT: /twitter/community/moderators
            const url = new URL(`${this.baseURL}/twitter/community/moderators`);
            url.searchParams.append('community_id', communityId);

            if (cursor) {
                url.searchParams.append('cursor', cursor);
            }

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'X-API-Key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // 15 second timeout
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();

            // ✅ FIXED: Your API returns "moderators" array, not "members"
            console.log(`✅ API SUCCESS: Found ${data.moderators?.length || 0} moderators`);
            console.log(`📄 Has next page: ${data.has_next_page}`);
            console.log(`📄 Next cursor: ${data.next_cursor || 'none'}`);

            return data;

        } catch (error) {
            console.error('❌ API Error fetching community moderators:', error);
            throw error;
        }
    }

    /**
     * Fetch all moderators with pagination support
     * Fixed to handle YOUR API response structure
     */
    async getAllCommunityModerators(communityId) {
        try {
            const allModerators = [];
            let cursor = null;
            let hasNext = true;
            let pageCount = 0;

            console.log(`📄 PAGINATION: Starting to fetch all moderators for community ${communityId}`);

            while (hasNext && pageCount < 10) { // Safety limit of 10 pages
                pageCount++;
                console.log(`📄 PAGE ${pageCount}: Fetching with cursor: ${cursor || 'initial'}`);

                const response = await this.getCommunityModerators(communityId, cursor);

                // ✅ FIXED: Use "moderators" instead of "members"
                if (response.moderators && response.moderators.length > 0) {
                    allModerators.push(...response.moderators);
                    console.log(`📊 PAGE ${pageCount}: Added ${response.moderators.length} moderators (Total: ${allModerators.length})`);
                }

                // ✅ CONFIRMED: Pagination fields from your API response
                hasNext = response.has_next_page;
                cursor = response.next_cursor;

                if (!hasNext) {
                    console.log(`✅ PAGINATION COMPLETE: No more pages to fetch`);
                    break;
                }

                // Add small delay between requests to be respectful
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`🎉 FINAL RESULT: Fetched ${allModerators.length} total moderators across ${pageCount} pages`);
            return allModerators;

        } catch (error) {
            console.error('❌ Error fetching all community moderators:', error);
            throw error;
        }
    }

    /**
     * Transform API moderator data to match your existing format
     * Based on your API response structure
     */
    transformModeratorsToAdminFormat(moderators) {
        return moderators.map(moderator => ({
            username: moderator.screen_name || moderator.name || 'unknown',
            displayName: moderator.name || moderator.screen_name || 'Unknown',
            userId: moderator.id,
            isVerified: moderator.verified || moderator.isBlueVerified,
            followersCount: moderator.followers_count,
            location: moderator.location,
            description: moderator.description,
            profileImageUrl: moderator.profile_image_url_https,
            type: 'Admin',
            source: 'api_fetch'
        }));
    }
}

const twitterAPI = new TwitterAPI();

// CREATE GLOBAL SCRAPER INSTANCE
const twitterScraper = new TwitterCommunityAdminScraper();

class TokenMetadataExtractor extends OriginalExtractor {
    constructor(rpcUrl) {
        super(rpcUrl || process.env.HELIUS_RPC);
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute cache
    }

    async getCompleteTokenMetadata(tokenAddress) {
        const cached = this.cache.get(tokenAddress);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            console.log(`📦 Using cached metadata for ${tokenAddress}`);
            return cached.data;
        }

        try {
            const metadata = await super.getCompleteTokenMetadata(tokenAddress);

            this.cache.set(tokenAddress, {
                data: metadata,
                timestamp: Date.now()
            });

            return metadata;
        } catch (error) {
            console.error(`Error fetching token metadata for ${tokenAddress}:`, error.message);
            throw error;
        }
    }

    extractTwitterHandle(metadata) {
        const twitterSources = [];

        const best = this.getBestMetadata(metadata);

        if (best.twitter && best.twitter !== 'Not available') {
            twitterSources.push(best.twitter);
        }

        if (best.website && best.website !== 'Not available' &&
            (best.website.includes('twitter.com') || best.website.includes('x.com'))) {
            twitterSources.push(best.website);
        }

        const sources = [
            metadata.geckoTerminalInfo,
            metadata.birdeyeInfo,
            metadata.jupiterInfo,
            metadata.registryInfo
        ].filter(Boolean);

        sources.forEach(source => {
            if (source.twitter) twitterSources.push(source.twitter);
            if (source.website && (source.website.includes('twitter.com') || source.website.includes('x.com'))) {
                twitterSources.push(source.website);
            }
        });

        if (metadata.offChainMetadata?.attributes) {
            metadata.offChainMetadata.attributes.forEach(attr => {
                if (attr?.trait_type?.toLowerCase() === 'twitter' && attr.value) {
                    twitterSources.push(attr.value);
                }
            });
        }

        console.log(`🔍 Found ${twitterSources.length} potential twitter sources`);

        for (const source of twitterSources) {
            const extracted = this.extractTwitterDataRobust(source);
            if (extracted.type && (extracted.handle || extracted.id)) {
                console.log(`✅ Valid Twitter data: ${extracted.handle || extracted.id}`);
                return extracted;
            }
        }

        return { type: null, handle: null, id: null };
    }

    extractTwitterDataRobust(input) {
        if (!input || typeof input !== 'string') {
            return { type: null, handle: null, id: null };
        }

        const cleanInput = input.trim();

        // Community pattern
        const communityMatch = cleanInput.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com\/|x\.com\/)i\/communities\/(\d+)/i);
        if (communityMatch) {
            return {
                type: 'community',
                id: communityMatch[1],
                handle: null
            };
        }

        // Individual user pattern
        const userMatch = cleanInput.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com\/|x\.com\/)(?!i\/communities\/)([a-zA-Z0-9_]+)/i);
        if (userMatch) {
            const handle = userMatch[1].toLowerCase();
            if (this.isValidTwitterHandle(handle)) {
                return {
                    type: 'individual',
                    handle: handle,
                    id: null
                };
            }
        }

        // Handle without URL
        if (cleanInput.startsWith('@')) {
            const handle = cleanInput.substring(1).trim().toLowerCase();
            if (this.isValidTwitterHandle(handle)) {
                return {
                    type: 'individual',
                    handle: handle,
                    id: null
                };
            }
        }

        if (/^[a-zA-Z0-9_]{1,15}$/.test(cleanInput)) {
            const handle = cleanInput.toLowerCase();
            if (this.isValidTwitterHandle(handle)) {
                return {
                    type: 'individual',
                    handle: handle,
                    id: null
                };
            }
        }

        return { type: null, handle: null, id: null };
    }

    isValidTwitterHandle(handle) {
        if (!handle || handle.length < 1 || handle.length > 15) return false;
        if (!/^[a-zA-Z0-9_]+$/.test(handle)) return false;

        const blockedTerms = [
            'home', 'explore', 'messages', 'follow', 'click', 'search',
            'notifications', 'profile', 'settings', 'logout', 'help',
            'about', 'privacy', 'terms', 'status', 'intent', 'share'
        ];

        return !blockedTerms.includes(handle.toLowerCase());
    }
}

// Create the instance
const tokenMetadataExtractor = new TokenMetadataExtractor();

class BotState {
    constructor() {
        this.isRunning = false;
        this.settings = {
            privateKey: '',
            tokenPageDestination: 'neo_bullx',
            enableAdminFilter: true,
            enableCommunityReuse: true,
            snipeAllTokens: false,
            detectionOnlyMode: true,

            // Global snipe settings
            globalSnipeSettings: {
                amount: 0.01,
                fees: 10,
                mevProtection: true,
                soundNotification: 'default.wav'
            }
        };
        this.primaryAdminList = new Map();
        this.secondaryAdminList = new Map();
        this.usedCommunities = new Set();
        this.processedTokens = new Set();
        this.detectedTokens = new Map();
        this.pumpPortalSocket = null;
        this.letsBonkSocket = null;
        this.reconnectTimeouts = new Map();
    }

    addDetectedToken(tokenAddress, tokenData) {
        this.detectedTokens.set(tokenAddress, {
            ...tokenData,
            detectedAt: new Date().toISOString(),
            id: Date.now().toString()
        });

        if (this.detectedTokens.size > 100) {
            const firstKey = this.detectedTokens.keys().next().value;
            this.detectedTokens.delete(firstKey);
        }
    }

    getDetectedTokens() {
        return Array.from(this.detectedTokens.values()).reverse();
    }

    clearDetectedTokens() {
        this.detectedTokens.clear();
    }

    addToList(listType, entry) {
        const config = {
            id: Date.now().toString(),
            address: (entry.address || entry.username).trim(),
            amount: entry.amount,
            fees: entry.fees,
            mevProtection: entry.mevProtection,
            soundNotification: entry.soundNotification,
            createdAt: new Date().toISOString()
        };

        switch (listType) {
            case 'primary_admins':
                this.primaryAdminList.set(config.id, config);
                break;
            case 'secondary_admins':
                this.secondaryAdminList.set(config.id, config);
                break;
        }
        return config;
    }

    removeFromList(listType, id) {
        switch (listType) {
            case 'primary_admins':
                return this.primaryAdminList.delete(id);
            case 'secondary_admins':
                return this.secondaryAdminList.delete(id);
        }
        return false;
    }

    getList(listType) {
        switch (listType) {
            case 'primary_admins':
                return Array.from(this.primaryAdminList.values());
            case 'secondary_admins':
                return Array.from(this.secondaryAdminList.values());
            default:
                return [];
        }
    }

    checkAdminInPrimary(identifier) {
        if (!identifier) return null;
        const cleanIdentifier = identifier.trim().toLowerCase();

        for (const config of this.primaryAdminList.values()) {
            const cleanAddress = config.address.trim().toLowerCase();

            // Skip comparison if types don't match (wallet vs username)
            if (this.isWalletAddress(identifier) !== this.isWalletAddress(config.address)) {
                continue;
            }

            console.log(`🔍 Comparing "${cleanIdentifier}" with "${cleanAddress}"`);
            if (cleanAddress === cleanIdentifier) {
                console.log(`✅ MATCH FOUND in primary: ${cleanAddress}`);
                return config;
            }
        }
        return null;
    }

    checkAdminInSecondary(identifier) {
        if (!identifier) return null;
        const cleanIdentifier = identifier.trim().toLowerCase();

        for (const config of this.secondaryAdminList.values()) {
            const cleanAddress = config.address.trim().toLowerCase();

            // Skip comparison if types don't match (wallet vs username)
            if (this.isWalletAddress(identifier) !== this.isWalletAddress(config.address)) {
                continue;
            }

            console.log(`🔍 Comparing "${cleanIdentifier}" with "${cleanAddress}"`);
            if (cleanAddress === cleanIdentifier) {
                console.log(`✅ MATCH FOUND in secondary: ${cleanAddress}`);
                return config;
            }
        }
        return null;
    }

    // Add this helper function to the BotState class
    isWalletAddress(identifier) {
        if (!identifier) return false;
        // Solana wallet addresses are typically 32-44 characters, base58 encoded
        const clean = identifier.trim();
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean);
    }
}

// ========== ENHANCED BOTSTATE CLASS WITH FIREBASE ==========

class EnhancedBotState extends BotState {
    constructor() {
        super();
        this.isFirebaseLoaded = false;
    }

    // Load admin lists from Firebase on startup
    async loadAdminListsFromFirebase() {
        try {
            console.log('📥 Loading admin lists from Firebase...');

            // Load primary admins
            const primaryAdmins = await loadAdminListFromFirebase('primary_admins');
            this.primaryAdminList.clear();
            primaryAdmins.forEach(admin => {
                this.primaryAdminList.set(admin.id, admin);
            });

            // Load secondary admins  
            const secondaryAdmins = await loadAdminListFromFirebase('secondary_admins');
            this.secondaryAdminList.clear();
            secondaryAdmins.forEach(admin => {
                this.secondaryAdminList.set(admin.id, admin);
            });

            this.isFirebaseLoaded = true;
            console.log(`✅ Firebase admin lists loaded: ${primaryAdmins.length} primary, ${secondaryAdmins.length} secondary`);

            return true;
        } catch (error) {
            console.error('❌ Failed to load admin lists from Firebase:', error);
            this.isFirebaseLoaded = false;
            return false;
        }
    }

    // Enhanced addToList with Firebase sync
    async addToList(listType, entry) {
        const config = {
            id: Date.now().toString(),
            address: (entry.address || entry.username).trim(),
            amount: entry.amount,
            fees: entry.fees,
            mevProtection: entry.mevProtection,
            soundNotification: entry.soundNotification,
            createdAt: new Date().toISOString()
        };

        // Add to local state
        switch (listType) {
            case 'primary_admins':
                this.primaryAdminList.set(config.id, config);
                break;
            case 'secondary_admins':
                this.secondaryAdminList.set(config.id, config);
                break;
        }

        // Save to Firebase
        await saveAdminListToFirebase(listType, config);

        return config;
    }

    // Enhanced removeFromList with Firebase sync
    async removeFromList(listType, id) {
        let success = false;

        // Remove from local state
        switch (listType) {
            case 'primary_admins':
                success = this.primaryAdminList.delete(id);
                break;
            case 'secondary_admins':
                success = this.secondaryAdminList.delete(id);
                break;
        }

        // Delete from Firebase if local deletion was successful
        if (success) {
            await deleteAdminFromFirebase(listType, id);
        }

        return success;
    }

    // Get stats including Firebase status
    getStats() {
        return {
            primaryAdmins: this.primaryAdminList.size,
            secondaryAdmins: this.secondaryAdminList.size,
            usedCommunities: this.usedCommunities.size,
            processedTokens: this.processedTokens.size,
            isFirebaseLoaded: this.isFirebaseLoaded
        };
    }
}

// Create enhanced bot state instance
const botState = new EnhancedBotState();

// WebSocket clients management
const wsClients = new Set();

function broadcastToClients(data) {
    const message = JSON.stringify(data);
    wsClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// ========== TWITTER DETECTION FUNCTIONS ==========

function extractTwitterData(input) {
    if (!input) return { type: null, id: null, handle: null };

    console.log(`🔍 Extracting Twitter data from: "${input}"`);

    // Clean the input
    const cleanInput = input.trim();

    // Pattern for Twitter community links
    const communityRegex = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com\/|x\.com\/)i\/communities\/(\d+)/i;
    const communityMatch = cleanInput.match(communityRegex);

    if (communityMatch) {
        console.log(`🏘️ Found community ID: ${communityMatch[1]}`);
        return {
            type: 'community',
            id: communityMatch[1],
            handle: null,
            originalUrl: cleanInput
        };
    }

    // Pattern for individual Twitter accounts (more permissive)
    const userRegex = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com\/|x\.com\/)(?!i\/communities\/)([a-zA-Z0-9_]+)/i;
    const userMatch = cleanInput.match(userRegex);

    if (userMatch) {
        const handle = userMatch[1].toLowerCase();
        console.log(`👤 Found individual handle: @${handle}`);
        return {
            type: 'individual',
            id: null,
            handle: handle,
            originalUrl: cleanInput
        };
    }

    // If it's just a handle without URL
    if (cleanInput.startsWith('@')) {
        const handle = cleanInput.substring(1).trim().toLowerCase(); // Add .trim()
        console.log(`👤 Found handle without URL: @${handle}`);
        return {
            type: 'individual',
            id: null,
            handle: handle,
            originalUrl: cleanInput
        };
    }

    // If it's just a plain username (be more strict here)
    if (/^[a-zA-Z0-9_]{1,15}$/.test(cleanInput)) {
        const handle = cleanInput.trim().toLowerCase(); // Add .trim()
        console.log(`👤 Found plain username: @${handle}`);
        return {
            type: 'individual',
            id: null,
            handle: handle,
            originalUrl: cleanInput
        };
    }

    console.log(`❌ No Twitter data found in: "${input}"`);
    return { type: null, id: null, handle: null };
}

// Firebase community tracking functions
async function isCommunityUsedInFirebase(communityId) {
    try {
        // Check in-memory cache first (sub-millisecond lookup)
        const isUsed = communityCache.communities.has(communityId.toString());
        console.log(`🔍 Community ${communityId} check: ${isUsed ? 'FOUND in cache' : 'NOT FOUND in cache'}`);
        return isUsed;
    } catch (error) {
        console.error('Error checking community in cache:', error);
        return false; // If error, don't block (safer approach)
    }
}

// Tweet tracking functions
async function isTweetUsedInFirebase(tweetId) {
    try {
        const isUsed = tweetCache.tweets.has(tweetId.toString());
        console.log(`🔍 Tweet ${tweetId} check: ${isUsed ? 'FOUND in cache' : 'NOT FOUND in cache'}`);
        return isUsed;
    } catch (error) {
        console.error('Error checking tweet in cache:', error);
        return false;
    }
}

async function markTweetAsUsedInFirebase(tweetId, username, tokenData) {
    try {
        console.log(`💾 Adding tweet ${tweetId} to local cache`);

        const tweetInfo = {
            firstUsed: new Date().toISOString(),
            username: username,
            tokenAddress: tokenData.tokenAddress,
            tokenName: tokenData.name,
            platform: tokenData.platform
        };

        // Add to memory cache
        tweetCache.tweets.set(tweetId.toString(), tweetInfo);
        tweetCache.pendingSync.add(tweetId.toString());

        // ✅ NEW: Immediately append to local JSON file for fast startup
        await appendTweetToLocalFile(tweetId, tweetInfo);

        // Save full cache to file
        await saveTweetCacheToFile();

        console.log(`✅ Tweet ${tweetId} added to cache and local file`);
        return true;
    } catch (error) {
        console.error(`❌ ERROR adding tweet ${tweetId} to cache:`, error);
        return false;
    }
}
async function appendTweetToLocalFile(tweetId, tweetInfo) {
    try {
        // Read existing tweets
        let existingTweets = {};
        try {
            const fileContent = await fsPromises.readFile(TWEETS_CACHE_FILE, 'utf8');
            const data = JSON.parse(fileContent);
            existingTweets = data.tweets || {};
        } catch (error) {
            // File doesn't exist, start fresh
        }

        // Add new tweet
        existingTweets[tweetId] = tweetInfo;

        // Write back to file immediately
        const updatedCache = {
            tweets: existingTweets,
            lastUpdated: new Date().toISOString()
        };

        await fsPromises.writeFile(TWEETS_CACHE_FILE, JSON.stringify(updatedCache, null, 2));
        console.log(`📄 Tweet ${tweetId} appended to local JSON file`);
    } catch (error) {
        console.error('❌ Error appending tweet to local file:', error);
    }
}

async function saveTweetCacheToFile() {
    try {
        const cacheData = {
            tweets: Object.fromEntries(tweetCache.tweets),
            pendingSync: Array.from(tweetCache.pendingSync),
            lastSyncToFirebase: tweetCache.lastSyncToFirebase,
            lastUpdated: new Date().toISOString()
        };

        await fsPromises.writeFile(TWEETS_CACHE_FILE, JSON.stringify(cacheData, null, 2));
        console.log(`💾 Tweet cache saved to file (${tweetCache.tweets.size} tweets)`);
    } catch (error) {
        console.error('❌ Error saving tweet cache to file:', error);
    }
}

async function initializeTweetCache() {
    try {
        console.log('🚀 Initializing local tweet cache...');

        try {
            const fileContent = await fsPromises.readFile(TWEETS_CACHE_FILE, 'utf8');
            const data = JSON.parse(fileContent);

            if (data.tweets) {
                Object.entries(data.tweets).forEach(([id, info]) => {
                    tweetCache.tweets.set(id, info);
                });
            }

            tweetCache.pendingSync = new Set(data.pendingSync || []);
            console.log(`✅ Loaded ${tweetCache.tweets.size} tweets from cache file`);
        } catch (error) {
            console.log('📄 No tweet cache file found, loading from Firebase...');
            await loadInitialTweetsFromFirebase();
        }

        startPeriodicTweetFirebaseSync();
    } catch (error) {
        console.error('❌ Error initializing tweet cache:', error);
    }
}

async function loadInitialTweetsFromFirebase() {
    try {
        const snapshot = await db.collection('usedTweets').get();
        let loadedCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            tweetCache.tweets.set(doc.id, {
                firstUsed: data.firstUsedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                username: data.username,
                tokenAddress: data.tokenAddress,
                tokenName: data.tokenName,
                platform: data.platform
            });
            loadedCount++;
        });

        console.log(`✅ Loaded ${loadedCount} tweets from Firebase`);
        await saveTweetCacheToFile();
    } catch (error) {
        console.error('❌ Error loading tweets from Firebase:', error);
    }
}

function startPeriodicTweetFirebaseSync() {
    setInterval(async () => {
        if (tweetCache.pendingSync.size > 0) {
            await syncPendingTweetsToFirebase();
        }
    }, FIREBASE_SYNC_INTERVAL);
}

async function syncPendingTweetsToFirebase() {
    if (tweetCache.pendingSync.size === 0) return;

    console.log(`🔄 Syncing ${tweetCache.pendingSync.size} tweets to Firebase...`);

    const batch = db.batch();
    let syncCount = 0;

    for (const tweetId of tweetCache.pendingSync) {
        const tweetData = tweetCache.tweets.get(tweetId);
        if (tweetData) {
            const docRef = db.collection('usedTweets').doc(tweetId);
            batch.set(docRef, {
                tweetId: tweetId,
                username: tweetData.username,
                firstUsedAt: admin.firestore.FieldValue.serverTimestamp(),
                tokenAddress: tweetData.tokenAddress,
                tokenName: tweetData.tokenName,
                platform: tweetData.platform,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            syncCount++;
        }
    }

    try {
        await batch.commit();
        console.log(`✅ Successfully synced ${syncCount} tweets to Firebase`);
        tweetCache.pendingSync.clear();
        tweetCache.lastSyncToFirebase = new Date().toISOString();
        await saveTweetCacheToFile();
    } catch (error) {
        console.error('❌ Error syncing tweets to Firebase:', error);
    }
}

async function getPairAddressFromDexScreener(tokenAddress) {
    try {
        console.log(`🔍 Fetching pair address for token: ${tokenAddress}`);

        // Use the actual token address, not hardcoded one
        const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;

        const response = await fetch(url, {
            timeout: 10000, // 10 second timeout
            headers: {
                'User-Agent': 'DevScope-Bot/1.0'
            }
        });

        if (!response.ok) {
            console.log(`❌ DexScreener API error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        console.log(`📊 DexScreener response:`, data);

        if (data.pairs && data.pairs.length > 0) {
            // Find Raydium pair first, or fallback to first available pair
            let bestPair = data.pairs.find(pair =>
                pair.dexId === 'raydium' ||
                pair.dexId.toLowerCase().includes('raydium')
            ) || data.pairs[0];

            console.log(`✅ Found pair on ${bestPair.dexId}: ${bestPair.pairAddress}`);

            return {
                pairAddress: bestPair.pairAddress,
                dexId: bestPair.dexId,
                baseToken: bestPair.baseToken,
                quoteToken: bestPair.quoteToken,
                liquidity: bestPair.liquidity,
                url: bestPair.url
            };
        }

        console.log(`❌ No pairs found for token: ${tokenAddress}`);
        return null;
    } catch (error) {
        console.error('❌ Error fetching pair data from DexScreener:', error);
        return null;
    }
}

async function markCommunityAsUsedInFirebase(communityId, tokenData) {
    try {
        console.log(`💾 Adding community ${communityId} to local cache`);

        // Add to in-memory cache immediately
        communityCache.communities.set(communityId.toString(), {
            firstUsed: new Date().toISOString(),
            tokenCount: 1,
            tokenAddress: tokenData.tokenAddress,
            tokenName: tokenData.name,
            platform: tokenData.platform
        });

        // Mark for Firebase sync
        communityCache.pendingSync.add(communityId.toString());

        // Save to local file immediately for crash protection
        await saveCacheToFile();

        console.log(`✅ Community ${communityId} added to cache and marked for Firebase sync`);
        return true;
    } catch (error) {
        console.error(`❌ ERROR adding community ${communityId} to cache:`, error);
        return false;
    }
}

// Initialize cache on startup
async function initializeCommunityCache() {
    try {
        console.log('🚀 Initializing local community cache...');

        // Load from file if exists
        try {
            const fileContent = await fsPromises.readFile(COMMUNITY_CACHE_FILE, 'utf8');
            const data = JSON.parse(fileContent);

            // Convert to Map for performance
            if (data.communities) {
                Object.entries(data.communities).forEach(([id, info]) => {
                    communityCache.communities.set(id, info);
                });
            }

            communityCache.lastSyncToFirebase = data.lastSyncToFirebase;
            communityCache.pendingSync = new Set(data.pendingSync || []);

            console.log(`✅ Loaded ${communityCache.communities.size} communities from cache file`);
        } catch (error) {
            console.log('📄 No cache file found, loading from Firebase...');
            await loadInitialDataFromFirebase();
        }

        // Start periodic sync
        startPeriodicFirebaseSync();

    } catch (error) {
        console.error('❌ Error initializing community cache:', error);
    }
}

// Load initial data from Firebase (one-time)
async function loadInitialDataFromFirebase() {
    try {
        const snapshot = await db.collection('usedCommunities').get();
        let loadedCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            communityCache.communities.set(doc.id, {
                firstUsed: data.firstUsedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                tokenCount: 1,
                tokenAddress: data.tokenAddress,
                tokenName: data.tokenName,
                platform: data.platform
            });
            loadedCount++;
        });

        console.log(`✅ Loaded ${loadedCount} communities from Firebase`);
        await saveCacheToFile();
    } catch (error) {
        console.error('❌ Error loading from Firebase:', error);
    }
}

// Save cache to local file
async function saveCacheToFile() {
    try {
        const cacheData = {
            communities: Object.fromEntries(communityCache.communities),
            pendingSync: Array.from(communityCache.pendingSync),
            lastSyncToFirebase: communityCache.lastSyncToFirebase,
            lastUpdated: new Date().toISOString()
        };

        await fsPromises.writeFile(COMMUNITY_CACHE_FILE, JSON.stringify(cacheData, null, 2));
        console.log(`💾 Cache saved to file (${communityCache.communities.size} communities)`);
    } catch (error) {
        console.error('❌ Error saving cache to file:', error);
    }
}

// Periodic Firebase sync
function startPeriodicFirebaseSync() {
    setInterval(async () => {
        if (communityCache.pendingSync.size > 0) {
            await syncPendingToFirebase();
        }
    }, FIREBASE_SYNC_INTERVAL);

    console.log(`⏰ Started periodic Firebase sync (every ${FIREBASE_SYNC_INTERVAL / 60000} minutes)`);
}

// Sync pending communities to Firebase
async function syncPendingToFirebase() {
    if (communityCache.pendingSync.size === 0) return;

    console.log(`🔄 Syncing ${communityCache.pendingSync.size} communities to Firebase...`);

    const batch = db.batch();
    let syncCount = 0;

    for (const communityId of communityCache.pendingSync) {
        const communityData = communityCache.communities.get(communityId);
        if (communityData) {
            const docRef = db.collection('usedCommunities').doc(communityId);
            batch.set(docRef, {
                communityId: communityId,
                firstUsedAt: admin.firestore.FieldValue.serverTimestamp(),
                tokenAddress: communityData.tokenAddress,
                tokenName: communityData.tokenName,
                platform: communityData.platform,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            syncCount++;
        }
    }

    try {
        await batch.commit();
        console.log(`✅ Successfully synced ${syncCount} communities to Firebase`);

        // Clear pending sync
        communityCache.pendingSync.clear();
        communityCache.lastSyncToFirebase = new Date().toISOString();

        // Update local file
        await saveCacheToFile();
    } catch (error) {
        console.error('❌ Error syncing to Firebase:', error);
    }
}

async function getTwitterDataFromToken(tokenData) {
    try {
        let twitterData = { type: null, id: null, handle: null, admin: null };

        // Get enhanced metadata using new Token Metadata API
        const metadata = await fetchTokenMetadata(tokenData);

        console.log('🔍 Enhanced metadata available:', {
            hasEnhancedData: metadata.hasEnhancedData,
            isBonkToken: metadata.isBonkToken,
            twitterHandle: metadata.twitterHandle,
            websites: metadata.websites?.length || 0
        });

        // Enhanced Twitter extraction with priority system
        const twitterSources = [];

        // Priority 1: Direct twitter handle from enhanced metadata
        if (metadata.hasEnhancedData) {
            if (metadata.twitterHandle) {
                twitterSources.push({
                    value: metadata.twitterHandle,
                    source: 'enhanced_metadata_twitter_handle'
                });
            }

            // Check websites for Twitter links
            if (metadata.websites && Array.isArray(metadata.websites)) {
                metadata.websites.forEach((website, index) => {
                    if (website && typeof website === 'string' &&
                        (website.includes('twitter.com') || website.includes('x.com'))) {
                        twitterSources.push({
                            value: website,
                            source: `enhanced_metadata_websites[${index}]`
                        });
                    }
                });
            }

            // Check website field
            if (metadata.website &&
                (metadata.website.includes('twitter.com') || metadata.website.includes('x.com'))) {
                twitterSources.push({
                    value: metadata.website,
                    source: 'enhanced_metadata_website'
                });
            }

            // If we have raw metadata, extract from it too
            if (metadata.rawMetadata) {
                const twitterFromRaw = tokenMetadataExtractor.extractTwitterHandle(metadata.rawMetadata);
                if (twitterFromRaw.handle) {
                    twitterSources.push({
                        value: twitterFromRaw.handle,
                        source: 'raw_metadata_extraction'
                    });
                } else if (twitterFromRaw.id) {
                    twitterSources.push({
                        value: `https://x.com/i/communities/${twitterFromRaw.id}`,
                        source: 'raw_metadata_community'
                    });
                }
            }
        }

        // Priority 2: Original token data fields (fallback)
        const fieldsToCheck = [
            { field: 'twitter', source: 'token_twitter' },
            { field: 'social?.twitter', source: 'token_social_twitter' },
            { field: 'website', source: 'token_website' },
            { field: 'metadata?.twitter', source: 'metadata_twitter' },
            { field: 'metadata?.social?.twitter', source: 'metadata_social_twitter' },
            { field: 'metadata?.website', source: 'metadata_website' },
            { field: 'metadata?.external_url', source: 'metadata_external_url' }
        ];

        fieldsToCheck.forEach(({ field, source }) => {
            const value = getNestedValue(tokenData, field);
            if (value && typeof value === 'string') {
                twitterSources.push({ value, source });
            }
        });

        console.log('🔍 Enhanced fields to check for Twitter data:', twitterSources.map(s => `${s.value} (${s.source})`));

        // Process each source and use the first valid match
        for (const twitterSource of twitterSources) {
            if (twitterSource.value && typeof twitterSource.value === 'string') {
                const extracted = extractTwitterDataRobust(twitterSource.value, twitterSource.source);
                if (extracted.type) {
                    console.log(`✅ Found Twitter data: ${extracted.type} - ${extracted.handle || extracted.id} from ${twitterSource.source}`);
                    if (metadata.hasEnhancedData) {
                        console.log('🚀 Twitter data source: Token Metadata API');
                    }
                    twitterData = extracted;
                    break;
                }
            }
        }

        // Set admin based on type
        if (twitterData.type === 'individual') {
            twitterData.admin = twitterData.handle;
        } else if (twitterData.type === 'community') {
            twitterData.admin = twitterData.id;
        }

        console.log('🔍 Final enhanced Twitter data result:', twitterData);

        return {
            ...twitterData,
            enhancedMetadata: metadata
        };
    } catch (error) {
        console.error('Error extracting enhanced Twitter data:', error);
        return {
            type: null,
            id: null,
            handle: null,
            admin: null,
            enhancedMetadata: { hasEnhancedData: false, isBonkToken: false }
        };
    }
}

app.get('/api/test-token-metadata/:tokenAddress', async (req, res) => {
    try {
        const { tokenAddress } = req.params;

        console.log(`🧪 Testing Token Metadata API for: ${tokenAddress}`);

        const completeMetadata = await tokenMetadataExtractor.getCompleteTokenMetadata(tokenAddress);
        const twitterInfo = tokenMetadataExtractor.extractTwitterHandle(completeMetadata);
        const bestMetadata = tokenMetadataExtractor.getBestMetadata(completeMetadata);

        res.json({
            success: true,
            tokenAddress,
            completeMetadata,
            bestMetadata,
            twitterInfo,
            extractedFields: {
                name: bestMetadata?.name,
                symbol: bestMetadata?.symbol,
                logoURI: bestMetadata?.logoURI,
                twitter_handle: twitterInfo?.handle,
                twitter_community: twitterInfo?.id,
                website: bestMetadata?.website,
                description: bestMetadata?.description,
                supply: bestMetadata?.supply
            }
        });
    } catch (error) {
        console.error('❌ Token Metadata API test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            tokenAddress: req.params.tokenAddress
        });
    }
});

console.log('🔥 Firebase Admin SDK initialized');
console.log('Project ID:', admin.app().options.projectId);

// Test Firebase connection at startup
async function testFirebase() {
    try {
        const testDoc = await db.collection('test').doc('connection').set({
            test: true,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Firebase connection test successful');
    } catch (error) {
        console.error('❌ Firebase connection test failed:', error);
    }
}

// ========== TRADING FUNCTIONS ==========

async function executeAPITrade(params) {
    try {
        const response = await fetch(`https://pumpportal.fun/api/trade?api-key=${PUMP_PORTAL_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...params,
                pool: params.pool || 'auto',
                skipPreflight: "true",
                jitoOnly: "true"
            })
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(data.error || 'Unknown API error');
        }

        return {
            signature: data.signature,
            confirmationPromise: connection.confirmTransaction(data.signature, 'processed')
        };
    } catch (error) {
        console.error(`API trade failed:`, error.message);
        throw error;
    }
}

async function fetchTokenMetadata(tokenData) {
    console.log('🔍 Starting metadata fetch for Bonk token...');
    console.log('⏳ This will take 30-40 seconds for proper indexing...');

    try {
        const metadata = await tokenMetadataExtractor.getCompleteTokenMetadata(tokenData.mint);

        console.log('✅ METADATA FETCH COMPLETE after delays:', {
            name: metadata.name,
            symbol: metadata.symbol,
            hasTwitter: !!metadata.twitter,
            source: metadata.hasData ? 'GeckoTerminal/Metaplex' : 'Fallback'
        });

        // Extract Twitter data
        let twitterHandle = null;
        let twitterType = null;
        let twitterId = null;

        if (metadata.twitter) {
            const twitterData = tokenMetadataExtractor.extractTwitterHandle(metadata);
            twitterHandle = twitterData.handle;
            twitterType = twitterData.type;
            twitterId = twitterData.id;
        }

        return {
            name: metadata.name,
            symbol: metadata.symbol,
            description: metadata.description,
            imageUrl: metadata.image,
            website: null,
            twitterHandle: twitterHandle,
            twitterUrl: metadata.twitter,
            twitterType: twitterType,
            twitterCommunityId: twitterId,
            hasEnhancedData: metadata.hasData,
            isBonkToken: true // This function is only called for Bonk tokens
        };

    } catch (error) {
        console.error('❌ Metadata fetch failed after delays:', error.message);

        return {
            name: tokenData.name || `Token ${tokenData.mint.slice(0, 8)}`,
            symbol: tokenData.symbol || 'TOKEN',
            description: null,
            imageUrl: tokenData.uri,
            website: null,
            twitterHandle: null,
            hasEnhancedData: false,
            isBonkToken: true
        };
    }
}

async function checkIfPumpFunToken(tokenAddress) {
    try {
        // Simple check - if it's 44 characters and base58, likely a Solana token
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tokenAddress);
    } catch (error) {
        return false;
    }
}

app.get('/api/pair-address/:tokenAddress', async (req, res) => {
    try {
        const { tokenAddress } = req.params;

        if (!tokenAddress) {
            return res.status(400).json({ error: 'Token address is required' });
        }

        console.log(`🔍 Getting address for token: ${tokenAddress}`);

        // 🔥 FIRST: Check if we have the bonding curve stored from detection
        const detectedToken = botState.detectedTokens.get(tokenAddress);

        if (detectedToken && detectedToken.bondingCurveAddress) {
            console.log(`✅ Found stored bonding curve: ${detectedToken.bondingCurveAddress}`);

            res.json({
                success: true,
                tokenAddress,
                bondingCurveData: {
                    bondingCurveAddress: detectedToken.bondingCurveAddress,
                    type: 'pump_fun_bonding_curve',
                    source: 'stored_from_detection'
                },
                axiomUrl: `https://axiom.trade/meme/${detectedToken.bondingCurveAddress}`,
                fallbackAxiomUrl: `https://axiom.trade/meme/${tokenAddress}`,
                isPumpFun: true
            });
            return;
        }

        // Check if this is a pump.fun token (ends with 'pump' or detected as pump.fun)
        const isPumpFunToken = tokenAddress.endsWith('pump') || await checkIfPumpFunToken(tokenAddress);

        if (isPumpFunToken) {
            try {
                console.log(`🎯 Pump.fun token detected, calculating bonding curve address as fallback`);

                const { PublicKey } = require('@solana/web3.js');
                const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

                const mintPublicKey = new PublicKey(tokenAddress);
                const [bondingCurve] = PublicKey.findProgramAddressSync(
                    [Buffer.from("bonding-curve"), mintPublicKey.toBytes()],
                    PUMP_FUN_PROGRAM
                );

                console.log(`✅ Calculated bonding curve as fallback: ${bondingCurve.toString()}`);

                res.json({
                    success: true,
                    tokenAddress,
                    bondingCurveData: {
                        bondingCurveAddress: bondingCurve.toString(),
                        type: 'pump_fun_bonding_curve',
                        source: 'calculated_fallback'
                    },
                    axiomUrl: `https://axiom.trade/meme/${bondingCurve.toString()}`,
                    fallbackAxiomUrl: `https://axiom.trade/meme/${tokenAddress}`,
                    isPumpFun: true
                });

            } catch (error) {
                console.error('❌ Error calculating bonding curve:', error);

                res.json({
                    success: false,
                    tokenAddress,
                    message: 'Failed to get bonding curve address',
                    fallbackAxiomUrl: `https://axiom.trade/meme/${tokenAddress}`,
                    isPumpFun: true,
                    error: error.message
                });
            }
        } else {
            // For non-pump.fun tokens, use the existing pair address logic
            const pairData = await getPairAddressFromDexScreener(tokenAddress);

            if (pairData) {
                console.log(`✅ Found pair data:`, pairData);

                res.json({
                    success: true,
                    tokenAddress,
                    pairData,
                    axiomUrl: `https://axiom.trade/meme/${pairData.pairAddress}`,
                    fallbackAxiomUrl: `https://axiom.trade/meme/${tokenAddress}`,
                    isPumpFun: false
                });
            } else {
                console.log(`❌ No pair found for token: ${tokenAddress}`);

                res.json({
                    success: false,
                    tokenAddress,
                    message: 'No pair found for this token',
                    fallbackAxiomUrl: `https://axiom.trade/meme/${tokenAddress}`,
                    isPumpFun: false
                });
            }
        }
    } catch (error) {
        console.error('❌ Error in pair-address endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            fallbackAxiomUrl: `https://axiom.trade/meme/${req.params.tokenAddress}`
        });
    }
});

async function snipeToken(tokenAddress, config) {
    console.log(`🎯 SNIPING: ${tokenAddress} with ${config.amount} SOL`);

    try {
        const params = {
            action: "buy",
            mint: tokenAddress,
            amount: config.amount,
            denominatedInSol: "true",
            slippage: config.fees || 10,
            priorityFee: config.mevProtection ? 0.00005 : 0.00001
        };

        const { signature } = await executeAPITrade(params);

        // 🔥 GENERATE TOKEN PAGE URL BEFORE BROADCASTING
        const tokenPageUrl = await getTokenPageUrl(tokenAddress, botState.settings.tokenPageDestination);

        broadcastToClients({
            type: 'snipe_success',
            data: {
                tokenAddress,
                signature,
                amount: config.amount,
                tokenPageUrl,
                timestamp: new Date().toISOString(),
                openTokenPage: true,
                destination: botState.settings.tokenPageDestination // ADD THIS LINE
            }
        });

        return { success: true, signature, tokenPageUrl };
    } catch (error) {
        console.error('Snipe failed:', error.message);

        broadcastToClients({
            type: 'snipe_error',
            data: {
                tokenAddress,
                error: error.message,
                timestamp: new Date().toISOString()
            }
        });

        return { success: false, error: error.message };
    }
}

async function getTokenPageUrl(tokenAddress, destination, platform = null) {
    console.log(`🌐 Generating token page URL for ${tokenAddress} on ${destination}`);

    switch (destination) {
        case 'neo_bullx':
            return `https://neo.bullx.io/terminal?chainId=1399811149&address=${tokenAddress}`;

        case 'axiom':
            // Always try to get pair address from DexScreener for Axiom
            try {
                console.log(`🔍 Fetching pair address for Axiom...`);
                const pairData = await getPairAddressFromDexScreener(tokenAddress);

                if (pairData && pairData.pairAddress) {
                    console.log(`🎯 Using Axiom with pair address: ${pairData.pairAddress}`);
                    return `https://axiom.trade/meme/${pairData.pairAddress}`;
                } else {
                    console.log(`⚠️ No pair found, using token address for Axiom: ${tokenAddress}`);
                    return `https://axiom.trade/meme/${tokenAddress}`;
                }
            } catch (error) {
                console.error('❌ Error getting pair address for Axiom:', error);
                return `https://axiom.trade/meme/${tokenAddress}`;
            }

        default:
            return `https://neo.bullx.io/terminal?chainId=1399811149&address=${tokenAddress}`;
    }
}

// ========== TOKEN PROCESSING ==========
// ========== REVERT TO YOUR ORIGINAL WORKING CODE ==========
// Only fix the community detection logic, keep everything else EXACTLY the same

// KEEP YOUR ORIGINAL connectToPumpPortal() - DON'T CHANGE IT
// KEEP YOUR ORIGINAL connectToLetsBonk() - DON'T CHANGE IT  
// KEEP YOUR ORIGINAL start/stop endpoints - DON'T CHANGE THEM

async function performActualScraping(communityId, tokenData, tokenStartTime) {
    const logger = createBlueLogger();

    // ✅ DIRECTLY START WITH BROWSER SCRAPING (NO COMMUNITY ID CHECKING)
    logger.logBold('🔍 PHASE 1: Attempting to scrape community admin list...');
    logger.log(`🎯 Target Community: ${communityId}`);
    logger.log(`💰 Token: ${tokenData.tokenAddress || 'Unknown'}`);
    logger.log(`🏷️ Token Name: ${tokenData.name || 'Unknown'}`);

    // Initialize scraper if needed
    if (!twitterScraper.isInitialized) {
        logger.log('🤖 Twitter scraper not initialized, initializing...');
        const initSuccess = await twitterScraper.init();
        if (!initSuccess) {
            logger.error('Failed to initialize Twitter scraper');
            throw new Error('Failed to initialize Twitter scraper');
        }
        logger.success('Twitter scraper initialized successfully');
    }

    // Check session status
    logger.log('🔍 Checking Twitter login session status...');
    const sessionStatus = await twitterScraper.checkSessionStatus();

    if (!sessionStatus.loggedIn) {
        logger.error('Twitter session not active');
        throw new Error('Twitter session not active - admin needs to login manually');
    }

    logger.success('Twitter session active! Proceeding with community scraping...');

    // ✅ ACTUAL SCRAPING HAPPENS HERE
    logger.logBold(`🕷️ PHASE 2: Scraping community ${communityId} admin list...`);
    logger.log(`🌐 Target URL: https://x.com/i/communities/${communityId}/moderators`);

    const communityAdmins = await twitterScraper.scrapeCommunityAdmins(communityId);
    logger.log(`📊 Scraping completed! Found ${communityAdmins.length} admin(s)`);

    if (communityAdmins.length === 0) {
        logger.warning('No admins found in community (private/empty/restricted)');
        return null;
    }

    // ✅ PHASE 3: ADMIN MATCHING LOGIC
    logger.success(`SUCCESS! Found ${communityAdmins.length} admin(s) in community ${communityId}:`);
    communityAdmins.forEach((admin, index) => {
        logger.log(`   ${index + 1}. @${admin.username} (${admin.badgeType}) - Source: ${admin.source}`);
    });

    // Check if any community admin is in our lists
    for (const admin of communityAdmins) {
        logger.log(`🔍 Checking scraped admin: @${admin.username} (${admin.badgeType})`);

        // ✅ CORRECT: Check admin username in primary list
        const primaryAdminConfig = botState.checkAdminInPrimary(admin.username);
        if (primaryAdminConfig) {
            logger.success(`ADMIN MATCH FOUND! @${admin.username} found in PRIMARY admin list!`);

            return {
                matchType: 'primary_admin',
                matchedEntity: admin.username,
                detectionReason: `Primary Community Admin: @${admin.username} (${admin.badgeType}) from Community ${communityId}`,
                config: primaryAdminConfig,
                communityAdmins: communityAdmins,
                matchedAdmin: admin,
                scrapingMethod: 'community_admin_scraping'
            };
        }

        // ✅ CORRECT: Check admin username in secondary list
        const secondaryAdminConfig = botState.checkAdminInSecondary(admin.username);
        if (secondaryAdminConfig) {
            // ✅ ENHANCED TIMING LOG
            const matchTime = Date.now() - tokenStartTime;
            logSecondaryMatch(tokenData.tokenAddress, admin.username, matchTime);
            logAdminMatchTiming(tokenData.tokenAddress, admin.username, 'secondary_admin', matchTime); // ADD THIS LINE

            logger.success(`ADMIN MATCH FOUND! @${admin.username} found in SECONDARY admin list!`);

            return {
                matchType: 'secondary_admin',
                matchedEntity: admin.username,
                detectionReason: `Secondary Community Admin: @${admin.username} (${admin.badgeType}) from Community ${communityId}`,
                config: secondaryAdminConfig,
                communityAdmins: communityAdmins,
                matchedAdmin: admin,
                scrapingMethod: 'community_admin_scraping'
            };
        }

        // Check variations
        const usernameVariations = [
            admin.username,
            `@${admin.username}`,
            admin.username.toLowerCase(),
            `@${admin.username.toLowerCase()}`
        ];

        logger.log(`🔄 Checking variations for @${admin.username}: [${usernameVariations.join(', ')}]`);

        for (const variation of usernameVariations) {
            const primaryVariationConfig = botState.checkAdminInPrimary(variation);
            if (primaryVariationConfig) {
                logger.success(`VARIATION MATCH FOUND! @${admin.username} found in PRIMARY list as "${variation}"!`);

                return {
                    matchType: 'primary_admin',
                    matchedEntity: variation,
                    detectionReason: `Primary Community Admin: @${admin.username} (${admin.badgeType}) from Community ${communityId} (matched as ${variation})`,
                    config: primaryVariationConfig,
                    communityAdmins: communityAdmins,
                    matchedAdmin: admin,
                    scrapingMethod: 'community_admin_scraping_variation'
                };
            }

            const secondaryVariationConfig = botState.checkAdminInSecondary(variation);
            if (secondaryVariationConfig) {
                // ✅ LOG SECONDARY MATCH FOR VARIATIONS
                const matchTime = Date.now() - tokenStartTime;
                logSecondaryMatch(tokenData.tokenAddress, variation, matchTime);

                logger.success(`VARIATION MATCH FOUND! @${admin.username} found in SECONDARY list as "${variation}"!`);

                return {
                    matchType: 'secondary_admin',
                    matchedEntity: variation,
                    detectionReason: `Secondary Community Admin: @${admin.username} (${admin.badgeType}) from Community ${communityId} (matched as ${variation})`,
                    config: secondaryVariationConfig,
                    communityAdmins: communityAdmins,
                    matchedAdmin: admin,
                    scrapingMethod: 'community_admin_scraping_variation'
                };
            }
        }

        logger.warning(`No match found for @${admin.username} in any admin lists`);
    }

    logger.error('NO MATCHES FOUND! None of the scraped admins are in your admin lists');
    return null;
}

async function applyScrapingResultToToken(scrapingResult, communityId, tokenData, tokenStartTime) {
    const logger = createBlueLogger();

    if (!scrapingResult) {
        return null;
    }

    // ✅ CRITICAL FIX: Always log secondary matches with proper timing for each token
    if (scrapingResult.matchType === 'secondary_admin') {
        const matchTime = Date.now() - tokenStartTime;
        logSecondaryMatch(tokenData.tokenAddress, scrapingResult.matchedEntity, matchTime);
        logger.success(`🔔 Secondary match logged for this token: ${scrapingResult.matchedEntity} - ${matchTime}ms`);
    }

    // Broadcast the match found event for this specific token
    broadcastToClients({
        type: 'community_admin_match_found',
        data: {
            communityId: communityId,
            matchType: scrapingResult.matchType === 'primary_admin' ? 'primary' : 'secondary',
            matchedAdmin: scrapingResult.matchedAdmin || { username: scrapingResult.matchedEntity },
            matchedAs: scrapingResult.scrapingMethod,
            allScrapedAdmins: scrapingResult.communityAdmins || []
        }
    });

    return scrapingResult;
}

async function scrapeCommunityAndMatchAdmins(communityId, tokenData) {
    try {
        console.log(`🚀 API SCRAPING: Community ${communityId} (replacing browser scraping)`);

        // ✅ STEP 1: Use twitterapi.io API instead of browser scraping
        const moderators = await twitterAPI.getAllCommunityModerators(communityId);

        if (!moderators || moderators.length === 0) {
            console.log('❌ No moderators found in community');

            // Broadcast that no moderators were found
            broadcastToClients({
                type: 'community_scraping_info',
                data: {
                    communityId: communityId,
                    reason: 'No moderators found in community',
                    tokenAddress: tokenData.tokenAddress,
                    timestamp: new Date().toISOString()
                }
            });

            return null;
        }

        // ✅ STEP 2: Transform API response to match your existing format
        const transformedAdmins = moderators.map(moderator => ({
            username: moderator.screen_name || moderator.name || 'unknown',
            displayName: moderator.name || moderator.screen_name || 'Unknown',
            userId: moderator.id,
            isVerified: moderator.verified || moderator.isBlueVerified,
            followersCount: moderator.followers_count,
            location: moderator.location,
            description: moderator.description,
            profileImageUrl: moderator.profile_image_url_https,
            badgeType: 'Admin',
            source: 'api_fetch'
        }));

        console.log(`✅ Successfully fetched ${transformedAdmins.length} moderators from community ${communityId}:`);
        transformedAdmins.forEach((admin, index) => {
            console.log(`   ${index + 1}. @${admin.username} (${admin.displayName}) - ${admin.followersCount || 0} followers`);
        });

        // ✅ STEP 3: Check against your admin lists using botState methods
        for (const admin of transformedAdmins) {
            console.log(`🔍 Checking scraped admin: @${admin.username}`);

            // Check against primary admin list
            const primaryAdminConfig = botState.checkAdminInPrimary(admin.username);
            if (primaryAdminConfig) {
                console.log(`✅ ADMIN MATCH FOUND! @${admin.username} found in PRIMARY admin list!`);

                return {
                    matchType: 'primary_admin',
                    matchedEntity: admin.username,
                    detectionReason: `Primary Community Admin: @${admin.username} from Community ${communityId}`,
                    config: primaryAdminConfig,
                    matchedAdmin: admin,
                    scrapingMethod: 'api_fetch'
                };
            }

            // Check against secondary admin list
            const secondaryAdminConfig = botState.checkAdminInSecondary(admin.username);
            if (secondaryAdminConfig) {
                console.log(`✅ ADMIN MATCH FOUND! @${admin.username} found in SECONDARY admin list!`);

                return {
                    matchType: 'secondary_admin',
                    matchedEntity: admin.username,
                    detectionReason: `Secondary Community Admin: @${admin.username} from Community ${communityId}`,
                    config: secondaryAdminConfig,
                    matchedAdmin: admin,
                    scrapingMethod: 'api_fetch'
                };
            }

            // Check username variations
            const usernameVariations = [
                admin.username,
                `@${admin.username}`,
                admin.username.toLowerCase(),
                `@${admin.username.toLowerCase()}`
            ];

            console.log(`🔄 Checking variations for @${admin.username}: [${usernameVariations.join(', ')}]`);

            for (const variation of usernameVariations) {
                const primaryVariationConfig = botState.checkAdminInPrimary(variation);
                if (primaryVariationConfig) {
                    console.log(`✅ VARIATION MATCH FOUND! "${variation}" found in PRIMARY admin list!`);

                    return {
                        matchType: 'primary_admin',
                        matchedEntity: variation,
                        detectionReason: `Primary Community Admin: @${admin.username} (variation: ${variation}) from Community ${communityId}`,
                        config: primaryVariationConfig,
                        matchedAdmin: admin,
                        scrapingMethod: 'api_fetch'
                    };
                }

                const secondaryVariationConfig = botState.checkAdminInSecondary(variation);
                if (secondaryVariationConfig) {
                    console.log(`✅ VARIATION MATCH FOUND! "${variation}" found in SECONDARY admin list!`);

                    return {
                        matchType: 'secondary_admin',
                        matchedEntity: variation,
                        detectionReason: `Secondary Community Admin: @${admin.username} (variation: ${variation}) from Community ${communityId}`,
                        config: secondaryVariationConfig,
                        matchedAdmin: admin,
                        scrapingMethod: 'api_fetch'
                    };
                }
            }
        }

        console.log('❌ No matching admins found in configured lists');

        // Broadcast that no matches were found
        broadcastToClients({
            type: 'community_scraping_info',
            data: {
                communityId: communityId,
                reason: `${transformedAdmins.length} admins scraped, but none match your lists`,
                scrapedAdmins: transformedAdmins,
                tokenAddress: tokenData.tokenAddress,
                timestamp: new Date().toISOString()
            }
        });

        return null;

    } catch (error) {
        console.error('❌ Error in API-based community scraping:', error);

        // ✅ NEW: Check for specific API errors and broadcast to frontend
        let errorType = 'general_error';
        let userMessage = 'Unknown Twitter API error occurred';

        if (error.message.includes('402 Payment Required') || error.message.includes('Credits is not enough')) {
            errorType = 'credits_exhausted';
            userMessage = 'Twitter API credits are exhausted. Please recharge your account.';
            console.log('💳 Twitter API credits exhausted - broadcasting to frontend');
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorType = 'unauthorized';
            userMessage = 'Twitter API access denied. Check your API key configuration.';
        } else if (error.message.includes('403')) {
            errorType = 'forbidden';
            userMessage = 'Twitter API access forbidden. Your account may be restricted.';
        } else if (error.message.includes('429')) {
            errorType = 'rate_limited';
            userMessage = 'Twitter API rate limit exceeded. Please wait before trying again.';
        } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
            errorType = 'timeout';
            userMessage = 'Twitter API request timed out. Please try again.';
        }

        // Broadcast the error to frontend
        broadcastToClients({
            type: 'twitter_api_error',
            data: {
                communityId: communityId,
                error: userMessage,
                errorType: errorType,
                message: userMessage,
                tokenAddress: tokenData.tokenAddress,
                originalError: error.message,
                timestamp: new Date().toISOString()
            }
        });

        throw error; // Re-throw so calling code can handle it
    }
}

async function processNewToken(tokenData, platform) {
    const tokenAddress = tokenData.mint;
    const creatorWallet = tokenData.creator || tokenData.traderPublicKey;
    const tokenStartTime = Date.now();

    // Check if this is a bonk token
    const isBonkToken = platform === 'letsbonk' ||
        tokenData.pool === 'bonk' ||
        tokenData.pool === 'letsbonk';

    // Check for duplicates
    if (botState.processedTokens.has(tokenAddress)) {
        return;
    }

    botState.processedTokens.add(tokenAddress);

    // Check if this is a demo token (has metadata field from demo injection)
    const isDemoToken = tokenData.metadata && (tokenData.metadata.twitter || tokenData.metadata.name);

    let enhancedData = null;
    let twitterData = { type: null, id: null, handle: null, admin: null };

    // Handle DEMO tokens specially
    if (isDemoToken) {
        console.log('🧪 DEMO TOKEN DETECTED - Using provided metadata directly');

        // Use metadata directly from demo without API calls
        enhancedData = {
            name: tokenData.metadata.name || tokenData.name || 'Demo Token',
            symbol: tokenData.metadata.symbol || tokenData.symbol || 'DEMO',
            description: tokenData.metadata.description || 'Demo token for testing',
            imageUrl: tokenData.uri || null,
            twitterUrl: tokenData.metadata.twitter || null,
            website: tokenData.metadata.website || null,
            hasEnhancedData: true
        };

        // Extract Twitter data from demo metadata
        if (tokenData.metadata.twitter) {
            const twitterInfo = extractTwitterDataRobust(tokenData.metadata.twitter);
            twitterData = {
                type: twitterInfo.type,
                id: twitterInfo.id,
                handle: twitterInfo.handle,
                admin: twitterInfo.handle || twitterInfo.id,
                originalUrl: tokenData.metadata.twitter
            };
        }
    }
    // BONK TOKEN - Special processing with delays
    else if (isBonkToken) {
        console.log('\n');
        console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
        console.log('║                         🦎 BONK TOKEN DETECTED! 🦎                          ║');
        console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
        console.log(`┌─ MINT ADDRESS: ${tokenAddress}`);
        console.log(`├─ Platform: ${platform}`);
        console.log(`├─ Pool: ${tokenData.pool}`);
        console.log(`└─ Detection Time: ${new Date().toISOString()}`);

        console.log('\n⏳ [BONK-DELAY] Adding 3 second initial delay for token indexing...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        let retryCount = 0;
        const maxRetries = 5;
        const retryDelays = [3000, 5000, 7000, 10000, 15000];

        while (retryCount < maxRetries) {
            try {
                if (retryCount > 0) {
                    console.log(`🔄 RETRY ${retryCount}/${maxRetries} - Waiting ${retryDelays[retryCount - 1]}ms`);
                    await new Promise(resolve => setTimeout(resolve, retryDelays[retryCount - 1]));
                }

                const metadata = await fetchEnhancedBonkMetadata(tokenAddress, tokenData);

                if (metadata && (metadata.name !== 'Unknown' || metadata.symbol !== 'Unknown')) {
                    enhancedData = metadata;
                    console.log(`✅ [BONK] Metadata extracted: "${metadata.name}" (${metadata.symbol})`);
                    break;
                }
            } catch (error) {
                console.log(`❌ [BONK] Attempt ${retryCount + 1} failed: ${error.message}`);
            }
            retryCount++;
        }

        if (!enhancedData) {
            enhancedData = {
                name: tokenData.name || `Bonk Token ${tokenAddress.slice(0, 8)}`,
                symbol: tokenData.symbol || 'BONK',
                description: tokenData.description || 'New Bonk Token',
                imageUrl: tokenData.uri || null,
                twitterUrl: null,
                hasEnhancedData: false
            };
        }
    }
    // PUMP TOKEN - Fast processing, no delays
    else {
        console.log(`🚀 [PUMP] Processing Pump.fun token: ${tokenAddress}`);

        try {
            const completeMetadata = await tokenMetadataExtractor.getCompleteTokenMetadata(tokenAddress, false);
            const bestMetadata = tokenMetadataExtractor.getBestMetadata(completeMetadata);

            enhancedData = {
                name: bestMetadata.name !== 'Unknown' ? bestMetadata.name : tokenData.name || 'New Token',
                symbol: bestMetadata.symbol !== 'Unknown' ? bestMetadata.symbol : tokenData.symbol || 'TOKEN',
                description: bestMetadata.description,
                imageUrl: bestMetadata.logoURI !== 'Not found' ? bestMetadata.logoURI : tokenData.uri || null,
                twitterUrl: bestMetadata.twitter !== 'Not available' ? bestMetadata.twitter : null,
                website: bestMetadata.website !== 'Not available' ? bestMetadata.website : null,
                hasEnhancedData: true
            };
        } catch (error) {
            enhancedData = {
                name: tokenData.name || `Token ${tokenAddress.slice(0, 8)}`,
                symbol: tokenData.symbol || 'TOKEN',
                description: null,
                imageUrl: tokenData.uri || null,
                twitterUrl: null,
                website: null,
                hasEnhancedData: false
            };
        }
    }

    // Extract Twitter data if available (for both types) - only if not already set by demo
    if (!isDemoToken && enhancedData.twitterUrl) {
        const twitterInfo = tokenMetadataExtractor.extractTwitterDataRobust(enhancedData.twitterUrl);
        twitterData = {
            type: twitterInfo.type,
            id: twitterInfo.id,
            handle: twitterInfo.handle,
            admin: twitterInfo.handle || twitterInfo.id,
            originalUrl: enhancedData.twitterUrl
        };
    }

    // Create token data object
    const completeTokenData = {
        tokenAddress,
        platform,
        creatorWallet,
        name: enhancedData.name,
        symbol: enhancedData.symbol,
        description: enhancedData.description,
        uri: enhancedData.imageUrl,
        imageUrl: enhancedData.imageUrl,
        logoURI: enhancedData.imageUrl,
        marketCapSol: tokenData.marketCapSol || 0,
        solAmount: tokenData.solAmount || 0,
        pool: tokenData.pool,
        twitter: enhancedData.twitterUrl,
        twitterType: twitterData.type,
        twitterCommunityId: twitterData.id,
        twitterHandle: twitterData.handle,
        twitterAdmin: twitterData.admin,
        website: enhancedData.website,
        hasTokenMetadataData: enhancedData.hasEnhancedData,
        isBonkToken: isBonkToken
    };

    console.log(`🔍 Processing token with metadata extracted. Now checking filters...`);

    // 2.5 Check Twitter Tweet/Status Reuse - SIMPLIFIED VERSION
    if (twitterData.type === 'tweet' && twitterData.id) {
        console.log(`📱 TWEET DETECTED: Tweet ID ${twitterData.id} from @${twitterData.handle}`);

        // Check if tweet was already used
        if (botState.settings.enableCommunityReuse) {
            const tweetUsed = await isTweetUsedInFirebase(twitterData.id);
            if (tweetUsed) {
                console.log(`❌ Tweet ${twitterData.id} was already used before - skipping token`);
                return; // Skip this token completely
            }
        }

        // Mark tweet as used immediately (save to both cache and append to local JSON)
        await markTweetAsUsedInFirebase(twitterData.id, twitterData.handle, completeTokenData);

        // Continue to normal admin filtering - don't return here
        console.log(`✅ Tweet ${twitterData.id} is new - continuing with normal token processing`);
    }

    // ========== ADMIN FILTERING LOGIC STARTS HERE ==========

    // Check if "snipe all tokens" mode is enabled
    if (botState.settings.snipeAllTokens) {
        console.log(`🎯 SNIPE ALL MODE: Token detected - ${tokenAddress}`);

        const detectedTokenData = {
            ...completeTokenData,
            matchType: 'snipe_all',
            matchedEntity: 'All tokens',
            detectionReason: 'Snipe All Mode Enabled'
        };

        botState.addDetectedToken(tokenAddress, detectedTokenData);

        broadcastToClients({
            type: 'token_detected',
            data: detectedTokenData
        });

        if (!botState.settings.detectionOnlyMode) {
            await snipeToken(tokenAddress, botState.settings.globalSnipeSettings);
        }
        return;
    }

    // Check admin filtering
    if (botState.settings.enableAdminFilter) {
        console.log('🔍 Checking admin filters...');

        // 1. Check Twitter Individual Admin matching
        if (twitterData.admin && twitterData.type === 'individual') {
            console.log(`👤 Found individual Twitter: @${twitterData.handle}`);

            // Check primary admins list
            const primaryAdminConfig = botState.checkAdminInPrimary(twitterData.handle);
            if (primaryAdminConfig) {
                console.log(`✅ Admin @${twitterData.handle} found in primary admin list!`);

                const detectedTokenData = {
                    ...completeTokenData,
                    matchType: 'primary_admin',
                    matchedEntity: twitterData.handle,
                    detectionReason: `Primary Admin: @${twitterData.handle}`,
                    config: primaryAdminConfig
                };

                botState.addDetectedToken(tokenAddress, detectedTokenData);
                broadcastToClients({
                    type: 'token_detected',
                    data: detectedTokenData
                });

                if (!botState.settings.detectionOnlyMode) {
                    await snipeToken(tokenAddress, botState.settings.globalSnipeSettings);
                }
                return;
            }

            // Check secondary admins list
            const secondaryAdminConfig = botState.checkAdminInSecondary(twitterData.handle);
            if (secondaryAdminConfig) {
                const matchTime = Date.now() - tokenStartTime;
                logSecondaryMatch(tokenAddress, twitterData.handle, matchTime);
                logAdminMatchTiming(tokenAddress, twitterData.handle, 'secondary_admin_individual', matchTime); // ADD THIS LINE

                console.log(`🔔 Admin @${twitterData.handle} found in secondary admin list!`);

                const detectedTokenData = {
                    ...completeTokenData,
                    matchType: 'secondary_admin',
                    matchedEntity: twitterData.handle,
                    detectionReason: `Secondary Admin: @${twitterData.handle}`,
                    config: secondaryAdminConfig
                };

                botState.addDetectedToken(tokenAddress, detectedTokenData);
                broadcastToClients({
                    type: 'token_detected',
                    data: detectedTokenData
                });

                broadcastToClients({
                    type: 'secondary_popup_trigger',
                    data: {
                        tokenData: detectedTokenData,
                        globalSnipeSettings: botState.settings.globalSnipeSettings,
                        timestamp: new Date().toISOString()
                    }
                });

                return;
            }
        }

        // 2. Check Twitter Community Admin Scraping
        if (twitterData.type === 'community' && twitterData.id) {
            console.log(`🏘️ TWITTER COMMUNITY DETECTED: ${twitterData.id}`);

            // Check if community was already used
            if (botState.settings.enableCommunityReuse) {
                const communityUsed = await isCommunityUsedInFirebase(twitterData.id);
                if (communityUsed) {
                    console.log(`❌ Community ${twitterData.id} was already used before - skipping token`);
                    return;
                }
            }

            // Scrape community admins
            const communityMatchResult = await scrapeCommunityAndMatchAdmins(twitterData.id, completeTokenData);

            if (communityMatchResult) {
                const detectedTokenData = {
                    ...completeTokenData,
                    matchType: communityMatchResult.matchType,
                    matchedEntity: communityMatchResult.matchedEntity,
                    detectionReason: communityMatchResult.detectionReason,
                    config: communityMatchResult.config
                };

                botState.addDetectedToken(tokenAddress, detectedTokenData);

                // Mark community as used
                await markCommunityAsUsedInFirebase(twitterData.id, detectedTokenData);

                broadcastToClients({
                    type: 'token_detected',
                    data: detectedTokenData
                });

                if (communityMatchResult.matchType === 'primary_admin' && !botState.settings.detectionOnlyMode) {
                    await snipeToken(tokenAddress, botState.settings.globalSnipeSettings);
                } else if (communityMatchResult.matchType === 'secondary_admin') {
                    const matchTime = Date.now() - tokenStartTime;
                    logSecondaryMatch(tokenAddress, communityMatchResult.matchedEntity, matchTime);

                    broadcastToClients({
                        type: 'secondary_popup_trigger',
                        data: {
                            tokenData: detectedTokenData,
                            globalSnipeSettings: botState.settings.globalSnipeSettings,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
                return;
            }
        }

        // 3. Check Wallet Address matching
        if (creatorWallet) {
            console.log(`💰 Checking creator wallet: ${creatorWallet}`);

            // Check primary admins
            const primaryAdminConfig = botState.checkAdminInPrimary(creatorWallet);
            if (primaryAdminConfig) {
                console.log(`✅ Wallet ${creatorWallet} found in primary admin list!`);

                const detectedTokenData = {
                    ...completeTokenData,
                    matchType: 'primary_admin',
                    matchedEntity: creatorWallet,
                    detectionReason: `Primary Wallet: ${creatorWallet.substring(0, 8)}...`,
                    config: primaryAdminConfig
                };

                botState.addDetectedToken(tokenAddress, detectedTokenData);
                broadcastToClients({
                    type: 'token_detected',
                    data: detectedTokenData
                });

                if (!botState.settings.detectionOnlyMode) {
                    await snipeToken(tokenAddress, botState.settings.globalSnipeSettings);
                }
                return;
            }

            // Check secondary admins
            const secondaryAdminConfig = botState.checkAdminInSecondary(creatorWallet);
            if (secondaryAdminConfig) {
                const matchTime = Date.now() - tokenStartTime;
                logSecondaryMatch(tokenAddress, creatorWallet, matchTime);
                console.log(`🔔 Wallet ${creatorWallet} found in secondary admin list!`);

                const detectedTokenData = {
                    ...completeTokenData,
                    matchType: 'secondary_admin',
                    matchedEntity: creatorWallet,
                    detectionReason: `Secondary Wallet: ${creatorWallet.substring(0, 8)}...`,
                    config: secondaryAdminConfig
                };

                botState.addDetectedToken(tokenAddress, detectedTokenData);
                broadcastToClients({
                    type: 'token_detected',
                    data: detectedTokenData
                });

                broadcastToClients({
                    type: 'secondary_popup_trigger',
                    data: {
                        tokenData: detectedTokenData,
                        globalSnipeSettings: botState.settings.globalSnipeSettings,
                        timestamp: new Date().toISOString()
                    }
                });
                return;
            }
        }

        console.log(`❌ Token ${tokenAddress} doesn't match any admin criteria`);
        return;
    }

    // If admin filtering is disabled, detect all tokens
    if (!botState.settings.enableAdminFilter) {
        console.log(`📢 Admin filtering disabled - detecting token: ${tokenAddress}`);

        const detectedTokenData = {
            ...completeTokenData,
            matchType: 'no_filters',
            matchedEntity: 'No filters active',
            detectionReason: 'Admin filtering disabled'
        };

        botState.addDetectedToken(tokenAddress, detectedTokenData);
        broadcastToClients({
            type: 'token_detected',
            data: detectedTokenData
        });

        if (!botState.settings.detectionOnlyMode) {
            await snipeToken(tokenAddress, botState.settings.globalSnipeSettings);
        }
    }
}

// New helper function for enhanced Bonk metadata fetching
async function fetchEnhancedBonkMetadata(tokenAddress, tokenData) {
    try {
        // Try multiple APIs with proper error handling

        // 1. Try Token Metadata Extractor
        try {
            const completeMetadata = await tokenMetadataExtractor.getCompleteTokenMetadata(tokenAddress, true);
            const bestMetadata = tokenMetadataExtractor.getBestMetadata(completeMetadata);

            if (bestMetadata && bestMetadata.name !== 'Unknown') {
                return {
                    name: bestMetadata.name,
                    symbol: bestMetadata.symbol,
                    description: bestMetadata.description,
                    imageUrl: bestMetadata.logoURI !== 'Not found' ? bestMetadata.logoURI : null,
                    twitterUrl: bestMetadata.twitter !== 'Not available' ? bestMetadata.twitter : null,
                    website: bestMetadata.website !== 'Not available' ? bestMetadata.website : null,
                    hasEnhancedData: true
                };
            }
        } catch (error) {
            console.log(`[METADATA-FALLBACK] Token extractor failed: ${error.message}`);
        }

        // 2. Try direct Helius API
        if (process.env.HELIUS_RPC) {
            try {
                const axios = require('axios');
                const heliusUrl = `https://api.helius.xyz/v0/token-metadata?api-key=${process.env.HELIUS_RPC.split('api-key=')[1]}`;
                const response = await axios.post(heliusUrl, {
                    mintAccounts: [tokenAddress],
                    includeOffChain: true,
                    disableCache: false
                }, { timeout: 3000 });

                if (response.data && response.data[0]) {
                    const data = response.data[0];
                    return {
                        name: data.onChainMetadata?.metadata?.data?.name || data.legacyMetadata?.name || 'Unknown',
                        symbol: data.onChainMetadata?.metadata?.data?.symbol || data.legacyMetadata?.symbol || 'BONK',
                        description: data.offChainMetadata?.metadata?.description || null,
                        imageUrl: data.offChainMetadata?.metadata?.image || data.legacyMetadata?.logoURI || null,
                        twitterUrl: data.offChainMetadata?.metadata?.twitter || null,
                        website: data.offChainMetadata?.metadata?.website || null,
                        hasEnhancedData: true
                    };
                }
            } catch (error) {
                console.log(`[METADATA-FALLBACK] Helius API failed: ${error.message}`);
            }
        }

        // 3. Return basic data if all fails
        return {
            name: tokenData.name || 'Unknown',
            symbol: tokenData.symbol || 'Unknown',
            description: null,
            imageUrl: tokenData.uri || null,
            twitterUrl: null,
            website: null,
            hasEnhancedData: false
        };

    } catch (error) {
        console.log(`[METADATA-ERROR] All metadata fetching failed: ${error.message}`);
        return null;
    }
}

// Enhanced Twitter data extraction function that handles all possible formats
function extractTwitterDataRobust(input, sourceType = 'unknown') {
    if (!input) return { type: null, id: null, handle: null, source: sourceType };

    console.log(`🔍 Extracting Twitter data from: "${input}" (source: ${sourceType})`);

    const cleanInput = input.trim();

    // Pattern 1: Tweet/Status URLs - ADD THIS PATTERN FIRST
    const tweetPatterns = [
        /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com\/|x\.com\/)([a-zA-Z0-9_]+)\/status\/(\d+)/i,
    ];

    for (const pattern of tweetPatterns) {
        const match = cleanInput.match(pattern);
        if (match) {
            console.log(`📱 Found tweet: @${match[1]} - Tweet ID: ${match[2]}`);
            return {
                type: 'tweet',
                id: match[2], // Tweet ID
                handle: match[1].toLowerCase(), // Username
                source: sourceType,
                originalUrl: cleanInput
            };
        }
    }

    // Pattern 2: Community ID in various formats
    const communityPatterns = [
        /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com\/|x\.com\/)i\/communities\/(\d+)/i,
        /^i\/communities\/(\d+)$/i,
        /communities\/(\d+)/i
    ];

    for (const pattern of communityPatterns) {
        const match = cleanInput.match(pattern);
        if (match) {
            console.log(`🏘️ Found community ID: ${match[1]} (pattern: ${pattern})`);
            return {
                type: 'community',
                id: match[1],
                handle: null,
                source: sourceType,
                originalUrl: cleanInput
            };
        }
    }

    // Pattern 3: Individual Twitter accounts
    const userPatterns = [
        /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com\/|x\.com\/)(?!i\/communities\/)(?!.*\/status\/)([a-zA-Z0-9_]+)/i,
        /^@([a-zA-Z0-9_]+)$/,
        /^([a-zA-Z0-9_]{1,15})$/
    ];

    for (const pattern of userPatterns) {
        const match = cleanInput.match(pattern);
        if (match) {
            const handle = match[1].toLowerCase();
            if (isValidTwitterHandle(handle)) {
                console.log(`👤 Found individual handle: @${handle} (pattern: ${pattern})`);
                return {
                    type: 'individual',
                    id: null,
                    handle: handle,
                    source: sourceType,
                    originalUrl: cleanInput
                };
            }
        }
    }

    console.log(`❌ No Twitter data found in: "${input}"`);
    return { type: null, id: null, handle: null, source: sourceType };
}

// Enhanced validation for Twitter handles
function isValidTwitterHandle(handle) {
    if (!handle || handle.length < 1 || handle.length > 15) return false;

    // Must only contain alphanumeric and underscore
    if (!/^[a-zA-Z0-9_]+$/.test(handle)) return false;

    // Block common non-username terms
    const blockedTerms = [
        'home', 'explore', 'messages', 'follow', 'click', 'search',
        'notifications', 'profile', 'settings', 'logout', 'help',
        'about', 'privacy', 'terms', 'status', 'intent', 'share'
    ];

    if (blockedTerms.includes(handle.toLowerCase())) return false;

    return true;
}

// Helper function to get nested object values safely
function getNestedValue(obj, path) {
    try {
        return path.split('.').reduce((current, key) => {
            if (key.includes('?')) {
                key = key.replace('?', '');
                return current?.[key];
            }
            return current[key];
        }, obj);
    } catch (error) {
        return undefined;
    }
}

// ========== API ENDPOINTS ==========

// Global snipe settings API endpoints
app.post('/api/global-snipe-settings', (req, res) => {
    const { amount, fees, mevProtection, soundNotification } = req.body;

    if (amount) botState.settings.globalSnipeSettings.amount = amount;
    if (fees) botState.settings.globalSnipeSettings.fees = fees;
    if (typeof mevProtection !== 'undefined') botState.settings.globalSnipeSettings.mevProtection = mevProtection;
    if (soundNotification) botState.settings.globalSnipeSettings.soundNotification = soundNotification;

    console.log('Global snipe settings updated:', botState.settings.globalSnipeSettings);

    res.json({
        success: true,
        globalSnipeSettings: botState.settings.globalSnipeSettings
    });
});

app.post('/api/twitter-logout', async (req, res) => {
    try {
        if (!twitterScraper.isInitialized) {
            return res.status(400).json({ error: 'Twitter scraper not initialized' });
        }

        // If browser crashed or closed, reinitialize it first
        if (!twitterScraper.browser || !twitterScraper.page) {
            console.log('🔄 Browser crashed, reinitializing...');
            const initSuccess = await twitterScraper.init();
            if (!initSuccess) {
                return res.status(500).json({ error: 'Failed to reinitialize browser' });
            }
        }

        let logoutSuccess = false;

        // Navigate to logout page and perform logout
        if (twitterScraper.page) {
            try {
                console.log('🚪 Starting Twitter logout process...');

                // Step 1: Go to logout page
                await twitterScraper.page.goto('https://twitter.com/logout', {
                    waitUntil: 'networkidle',
                    timeout: 30000
                });

                await twitterScraper.page.waitForTimeout(2000);

                // Step 2: Try to auto-click logout confirmation
                try {
                    console.log('🔍 Looking for logout confirmation button...');
                    const logoutButton = await twitterScraper.page.waitForSelector(
                        '[data-testid="confirmationSheetConfirm"]',
                        { timeout: 5000 }
                    );

                    if (logoutButton) {
                        console.log('✅ Found logout button, clicking...');
                        await logoutButton.click();
                        await twitterScraper.page.waitForTimeout(3000);

                        // Step 3: Check if we're actually logged out
                        const currentUrl = twitterScraper.page.url();
                        console.log('🔍 Current URL after logout:', currentUrl);

                        // Look for login indicators
                        try {
                            await twitterScraper.page.waitForSelector('[data-testid="loginButton"]', { timeout: 5000 });
                            console.log('✅ Login button found - logout successful');
                            logoutSuccess = true;
                        } catch (e) {
                            // If login button not found, check URL
                            if (currentUrl.includes('/login') || currentUrl.includes('/i/flow/login')) {
                                console.log('✅ Redirected to login page - logout successful');
                                logoutSuccess = true;
                            }
                        }
                    }
                } catch (e) {
                    console.log('⚠️ No logout confirmation button found');

                    // Check if we're already on login page
                    const currentUrl = twitterScraper.page.url();
                    if (currentUrl.includes('/login')) {
                        console.log('✅ Already on login page - logout successful');
                        logoutSuccess = true;
                    }
                }

                // Step 4: If auto-logout failed, try direct navigation to login
                if (!logoutSuccess) {
                    console.log('🔄 Auto-logout failed, trying direct login navigation...');
                    await twitterScraper.page.goto('https://twitter.com/i/flow/login', {
                        waitUntil: 'networkidle',
                        timeout: 30000
                    });

                    // Check if we reached login page
                    const finalUrl = twitterScraper.page.url();
                    if (finalUrl.includes('/login') || finalUrl.includes('/i/flow/login')) {
                        console.log('✅ Successfully navigated to login page');
                        logoutSuccess = true;
                    }
                }

            } catch (e) {
                console.log('⚠️ Error during logout navigation:', e.message);
            }
        }

        // Reset session state regardless of logout success
        twitterScraper.sessionActive = false;

        const message = logoutSuccess ?
            'Successfully logged out from Twitter' :
            'Logout page opened - please complete logout manually in browser';

        res.json({
            success: true,
            loggedOut: logoutSuccess,
            message: message
        });

    } catch (error) {
        console.error('❌ Logout error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/twitter-reopen-browser', async (req, res) => {
    try {
        console.log('🔄 Reopening Twitter browser...');

        // Close existing browser if any
        if (twitterScraper.browser) {
            try {
                await twitterScraper.browser.close();
            } catch (e) {
                console.log('Old browser already closed');
            }
        }

        // Reinitialize
        const initSuccess = await twitterScraper.init();
        if (initSuccess) {
            // Open Twitter login page
            await twitterScraper.openLoginPage();
            res.json({
                success: true,
                message: 'Browser reopened and Twitter login page loaded'
            });
        } else {
            res.status(500).json({ error: 'Failed to reopen browser' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/snipe-with-global-settings/:tokenAddress', async (req, res) => {
    const { tokenAddress } = req.params;
    const globalSettings = botState.settings.globalSnipeSettings;

    try {
        const result = await snipeToken(tokenAddress, globalSettings);

        if (result.success) {
            // 🔥 BROADCAST AUTO-OPEN MESSAGE
            broadcastToClients({
                type: 'auto_open_token_page',
                data: {
                    tokenAddress,
                    tokenPageUrl: result.tokenPageUrl,
                    destination: botState.settings.tokenPageDestination,
                    reason: 'manual_secondary_snipe'
                }
            });
        }

        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Firebase management endpoints
app.get('/api/firebase/used-communities', async (req, res) => {
    try {
        const snapshot = await db.collection('usedCommunities').get();
        const communities = [];
        snapshot.forEach(doc => {
            communities.push({
                id: doc.id,
                ...doc.data()
            });
        });
        res.json({ communities });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tweet management endpoints
app.get('/api/firebase/used-tweets', async (req, res) => {
    try {
        const snapshot = await db.collection('usedTweets').get();
        const tweets = [];
        snapshot.forEach(doc => {
            tweets.push({
                id: doc.id,
                ...doc.data()
            });
        });
        res.json({ tweets });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/firebase/used-tweets/:tweetId', async (req, res) => {
    try {
        const { tweetId } = req.params;
        await db.collection('usedTweets').doc(tweetId).delete();

        // Remove from cache
        tweetCache.tweets.delete(tweetId);
        await saveTweetCacheToFile();

        res.json({ success: true, message: `Tweet ${tweetId} removed from Firebase` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/firebase/used-tweets', async (req, res) => {
    try {
        const snapshot = await db.collection('usedTweets').get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        // Clear cache
        tweetCache.tweets.clear();
        await saveTweetCacheToFile();

        res.json({ success: true, message: 'All used tweets cleared from Firebase' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add these endpoints after the existing API routes

// Get all uploaded sound files
app.get('/api/sound-files', async (req, res) => {
    try {
        await ensureSoundsDir();

        // ✅ LOAD METADATA FILE
        const metadataPath = path.join(SOUNDS_DIR, 'metadata.json');
        let metadata = {};

        try {
            const metadataContent = await fsPromises.readFile(metadataPath, 'utf8');
            metadata = JSON.parse(metadataContent);
        } catch (error) {
            console.log('No metadata file found, will use generated names');
        }

        const files = await fsPromises.readdir(SOUNDS_DIR);
        const soundFiles = [];

        for (const filename of files) {
            // Skip metadata file
            if (filename === 'metadata.json') continue;

            try {
                const filePath = path.join(SOUNDS_DIR, filename);
                const stats = await fsPromises.stat(filePath);

                soundFiles.push({
                    filename,
                    originalName: metadata[filename]?.originalName || filename, // ✅ USE STORED ORIGINAL NAME
                    size: stats.size,
                    uploadedAt: metadata[filename]?.uploadedAt || stats.birthtime,
                    mimetype: metadata[filename]?.mimetype || getMimeType(path.extname(filename))
                });
            } catch (error) {
                console.error(`Error getting stats for ${filename}:`, error);
            }
        }

        res.json({
            success: true,
            files: soundFiles.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
        });
    } catch (error) {
        console.error('Error fetching sound files:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upload a new sound file
app.post('/api/upload-sound', uploadSound.single('soundFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No sound file provided' });
        }

        const soundFile = {
            filename: req.file.filename,
            originalName: req.file.originalname, // ✅ This preserves the original name
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploadedAt: new Date(),
            path: req.file.path
        };

        // ✅ SAVE ORIGINAL NAME TO A JSON FILE FOR RETRIEVAL
        const metadataPath = path.join(SOUNDS_DIR, 'metadata.json');
        let metadata = {};

        try {
            const existingData = await fsPromises.readFile(metadataPath, 'utf8');
            metadata = JSON.parse(existingData);
        } catch (error) {
            // File doesn't exist yet, start with empty object
        }

        metadata[req.file.filename] = {
            originalName: req.file.originalname,
            uploadedAt: new Date().toISOString(),
            size: req.file.size,
            mimetype: req.file.mimetype
        };

        await fsPromises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        console.log('🔊 Sound file uploaded:', soundFile);

        res.json({
            success: true,
            message: 'Sound file uploaded successfully',
            filename: soundFile.filename,
            originalName: soundFile.originalName,
            size: soundFile.size
        });
    } catch (error) {
        console.error('Error uploading sound file:', error);
        res.status(500).json({ error: error.message });
    }
});

// ADD THIS NEW ENDPOINT after line ~1850:
app.post('/api/clean-admin-lists', async (req, res) => {
    try {
        console.log('🧹 Cleaning admin list entries...');

        // Clean primary admins
        for (const [id, config] of botState.primaryAdminList.entries()) {
            if (config.address) {
                const cleanAddress = config.address.trim();
                if (cleanAddress !== config.address) {
                    console.log(`Cleaning primary admin: "${config.address}" -> "${cleanAddress}"`);
                    config.address = cleanAddress;

                    // Update in Firebase
                    await saveAdminListToFirebase('primary_admins', config);
                }
            }
        }

        // Clean secondary admins
        for (const [id, config] of botState.secondaryAdminList.entries()) {
            if (config.address) {
                const cleanAddress = config.address.trim();
                if (cleanAddress !== config.address) {
                    console.log(`Cleaning secondary admin: "${config.address}" -> "${cleanAddress}"`);
                    config.address = cleanAddress;

                    // Update in Firebase
                    await saveAdminListToFirebase('secondary_admins', config);
                }
            }
        }

        res.json({
            success: true,
            message: 'Admin lists cleaned successfully'
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a sound file
app.delete('/api/sound-files/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(SOUNDS_DIR, filename);

        try {
            await fsPromises.access(filePath);
            await fsPromises.unlink(filePath);

            // ✅ CLEAN UP METADATA
            const metadataPath = path.join(SOUNDS_DIR, 'metadata.json');
            try {
                const metadataContent = await fsPromises.readFile(metadataPath, 'utf8');
                const metadata = JSON.parse(metadataContent);
                delete metadata[filename];
                await fsPromises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
            } catch (error) {
                console.log('No metadata to clean up');
            }

            console.log('🗑️ Sound file deleted:', filename);

            res.json({
                success: true,
                message: 'Sound file deleted successfully'
            });
        } catch (error) {
            if (error.code === 'ENOENT') {
                return res.status(404).json({ error: 'Sound file not found' });
            }
            throw error;
        }
    } catch (error) {
        console.error('Error deleting sound file:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve uploaded sound files
app.get('/api/sounds/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(SOUNDS_DIR, filename);

    res.sendFile(filePath, (error) => {
        if (error) {
            console.error('Error serving sound file:', error);
            res.status(404).json({ error: 'Sound file not found' });
        }
    });
});

app.delete('/api/firebase/used-communities/:communityId', async (req, res) => {
    try {
        const { communityId } = req.params;
        await db.collection('usedCommunities').doc(communityId).delete();
        res.json({ success: true, message: `Community ${communityId} removed from Firebase` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/firebase/used-communities', async (req, res) => {
    try {
        const snapshot = await db.collection('usedCommunities').get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        res.json({ success: true, message: 'All used communities cleared from Firebase' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Enhanced Firebase admin list endpoints
app.get('/api/firebase/admin-lists', async (req, res) => {
    try {
        const primaryAdmins = await loadAdminListFromFirebase('primary_admins');
        const secondaryAdmins = await loadAdminListFromFirebase('secondary_admins');

        res.json({
            success: true,
            data: {
                primary_admins: primaryAdmins,
                secondary_admins: secondaryAdmins
            },
            stats: {
                primaryCount: primaryAdmins.length,
                secondaryCount: secondaryAdmins.length
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/firebase/sync-admin-lists', async (req, res) => {
    try {
        const success = await botState.loadAdminListsFromFirebase();

        if (success) {
            // Broadcast sync update to all clients
            broadcastToClients({
                type: 'admin_lists_synced',
                data: {
                    stats: botState.getStats(),
                    timestamp: new Date().toISOString()
                }
            });

            res.json({
                success: true,
                message: 'Admin lists synchronized from Firebase',
                stats: botState.getStats()
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to sync admin lists from Firebase'
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/firebase/admin-lists/:listType', async (req, res) => {
    try {
        const { listType } = req.params;

        // Get all documents in the collection
        const snapshot = await db.collection(listType).get();

        // Delete all documents
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        // Clear local state
        switch (listType) {
            case 'primary_admins':
                botState.primaryAdminList.clear();
                break;
            case 'secondary_admins':
                botState.secondaryAdminList.clear();
                break;
        }

        // Broadcast update
        broadcastToClients({
            type: 'admin_list_cleared',
            data: {
                listType,
                stats: botState.getStats(),
                timestamp: new Date().toISOString()
            }
        });

        res.json({
            success: true,
            message: `All ${listType} cleared from Firebase and local state`,
            clearedCount: snapshot.docs.length,
            stats: botState.getStats()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test Firebase connection endpoint
app.get('/api/test-firebase', async (req, res) => {
    try {
        const testDoc = await db.collection('test').add({
            message: 'Firebase connected successfully!',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        res.json({
            success: true,
            message: 'Firebase connected!',
            docId: testDoc.id
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// WebSocket connections to platforms
function connectToPumpPortal() {
    if (botState.pumpPortalSocket) {
        botState.pumpPortalSocket.close();
    }

    console.log('🔌 Connecting to Pump Portal...');
    botState.pumpPortalSocket = new WebSocket('wss://pumpportal.fun/api/data');

    botState.pumpPortalSocket.onopen = () => {
        console.log('✅ Connected to Pump Portal WebSocket');
        botState.pumpPortalSocket.send(JSON.stringify({ method: "subscribeNewToken" }));

        broadcastToClients({
            type: 'platform_status',
            data: { platform: 'pumpfun', status: 'connected' }
        });
    };

    // In your connectToPumpPortal() function
    botState.pumpPortalSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.txType === 'create' && botState.isRunning) {

                // 🔥 DEBUG: Log all available fields to see what we can extract
                console.log('🔍 PUMP.FUN CREATE EVENT - Available fields:');
                console.log('📊 Full data structure:', JSON.stringify(data, null, 2));

                // Look for bonding curve related fields
                const possibleBondingCurveFields = [
                    'bondingCurveKey',
                    'bondingCurve',
                    'bonding_curve',
                    'bondingCurveAddress',
                    'bonding_curve_address'
                ];

                possibleBondingCurveFields.forEach(field => {
                    if (data[field]) {
                        console.log(`✅ Found bonding curve field '${field}': ${data[field]}`);
                    }
                });

                processNewToken(data, 'pumpfun');
            }
        } catch (error) {
            console.error('Error processing Pump Portal message:', error);
        }
    };

    botState.pumpPortalSocket.onerror = (error) => {
        console.error('Pump Portal WebSocket error:', error);
        broadcastToClients({
            type: 'platform_status',
            data: { platform: 'pumpfun', status: 'error', error: error.message }
        });
    };

    botState.pumpPortalSocket.onclose = () => {
        console.log('Pump Portal WebSocket closed');
        broadcastToClients({
            type: 'platform_status',
            data: { platform: 'pumpfun', status: 'disconnected' }
        });

        if (botState.isRunning) {
            botState.reconnectTimeouts.set('pumpfun', setTimeout(() => {
                connectToPumpPortal();
            }, 5000));
        }
    };
}

function connectToLetsBonk() {
    console.log('🔌 LetsBonk connection placeholder');
    broadcastToClients({
        type: 'platform_status',
        data: { platform: 'letsbonk', status: 'not_implemented' }
    });
}

// Main API Routes
app.get('/api/status', (req, res) => {
    res.json({
        isRunning: botState.isRunning,
        settings: botState.settings,
        stats: botState.getStats()
    });
});

app.post('/api/start', (req, res) => {
    if (botState.isRunning) {
        return res.status(400).json({ error: 'Bot is already running' });
    }

    if (!botState.settings.privateKey) {
        return res.status(400).json({ error: 'Private key not set' });
    }

    botState.isRunning = true;
    connectToPumpPortal();
    connectToLetsBonk();

    broadcastToClients({
        type: 'bot_status',
        data: { isRunning: true }
    });

    res.json({ success: true, message: 'Bot started' });
});

app.post('/api/stop', (req, res) => {
    botState.isRunning = false;

    if (botState.pumpPortalSocket) {
        botState.pumpPortalSocket.close();
    }
    if (botState.letsBonkSocket) {
        botState.letsBonkSocket.close();
    }

    botState.reconnectTimeouts.forEach(timeout => clearTimeout(timeout));
    botState.reconnectTimeouts.clear();

    broadcastToClients({
        type: 'bot_status',
        data: { isRunning: false }
    });

    res.json({ success: true, message: 'Bot stopped' });
});

app.post('/api/settings', (req, res) => {
    const { privateKey, tokenPageDestination } = req.body;

    if (privateKey) {
        try {
            Keypair.fromSecretKey(bs58.decode(privateKey));
            botState.settings.privateKey = privateKey;
        } catch (error) {
            return res.status(400).json({ error: 'Invalid private key' });
        }
    }

    if (tokenPageDestination) {
        botState.settings.tokenPageDestination = tokenPageDestination;
    }

    res.json({ success: true, settings: botState.settings });
});

// Updated filter settings endpoint with consolidated admin filtering
app.post('/api/filter-settings', (req, res) => {
    const {
        enableAdminFilter,
        enableCommunityReuse,
        snipeAllTokens,
        detectionOnlyMode,
        bonkTokensOnly  // Add new filter for bonk tokens only
    } = req.body;

    console.log('🔧 Received filter settings update:', {
        enableAdminFilter,
        enableCommunityReuse,
        snipeAllTokens,
        detectionOnlyMode,
        bonkTokensOnly
    });

    // Update admin filtering (now handles both Twitter admins AND wallet addresses)
    if (typeof enableAdminFilter !== 'undefined') {
        botState.settings.enableAdminFilter = enableAdminFilter;
        console.log(`📋 Admin filtering (Twitter + Wallets): ${enableAdminFilter ? 'ENABLED' : 'DISABLED'}`);
    }

    // Update community reuse prevention
    if (typeof enableCommunityReuse !== 'undefined') {
        botState.settings.enableCommunityReuse = enableCommunityReuse;
        console.log(`😍 Community reuse prevention: ${enableCommunityReuse ? 'ENABLED' : 'DISABLED'}`);
    }

    // Update snipe all tokens mode
    if (typeof snipeAllTokens !== 'undefined') {
        botState.settings.snipeAllTokens = snipeAllTokens;
        console.log(`⚡ Snipe all tokens: ${snipeAllTokens ? 'ENABLED' : 'DISABLED'}`);

        if (snipeAllTokens) {
            console.log('⚠️ WARNING: SNIPE ALL TOKENS MODE ENABLED - This will attempt to snipe EVERY new token!');
        }
    }

    // Update detection only mode
    if (typeof detectionOnlyMode !== 'undefined') {
        botState.settings.detectionOnlyMode = detectionOnlyMode;
        console.log(`🛡️ Detection only mode: ${detectionOnlyMode ? 'ENABLED' : 'DISABLED'}`);

        if (!detectionOnlyMode && snipeAllTokens) {
            console.log('🚨 CRITICAL WARNING: Detection only mode is OFF and Snipe all tokens is ON!');
        }
    }

    // Update bonk tokens only filter
    if (typeof bonkTokensOnly !== 'undefined') {
        botState.settings.bonkTokensOnly = bonkTokensOnly;
        console.log(`🦎 Bonk tokens only: ${bonkTokensOnly ? 'ENABLED' : 'DISABLED'}`);
    }

    // Log current filter configuration
    console.log('📊 Current filter configuration:', {
        enableAdminFilter: botState.settings.enableAdminFilter,
        enableCommunityReuse: botState.settings.enableCommunityReuse,
        snipeAllTokens: botState.settings.snipeAllTokens,
        detectionOnlyMode: botState.settings.detectionOnlyMode,
        bonkTokensOnly: botState.settings.bonkTokensOnly
    });

    // Update filter logic explanation based on current settings
    let filterExplanation = '';
    if (botState.settings.bonkTokensOnly) {
        filterExplanation = 'Will only process Bonk tokens (all Pump.fun tokens filtered out)';
    } else if (botState.settings.snipeAllTokens) {
        filterExplanation = 'Will detect and snipe ALL new tokens (all other filters bypassed)';
    } else if (botState.settings.enableAdminFilter) {
        filterExplanation = 'Will detect tokens from wallet addresses or Twitter admins in your Primary/Secondary Admin lists';
    } else {
        filterExplanation = 'Will detect ALL tokens (no filtering applied)';
    }

    console.log(`🎯 Filter behavior: ${filterExplanation}`);

    // Return updated settings
    res.json({
        success: true,
        settings: {
            enableAdminFilter: botState.settings.enableAdminFilter,
            enableCommunityReuse: botState.settings.enableCommunityReuse,
            snipeAllTokens: botState.settings.snipeAllTokens,
            detectionOnlyMode: botState.settings.detectionOnlyMode,
            bonkTokensOnly: botState.settings.bonkTokensOnly
        },
        message: 'Filter settings updated successfully',
        explanation: filterExplanation,
        warnings: [
            ...(botState.settings.bonkTokensOnly ? ['🦎 Bonk Tokens Only mode is ACTIVE - all Pump.fun tokens will be filtered out'] : []),
            ...(botState.settings.snipeAllTokens ? ['⚠️ Snipe All Tokens mode is ACTIVE'] : []),
            ...(!botState.settings.detectionOnlyMode ? ['⚠️ Detection Only mode is OFF - real sniping enabled'] : []),
            ...(botState.settings.snipeAllTokens && !botState.settings.detectionOnlyMode ? ['🚨 DANGER: Will snipe ALL tokens automatically!'] : [])
        ]
    });
});

// Enhanced list management routes with Firebase integration
app.get('/api/lists/:listType', async (req, res) => {
    try {
        const { listType } = req.params;

        // Ensure Firebase data is loaded
        if (!botState.isFirebaseLoaded) {
            await botState.loadAdminListsFromFirebase();
        }

        const list = botState.getList(listType);
        res.json({
            list,
            firebaseLoaded: botState.isFirebaseLoaded,
            count: list.length
        });
    } catch (error) {
        console.error('Error fetching list:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/lists/:listType', async (req, res) => {
    try {
        const { listType } = req.params;
        const entry = req.body;

        if (!entry.address && !entry.username) {
            return res.status(400).json({ error: 'Address or username required' });
        }
        if (!entry.amount || !entry.fees) {
            return res.status(400).json({ error: 'Amount and fees required' });
        }

        const config = await botState.addToList(listType, entry);

        // Broadcast update to all connected clients
        broadcastToClients({
            type: 'admin_list_updated',
            data: {
                listType,
                action: 'added',
                entry: config,
                stats: botState.getStats(),
                timestamp: new Date().toISOString()
            }
        });

        res.json({
            success: true,
            config,
            message: `Entry added to ${listType} and saved to Firebase`,
            stats: botState.getStats()
        });
    } catch (error) {
        console.error('Error adding to list:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/lists/:listType/:id', async (req, res) => {
    try {
        const { listType, id } = req.params;
        const success = await botState.removeFromList(listType, id);

        if (success) {
            // Broadcast update to all connected clients
            broadcastToClients({
                type: 'admin_list_updated',
                data: {
                    listType,
                    action: 'removed',
                    entryId: id,
                    stats: botState.getStats(),
                    timestamp: new Date().toISOString()
                }
            });

            res.json({
                success: true,
                message: `Entry removed from ${listType} and Firebase`,
                stats: botState.getStats()
            });
        } else {
            res.status(404).json({ error: 'Entry not found' });
        }
    } catch (error) {
        console.error('Error removing from list:', error);
        res.status(500).json({ error: error.message });
    }
});

// Detected tokens routes
app.get('/api/detected-tokens', (req, res) => {
    const tokens = botState.getDetectedTokens();
    res.json({ tokens });
});

app.delete('/api/detected-tokens', (req, res) => {
    botState.clearDetectedTokens();
    res.json({ success: true, message: 'Detected tokens cleared' });
});

app.post('/api/detected-tokens/:tokenAddress/snipe', async (req, res) => {
    const { tokenAddress } = req.params;

    if (!botState.detectedTokens.has(tokenAddress)) {
        return res.status(404).json({ error: 'Token not found in detected list' });
    }

    const tokenData = botState.detectedTokens.get(tokenAddress);

    if (!tokenData.config) {
        return res.status(400).json({ error: 'No snipe configuration available for this token' });
    }

    try {
        const result = await snipeToken(tokenAddress, tokenData.config);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== DEMO SYSTEM ==========

// Helper functions for demo system
function generateDemoTokenData(template, customWallet = null, customTwitter = null) {
    const randomWallet = customWallet || DEMO_WALLETS[Math.floor(Math.random() * DEMO_WALLETS.length)];
    //const randomTokenAddress = generateRandomTokenAddress();
    const randomTokenAddress = "ALtLPhNGg1dytuto8rRW4xA1h853f8JJuNzXdtbLpump";
    const randomSignature = generateRandomSignature();
    const randomTwitter = customTwitter || template.twitterHandle;

    const baseData = {
        signature: randomSignature,
        mint: randomTokenAddress,
        traderPublicKey: randomWallet,
        creator: randomWallet,
        txType: "create",
        name: template.name,
        symbol: template.symbol,
        uri: template.uri,
        pool: template.pool,
        solAmount: Math.random() * 5 + 0.01,
        marketCapSol: Math.random() * 50 + 10,
        initialBuy: Math.random() * 100000000,
    };

    if (template.platform === "pumpfun") {
        return {
            ...baseData,
            bondingCurveKey: generateRandomTokenAddress(),
            vTokensInBondingCurve: Math.random() * 1000000000 + 100000000,
            vSolInBondingCurve: Math.random() * 30 + 5,
            metadata: {
                name: template.name,
                symbol: template.symbol,
                twitter: `https://twitter.com/${randomTwitter}`
            }
        };
    } else {
        return {
            ...baseData,
            solInPool: Math.random() * 10 + 1,
            tokensInPool: Math.random() * 1000000000 + 100000000,
            newTokenBalance: Math.random() * 100000000,
            metadata: {
                name: template.name,
                symbol: template.symbol,
                twitter: `https://twitter.com/${randomTwitter}`
            }
        };
    }
}


function generateRandomTokenAddress() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';
    let result = '';
    for (let i = 0; i < 44; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateRandomSignature() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';
    let result = '';
    for (let i = 0; i < 88; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

app.post('/api/demo/inject-token', (req, res) => {
    const {
        templateIndex = 0,
        customWallet = null,
        customTwitter = null,
        customCommunity = null,
        customTweet = null,
        platform = null
    } = req.body;

    let template = DEMO_TOKEN_TEMPLATES[templateIndex];
    if (!template) {
        template = DEMO_TOKEN_TEMPLATES[0];
    }

    if (platform) {
        template = { ...template, platform, pool: platform === 'pumpfun' ? 'pump' : 'bonk' };
    }

    // Generate the demo token data
    const demoTokenData = generateDemoTokenData(template, customWallet, template.twitterHandle);

    // Make sure metadata is properly set
    if (!demoTokenData.metadata) {
        demoTokenData.metadata = {};
    }

    // Override the twitter field in metadata
    if (customCommunity) {
        demoTokenData.metadata.twitter = `https://x.com/i/communities/${customCommunity}`;
    } else if (customTwitter) {
        demoTokenData.metadata.twitter = `https://twitter.com/${customTwitter}`;
    } else if (template.twitterHandle) {
        demoTokenData.metadata.twitter = `https://twitter.com/${template.twitterHandle}`;
    }

    if (customTweet) {
        demoTokenData.metadata.twitter = customTweet;  // ADD THIS
    } else if (customCommunity) {
        demoTokenData.metadata.twitter = `https://x.com/i/communities/${customCommunity}`;
    } else if (customTwitter) {
        demoTokenData.metadata.twitter = `https://twitter.com/${customTwitter}`;
    } else if (template.twitterHandle) {
        demoTokenData.metadata.twitter = `https://twitter.com/${template.twitterHandle}`;
    }

    // Ensure name and symbol are in metadata
    demoTokenData.metadata.name = demoTokenData.name || template.name;
    demoTokenData.metadata.symbol = demoTokenData.symbol || template.symbol;

    console.log(`🧪 DEMO: Injecting token data for ${template.platform}:`, demoTokenData);

    processNewToken(demoTokenData, template.platform);

    res.json({
        success: true,
        message: 'Demo token injected',
        tokenData: demoTokenData
    });
});

// Add this to your demo endpoints
app.post('/api/demo/inject-bonk-token', (req, res) => {
    const demoTokenData = {
        signature: 'demo-signature',
        mint: '2g32h8SRweRF4BJAKmBkUhu17QLxYhBo39DYNxgWbonk',
        traderPublicKey: 'demo-wallet',
        creator: 'demo-wallet',
        txType: "create",
        name: 'Demo Bonk Token',
        symbol: 'DEMO',
        pool: 'bonk', // This is key!
        solAmount: 1.5,
        marketCapSol: 25.0
    };

    console.log('🧪 DEMO: Injecting BONK token for testing GeckoTerminal integration');
    processNewToken(demoTokenData, 'letsbonk');

    res.json({
        success: true,
        message: 'Demo bonk token injected'
    });
});

app.post('/api/demo/inject-batch', (req, res) => {
    if (!botState.isRunning) {
        return res.status(400).json({ error: 'Bot must be running to inject demo tokens' });
    }

    const { count = 5, delay = 2000 } = req.body;
    let injected = 0;

    const injectNext = () => {
        if (injected >= count) {
            return;
        }

        const templateIndex = Math.floor(Math.random() * DEMO_TOKEN_TEMPLATES.length);
        const template = DEMO_TOKEN_TEMPLATES[templateIndex];
        const demoTokenData = generateDemoTokenData(template);

        console.log(`🧪 DEMO BATCH ${injected + 1}/${count}: Injecting ${template.name}`);
        processNewToken(demoTokenData, template.platform);

        injected++;

        if (injected < count) {
            setTimeout(injectNext, delay);
        }
    };

    injectNext();

    res.json({
        success: true,
        message: `Injecting ${count} demo tokens with ${delay}ms delay`
    });
});

app.get('/api/demo/templates', (req, res) => {
    res.json({
        templates: DEMO_TOKEN_TEMPLATES.map((template, index) => ({
            index,
            name: template.name,
            symbol: template.symbol,
            platform: template.platform,
            twitterHandle: template.twitterHandle
        })),
        wallets: DEMO_WALLETS
    });
});

app.post('/api/demo/inject-from-list', (req, res) => {
    if (!botState.isRunning) {
        return res.status(400).json({ error: 'Bot must be running to inject demo tokens' });
    }

    const { listType, templateIndex = 0 } = req.body;

    let targetWallet = null;
    let targetTwitter = null;

    const list = botState.getList(listType);
    if (list.length === 0) {
        return res.status(400).json({ error: `No entries in ${listType} list` });
    }

    const randomEntry = list[Math.floor(Math.random() * list.length)];

    if (listType.includes('wallets')) {
        targetWallet = randomEntry.address;
    } else {
        targetTwitter = randomEntry.address;
    }

    const template = DEMO_TOKEN_TEMPLATES[templateIndex] || DEMO_TOKEN_TEMPLATES[0];
    const demoTokenData = generateDemoTokenData(template, targetWallet, targetTwitter);

    console.log(`🧪 DEMO FROM LIST: Injecting token with ${listType} entry:`, {
        wallet: targetWallet,
        twitter: targetTwitter,
        tokenName: template.name
    });

    processNewToken(demoTokenData, template.platform);

    res.json({
        success: true,
        message: `Demo token injected using ${listType} entry`,
        usedEntry: randomEntry,
        tokenData: demoTokenData
    });
});

// ADD THESE NEW API ENDPOINTS
app.post('/api/scrape-community/:communityId', async (req, res) => {
    try {
        const { communityId } = req.params;

        if (!twitterScraper.isInitialized) {
            const initSuccess = await twitterScraper.init();
            if (!initSuccess) {
                return res.status(500).json({ error: 'Failed to initialize Twitter scraper' });
            }
        }

        const loginSuccess = await twitterScraper.automaticLogin();
        if (!loginSuccess) {
            return res.status(500).json({ error: 'Failed to login to Twitter' });
        }

        const communityAdmins = await twitterScraper.scrapeCommunityAdmins(communityId);

        res.json({
            success: true,
            communityId: communityId,
            admins: communityAdmins,
            totalAdmins: communityAdmins.length,
            scrapedAt: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/twitter-scraper-status', (req, res) => {
    res.json({
        initialized: twitterScraper.isInitialized,
        sessionActive: twitterScraper.sessionActive,
        credentialsConfigured: !!(TWITTER_CONFIG.username && TWITTER_CONFIG.password)
    });
});

app.get('/api/twitter-session-status', async (req, res) => {
    try {
        if (!twitterScraper.isInitialized) {
            return res.json({
                initialized: false,
                loggedIn: false,
                message: 'Twitter scraper not initialized'
            });
        }

        // Force a fresh status check
        const sessionStatus = await twitterScraper.checkSessionStatus();

        // If URL shows we're on home page, override to logged in
        if (sessionStatus.url && sessionStatus.url.includes('/home')) {
            sessionStatus.loggedIn = true;
            twitterScraper.sessionActive = true;
        }

        res.json({
            initialized: twitterScraper.isInitialized,
            loggedIn: sessionStatus.loggedIn,
            url: sessionStatus.url,
            error: sessionStatus.error,
            message: sessionStatus.loggedIn ? 'Session active' : 'Please login manually'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/test-geckoterminal-enhanced/:tokenAddress', async (req, res) => {
    try {
        const { tokenAddress } = req.params;

        console.log(`🧪 Testing enhanced GeckoTerminal API for: ${tokenAddress}`);

        const geckoResponse = await geckoTerminalAPI.fetchTokenInfo(tokenAddress);
        const enhancedData = geckoTerminalAPI.extractEnhancedTokenData(geckoResponse);

        res.json({
            success: true,
            tokenAddress,
            rawResponse: geckoResponse,
            enhancedData,
            hasData: !!enhancedData,
            extractedFields: {
                name: enhancedData?.name,
                symbol: enhancedData?.symbol,
                image_url: enhancedData?.image_url,
                twitter_handle: enhancedData?.twitterHandle,
                holders_count: enhancedData?.holdersCount,
                gt_score: enhancedData?.gtScore,
                is_honeypot: enhancedData?.isHoneypot
            }
        });
    } catch (error) {
        console.error('❌ GeckoTerminal test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            tokenAddress: req.params.tokenAddress
        });
    }
});

app.post('/api/twitter-open-login', async (req, res) => {
    try {
        if (!twitterScraper.isInitialized) {
            const initSuccess = await twitterScraper.init();
            if (!initSuccess) {
                return res.status(500).json({ error: 'Failed to initialize Twitter scraper' });
            }
        }

        // Use automatic login with credentials from environment
        console.log('🔐 Attempting automatic Twitter login...');
        const loginSuccess = await twitterScraper.automaticLogin();

        if (loginSuccess) {
            console.log('✅ Automatic Twitter login successful');
            res.json({
                success: true,
                message: 'Successfully logged in to Twitter automatically'
            });
        } else {
            console.log('❌ Automatic login failed');
            res.status(500).json({ error: 'Failed to login automatically. Check credentials in .env file' });
        }

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== WEBSOCKET CONNECTION HANDLING ==========

wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    wsClients.add(ws);

    ws.send(JSON.stringify({
        type: 'bot_status',
        data: { isRunning: botState.isRunning }
    }));

    ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
        wsClients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        wsClients.delete(ws);
    });
});

// ========== FIREBASE INITIALIZATION ==========

async function initializeFirebaseData() {
    console.log('🔥 Initializing Firebase data...');

    try {
        await testFirebase();
        await botState.loadAdminListsFromFirebase();

        console.log('✅ Firebase initialization complete');
        console.log(`📊 Loaded admin lists:`, botState.getStats());
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
    }
}


// ========== ERROR HANDLING ==========

app.use((error, req, res, next) => {
    console.error('Express error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// ========== SERVER STARTUP ==========

httpServer.listen(PORT, async () => {
    console.log(`🚀 DevScope backend running on port ${PORT}`);
    console.log(`WebSocket endpoint: wss://localhost:${PORT}`);
    console.log(`HTTP API endpoint: http://localhost:${PORT}/api`);

    // Initialize Firebase data
    await initializeFirebaseData();
    await initializeCommunityCache();
    await initializeTweetCache();
    await ensureSoundsDir();
    initializeTimingLog();
    initializeSecondaryMatchesLog();

    console.log('🔥 Enhanced Firebase Admin Lists Integration Loaded');
    console.log('🔊 Sound upload system initialized');
    console.log('✅ Features:');
    console.log('  - Firebase storage for Primary/Secondary admin lists');
    console.log('  - Real-time sync between local state and Firebase');
    console.log('  - Automatic data loading on server startup');
    console.log('  - Enhanced statistics with Firebase status');
    console.log('  - Individual Twitter account detection');
    console.log('  - Twitter community detection and tracking');
    console.log('  - Enhanced token page opening on snipe');
    console.log('  - Improved speed optimizations');

    console.log('🧪 Available Firebase endpoints:');
    console.log('  GET /api/firebase/admin-lists - Get all admin lists from Firebase');
    console.log('  POST /api/firebase/sync-admin-lists - Sync admin lists from Firebase');
    console.log('  DELETE /api/firebase/admin-lists/:listType - Clear specific admin list');
    console.log('  GET /api/firebase/used-communities - Fetch used communities');
    console.log('  DELETE /api/firebase/used-communities - Clear all used communities');
    console.log('  GET /api/test-firebase - Test Firebase connection');

    console.log('🎯 Demo data injection system loaded');
    console.log('Available demo endpoints:');
    console.log('  POST /api/demo/inject-token - Inject single demo token');
    console.log('  POST /api/demo/inject-batch - Inject multiple demo tokens');
    console.log('  POST /api/demo/inject-from-list - Inject token matching your lists');
    console.log('  GET /api/demo/templates - Get available demo templates');

});

// ADD GRACEFUL SHUTDOWN
process.on('SIGINT', async () => {
    console.log('\n⏹️ Shutting down gracefully...');

    if (twitterScraper) {
        await twitterScraper.close();
    }

    process.exit(0);
});


function cleanupScrapingCache() {
    const now = Date.now();
    const expiredCommunities = [];

    for (const [communityId, cachedData] of scrapingResults.entries()) {
        if (now - cachedData.timestamp > SCRAPING_RESULT_CACHE_TIME) {
            expiredCommunities.push(communityId);
        }
    }

    expiredCommunities.forEach(communityId => {
        scrapingResults.delete(communityId);
        console.log(`🧹 Cleaned up expired cache for community ${communityId}`);
    });
}

// ✅ ADD AUTOMATIC CLEANUP EVERY 60 SECONDS
setInterval(cleanupScrapingCache, 60000);

// ========== DEBUGGING FUNCTIONS ==========
function getScrapingStats() {
    return {
        activeSessions: activeScrapingSessions.size,
        cachedResults: scrapingResults.size,
        activeSessionCommunities: Array.from(activeScrapingSessions.keys()),
        cachedCommunities: Array.from(scrapingResults.keys())
    };
}

// Log scraping stats every 30 seconds for debugging
setInterval(() => {
    const stats = getScrapingStats();
    if (stats.activeSessions > 0 || stats.cachedResults > 0) {
        console.log('📊 Scraping Stats:', stats);
    }
}, 30000);

const HTTPS_PORT = process.env.HTTPS_PORT || 3002;

httpsServer.listen(HTTPS_PORT, () => {
    console.log(`🔒 HTTPS Server with WebSocket running on port ${HTTPS_PORT}`);
    console.log(`🔌 WebSocket endpoint: wss://devscope.fun:${HTTPS_PORT}`);
});

module.exports = { app, httpServer, botState, TwitterAPI, twitterAPI, scrapeCommunityAndMatchAdmins };
