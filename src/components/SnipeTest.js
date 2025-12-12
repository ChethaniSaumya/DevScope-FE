import React, { useState } from 'react';

function SnipeTest() {
  const [testConfig, setTestConfig] = useState({
    tokenAddress: '',
    tokenName: 'Test Token',
    tokenSymbol: 'TEST',
    creatorWallet: '',
    twitterHandle: '',
    twitterCommunityId: '',
    testType: 'wallet',
    adminType: 'primary',
    amount: '0.001',
    slippage: '10',
    priorityFee: '0.0001',
  });
  
  const [testResults, setTestResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [adminLists, setAdminLists] = useState({ primary: [], secondary: [] });

  const fetchAdminLists = async function() {
    try {
      const response = await fetch('/api/admin-lists');
      const data = await response.json();
      if (data.success) {
        setAdminLists({
          primary: data.primaryAdmins || [],
          secondary: data.secondaryAdmins || []
        });
        addResult('✅ Admin lists loaded', 'success', data);
      }
    } catch (error) {
      addResult('❌ Failed to load admin lists', 'error', error.message);
    }
  };

  function addResult(message, type, data) {
    type = type || 'info';
    data = data || null;
    setTestResults(function(prev) {
      return [{
        id: Date.now(),
        message: message,
        type: type,
        data: data,
        timestamp: new Date().toLocaleTimeString()
      }].concat(prev).slice(0, 50);
    });
  }

  const testAdminMatch = async function() {
    setIsLoading(true);
    addResult('🔍 Testing admin match...', 'info');
    
    try {
      var identifier;
      if (testConfig.testType === 'wallet') {
        identifier = testConfig.creatorWallet;
      } else if (testConfig.testType === 'twitter_individual') {
        identifier = testConfig.twitterHandle;
      } else {
        identifier = testConfig.twitterCommunityId;
      }

      const response = await fetch('/api/test/check-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier,
          type: testConfig.testType,
          checkPrimary: true,
          checkSecondary: true
        })
      });
      
      const data = await response.json();
      
      if (data.matchFound) {
        addResult('✅ MATCH FOUND in ' + data.matchType + ' list!', 'success', data);
      } else {
        addResult('❌ No match found in any admin list', 'warning', data);
      }
    } catch (error) {
      addResult('❌ Error: ' + error.message, 'error');
    }
    setIsLoading(false);
  };

  const testTokenDetection = async function() {
    setIsLoading(true);
    addResult('🚀 Simulating token detection...', 'info');
    
    try {
      var twitterUrl = null;
      if (testConfig.testType === 'twitter_individual') {
        twitterUrl = 'https://x.com/' + testConfig.twitterHandle;
      } else if (testConfig.testType === 'twitter_community') {
        twitterUrl = 'https://x.com/i/communities/' + testConfig.twitterCommunityId;
      }

      const response = await fetch('/api/test/simulate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint: testConfig.tokenAddress || ('TEST' + Date.now() + 'pump'),
          name: testConfig.tokenName,
          symbol: testConfig.tokenSymbol,
          creator: testConfig.creatorWallet,
          twitter: twitterUrl,
          platform: 'pumpfun',
          isTest: true,
          skipSnipe: true
        })
      });
      
      const data = await response.json();
      addResult('📊 Detection result: ' + data.result, data.matched ? 'success' : 'warning', data);
    } catch (error) {
      addResult('❌ Error: ' + error.message, 'error');
    }
    setIsLoading(false);
  };

  const testSnipeExecution = async function(dryRun) {
    setIsLoading(true);
    addResult('🎯 ' + (dryRun ? 'DRY RUN' : 'LIVE') + ' Snipe test...', 'info');
    
    if (!testConfig.tokenAddress) {
      addResult('❌ Token address required for snipe test', 'error');
      setIsLoading(false);
      return;
    }
    
    try {
      const response = await fetch('/api/test/snipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress: testConfig.tokenAddress,
          amount: parseFloat(testConfig.amount),
          slippage: parseFloat(testConfig.slippage),
          priorityFee: parseFloat(testConfig.priorityFee),
          dryRun: dryRun
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        addResult('✅ Snipe ' + (dryRun ? 'simulation' : 'execution') + ' successful!', 'success', data);
      } else {
        addResult('❌ Snipe failed: ' + data.error, 'error', data);
      }
    } catch (error) {
      addResult('❌ Error: ' + error.message, 'error');
    }
    setIsLoading(false);
  };

  const addTestAdmin = async function() {
    setIsLoading(true);
    var identifier;
    if (testConfig.testType === 'wallet') {
      identifier = testConfig.creatorWallet;
    } else {
      identifier = testConfig.twitterHandle || testConfig.twitterCommunityId;
    }
    
    if (!identifier) {
      addResult('❌ Please enter a wallet or twitter handle', 'error');
      setIsLoading(false);
      return;
    }
    
    addResult('➕ Adding ' + identifier + ' to ' + testConfig.adminType + ' list...', 'info');
    
    try {
      const response = await fetch('/api/admin-lists/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier,
          type: testConfig.adminType,
          amount: parseFloat(testConfig.amount),
          slippage: parseFloat(testConfig.slippage),
          priorityFee: parseFloat(testConfig.priorityFee)
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        addResult('✅ Added to ' + testConfig.adminType + ' list!', 'success', data);
        fetchAdminLists();
      } else {
        addResult('❌ Failed: ' + data.error, 'error');
      }
    } catch (error) {
      addResult('❌ Error: ' + error.message, 'error');
    }
    setIsLoading(false);
  };

  function fillTestData(preset) {
    if (preset === 'wallet') {
      setTestConfig(function(prev) {
        return Object.assign({}, prev, {
          testType: 'wallet',
          creatorWallet: 'TestWa11etAddress1234567890abcdefghijk',
          tokenName: 'Wallet Test Token',
          tokenSymbol: 'WTT'
        });
      });
    } else if (preset === 'twitter') {
      setTestConfig(function(prev) {
        return Object.assign({}, prev, {
          testType: 'twitter_individual',
          twitterHandle: 'elonmusk',
          tokenName: 'Twitter Test Token',
          tokenSymbol: 'TTT'
        });
      });
    } else if (preset === 'community') {
      setTestConfig(function(prev) {
        return Object.assign({}, prev, {
          testType: 'twitter_community',
          twitterCommunityId: '1234567890123456789',
          tokenName: 'Community Test Token',
          tokenSymbol: 'CTT'
        });
      });
    }
    addResult('📝 Filled ' + preset + ' test data', 'info');
  }

  function handleConfigChange(field, value) {
    setTestConfig(function(prev) {
      var updated = Object.assign({}, prev);
      updated[field] = value;
      return updated;
    });
  }

  function getResultClassName(type) {
    if (type === 'success') return 'snipe-test-result success';
    if (type === 'error') return 'snipe-test-result error';
    if (type === 'warning') return 'snipe-test-result warning';
    return 'snipe-test-result info';
  }

  return (
    <div className="snipe-test-container">
      <h1 className="snipe-test-title">🧪 Snipe Testing Lab</h1>
      
      {/* Quick Presets */}
      <div className="snipe-test-section">
        <h2 className="section-title blue">Quick Presets</h2>
        <div className="button-row">
          <button onClick={function() { fillTestData('wallet'); }} className="btn purple">
            🔑 Wallet Test
          </button>
          <button onClick={function() { fillTestData('twitter'); }} className="btn blue">
            🐦 Twitter Test
          </button>
          <button onClick={function() { fillTestData('community'); }} className="btn cyan">
            👥 Community Test
          </button>
          <button onClick={fetchAdminLists} className="btn gray">
            🔄 Load Admin Lists
          </button>
        </div>
      </div>

      <div className="snipe-test-grid">
        {/* Configuration Panel */}
        <div className="snipe-test-column">
          <div className="snipe-test-section">
            <h2 className="section-title yellow">Test Configuration</h2>
            
            <div className="form-group">
              <label>Test Type</label>
              <select 
                value={testConfig.testType}
                onChange={function(e) { handleConfigChange('testType', e.target.value); }}
                className="form-control"
              >
                <option value="wallet">Wallet Address Match</option>
                <option value="twitter_individual">Twitter Individual</option>
                <option value="twitter_community">Twitter Community</option>
              </select>
            </div>

            <div className="form-group">
              <label>Admin List Type</label>
              <select 
                value={testConfig.adminType}
                onChange={function(e) { handleConfigChange('adminType', e.target.value); }}
                className="form-control"
              >
                <option value="primary">Primary (Auto-Snipe)</option>
                <option value="secondary">Secondary (Popup)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Token Address (for snipe test)</label>
              <input 
                type="text"
                value={testConfig.tokenAddress}
                onChange={function(e) { handleConfigChange('tokenAddress', e.target.value); }}
                placeholder="Enter token mint address..."
                className="form-control"
              />
            </div>

            {testConfig.testType === 'wallet' && (
              <div className="form-group">
                <label>Creator Wallet</label>
                <input 
                  type="text"
                  value={testConfig.creatorWallet}
                  onChange={function(e) { handleConfigChange('creatorWallet', e.target.value); }}
                  placeholder="Enter wallet address..."
                  className="form-control"
                />
              </div>
            )}

            {testConfig.testType === 'twitter_individual' && (
              <div className="form-group">
                <label>Twitter Handle</label>
                <input 
                  type="text"
                  value={testConfig.twitterHandle}
                  onChange={function(e) { handleConfigChange('twitterHandle', e.target.value.replace('@', '')); }}
                  placeholder="Enter handle without @..."
                  className="form-control"
                />
              </div>
            )}

            {testConfig.testType === 'twitter_community' && (
              <div className="form-group">
                <label>Community ID</label>
                <input 
                  type="text"
                  value={testConfig.twitterCommunityId}
                  onChange={function(e) { handleConfigChange('twitterCommunityId', e.target.value); }}
                  placeholder="Enter community ID..."
                  className="form-control"
                />
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Token Name</label>
                <input 
                  type="text"
                  value={testConfig.tokenName}
                  onChange={function(e) { handleConfigChange('tokenName', e.target.value); }}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>Symbol</label>
                <input 
                  type="text"
                  value={testConfig.tokenSymbol}
                  onChange={function(e) { handleConfigChange('tokenSymbol', e.target.value); }}
                  className="form-control"
                />
              </div>
            </div>

            <div className="form-row three-col">
              <div className="form-group">
                <label>Amount (SOL)</label>
                <input 
                  type="text"
                  value={testConfig.amount}
                  onChange={function(e) { handleConfigChange('amount', e.target.value); }}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>Slippage %</label>
                <input 
                  type="text"
                  value={testConfig.slippage}
                  onChange={function(e) { handleConfigChange('slippage', e.target.value); }}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>Priority Fee</label>
                <input 
                  type="text"
                  value={testConfig.priorityFee}
                  onChange={function(e) { handleConfigChange('priorityFee', e.target.value); }}
                  className="form-control"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="snipe-test-section">
            <h2 className="section-title orange">Test Actions</h2>
            <div className="action-grid">
              <button 
                onClick={addTestAdmin}
                disabled={isLoading}
                className="btn green"
              >
                ➕ Add to Admin List
              </button>
              <button 
                onClick={testAdminMatch}
                disabled={isLoading}
                className="btn blue"
              >
                🔍 Test Admin Match
              </button>
              <button 
                onClick={testTokenDetection}
                disabled={isLoading}
                className="btn purple"
              >
                🚀 Simulate Detection
              </button>
              <button 
                onClick={function() { testSnipeExecution(true); }}
                disabled={isLoading}
                className="btn yellow"
              >
                🧪 Dry Run Snipe
              </button>
              <button 
                onClick={function() { testSnipeExecution(false); }}
                disabled={isLoading}
                className="btn red full-width"
              >
                ⚡ LIVE SNIPE TEST (Real Transaction)
              </button>
            </div>
          </div>

          {/* Current Admin Lists */}
          <div className="snipe-test-section">
            <h2 className="section-title pink">Current Admin Lists</h2>
            <div className="admin-lists-grid">
              <div>
                <h3 className="list-title green">Primary ({adminLists.primary.length})</h3>
                <div className="admin-list">
                  {adminLists.primary.length === 0 ? (
                    <span className="empty-text">No primary admins</span>
                  ) : (
                    adminLists.primary.map(function(admin, i) {
                      return <div key={i} className="admin-item">{admin}</div>;
                    })
                  )}
                </div>
              </div>
              <div>
                <h3 className="list-title yellow">Secondary ({adminLists.secondary.length})</h3>
                <div className="admin-list">
                  {adminLists.secondary.length === 0 ? (
                    <span className="empty-text">No secondary admins</span>
                  ) : (
                    adminLists.secondary.map(function(admin, i) {
                      return <div key={i} className="admin-item">{admin}</div>;
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="snipe-test-column">
          <div className="snipe-test-section results-section">
            <div className="results-header">
              <h2 className="section-title cyan">Test Results</h2>
              <button 
                onClick={function() { setTestResults([]); }}
                className="clear-btn"
              >
                Clear
              </button>
            </div>
            <div className="results-list">
              {testResults.length === 0 ? (
                <div className="empty-results">
                  No test results yet. Run a test to see results here.
                </div>
              ) : (
                testResults.map(function(result) {
                  return (
                    <div key={result.id} className={getResultClassName(result.type)}>
                      <div className="result-header">
                        <span>{result.message}</span>
                        <span className="result-time">{result.timestamp}</span>
                      </div>
                      {result.data && (
                        <pre className="result-data">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .snipe-test-container {
          padding: 24px;
          background: #111827;
          min-height: 100vh;
          color: white;
        }
        .snipe-test-title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 24px;
          color: #4ade80;
        }
        .snipe-test-section {
          background: #1f2937;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .section-title.blue { color: #60a5fa; }
        .section-title.yellow { color: #fbbf24; }
        .section-title.orange { color: #fb923c; }
        .section-title.pink { color: #f472b6; }
        .section-title.cyan { color: #22d3ee; }
        .button-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn.purple { background: #9333ea; color: white; }
        .btn.purple:hover:not(:disabled) { background: #7e22ce; }
        .btn.blue { background: #2563eb; color: white; }
        .btn.blue:hover:not(:disabled) { background: #1d4ed8; }
        .btn.cyan { background: #0891b2; color: white; }
        .btn.cyan:hover:not(:disabled) { background: #0e7490; }
        .btn.gray { background: #4b5563; color: white; }
        .btn.gray:hover:not(:disabled) { background: #374151; }
        .btn.green { background: #16a34a; color: white; }
        .btn.green:hover:not(:disabled) { background: #15803d; }
        .btn.yellow { background: #ca8a04; color: white; }
        .btn.yellow:hover:not(:disabled) { background: #a16207; }
        .btn.red { background: #dc2626; color: white; }
        .btn.red:hover:not(:disabled) { background: #b91c1c; }
        .btn.full-width { grid-column: span 2; }
        .snipe-test-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 1024px) {
          .snipe-test-grid { grid-template-columns: 1fr; }
        }
        .form-group {
          margin-bottom: 12px;
        }
        .form-group label {
          display: block;
          font-size: 14px;
          color: #9ca3af;
          margin-bottom: 4px;
        }
        .form-control {
          width: 100%;
          padding: 8px 12px;
          background: #374151;
          border: 1px solid #4b5563;
          border-radius: 6px;
          color: white;
          font-size: 14px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .form-row.three-col {
          grid-template-columns: 1fr 1fr 1fr;
        }
        .action-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .admin-lists-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .list-title {
          font-size: 14px;
          margin-bottom: 8px;
        }
        .list-title.green { color: #4ade80; }
        .list-title.yellow { color: #fbbf24; }
        .admin-list {
          max-height: 128px;
          overflow-y: auto;
          font-size: 12px;
          background: #111827;
          padding: 8px;
          border-radius: 6px;
        }
        .admin-item {
          color: #d1d5db;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .empty-text { color: #6b7280; }
        .results-section { height: 100%; }
        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .clear-btn {
          font-size: 14px;
          color: #9ca3af;
          background: none;
          border: none;
          cursor: pointer;
        }
        .clear-btn:hover { color: white; }
        .results-list {
          max-height: 600px;
          overflow-y: auto;
        }
        .empty-results {
          color: #6b7280;
          text-align: center;
          padding: 32px;
        }
        .snipe-test-result {
          padding: 12px;
          border-radius: 6px;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .snipe-test-result.success {
          background: rgba(22, 163, 74, 0.2);
          border: 1px solid #16a34a;
        }
        .snipe-test-result.error {
          background: rgba(220, 38, 38, 0.2);
          border: 1px solid #dc2626;
        }
        .snipe-test-result.warning {
          background: rgba(202, 138, 4, 0.2);
          border: 1px solid #ca8a04;
        }
        .snipe-test-result.info {
          background: rgba(75, 85, 99, 0.2);
          border: 1px solid #4b5563;
        }
        .result-header {
          display: flex;
          justify-content: space-between;
        }
        .result-time {
          color: #6b7280;
          font-size: 12px;
        }
        .result-data {
          margin-top: 8px;
          font-size: 12px;
          color: #9ca3af;
          overflow-x: auto;
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  );
}

export default SnipeTest;