import { useEffect, useState } from 'react';
import { CheckCircle, RefreshCcw, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/api.js';

function ConfigRow({ label, configured, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className="text-xs text-muted-foreground">{value}</span>}
        {configured ? (
          <CheckCircle className="w-4 h-4 text-green-400" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400" />
        )}
        <Badge variant={configured ? 'positive' : 'critical'} className="text-xs">
          {configured ? 'Configured' : 'Missing'}
        </Badge>
      </div>
    </div>
  );
}

export default function Settings() {
  const [status, setStatus] = useState(null);
  const [syncRuns, setSyncRuns] = useState([]);
  const [connection, setConnection] = useState(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    Promise.all([
      api.status(),
      api.syncRuns().catch(() => []),
    ]).then(([s, runs]) => {
      setStatus(s);
      setSyncRuns(runs);
    }).catch((err) => setError(err.message))
      .finally(() => setLoadingStatus(false));
  }, []);

  async function test() {
    setTesting(true);
    setError('');
    setConnection(null);
    try {
      setConnection(await api.testConnection());
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* DataDive API status */}
      <Card>
        <CardHeader>
          <CardTitle>DataDive API Configuration</CardTitle>
          <CardDescription>Keys are stored server-side only. The UI only sees connection status.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStatus ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : status ? (
            <div>
              <ConfigRow label="Provider" configured={true} value={status.provider} />
              <ConfigRow label="API Key" configured={status.apiKeyConfigured} />
              <ConfigRow label="Base URL" configured={status.baseUrlConfigured} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load status.</p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={test} disabled={testing} variant="outline" size="sm">
              <RefreshCcw className={`w-3.5 h-3.5 mr-2 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testing…' : 'Test Connection'}
            </Button>
            {connection && (
              <span className="text-sm text-green-400 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Connected
              </span>
            )}
          </div>

          {connection && (
            <pre className="mt-3 p-3 rounded bg-muted text-xs overflow-x-auto text-foreground">
              {JSON.stringify(connection, null, 2)}
            </pre>
          )}
          {error && (
            <div className="mt-3 p-3 rounded border border-destructive bg-destructive/10 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync history */}
      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
          <CardDescription>Last 25 DataDive sync runs</CardDescription>
        </CardHeader>
        <CardContent>
          {syncRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No sync runs yet. Click Sync in the top bar.</p>
          ) : (
            <div className="space-y-1">
              {syncRuns.slice(0, 25).map((run) => (
                <div key={run.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={run.status === 'success' ? 'positive' : 'critical'} className="text-xs capitalize">
                      {run.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    {run.records_processed != null && <span>{run.records_processed} records</span>}
                    {run.error_message && (
                      <span className="text-red-400 ml-2 max-w-[200px] truncate block">{run.error_message}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Environment variable reference */}
      <Card>
        <CardHeader>
          <CardTitle>Required Environment Variables</CardTitle>
          <CardDescription>Configure these in your deployment environment or .env file.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="p-3 rounded bg-muted text-xs text-foreground overflow-x-auto">{`DATADIVE_API_KEY=your_api_key_here
DATADIVE_API_BASE_URL=https://api.datadive.tools
DATADIVE_PROVIDER=live
DATADIVE_SYNC_INTERVAL_MINUTES=60
MONGODB_URI=mongodb://...   (for live mode)
MONGODB_DB=rankradar-os`}</pre>
          <p className="text-xs text-muted-foreground mt-2">
            Optional future Slack vars: SLACK_WEBHOOK_URL, SLACK_ALERTS_ENABLED, SLACK_DRY_RUN
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
