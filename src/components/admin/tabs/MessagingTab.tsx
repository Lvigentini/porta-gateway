import React, { useEffect, useMemo, useState } from 'react';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  text_content: string;
  variables?: string[];
}

interface TemplatesResponse {
  templates: EmailTemplate[];
}

const getAdminToken = () => {
  // Align with AdminDashboard storage keys
  return (
    localStorage.getItem('porta_admin_token') ||
    localStorage.getItem('admin_token') ||
    localStorage.getItem('token') ||
    ''
  );
};

const jsonPretty = (obj: any) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return '';
  }
};

const MessagingTab: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [variablesJson, setVariablesJson] = useState<string>('{}');
  const [variablesError, setVariablesError] = useState<string>('');
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const loadTemplates = async () => {
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/messaging?action=templates', {
        headers: {
          'Authorization': `Bearer ${getAdminToken()}`,
        },
      });
      if (!res.ok) throw new Error(`Failed to load templates (${res.status})`);
      const data: TemplatesResponse = await res.json();
      setTemplates(data.templates || []);
      // Initialize selection if empty
      if (!selectedTemplateId && data.templates?.length) {
        const first = data.templates[0];
        setSelectedTemplateId(first.id);
        setSubject(first.subject || '');
        setHtmlContent(first.html_content || '');
        setTextContent(first.text_content || '');
        // Try to infer variables from template variables field if available
        if ((first as any).variables) {
          const example: Record<string, any> = {};
          (first as any).variables.forEach((k: string) => (example[k] = `{{${k}}}`));
          setVariablesJson(jsonPretty(example));
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Error loading templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      setSubject(selectedTemplate.subject || '');
      setHtmlContent(selectedTemplate.html_content || '');
      setTextContent(selectedTemplate.text_content || '');
    }
    // Keep variablesJson as-is, users may edit freely
  }, [selectedTemplateId]);

  const parseVariables = (): Record<string, any> => {
    try {
      const parsed = JSON.parse(variablesJson || '{}');
      if (parsed && typeof parsed === 'object') return parsed;
      return {};
    } catch {
      return {};
    }
  };

  const validateVariablesJson = (val: string) => {
    try {
      const parsed = JSON.parse(val || '{}');
      if (parsed && typeof parsed === 'object') {
        setVariablesError('');
        return true;
      }
      setVariablesError('Variables must be a JSON object');
      return false;
    } catch (e: any) {
      setVariablesError(e?.message || 'Invalid JSON');
      return false;
    }
  };

  const testSendgridConnection = async () => {
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/messaging?action=test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Test failed (${res.status})`);
      setMessage('SendGrid connection OK');
    } catch (e: any) {
      setError(e?.message || 'SendGrid test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestEmail = async () => {
    if (!selectedTemplate) {
      setError('Select a template first');
      return;
    }
    if (!testEmail) {
      setError('Enter a recipient email');
      return;
    }
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/admin/messaging?action=send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAdminToken()}`,
        },
        body: JSON.stringify({
          to: testEmail,
          templateId: selectedTemplate.id,
          subject,
          html: htmlContent,
          text: textContent,
          variables: parseVariables(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Send failed (${res.status})`);
      setMessage('Test email sent');
    } catch (e: any) {
      setError(e?.message || 'Failed to send test email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#1f2937' }}>Email Templates &amp; SendGrid</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={testSendgridConnection} disabled={isLoading}
            style={{ backgroundColor: '#6b7280', color: 'white', padding: '0.5rem 0.75rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            Test Connection
          </button>
          <button onClick={loadTemplates} disabled={isLoading}
            style={{ backgroundColor: '#e5e7eb', color: '#111827', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db', cursor: 'pointer', fontWeight: 600 }}>
            Reload Templates
          </button>
        </div>
      </div>

      {(error || message) && (
        <div style={{ marginBottom: '1rem' }}>
          {error && (
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #fecaca' }}>{error}</div>
          )}
          {message && (
            <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #bbf7d0', marginTop: '0.5rem' }}>{message}</div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Template</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem', width: '100%' }}
          >
            <option value="">Choose a template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Test Recipient</label>
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="name@example.com"
            style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem', width: '100%' }}
          />
        </div>
      </div>

      <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem', width: '100%' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Variables (JSON)</label>
          <textarea
            value={variablesJson}
            onChange={(e) => {
              const val = e.target.value;
              setVariablesJson(val);
              validateVariablesJson(val);
            }}
            rows={6}
            spellCheck={false}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: '0.875rem' }}
          />
          {variablesError && (
            <div style={{ marginTop: '0.5rem', color: '#b91c1c', fontSize: '0.8125rem' }}>{variablesError}</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>HTML Content</label>
          <textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            rows={10}
            spellCheck={false}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: '0.875rem' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Text Content</label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={10}
            spellCheck={false}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: '0.875rem' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button onClick={sendTestEmail} disabled={isLoading || !testEmail || !selectedTemplateId || !!variablesError}
          style={{ backgroundColor: '#10b981', color: 'white', padding: '0.5rem 0.75rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          {isLoading ? 'Sending...' : 'Send Test Email'}
        </button>
      </div>
    </div>
  );
};

export default MessagingTab;
