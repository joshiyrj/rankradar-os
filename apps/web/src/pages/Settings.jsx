import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Settings() {
  const [status, setStatus] = useState(null);
  const [connection, setConnection] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.status().then(setStatus).catch((err) => setError(err.message));
  }, []);

  async function test() {
    setError('');
    try {
      setConnection(await api.testConnection());
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel settings-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Secure integration</span>
          <h2>DataDive API Settings</h2>
        </div>
        <p>Keys stay server-side. The React app only sees safe connection status.</p>
      </div>
      {status && <div className="settings-grid">
        <div><span>Provider</span><b>{status.provider}</b></div>
        <div><span>API Key</span><b>{status.apiKeyConfigured ? 'Configured' : 'Missing'}</b></div>
        <div><span>Base URL</span><b>{status.baseUrlConfigured ? 'Configured' : 'Missing'}</b></div>
        <div><span>Org ID</span><b>{status.orgConfigured ? 'Configured' : 'Optional / Missing'}</b></div>
      </div>}
      <button className="primary-btn" onClick={test}>Test DataDive Connection</button>
      {connection && <pre className="code-box">{JSON.stringify(connection, null, 2)}</pre>}
      {error && <div className="error-box">{error}</div>}
    </section>
  );
}
