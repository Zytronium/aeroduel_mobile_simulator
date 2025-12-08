import React, { useState, useRef, useEffect } from 'react';
import { Smartphone, LogIn, Trophy, Users, AlertCircle, CheckCircle } from 'lucide-react';

const MobileSimulator = () => {
  const [mobile1, setMobile1] = useState({
    userId: 'sim-user-001',
    planeId: 'sim-plane-001',
    playerName: 'Foxtrot-4',
    authToken: null,
    matchId: null,
    wsUrl: null,
    isJoined: false,
    wsConnected: false,
    status: 'Not Joined'
  });

  const [mobile2, setMobile2] = useState({
    userId: 'sim-user-002',
    planeId: 'sim-plane-002',
    playerName: 'Delta-7',
    authToken: null,
    matchId: null,
    wsUrl: null,
    isJoined: false,
    wsConnected: false,
    status: 'Not Joined'
  });

  const [serverUrl] = useState('http://aeroduel.local:45045');
  const [logs, setLogs] = useState([]);
  const [debugData, setDebugData] = useState(null);
  const [showDebug, setShowDebug] = useState(false);

  // Keep WebSocket instances outside of React state
  const wsRefs = useRef({ 1: null, 2: null });

  const addLog = (mobile, message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [{ mobile, message, type, timestamp }, ...prev].slice(0, 20));
  };

  const setupWebSocket = ({ mobileNum, matchId, wsUrl, authToken, userId }) => {
    const setMobile = mobileNum === 1 ? setMobile1 : setMobile2;

    if (!wsUrl || !matchId) {
      addLog(`Mobile ${mobileNum}`, 'No WebSocket URL or matchId provided by server; skipping WS connection.', 'error');
      return;
    }

    // Close any existing socket for this mobile
    if (wsRefs.current[mobileNum]) {
      try {
        wsRefs.current[mobileNum].close();
      } catch {
        // ignore
      }
    }

    addLog(`Mobile ${mobileNum}`, `Connecting WebSocket: ${wsUrl}`, 'info');

    const ws = new WebSocket(wsUrl);
    wsRefs.current[mobileNum] = ws;

    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          type: 'hello',
          role: 'mobile',
          matchId,
          userId,
          authToken, // from /api/join-match
        }),
      );

      setMobile(prev => ({
        ...prev,
        wsConnected: true,
        status: 'Joined (WS Connecting/Live)',
      }));
      addLog(`Mobile ${mobileNum}`, 'WebSocket connection opened; hello sent.', 'success');
    });

    ws.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        addLog(`Mobile ${mobileNum}`, `Received non-JSON WS message: ${event.data}`, 'error');
        return;
      }

      switch (msg.type) {
        case 'system:ack':
          // Connected & authenticated
          setMobile(prev => ({
            ...prev,
            wsConnected: true,
            status: 'Live (WS Authenticated)',
          }));
          addLog(`Mobile ${mobileNum}`, 'WebSocket authenticated (system:ack).', 'success');
          break;

        case 'match:update':
          // Show scores / status in UI (debug panel)
          setDebugData({ type: `Match Update (Mobile ${mobileNum})`, data: msg });
          setShowDebug(true);
          addLog(`Mobile ${mobileNum}`, 'Received match:update.', 'info');
          break;

        case 'match:created':
          // A new match lobby has been created
          addLog(`Mobile ${mobileNum}`, 'New match created - you can join again.', 'info');
          setMobile(prev => ({
            ...prev,
            isJoined: false,
            status: 'Not Joined',
          }));
          break;

        case 'plane:hit':
          // Optional per-hit animation – we log it for now
          addLog(
            `Mobile ${mobileNum}`,
            `Received plane:hit event: ${JSON.stringify(msg)}`,
            'info',
          );
          break;

        case 'plane:kicked':
          // Check if this mobile's plane was kicked
          setMobile(prev => {
            const kickedPlaneId = msg.data?.planeId;
            addLog(
              `Mobile ${mobileNum}`,
              `Kick event received - planeId: ${kickedPlaneId}, my planeId: ${prev.planeId}`,
              'info',
            );

            if (kickedPlaneId === prev.planeId) {
              addLog(
                `Mobile ${mobileNum}`,
                `You were kicked from the match. Reason: ${msg.data?.reason || 'unknown'}`,
                'error',
              );
              setDebugData({ type: `Kicked (Mobile ${mobileNum})`, data: msg });
              setShowDebug(true);
              return {
                ...prev,
                isJoined: false,
                status: 'Kicked',
              };
            } else {
              addLog(
                `Mobile ${mobileNum}`,
                `Plane ${kickedPlaneId} was kicked from the match.`,
                'info',
              );
              return prev;
            }
          });
          break;

        case 'plane:disqualified':
          // Check if this mobile's plane was disqualified
          setMobile(prev => {
            const disqualifiedPlaneId = msg.data?.planeId;
            addLog(
              `Mobile ${mobileNum}`,
              `Disqualify event received - planeId: ${disqualifiedPlaneId}, my planeId: ${prev.planeId}`,
              'info',
            );

            if (disqualifiedPlaneId === prev.planeId) {
              addLog(
                `Mobile ${mobileNum}`,
                `You were disqualified from the match. Reason: ${msg.data?.reason || 'unknown'}`,
                'error',
              );
              setDebugData({ type: `Disqualified (Mobile ${mobileNum})`, data: msg });
              setShowDebug(true);
              return {
                ...prev,
                isJoined: false,
                status: 'Disqualified',
              };
            } else {
              addLog(
                `Mobile ${mobileNum}`,
                `Plane ${disqualifiedPlaneId} was disqualified from the match.`,
                'info',
              );
              return prev;
            }
          });
          break;

        case 'plane:poweron':
          // When a plane powers on, re-enable the join button for that plane (based on planeId only).
          // The event includes planeId and (sometimes empty) userId — we must act only on planeId.
          {
            const poweredPlaneId = msg.data?.planeId;
            addLog(`Mobile ${mobileNum}`, `plane:poweron received for planeId: ${poweredPlaneId}`, 'info');

            // If this event refers to mobile1's plane, clear its joined state so its Join button is re-enabled.
            if (poweredPlaneId && poweredPlaneId === mobile1.planeId) {
              setMobile1(prev => ({
                ...prev,
                isJoined: false,
                status: 'Not Joined',
              }));
              addLog('Mobile 1', `Re-enabled Join for plane ${poweredPlaneId}`, 'success');
            }

            // If this event refers to mobile2's plane, clear its joined state so its Join button is re-enabled.
            if (poweredPlaneId && poweredPlaneId === mobile2.planeId) {
              setMobile2(prev => ({
                ...prev,
                isJoined: false,
                status: 'Not Joined',
              }));
              addLog('Mobile 2', `Re-enabled Join for plane ${poweredPlaneId}`, 'success');
            }
          }
          break;

        case 'match:end':
          // Show final scoreboard – log & push to debug panel
          setDebugData({ type: `Match End (Mobile ${mobileNum})`, data: msg });
          setShowDebug(true);
          addLog(`Mobile ${mobileNum}`, 'Match ended (match:end).', 'success');
          setMobile(prev => ({
            ...prev,
            wsConnected: false,
            status: 'Match Ended',
          }));
          break;

        default:
          addLog(
            `Mobile ${mobileNum}`,
            `Received unknown WS message type "${msg.type}".`,
            'info',
          );
      }
    });

    ws.addEventListener('close', () => {
      setMobile(prev => ({
        ...prev,
        wsConnected: false,
        status: prev.isJoined ? 'Joined (WS Closed)' : 'Not Joined',
      }));
      addLog(`Mobile ${mobileNum}`, 'WebSocket connection closed.', 'info');
      wsRefs.current[mobileNum] = null;
    });

    ws.addEventListener('error', (err) => {
      addLog(`Mobile ${mobileNum}`, `WebSocket error: ${err?.message || 'unknown error'}`, 'error');
    });
  };

  const handleJoinMatch = async (mobileNum) => {
    const mobile = mobileNum === 1 ? mobile1 : mobile2;
    const setMobile = mobileNum === 1 ? setMobile1 : setMobile2;

    try {
      setMobile(prev => ({ ...prev, status: 'Joining...' }));

      const response = await fetch(`${serverUrl}/api/join-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planeId: mobile.planeId,
          userId: mobile.userId,
          playerName: mobile.playerName
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMobile(prev => ({
          ...prev,
          isJoined: true,
          authToken: data.authToken,
          matchId: data.matchId ?? prev.matchId,
          wsUrl: data.wsUrl ?? prev.wsUrl,
          wsConnected: false,
          status: 'Joined Match'
        }));
        addLog(
          `Mobile ${mobileNum}`,
          `${mobile.playerName} joined match successfully! Token: ${data.authToken?.substring(0, 8) || 'no-token'}...`,
          'success'
        );

        // Attempt to connect WebSocket using data from /api/join-match
        setupWebSocket({
          mobileNum,
          matchId: data.matchId,
          wsUrl: data.wsUrl,
          authToken: data.authToken,
          userId: mobile.userId,
        });
      } else {
        throw new Error(data.error || 'Join failed');
      }
    } catch (error) {
      setMobile(prev => ({
        ...prev,
        status: 'Not Joined',
        isJoined: false,
        wsConnected: false,
      }));
      addLog(`Mobile ${mobileNum}`, `Join failed: ${error.message}`, 'error');
    }
  };

  const fetchMatchState = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/match`);
      const data = await response.json();
      setDebugData({ type: 'Match State', data });
      setShowDebug(true);
      addLog('Debug', 'Fetched match state', 'info');
    } catch (error) {
      addLog('Debug', `Failed to fetch match state: ${error.message}`, 'error');
    }
  };

  const fetchPlanes = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/planes`);
      const data = await response.json();
      setDebugData({ type: 'Planes & Scores', data });
      setShowDebug(true);
      addLog('Debug', 'Fetched planes and scores', 'info');
    } catch (error) {
      addLog('Debug', `Failed to fetch planes: ${error.message}`, 'error');
    }
  };

  const MobileControl = ({ mobileNum, mobile, setMobile }) => {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Mobile App #{mobileNum}</h2>
          <div className="flex flex-col items-end gap-1">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                mobile.isJoined ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <Smartphone className="w-4 h-4"/>
              <span className="text-sm font-medium">{mobile.status}</span>
            </div>
            <span
              className={`text-xs font-mono ${
                mobile.wsConnected ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              WS: {mobile.wsConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-6 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Player Name:</span>
            <input
              type="text"
              value={mobile.playerName}
              onChange={(e) => setMobile(prev => ({ ...prev, playerName: e.target.value }))}
              disabled={mobile.isJoined}
              className={`font-medium text-gray-900 px-2 py-1 rounded border ${
                mobile.isJoined ? 'bg-gray-100 cursor-not-allowed' : 'border-gray-300'
              }`}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">User ID:</span>
            <span className="font-mono text-gray-900">{mobile.userId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Plane ID:</span>
            <span className="font-mono text-gray-900">{mobile.planeId}</span>
          </div>
          {mobile.authToken && (
            <div className="flex justify-between">
              <span className="text-gray-600">Auth Token:</span>
              <span
                className="font-mono text-xs text-gray-700">{mobile.authToken.substring(0, 12)}...</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleJoinMatch(mobileNum)}
            disabled={mobile.isJoined}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
              mobile.isJoined
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <LogIn className="w-5 h-5"/>
            {mobile.isJoined ? 'Already Joined' : 'Join Match'}
          </button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    // Cleanup WebSockets on unmount
    return () => {
      Object.values(wsRefs.current).forEach((ws) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.close();
          } catch {
            // ignore
          }
        }
      });
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Aeroduel Mobile Simulator</h1>
          <p className="text-gray-600">Test mobile app endpoints with simulated users</p>
          <p className="text-sm text-gray-500 mt-2">Server: {serverUrl}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <MobileControl mobileNum={1} mobile={mobile1} setMobile={setMobile1}/>
          <MobileControl mobileNum={2} mobile={mobile2} setMobile={setMobile2}/>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200 mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Debug Tools</h3>
          <div className="flex gap-4">
            <button
              onClick={fetchMatchState}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              <Trophy className="w-5 h-5"/>
              View Match State
            </button>
            <button
              onClick={fetchPlanes}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
            >
              <Users className="w-5 h-5"/>
              View Planes & Scores
            </button>
          </div>
        </div>

        {showDebug && debugData && (
          <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-indigo-200 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">{debugData.type}</h3>
              <button
                onClick={() => setShowDebug(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm">
              {JSON.stringify(debugData.data, null, 2)}
            </pre>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Activity Log</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No activity yet. Try joining a
                match!</p>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    log.type === 'success'
                      ? 'bg-green-50 border border-green-200'
                      : log.type === 'error'
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-blue-50 border border-blue-200'
                  }`}
                >
                  {log.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-gray-700">{log.mobile}</span>
                      <span className="text-xs text-gray-500">{log.timestamp}</span>
                    </div>
                    <p className="text-sm text-gray-800">{log.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileSimulator;
